import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Inbox, 
  Mail, 
  RotateCw, 
  Search, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Globe, 
  User, 
  Calendar, 
  ChevronRight, 
  MessageSquareReply, 
  MailCheck, 
  MailOpen,
  Filter,
  Sparkles,
  ArrowUpRight,
  Send
} from 'lucide-react';
import { api } from '../lib/api';
import { cn, formatDate } from '../lib/utils';
import { getRecipientCountryInfo, formatInTimezone, getTimeDifference } from '../lib/timezone';
import { sanitizeHtml } from '../lib/sanitize';
import { toast } from 'sonner';

export function getReplyCategory(subject = '') {
  const sub = (subject || '').toLowerCase();
  if (sub.includes('automatic reply') || sub.includes('auto:') || sub.includes('out of office')) {
    return {
      type: 'auto',
      label: 'Auto-Reply (OOO)',
      icon: '🤖',
      badgeClass: 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/80'
    };
  }
  if (sub.includes('undeliverable') || sub.includes('delivery status') || sub.includes('failure')) {
    return {
      type: 'bounce',
      label: 'Undelivered',
      icon: '⚠️',
      badgeClass: 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/80'
    };
  }
  return {
    type: 'human',
    label: 'Direct Reply',
    icon: '💬',
    badgeClass: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80'
  };
}

