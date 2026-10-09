import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Layers, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RotateCw, 
  ChevronDown, 
  ChevronUp, 
  Paperclip,
  ArrowRight,
  AlertTriangle,
  Send,
  Sparkles
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, timeAgo } from '../lib/utils';
import { detectRecipientTimezone, formatInTimezone, getTimeDifference } from '../lib/timezone';
import { toast } from 'sonner';

export function Batches({ initialBatchId }) {
  const queryClient = useQueryClient();
  const [expandedBatchId, setExpandedBatchId] = useState(initialBatchId || null);

  useEffect(() => {
    if (initialBatchId) {
      setExpandedBatchId(initialBatchId);
    }
  }, [initialBatchId]);

  // Fetch all batches (auto-refreshes every 4s while batches exist)
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['batches'],
    queryFn: api.getBatches,
    refetchInterval: (query) => {
      const hasActive = query.state.data?.batches?.some((b) => b.status === 'sending' || b.status === 'queued');
      return hasActive ? 3000 : 15000;
    }
  });

  // Fetch expanded batch details (emails)
  const { data: batchDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['batchDetail', expandedBatchId],
    queryFn: () => api.getBatchDetail(expandedBatchId),
    enabled: !!expandedBatchId,
    refetchInterval: (query) => {
      return query.state.data?.status === 'sending' ? 3000 : false;
    }
  });

  const [resendingEmailId, setResendingEmailId] = useState(null);

  // Retry / Resume batch emails
  const retryMutation = useMutation({
    mutationFn: (batchId) => api.retryBatch(batchId),
    onSuccess: (res) => {
      toast.success(res.message || 'Resuming dispatch for remaining emails...');
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['batchDetail', expandedBatchId] });
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to retry batch');
    }
  });

  // Resend / Send single email
  const resendSingleMutation = useMutation({
    mutationFn: (emailId) => {
      setResendingEmailId(emailId);
      return api.resendEmail(emailId);
    },
    onSuccess: (res) => {
      toast.success(res.message || 'Email dispatched successfully!');
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['batchDetail', expandedBatchId] });
      queryClient.invalidateQueries({ queryKey: ['history'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      setResendingEmailId(null);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to send email');
      setResendingEmailId(null);
    }
  });

  const batches = data?.batches || [];

  const toggleExpand = (id) => {
    setExpandedBatchId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Campaign Batches & Deliverability
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time multi-recipient progress tracking, live duplicate skip audit, and batch retry recovery.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors self-start sm:self-auto"
        >
          <RotateCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Batches List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : batches.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <Layers className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No Batches Yet</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
            When you dispatch bulk campaigns from Compose, their live progress and outcome summaries will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {batches.map((batch) => {
            const isExpanded = expandedBatchId === batch.id;
            const progress = batch.total > 0 
              ? Math.round(((batch.sent_count + batch.failed_count) / batch.total) * 100) 
              : 0;

            const skippedDuplicates = batch.skipped_count || 0;
            const queuedCount = batch.queued_count !== undefined 
              ? batch.queued_count 
              : Math.max(0, batch.total - batch.sent_count - batch.failed_count);
            const pendingCount = queuedCount + (batch.failed_count || 0);

            return (
              <div
                key={batch.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border shadow-subtle overflow-hidden transition-all ${
                  isExpanded 
                    ? 'border-indigo-400/80 dark:border-indigo-500/80 ring-2 ring-indigo-500/10' 
                    : 'border-slate-200/80 dark:border-slate-800'
                }`}
              >
                {/* Batch Header Bar */}
                <div 
                  onClick={() => toggleExpand(batch.id)}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                      <Layers className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {batch.subject || '(Untitled Batch)'}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          batch.status === 'completed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
                          batch.status === 'failed' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300' :
                          batch.status === 'sending' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 animate-pulse' :
                          'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {batch.status}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {batch.mode === 'individual' ? 'Individual sends' : 'Single email'}
                        </span>
                      </div>

                      {/* Summary text: "Sent 13, Queued 16, Failed 0" */}
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1">
                        <span className="text-emerald-600 dark:text-emerald-400">Sent {batch.sent_count}</span>
                        {queuedCount > 0 && (
                          <span className="text-amber-600 dark:text-amber-400">, Queued {queuedCount}</span>
                        )}
                        {batch.failed_count > 0 && (
                          <span className="text-rose-600 dark:text-rose-400">, Failed {batch.failed_count}</span>
                        )}
                        {skippedDuplicates > 0 && (
                          <span className="text-purple-600 dark:text-purple-400">, Skipped {skippedDuplicates} duplicates</span>
                        )}
                        <span className="text-slate-400 font-normal"> · Created {timeAgo(batch.created_at)}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right summary counters, action & progress */}
                  <div className="flex items-center gap-4 sm:gap-6 self-end md:self-auto shrink-0">
                    {pendingCount > 0 && batch.status !== 'sending' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          retryMutation.mutate(batch.id);
                        }}
                        disabled={retryMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
                        title="Resume sending remaining queued or failed emails in this batch"
                      >
                        <RotateCw className={`h-3.5 w-3.5 ${retryMutation.isPending ? 'animate-spin' : ''}`} />
                        <span>Resume ({pendingCount})</span>
                      </button>
                    )}

                    <div className="w-28 text-right">
                      <div className="flex justify-between text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                        <span>{progress}%</span>
                        <span>{batch.sent_count}/{batch.total}</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Emails List & Actions */}
                {isExpanded && (
                  <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          Emails in this Batch ({batch.total})
                        </h4>
                        {skippedDuplicates > 0 && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            {skippedDuplicates} duplicates filtered out
                          </span>
                        )}
                      </div>

                      {pendingCount > 0 && (
                        <button
                          onClick={() => retryMutation.mutate(batch.id)}
                          disabled={retryMutation.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
                        >
                          <RotateCw className={`h-3.5 w-3.5 ${retryMutation.isPending ? 'animate-spin' : ''}`} />
                          <span>Resume Sending ({pendingCount} remaining)</span>
                        </button>
                      )}
                    </div>

                    {isLoadingDetail ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        Loading email records...
                      </div>
                    ) : !batchDetail?.emails || batchDetail.emails.length === 0 ? (
                      <div className="py-4 text-center text-xs text-slate-400">
                        No email records found for this batch.
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 text-[10px] font-semibold text-slate-500 uppercase">
                            <tr>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3">Recipient</th>
                              <th className="py-2.5 px-3">Subject</th>
                              <th className="py-2.5 px-3">Attempts</th>
                              <th className="py-2.5 px-3">Error / Note</th>
                              <th className="py-2.5 px-3">Gmail ID</th>
                              <th className="py-2.5 px-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {batchDetail.emails.map((email) => (
                              <tr key={email.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="py-2.5 px-3">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    email.status === 'sent' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
                                    email.status === 'failed' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300' :
                                    'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                  }`}>
                                    {email.status}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
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
                                <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                                  {email.subject}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500 font-mono">
                                  {email.attempts}
                                </td>
                                <td className="py-2.5 px-3 text-rose-600 dark:text-rose-400 truncate max-w-xs text-[11px]">
                                  {email.error_message || '—'}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                                  {email.gmail_message_id ? (
                                    <div>
                                      <a
                                        href={`https://mail.google.com/mail/u/0/#sent/${email.gmail_message_id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-indigo-600 dark:text-indigo-400 hover:underline"
                                      >
                                        {email.gmail_message_id.slice(0, 10)}...
                                      </a>
                                      {email.sent_at && (() => {
                                        const tz = detectRecipientTimezone(email.to_address);
                                        const recTime = formatInTimezone(email.sent_at, tz.timeZone, { hour: 'numeric', minute: '2-digit', hour12: true });
                                        return (
                                          <div className="text-[10px] text-slate-400 font-sans mt-0.5" title={`Recipient time: ${recTime} (${tz.country})`}>
                                            {tz.flag} {recTime}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  ) : '—'}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {email.status === 'sent' ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      <span>Sent</span>
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => resendSingleMutation.mutate(email.id)}
                                      disabled={resendSingleMutation.isPending && resendingEmailId === email.id}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 text-[11px] font-medium transition-colors shadow-2xs"
                                      title="Send or retry this recipient immediately"
                                    >
                                      <Send className={`h-3 w-3 ${resendSingleMutation.isPending && resendingEmailId === email.id ? 'animate-spin' : ''}`} />
                                      <span>
                                        {resendSingleMutation.isPending && resendingEmailId === email.id
                                          ? 'Sending...'
                                          : email.status === 'failed'
                                          ? 'Retry'
                                          : 'Send Now'}
                                      </span>
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
