import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Send, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Calendar, 
  TrendingUp, 
  AlertTriangle,
  ArrowRight,
  Mail,
  ShieldCheck,
  RefreshCw,
  MessageSquareReply
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { formatDate, timeAgo } from '../lib/utils';

export function Dashboard({ onNavigate }) {
  const { connected, account } = useAuth();

  const { data: stats, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: api.getDashboardStats,
    refetchInterval: 15000,
  });

  const cards = [
    {
      title: 'Sent Today',
      value: stats?.today ?? 0,
      icon: Send,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      desc: 'Dispatched through your Gmail today'
    },
    {
      title: 'Sent This Week',
      value: stats?.week ?? 0,
      icon: Calendar,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/40',
      desc: 'Past 7 days volume'
    },
    {
      title: 'Sent This Month',
      value: stats?.month ?? 0,
      icon: TrendingUp,
      color: 'text-sky-600 dark:text-sky-400',
      bg: 'bg-sky-50 dark:bg-sky-950/40',
      desc: 'Past 30 days total'
    },
    {
      title: 'Success Rate',
      value: `${stats?.successRate ?? 100}%`,
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      desc: 'Successful deliveries'
    },
    {
      title: 'Inbound Replies',
      value: stats?.replies ?? 0,
      icon: MessageSquareReply,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-50 dark:bg-violet-950/40',
      badge: (stats?.unreadReplies ?? 0) > 0 ? `${stats.unreadReplies} unread` : null,
      desc: 'Responses from recipients',
      onClick: () => onNavigate('replies')
    },
    {
      title: 'Needs Attention',
      value: stats?.failed ?? 0,
      icon: AlertTriangle,
      color: stats?.failed > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500',
      bg: stats?.failed > 0 ? 'bg-rose-50 dark:bg-rose-950/40' : 'bg-slate-50 dark:bg-slate-800/40',
      desc: 'Failed sends to review/retry'
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Dispatch Overview
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Monitor email throughput, live batch deliveries, and delivery performance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh statistics"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => onNavigate('replies')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-all shadow-xs"
          >
            <MessageSquareReply className="h-4 w-4 text-violet-500" />
            <span>Replies</span>
            {(stats?.unreadReplies ?? 0) > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                {stats.unreadReplies}
              </span>
            )}
          </button>

          <button
            onClick={() => onNavigate('compose')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-all shadow-xs hover:shadow-indigo-500/20 active:scale-98"
          >
            <Send className="h-4 w-4" />
            <span>Compose Email</span>
          </button>
        </div>
      </div>

      {/* Connection Notice if Not Connected */}
      {!connected && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200/80 dark:border-amber-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 shrink-0">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Connect your Gmail Account
              </h3>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5 max-w-xl">
                To start dispatching 100+ daily emails natively from your Sent box, authenticate securely with Google OAuth 2.0.
              </p>
            </div>
          </div>
          <a
            href="http://localhost:3000/auth/google"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
          >
            <span>Connect Account</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              onClick={card.onClick}
              className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-subtle flex flex-col justify-between ${
                card.onClick ? 'cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {card.title}
                </span>
                <div className={`p-2 rounded-xl ${card.bg} ${card.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {isLoading ? (
                      <div className="h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse" />
                    ) : (
                      card.value
                    )}
                  </div>
                  {card.badge && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300">
                      {card.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  {card.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-subtle overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Recent Send Activity</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Latest dispatched emails across all batches</p>
          </div>
          <button
            onClick={() => onNavigate('history')}
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1"
          >
            <span>View Full History</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !stats?.recentActivity || stats.recentActivity.length === 0 ? (
          <div className="py-12 text-center">
            <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <Clock className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No emails sent yet</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Your recent dispatches and deliveries will appear here once you send your first batch.
            </p>
            <button
              onClick={() => onNavigate('compose')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Compose First Email</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {stats.recentActivity.map((email) => {
              const isSent = email.status === 'sent';
              const isFailed = email.status === 'failed';

              return (
                <div
                  key={email.id}
                  className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-4">
                    <div className={`p-2 rounded-xl shrink-0 ${
                      isSent ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' :
                      isFailed ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600' :
                      'bg-amber-50 dark:bg-amber-950/40 text-amber-600'
                    }`}>
                      {isSent ? <CheckCircle2 className="h-4 w-4" /> :
                       isFailed ? <XCircle className="h-4 w-4" /> :
                       <Clock className="h-4 w-4" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {email.to_address}
                        </span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${
                          isSent ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' :
                          isFailed ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' :
                          'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}>
                          {email.status}
                        </span>
                        {email.has_reply === 1 && (
                          <span
                            onClick={() => onNavigate('replies')}
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 cursor-pointer hover:bg-indigo-200"
                            title="Click to view reply in Replies portal"
                          >
                            <MessageSquareReply className="h-2.5 w-2.5" />
                            <span>Replied</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {email.subject}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs text-slate-400">
                      {timeAgo(email.sent_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