export function Replies() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'unread', 'read'
  const [filterType, setFilterType] = useState('all'); // 'all', 'human', 'auto', 'bounce'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReplyId, setSelectedReplyId] = useState(null);
  const [page, setPage] = useState(1);

  // Fetch replies list
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['replies', filterStatus, filterType, searchTerm, page],
    queryFn: () => api.getReplies({ status: filterStatus, type: filterType, search: searchTerm, page, limit: 50 }),
    refetchInterval: 30000, // Background refresh every 30s
  });

  // Fetch stats for total sent to calculate reply rate
  const { data: dashboardStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.getDashboardStats(),
  });

  // Fetch selected reply detail
  const { data: selectedReply, isLoading: isDetailLoading } = useQuery({
    queryKey: ['reply-detail', selectedReplyId],
    queryFn: () => api.getReplyDetail(selectedReplyId),
    enabled: !!selectedReplyId,
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: () => api.syncReplies(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['replies'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['history'] });
      if (result.newReplies > 0) {
        toast.success(`Discovered ${result.newReplies} new reply!`, {
          description: `Total replies tracked: ${result.totalReplies}`
        });
      } else {
        toast.info('Inbox up to date', {
          description: 'No new replies discovered from recipients.'
        });
      }
    },
    onError: (err) => {
      toast.error('Sync failed: ' + err.message);
    }
  });

  // Toggle read/unread mutation
  const toggleReadMutation = useMutation({
    mutationFn: ({ id, isRead }) => api.toggleReplyRead(id, isRead),
    onSuccess: (res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['replies'] });
      queryClient.invalidateQueries({ queryKey: ['reply-detail', vars.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(vars.isRead ? 'Marked as read' : 'Marked as unread');
    },
    onError: (err) => {
      toast.error('Failed to update status: ' + err.message);
    }
  });

  const replies = data?.replies || [];
  const unreadCount = data?.unreadCount || 0;
  const totalOverall = data?.totalOverall || 0;
  const totalSent = (dashboardStats?.today || 0) + (dashboardStats?.week || 0) + 1; // estimate
  const replyRate = totalOverall > 0 ? ((totalOverall / Math.max(1, (dashboardStats?.successRate ? (totalOverall * 3) : 10))) * 100).toFixed(1) : 0;

  // Auto-select first reply if none selected
  useEffect(() => {
    if (replies.length > 0 && !selectedReplyId) {
      setSelectedReplyId(replies[0].id);
    }
  }, [replies, selectedReplyId]);

  const handleSelectReply = (reply) => {
    setSelectedReplyId(reply.id);
    // If reply is unread, automatically mark as read
    if (reply.is_read === 0) {
      toggleReadMutation.mutate({ id: reply.id, isRead: true });
    }
  };

  const selectedCountry = selectedReply ? getRecipientCountryInfo(selectedReply.from_address) : null;
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header & Stats Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <MessageSquareReply className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Replies Portal
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Inbound responses received from recipients across all dispatched campaigns
              </p>
            </div>
          </div>
        </div>

        {/* Sync Action */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || isFetching}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm",
              "bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 disabled:opacity-50"
            )}
          >
            <RotateCw className={cn("h-4 w-4", (syncMutation.isPending || isFetching) && "animate-spin")} />
            <span>{syncMutation.isPending ? 'Syncing Gmail...' : 'Sync Inbox'}</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Inbound Replies
            </span>
            <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Inbox className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">{totalOverall}</span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">live tracked</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Unread Responses
            </span>
            <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Mail className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">{unreadCount}</span>
            {unreadCount > 0 ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-semibold animate-pulse">
                Needs attention
              </span>
            ) : (
              <span className="text-xs text-slate-400 font-medium">All caught up</span>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Active Threads
            </span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">{replies.length}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">campaign conversations</span>
          </div>
        </div>
      </div>

      {/* Main Content Area: Split 2-panel master-detail */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {/* Filters and Search Bar */}
        <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-col gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-800 rounded-xl w-full sm:w-auto">
              <button
                onClick={() => { setFilterStatus('all'); setPage(1); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  filterStatus === 'all'
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                All Replies ({totalOverall})
              </button>
              <button
                onClick={() => { setFilterStatus('unread'); setPage(1); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
                  filterStatus === 'unread'
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <span>Unread</span>
                {unreadCount > 0 && (
                  <span className="h-4 px-1.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setFilterStatus('read'); setPage(1); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                  filterStatus === 'read'
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                Read
              </button>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search sender, subject, text..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-xs">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Type:</span>
            <button
              onClick={() => { setFilterType('all'); setPage(1); }}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                filterType === 'all'
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              )}
            >
              All Types
            </button>
            <button
              onClick={() => { setFilterType('human'); setPage(1); }}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border",
                filterType === 'human'
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100"
              )}
            >
              <span>💬</span>
              <span>Direct Customer Replies</span>
            </button>
            <button
              onClick={() => { setFilterType('auto'); setPage(1); }}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border",
                filterType === 'auto'
                  ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                  : "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60 hover:bg-purple-100"
              )}
            >
              <span>🤖</span>
              <span>Auto-Replies (OOO)</span>
            </button>
            <button
              onClick={() => { setFilterType('bounce'); setPage(1); }}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border",
                filterType === 'bounce'
                  ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                  : "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60 hover:bg-rose-100"
              )}
            >
              <span>⚠️</span>
              <span>Undelivered / Bounces</span>
            </button>
          </div>
        </div>

        {/* 2-Column Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
          {/* Left Column: Replies List */}
          <div className="lg:col-span-5 border-r border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[700px]">
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
              {isLoading ? (
                <div className="p-8 text-center text-slate-500 space-y-3">
                  <RotateCw className="h-6 w-6 animate-spin mx-auto text-indigo-500" />
                  <p className="text-xs">Loading replies...</p>
                </div>
              ) : replies.length === 0 ? (
                <div className="p-12 text-center text-slate-500 space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                    <Inbox className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No replies found</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchTerm ? 'Try adjusting your search criteria.' : 'No replies match this filter yet.'}
                    </p>
                  </div>
                  <button
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    <span>Check Inbox Now</span>
                  </button>
                </div>
              ) : (
                replies.map((reply) => {
                  const isSelected = selectedReplyId === reply.id;
                  const isUnread = reply.is_read === 0;
                  const category = getReplyCategory(reply.subject);
                  const country = getRecipientCountryInfo(reply.from_address);
                  const recipientTime = formatInTimezone(reply.received_at, country.timeZone, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  });
                  const userTime = formatDate(reply.received_at);

                  return (
                    <div
                      key={reply.id}
                      onClick={() => handleSelectReply(reply)}
                      className={cn(
                        "p-4 cursor-pointer transition-all duration-150 relative group",
                        isSelected
                          ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-l-4 border-l-indigo-600 dark:border-l-indigo-500"
                          : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40 border-l-4 border-l-transparent",
                        isUnread && !isSelected && "bg-slate-50/40 dark:bg-slate-800/20"
                      )}
                    >
                      {/* Top row: Sender, Category Badge & Country Flag */}
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          {isUnread && (
                            <span className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400 shrink-0" title="Unread" />
                          )}
                          <span className={cn(
                            "text-xs truncate",
                            isUnread ? "font-bold text-slate-900 dark:text-white" : "font-medium text-slate-800 dark:text-slate-200"
                          )}>
                            {reply.from_name || reply.from_address}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Category Badge */}
                          <span className={cn(
                            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border",
                            category.badgeClass
                          )}>
                            <span>{category.icon}</span>
                            <span className="hidden sm:inline">{category.label}</span>
                          </span>

                          {/* Country Flag Badge */}
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            <span>{country.flag}</span>
                            <span className="hidden md:inline truncate max-w-[65px]">{country.country}</span>
                          </span>
                        </div>
                      </div>

                      {/* Subject */}
                      <h4 className={cn(
                        "text-xs truncate mb-1",
                        isUnread ? "font-semibold text-slate-900 dark:text-slate-100" : "text-slate-700 dark:text-slate-300"
                      )}>
                        {reply.subject}
                      </h4>

                      {/* Snippet */}
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-2 leading-relaxed">
                        {reply.snippet || '(Empty body)'}
                      </p>

                      {/* Dual Timestamps in card footer */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100/60 dark:border-slate-800/40">
                        <div className="flex items-center gap-1" title={`Your time: ${userTime}`}>
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span>{userTime}</span>
                        </div>
                        <div className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300" title={`Recipient Country Time: ${recipientTime}`}>
                          <span>{country.flag}</span>
                          <span>{recipientTime}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Full Conversation Reader */}
          <div className="lg:col-span-7 flex flex-col bg-white dark:bg-slate-900 overflow-y-auto max-h-[700px]">
            {isDetailLoading ? (
              <div className="flex-1 flex items-center justify-center p-12 text-slate-500">
                <RotateCw className="h-6 w-6 animate-spin text-indigo-500" />
              </div>
            ) : selectedReply ? (
              <div className="p-6 space-y-6 flex-1">
                {/* Header Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {(() => {
                        const selCat = getReplyCategory(selectedReply.subject);
                        return (
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold border",
                            selCat.badgeClass
                          )}>
                            <span>{selCat.icon}</span>
                            <span>{selCat.label}</span>
                          </span>
                        );
                      })()}
                      <h2 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                        {selectedReply.subject}
                      </h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {selectedReply.from_name || selectedReply.from_address}
                      </span>
                      <span>&lt;{selectedReply.from_address}&gt;</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Read/Unread Toggle */}
                    <button
                      onClick={() => toggleReadMutation.mutate({
                        id: selectedReply.id,
                        isRead: selectedReply.is_read === 0
                      })}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                        selectedReply.is_read === 1
                          ? "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          : "border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400"
                      )}
                    >
                      {selectedReply.is_read === 1 ? (
                        <>
                          <MailOpen className="h-3.5 w-3.5" />
                          <span>Mark Unread</span>
                        </>
                      ) : (
                        <>
                          <MailCheck className="h-3.5 w-3.5" />
                          <span>Mark Read</span>
                        </>
                      )}
                    </button>

                    {/* Direct Deep Link into Gmail Web */}
                    <a
                      href={`https://mail.google.com/mail/u/0/#inbox/${selectedReply.thread_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors shadow-xs"
                      title="Open full conversation thread in Gmail"
                    >
                      <span>Open in Gmail</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                {/* Dual Timings Banner Card */}
                {selectedCountry && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                        {selectedCountry.flag}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {selectedCountry.country} ({selectedCountry.label})
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {getTimeDifference(selectedReply.received_at, selectedCountry.timeZone).text}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">Your Time</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {formatDate(selectedReply.received_at)}
                        </span>
                      </div>
                      <div className="border-l border-slate-200 dark:border-slate-700 pl-4">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block">Recipient Local Time</span>
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          {formatInTimezone(selectedReply.received_at, selectedCountry.timeZone)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Email Body Content */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Response Message
                    </span>
                    <span className="text-[11px] text-slate-400">
                      From: {selectedReply.from_address}
                    </span>
                  </div>

                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-200 leading-relaxed overflow-x-auto shadow-xs">
                    {selectedReply.body_html ? (
                      <div 
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedReply.body_html) }} 
                        className="prose prose-sm dark:prose-invert max-w-none break-words"
                      />
                    ) : selectedReply.body_text ? (
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed break-words">
                        {selectedReply.body_text}
                      </pre>
                    ) : (
                      <p className="text-slate-400 italic">{selectedReply.snippet || 'No message content available.'}</p>
                    )}
                  </div>
                </div>

                {/* Original Dispatched Campaign Email Context */}
                {selectedReply.original_subject && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                      <Send className="h-3.5 w-3.5 text-indigo-500" />
                      <span>Original Email Dispatched to this Recipient</span>
                    </div>

                    <div className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      Subject: "{selectedReply.original_subject}"
                    </div>

                    {selectedReply.original_sent_at && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Sent on: {formatDate(selectedReply.original_sent_at)}
                      </div>
                    )}

                    {selectedReply.original_body_html && (
                      <details className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                        <summary className="cursor-pointer font-medium hover:text-indigo-600 dark:hover:text-indigo-400 select-none">
                          View original message content
                        </summary>
                        <div 
                          dangerouslySetInnerHTML={{ __html: selectedReply.original_body_html }}
                          className="mt-2 p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[12px] max-h-48 overflow-y-auto"
                        />
                      </details>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400 space-y-3">
                <div className="h-14 w-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                  <Mail className="h-7 w-7" />
                </div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No Reply Selected
                </h3>
                <p className="text-xs text-slate-500 max-w-xs">
                  Choose a response from the left panel to inspect the full reply, dual timezone timing, and original dispatched campaign message.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
