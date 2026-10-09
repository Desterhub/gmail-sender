import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Search, 
  Filter, 
  Download, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Paperclip, 
  ExternalLink, 
  RefreshCw, 
  X, 
  ChevronRight, 
  FileText,
  RotateCw,
  Layers,
  Globe,
  MessageSquareReply
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, timeAgo, formatBytes } from '../lib/utils';
import { detectRecipientTimezone, formatInTimezone, getTimeDifference, POPULAR_TIMEZONES } from '../lib/timezone';
import { toast } from 'sonner';

export function History() {
  const queryClient = useQueryClient();

  // Filters & State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [groupByBatch, setGroupByBatch] = useState(false);

  // Selected email for Detail Drawer
  const [selectedEmailId, setSelectedEmailId] = useState(null);
  const [customRecipientTz, setCustomRecipientTz] = useState(null);

  // Fetch paginated history
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['history', search, statusFilter, startDate, endDate, page],
    queryFn: () => api.getHistory({ search, status: statusFilter, startDate, endDate, page, limit: 20 }),
    keepPreviousData: true
  });

  // Fetch single email detail for drawer
  const { data: emailDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['emailDetail', selectedEmailId],
    queryFn: () => api.getHistoryDetail(selectedEmailId),
    enabled: !!selectedEmailId
  });

  // Resend single email mutation
  const resendMutation = useMutation({
    mutationFn: (id) => api.resendEmail(id),
    onSuccess: () => {
      toast.success('Email resent successfully!');
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: ['emailDetail', selectedEmailId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to resend email');
    }
  });

  // Group emails by batch_id if toggled
  const emails = data?.emails || [];
  const groupedBatches = React.useMemo(() => {
    if (!groupByBatch) return null;
    const groups = {};
    for (const email of emails) {
      const bId = email.batch_id || 'unassigned';
      if (!groups[bId]) {
        groups[bId] = [];
      }
      groups[bId].push(email);
    }
    return groups;
  }, [emails, groupByBatch]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Send History & Audit
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Detailed log of all individual deliveries, status outcomes, and Gmail message identifiers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Group by batch toggle */}
          <button
            onClick={() => setGroupByBatch(!groupByBatch)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
              groupByBatch
                ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400'
                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Group by Batch</span>
          </button>

          {/* Export CSV */}
          <a
            href={`/api/export/csv?search=${encodeURIComponent(search)}&status=${statusFilter}&startDate=${startDate}&endDate=${endDate}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </a>

          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RotateCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-subtle grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Search by email address or subject */}
        <div className="relative sm:col-span-2">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search past sends by email address or subject..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="sent">Sent (Delivered)</option>
            <option value="failed">Failed</option>
            <option value="queued">Queued</option>
          </select>
        </div>

        {/* Start Date */}
        <div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* End Date */}
        <div>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-subtle overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div className="py-16 text-center">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <Clock className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No email records found</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              {search || statusFilter !== 'all'
                ? 'Try broadening your search or resetting active filters.'
                : 'No emails have been recorded yet. Head over to Compose to send your first batch.'}
            </p>
          </div>
        ) : groupByBatch && groupedBatches ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {Object.entries(groupedBatches).map(([batchId, batchEmails]) => (
              <div key={batchId} className="p-4 space-y-3">
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 px-3 py-2 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-indigo-500" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Batch #{batchId.slice(0, 8)}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      ({batchEmails.length} emails)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {formatDate(batchEmails[0]?.sent_at)}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <tbody>
                      {batchEmails.map((email) => renderEmailRow(email, setSelectedEmailId, resendMutation))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Recipient</th>
                  <th className="py-3.5 px-4">Subject</th>
                  <th className="py-3.5 px-4">Sent At</th>
                  <th className="py-3.5 px-4">Attachments</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {emails.map((email) => renderEmailRow(email, setSelectedEmailId, resendMutation))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {data?.pagination && data.pagination.totalPages > 1 && (
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {emails.length} of {data.pagination.total} records
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
              >
                Previous
              </button>
              <span className="px-2 font-mono">
                {page} / {data.pagination.totalPages}
              </span>
              <button
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Detail Drawer */}
      {selectedEmailId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Email Send Details</h3>
                <p className="text-[11px] text-slate-400 font-mono">ID: {selectedEmailId}</p>
              </div>
              <button
                onClick={() => setSelectedEmailId(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {isLoadingDetail || !emailDetail ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Status Card & Dual Timestamps */}
                  {(() => {
                    const detected = detectRecipientTimezone(emailDetail.to_address);
                    const activeTz = customRecipientTz || detected.timeZone;
                    const activeInfo = POPULAR_TIMEZONES.find((t) => t.timeZone === activeTz) || detected;
                    const timeDiff = emailDetail.sent_at ? getTimeDifference(emailDetail.sent_at, activeTz) : null;

                    return (
                      <div className={`p-4 rounded-2xl border space-y-3 ${
                        emailDetail.status === 'sent' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' :
                        emailDetail.status === 'failed' ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300' :
                        'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            {emailDetail.status === 'sent' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> :
                             emailDetail.status === 'failed' ? <XCircle className="h-5 w-5 text-rose-500" /> :
                             <Clock className="h-5 w-5 text-amber-500" />}
                            <div>
                              <div className="font-semibold text-xs uppercase tracking-wider">
                                Status: {emailDetail.status}
                              </div>
                              <div className="text-[11px] opacity-80">
                                {emailDetail.sent_at ? `Dispatched ${formatDate(emailDetail.sent_at)}` : 'In Queue'}
                              </div>
                            </div>
                          </div>

                          {emailDetail.status === 'failed' && (
                            <button
                              onClick={() => resendMutation.mutate(emailDetail.id)}
                              disabled={resendMutation.isPending}
                              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-all shadow-xs flex items-center gap-1.5"
                            >
                              <RotateCw className={`h-3.5 w-3.5 ${resendMutation.isPending ? 'animate-spin' : ''}`} />
                              <span>Resend Email</span>
                            </button>
                          )}
                        </div>

                        {/* Dual Timing Section */}
                        {emailDetail.sent_at && (
                          <div className="pt-3 border-t border-emerald-200/60 dark:border-emerald-800/60 space-y-2.5">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-950 dark:text-emerald-200">
                              <span className="flex items-center gap-1.5">
                                <Globe className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Global Delivery Timings</span>
                              </span>
                              {timeDiff && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100/90 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300/40">
                                  {timeDiff.text}
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {/* Sender's Time */}
                              <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-emerald-200/70 dark:border-emerald-900/60 shadow-2xs">
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                  <span>🇮🇳</span>
                                  <span>Your Time (Sender)</span>
                                </div>
                                <div className="font-bold text-slate-900 dark:text-white text-xs mt-1">
                                  {formatDate(emailDetail.sent_at)}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Local ({Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'})
                                </div>
                              </div>

                              {/* Recipient's Time */}
                              <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-emerald-200/70 dark:border-emerald-900/60 shadow-2xs">
                                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                  <span className="flex items-center gap-1.5">
                                    <span>{activeInfo.flag}</span>
                                    <span>Recipient's Time</span>
                                  </span>
                                </div>
                                <div className="font-bold text-slate-900 dark:text-white text-xs mt-1">
                                  {formatInTimezone(emailDetail.sent_at, activeTz)}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                                  {activeInfo.label || activeTz}
                                </div>
                              </div>
                            </div>

                            {/* Timezone Switcher Dropdown */}
                            <div className="flex items-center justify-between text-[11px] pt-1">
                              <span className="text-[10px] text-slate-600 dark:text-slate-400">
                                Recipient Timezone:
                              </span>
                              <select
                                value={activeTz}
                                onChange={(e) => setCustomRecipientTz(e.target.value)}
                                className="text-[11px] py-1 px-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs cursor-pointer focus:outline-hidden"
                              >
                                {POPULAR_TIMEZONES.map((tz) => (
                                  <option key={tz.timeZone} value={tz.timeZone}>
                                    {tz.flag} {tz.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Failure Error Message if any */}
                  {emailDetail.error_message && (
                    <div className="p-3.5 rounded-xl bg-rose-100/70 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 space-y-1">
                      <div className="font-semibold">Failure Diagnostic:</div>
                      <div className="font-mono text-[11px] break-all">{emailDetail.error_message}</div>
                    </div>
                  )}

                  {/* Metadata Fields */}
                  <div className="space-y-2 text-xs border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-950">
                    <div className="flex gap-2">
                      <span className="text-slate-400 font-semibold w-24">To:</span>
                      <span className="text-slate-800 dark:text-slate-200 font-mono select-all">{emailDetail.to_address}</span>
                    </div>
                    {emailDetail.cc && (
                      <div className="flex gap-2">
                        <span className="text-slate-400 font-semibold w-24">CC:</span>
                        <span className="text-slate-800 dark:text-slate-200 font-mono">{emailDetail.cc}</span>
                      </div>
                    )}
                    {emailDetail.bcc && (
                      <div className="flex gap-2">
                        <span className="text-slate-400 font-semibold w-24">BCC:</span>
                        <span className="text-slate-800 dark:text-slate-200 font-mono">{emailDetail.bcc}</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <span className="text-slate-400 font-semibold w-24">Subject:</span>
                      <span className="text-slate-900 dark:text-slate-100 font-semibold">{emailDetail.subject}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-slate-400 font-semibold w-24">Batch ID:</span>
                      <span className="text-slate-600 dark:text-slate-400 font-mono">{emailDetail.batch_id}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-slate-400 font-semibold w-24">Attempts:</span>
                      <span className="text-slate-600 dark:text-slate-400">{emailDetail.attempts}</span>
                    </div>
                    {emailDetail.gmail_message_id && (
                      <div className="flex gap-2 items-center">
                        <span className="text-slate-400 font-semibold w-24">Gmail ID:</span>
                        <a
                          href={`https://mail.google.com/mail/u/0/#sent/${emailDetail.gmail_message_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 dark:text-indigo-400 font-mono hover:underline inline-flex items-center gap-1"
                        >
                          <span>{emailDetail.gmail_message_id}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Inbound Replies Section in Drawer */}
                  {emailDetail.replies && emailDetail.replies.length > 0 && (
                    <div className="space-y-3 p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/60">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageSquareReply className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider">
                            Inbound Replies Received ({emailDetail.replies.length})
                          </h4>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                          Replied
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {emailDetail.replies.map((rep) => (
                          <div
                            key={rep.id}
                            className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/40 text-xs space-y-2 shadow-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {rep.from_name || rep.from_address}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {formatDate(rep.received_at)}
                              </span>
                            </div>

                            <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                              {rep.body_text ? rep.body_text.slice(0, 280) : (rep.snippet || '(No text preview)')}
                            </p>

                            <div className="pt-1 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                              <span className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]">
                                {rep.from_address}
                              </span>
                              <a
                                href={`https://mail.google.com/mail/u/0/#inbox/${rep.thread_id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-600 dark:text-indigo-400 font-medium text-[11px] hover:underline inline-flex items-center gap-1"
                              >
                                <span>Open in Gmail</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Attachments Section */}
                  {emailDetail.attachments && emailDetail.attachments.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Attached Files ({emailDetail.attachments.length})
                      </h4>
                      <div className="space-y-1.5">
                        {emailDetail.attachments.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-xs"
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <Paperclip className="h-4 w-4 text-indigo-500 shrink-0" />
                              <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                {att.filename}
                              </span>
                              <span className="text-slate-400 text-[11px]">
                                ({formatBytes(att.size)})
                              </span>
                            </div>
                            <a
                              href={`/api/attachments/${att.id}/download`}
                              download
                              className="p-1.5 text-indigo-600 hover:text-indigo-700 font-medium text-xs flex items-center gap-1"
                            >
                              <Download className="h-3.5 w-3.5" />
                              <span>Download</span>
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Full Rendered Body Preview */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Rendered Message Body
                    </h4>
                    <div 
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs prose dark:prose-invert max-w-none break-words"
                      dangerouslySetInnerHTML={{ __html: emailDetail.body_html }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to render table row
function renderEmailRow(email, onSelect, resendMutation) {
  const isSent = email.status === 'sent';
  const isFailed = email.status === 'failed';

  return (
    <tr
      key={email.id}
      onClick={() => onSelect(email.id)}
      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
            isSent ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
            isFailed ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' :
            'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
          }`}>
            {isSent ? <CheckCircle2 className="h-3 w-3" /> :
             isFailed ? <XCircle className="h-3 w-3" /> :
             <Clock className="h-3 w-3" />}
            <span>{email.status}</span>
          </span>

          {email.has_reply === 1 && (
            <span 
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 shadow-xs"
              title={`Received ${email.reply_count || 1} reply/replies`}
            >
              <MessageSquareReply className="h-3 w-3" />
              <span>Replied</span>
            </span>
          )}
        </div>
      </td>

      <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100 max-w-[190px] truncate">
        {(() => {
          const tz = detectRecipientTimezone(email.to_address);
          return (
            <div className="flex items-center gap-1.5 min-w-0" title={`${email.to_address} (${tz.country})`}>
              <span className="shrink-0 text-sm select-none">{tz.flag}</span>
              <span className="truncate">{email.to_address}</span>
            </div>
          );
        })()}
      </td>

      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-[220px] truncate">
        {email.subject}
      </td>

      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
        <div className="font-medium text-slate-800 dark:text-slate-200">
          {formatDate(email.sent_at)}
        </div>
        {email.sent_at && (() => {
          const tz = detectRecipientTimezone(email.to_address);
          const recTime = formatInTimezone(email.sent_at, tz.timeZone, { hour: 'numeric', minute: '2-digit', hour12: true });
          const diff = getTimeDifference(email.sent_at, tz.timeZone);
          return (
            <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5" title={`Recipient time: ${recTime} (${diff.text})`}>
              <span>{tz.flag}</span>
              <span>{recTime} ({tz.country.split(' ')[0]})</span>
            </div>
          );
        })()}
      </td>

      <td className="py-3 px-4 text-slate-500">
        {email.attachment_count > 0 ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400">
            <Paperclip className="h-3 w-3 text-indigo-500" />
            <span>{email.attachment_count}</span>
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>

      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
        {isFailed ? (
          <button
            onClick={() => resendMutation.mutate(email.id)}
            disabled={resendMutation.isPending}
            className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 font-semibold text-[11px] transition-colors inline-flex items-center gap-1"
          >
            <RotateCw className="h-3 w-3" />
            <span>Resend</span>
          </button>
        ) : (
          <button
            onClick={() => onSelect(email.id)}
            className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium text-[11px] inline-flex items-center gap-1"
          >
            <span>Details</span>
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </td>
    </tr>
  );
}
