import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ShieldCheck, 
  Mail, 
  ExternalLink, 
  Key, 
  Database, 
  Sliders, 
  CheckCircle2, 
  AlertCircle,
  LogOut,
  Lock,
  PenTool,
  Code,
  Eye,
  Save,
  Image as ImageIcon,
  Bold,
  Italic,
  Underline,
  Link2,
  Info,
  UploadCloud,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
  Server,
  EyeOff,
  HelpCircle,
  RefreshCw,
  Check
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { formatDate, cn } from '../lib/utils';
import { toast } from 'sonner';

export function Settings() {
  const { connected, account, disconnect, isDisconnecting } = useAuth();
  const queryClient = useQueryClient();

  // Signature state
  const [signatureMode, setSignatureMode] = useState('rich'); // 'rich' or 'html'
  const [signatureHtml, setSignatureHtml] = useState('');
  const richEditorRef = useRef(null);

  // Manual Image Signature Controls
  const [showImageControls, setShowImageControls] = useState(true);
  const [sigImgSrc, setSigImgSrc] = useState('');
  const [sigImgWidth, setSigImgWidth] = useState(140);
  const [sigImgAlign, setSigImgAlign] = useState('left'); // 'left', 'center', 'right'
  const [sigImgLink, setSigImgLink] = useState('');
  const [sigImgAlt, setSigImgAlt] = useState('');
  const imageFileInputRef = useRef(null);

  // SMTP & Protocol State
  const [dispatchMode, setDispatchMode] = useState('smtp'); // 'smtp' or 'google'
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showHowToHelp, setShowHowToHelp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState(null);

  // Fetch SMTP settings
  const { data: smtpData, isLoading: isLoadingSmtp } = useQuery({
    queryKey: ['smtp-settings'],
    queryFn: api.getSmtpSettings,
  });

  useEffect(() => {
    if (smtpData) {
      setDispatchMode(smtpData.dispatch_mode || 'smtp');
      if (smtpData.smtp_user) {
        setSmtpUser(smtpData.smtp_user);
      } else if (account?.email) {
        setSmtpUser(account.email);
      }
    }
  }, [smtpData, account]);

  // Test SMTP Mutation
  const testSmtpMutation = useMutation({
    mutationFn: (data) => api.testSmtpConnection(data),
    onSuccess: (res) => {
      setSmtpTestResult({ success: true, message: res.message || 'SMTP verified successfully with Google Workspace!' });
      toast.success('SMTP verified! Ready to dispatch emails.');
    },
    onError: (err) => {
      setSmtpTestResult({ success: false, message: err.message });
      toast.error('SMTP test failed: ' + err.message);
    }
  });

  // Save SMTP Mutation
  const saveSmtpMutation = useMutation({
    mutationFn: (data) => api.saveSmtpSettings(data),
    onSuccess: () => {
      toast.success('SMTP settings saved and encrypted with AES-256-GCM!');
      queryClient.invalidateQueries({ queryKey: ['smtp-settings'] });
      setSmtpPass('');
    },
    onError: (err) => {
      toast.error('Failed to save SMTP settings: ' + err.message);
    }
  });

  // IMAP Sync Mutation
  const syncImapMutation = useMutation({
    mutationFn: () => api.syncImapReplies(),
    onSuccess: (res) => {
      if (res.newCount > 0) {
        toast.success(`Discovered ${res.newCount} new reply via IMAP!`);
      } else {
        toast.info('IMAP inbox is up to date.');
      }
      queryClient.invalidateQueries({ queryKey: ['replies'] });
    },
    onError: (err) => {
      toast.error('IMAP sync failed: ' + err.message);
    }
  });

  // Fetch signature
  const { data: signatureData, isLoading: isLoadingSig } = useQuery({
    queryKey: ['signature'],
    queryFn: api.getSignature,
    enabled: connected,
  });

  useEffect(() => {
    if (signatureData?.signatureHtml !== undefined) {
      const html = signatureData.signatureHtml || '';
      setSignatureHtml(html);
      if (richEditorRef.current) {
        richEditorRef.current.innerHTML = html;
      }

      // Auto-extract existing logo properties if already present in signature
      const matchImg = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
      if (matchImg && matchImg[1]) {
        setSigImgSrc(matchImg[1]);
        const matchWidth = html.match(/width=["']?(\d+)["']?/i);
        if (matchWidth && matchWidth[1]) {
          setSigImgWidth(Number(matchWidth[1]));
        }
        const matchAlign = html.match(/text-align:\s*(left|center|right)/i);
        if (matchAlign && matchAlign[1]) {
          setSigImgAlign(matchAlign[1]);
        }
      }
    }
  }, [signatureData]);

  // Update signature mutation
  const saveSignatureMutation = useMutation({
    mutationFn: (html) => api.updateSignature(html),
    onSuccess: () => {
      toast.success('Email signature saved successfully!');
      queryClient.invalidateQueries({ queryKey: ['signature'] });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save signature');
    }
  });

  const handleSaveSignature = () => {
    let contentToSave = signatureHtml;
    if (signatureMode === 'rich' && richEditorRef.current) {
      contentToSave = richEditorRef.current.innerHTML;
      setSignatureHtml(contentToSave);
    }
    saveSignatureMutation.mutate(contentToSave);
  };

  // Rich editor formatting command
  const executeCmd = (command, value = null) => {
    document.execCommand(command, false, value);
    if (richEditorRef.current) {
      setSignatureHtml(richEditorRef.current.innerHTML);
    }
  };

  const handleInsertLink = () => {
    const url = prompt('Enter URL:', 'https://');
    if (url) executeCmd('createLink', url);
  };

  // Local file to base64 Data URL converter
  const handleImageFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, SVG, WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSigImgSrc(ev.target.result);
      toast.success('Image loaded! You can adjust width/alignment and click "Insert into Signature".');
    };
    reader.readAsDataURL(file);
  };

  // Manual Image Apply to Signature
  const handleApplySignatureImage = () => {
    if (!sigImgSrc || !sigImgSrc.trim()) {
      toast.error('Please upload an image or enter an image URL first.');
      return;
    }

    const linkOpen = sigImgLink.trim()
      ? `<a href="${sigImgLink.trim()}" target="_blank" rel="noopener noreferrer">`
      : '';
    const linkClose = sigImgLink.trim() ? `</a>` : '';
    const altAttr = sigImgAlt.trim() ? `alt="${sigImgAlt.trim()}"` : 'alt="Company Logo"';

    const logoBlockHtml = `<div class="sig-logo-block" style="text-align: ${sigImgAlign}; margin-top: 10px; margin-bottom: 6px;">${linkOpen}<img src="${sigImgSrc.trim()}" ${altAttr} width="${sigImgWidth}" style="width: ${sigImgWidth}px; max-width: 100%; height: auto; display: inline-block; border: 0;" />${linkClose}</div>`;

    let currentHtml = signatureMode === 'rich' && richEditorRef.current
      ? richEditorRef.current.innerHTML
      : signatureHtml;

    // Check if signature already has a logo block or img tag to replace
    if (/<div[^>]*class=["']sig-logo-block["'][^>]*>[\s\S]*?<\/div>/i.test(currentHtml)) {
      currentHtml = currentHtml.replace(/<div[^>]*class=["']sig-logo-block["'][^>]*>[\s\S]*?<\/div>/i, logoBlockHtml);
    } else if (/<img[^>]+>/i.test(currentHtml)) {
      // Replace existing standalone img
      currentHtml = currentHtml.replace(/(?:<a[^>]*>)?\s*<img[^>]+>\s*(?:<\/a>)?/i, logoBlockHtml);
    } else {
      // Append logo at bottom of signature
      currentHtml = currentHtml ? `${currentHtml}<br>${logoBlockHtml}` : logoBlockHtml;
    }

    setSignatureHtml(currentHtml);
    if (richEditorRef.current) {
      richEditorRef.current.innerHTML = currentHtml;
    }
    toast.success('Signature image updated! Click "Save Signature" below to save changes.');
  };

  // Manual Image Removal
  const handleRemoveSignatureImage = () => {
    let currentHtml = signatureMode === 'rich' && richEditorRef.current
      ? richEditorRef.current.innerHTML
      : signatureHtml;

    currentHtml = currentHtml
      .replace(/<div[^>]*class=["']sig-logo-block["'][^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/(?:<a[^>]*>)?\s*<img[^>]+>\s*(?:<\/a>)?/gi, '');

    setSignatureHtml(currentHtml);
    if (richEditorRef.current) {
      richEditorRef.current.innerHTML = currentHtml;
    }
    setSigImgSrc('');
    toast.success('Signature image removed from draft.');
  };

  // Sync content when switching tabs
  const switchMode = (newMode) => {
    if (newMode === 'html' && richEditorRef.current) {
      setSignatureHtml(richEditorRef.current.innerHTML);
    } else if (newMode === 'rich') {
      setTimeout(() => {
        if (richEditorRef.current) {
          richEditorRef.current.innerHTML = signatureHtml;
        }
      }, 10);
    }
    setSignatureMode(newMode);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Application Settings & Diagnostics
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Manage your Google OAuth connection, email signature, storage, and throttle thresholds.
        </p>
      </div>

      {/* Email Protocol & Google Workspace SMTP Card */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 shadow-subtle space-y-5 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -right-16 -top-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/20">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Email Dispatch Protocol (Google Workspace SMTP)
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <Check className="h-3 w-3" />
                  <span>Option A Active</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Zero token expiration, bypasses Google Cloud Console limits, sends via smtp.gmail.com
              </p>
            </div>
          </div>
        </div>

        {/* Protocol Mode Switcher */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
            Active Sending Engine
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDispatchMode('smtp')}
              className={cn(
                "p-3.5 rounded-xl text-left border transition-all flex items-start gap-3",
                dispatchMode === 'smtp'
                  ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-900"
              )}
            >
              <div className={cn(
                "p-2 rounded-lg shrink-0",
                dispatchMode === 'smtp' ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
              )}>
                <Server className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>Google Workspace SMTP</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-semibold">Recommended</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Uses 16-character Google App Password. Permanent connection without 7-day token expiration.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDispatchMode('google')}
              className={cn(
                "p-3.5 rounded-xl text-left border transition-all flex items-start gap-3",
                dispatchMode === 'google'
                  ? "border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-900"
              )}
            >
              <div className={cn(
                "p-2 rounded-lg shrink-0",
                dispatchMode === 'google' ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
              )}>
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Google Cloud Console (OAuth 2.0)
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Uses OAuth access and refresh tokens. Requires active Google Cloud Client ID & Secret.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* SMTP Configuration Fields (when SMTP is active) */}
        {dispatchMode === 'smtp' && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  Google Workspace Email
                </label>
                <input
                  type="email"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="marketing1@jollyclamps.com"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Google App Password (16 characters)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowHowToHelp(!showHowToHelp)}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                  >
                    <HelpCircle className="h-3 w-3" />
                    <span>How to get it?</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showSmtpPass ? 'text' : 'password'}
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    placeholder={smtpData?.has_password ? "•••••••••••••••• (Saved & AES-256-GCM Encrypted)" : "e.g. abcd efgh ijkl mnop"}
                    className="w-full text-xs px-3 py-2 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmtpPass(!showSmtpPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showSmtpPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Step-by-Step Google App Password Guide (Expandable) */}
            {showHowToHelp && (
              <div className="p-4 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60 text-xs text-slate-700 dark:text-slate-300 space-y-2 animate-in fade-in duration-150">
                <div className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
                  <span>How to generate your 16-character Google App Password (in 60 seconds):</span>
                  <button type="button" onClick={() => setShowHowToHelp(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 leading-relaxed text-slate-600 dark:text-slate-300">
                  <li>Go to your Google Account Security: <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 font-semibold underline inline-flex items-center gap-0.5">Google Security <ExternalLink className="h-2.5 w-2.5" /></a></li>
                  <li>Ensure <strong>2-Step Verification</strong> is turned <strong>ON</strong>.</li>
                  <li>Go to <strong>App Passwords</strong>: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 font-semibold underline inline-flex items-center gap-0.5">myaccount.google.com/apppasswords <ExternalLink className="h-2.5 w-2.5" /></a></li>
                  <li>In the App name box, type <strong>Jolly Clamps Sender</strong> and click <strong>Create</strong>.</li>
                  <li>Google will display a 16-character yellow box code (e.g. <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded font-mono font-bold text-indigo-600">abcd efgh ijkl mnop</code>). Copy and paste it above!</li>
                </ol>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-indigo-200/50 dark:border-indigo-800/40">
                  Note: App Passwords never expire in 7 days and remain permanently active.
                </div>
              </div>
            )}

            {/* Host & Port Details (Auto-configured for Google Workspace) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">SMTP Host</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 text-[11px]">smtp.gmail.com</span>
              </div>
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">SMTP Port</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 text-[11px]">465 (SSL Encrypted)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">IMAP Host (Replies)</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 text-[11px]">imap.gmail.com</span>
              </div>
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">IMAP Port</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 text-[11px]">993 (TLS Encrypted)</span>
              </div>
            </div>

            {/* Test Connection Outcome */}
            {smtpTestResult && (
              <div className={cn(
                "p-3 rounded-xl border text-xs flex items-center gap-2",
                smtpTestResult.success
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                  : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
              )}>
                {smtpTestResult.success ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> : <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />}
                <span>{smtpTestResult.message}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => testSmtpMutation.mutate({
                    smtp_host: 'smtp.gmail.com',
                    smtp_port: 465,
                    smtp_secure: true,
                    smtp_user: smtpUser,
                    smtp_pass: smtpPass
                  })}
                  disabled={testSmtpMutation.isPending || (!smtpPass && !smtpData?.has_password)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", testSmtpMutation.isPending && "animate-spin")} />
                  <span>{testSmtpMutation.isPending ? 'Testing SMTP...' : 'Test Connection'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => syncImapMutation.mutate()}
                  disabled={syncImapMutation.isPending || (!smtpPass && !smtpData?.has_password)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
                >
                  <Mail className={cn("h-3.5 w-3.5", syncImapMutation.isPending && "animate-spin")} />
                  <span>{syncImapMutation.isPending ? 'Syncing IMAP...' : 'Sync Replies via IMAP'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => saveSmtpMutation.mutate({
                  dispatch_mode: 'smtp',
                  smtp_host: 'smtp.gmail.com',
                  smtp_port: 465,
                  smtp_secure: true,
                  smtp_user: smtpUser,
                  smtp_pass: smtpPass,
                  imap_host: 'imap.gmail.com',
                  imap_port: 993
                })}
                disabled={saveSmtpMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{saveSmtpMutation.isPending ? 'Saving...' : 'Save & Encrypt SMTP Settings'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Gmail OAuth Connection Card */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-subtle space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Google Account Authorization
              </h3>
              <p className="text-xs text-slate-500">
                Direct integration with Gmail API (users.messages.send)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {connected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Connected</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Not Connected</span>
              </span>
            )}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/60 space-y-2 text-xs">
          {connected ? (
            <>
              <div className="flex justify-between">
                <span className="text-slate-500">Connected Account:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{account?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Authorized At:</span>
                <span className="text-slate-800 dark:text-slate-200">{formatDate(account?.connectedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Auto Token Refresh:</span>
                <span className="text-emerald-600 font-semibold">Active (via offline refresh_token)</span>
              </div>
            </>
          ) : (
            <p className="text-slate-500">
              No Gmail account is currently authenticated. Connect your Google account to grant sending permissions.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2">
          {connected ? (
            <>
              <a
                href="http://localhost:3000/auth/google"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
              >
                <span>Reconnect Account</span>
                <ExternalLink className="h-3 w-3" />
              </a>
              <button
                onClick={() => {
                  if (window.confirm('Disconnect this Gmail account? You will need to re-authenticate to dispatch emails.')) {
                    disconnect();
                  }
                }}
                disabled={isDisconnecting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-semibold transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Disconnect</span>
              </button>
            </>
          ) : (
            <a
              href="http://localhost:3000/auth/google"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Mail className="h-4 w-4" />
              <span>Connect Gmail Account</span>
            </a>
          )}
        </div>
      </div>

      {/* FEATURE 2: Email Signature Card */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-subtle space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400">
              <PenTool className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Email Signature (Auto-Append)
              </h3>
              <p className="text-xs text-slate-500">
                Automatically appended below your dispatched emails with a subtle divider
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => switchMode('rich')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                signatureMode === 'rich'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Rich Editor
            </button>
            <button
              type="button"
              onClick={() => switchMode('html')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                signatureMode === 'html'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              HTML
            </button>
          </div>
        </div>

        {/* First-time setup helpful hint */}
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/60 flex items-start gap-2.5 text-xs text-blue-800 dark:text-blue-300">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
          <p>
            <strong>Helpful hint:</strong> Paste your Gmail signature here — you can copy it directly from <strong>Gmail Settings &gt; Signature</strong> or paste raw custom HTML. Embedded images (<code className="font-mono text-[11px]">&lt;img src="data:..."&gt;</code> and <code className="font-mono text-[11px]">&lt;img src="http..."&gt;</code>) are fully preserved.
          </p>
        </div>

        {/* Signature Editor Body */}
        {signatureMode === 'rich' ? (
          <div className="space-y-2">
            {/* Formatting Toolbar */}
            <div className="flex flex-wrap items-center gap-1 p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
              <button
                type="button"
                onClick={() => executeCmd('bold')}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs"
                title="Bold"
              >
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeCmd('italic')}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs"
                title="Italic"
              >
                <Italic className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeCmd('underline')}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs"
                title="Underline"
              >
                <Underline className="h-3.5 w-3.5" />
              </button>
              <span className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
              <button
                type="button"
                onClick={handleInsertLink}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs flex items-center gap-1"
                title="Insert Link"
              >
                <Link2 className="h-3.5 w-3.5" />
                <span className="text-[10px]">Link</span>
              </button>
              <button
                type="button"
                onClick={() => setShowImageControls(true)}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs flex items-center gap-1 text-indigo-600 dark:text-indigo-400"
                title="Signature Image & Logo Settings"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span className="text-[10px] font-semibold">Image / Logo</span>
              </button>
            </div>

            {/* WYSIWYG Editable Area */}
            <div
              ref={richEditorRef}
              contentEditable
              onInput={() => {
                if (richEditorRef.current) {
                  setSignatureHtml(richEditorRef.current.innerHTML);
                }
              }}
              className="min-h-[140px] p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none overflow-y-auto leading-relaxed"
              placeholder="Design or paste your email signature here..."
            />
          </div>
        ) : (
          <div className="space-y-1">
            <textarea
              rows={7}
              placeholder='<p>Best regards,<br><strong>Your Name</strong><br><a href="https://example.com">example.com</a></p>'
              value={signatureHtml}
              onChange={(e) => setSignatureHtml(e.target.value)}
              className="w-full font-mono text-xs p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        {/* Dedicated Signature Image / Logo Manual Editor Panel */}
        <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
                <ImageIcon className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Signature Image & Logo Controls
                </h4>
                <p className="text-[11px] text-slate-500">
                  Upload local image/logo, adjust width slider & presets, set alignment, or add link
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowImageControls(!showImageControls)}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1"
            >
              <span>{showImageControls ? 'Collapse' : 'Expand Controls'}</span>
              {showImageControls ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>

          {showImageControls && (
            <div className="space-y-3.5 pt-1">
              {/* Image Source (Local File upload or Web URL) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Upload from Local PC */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Upload from Device (PC)
                  </label>
                  <input
                    ref={imageFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageFileUpload}
                  />
                  <button
                    type="button"
                    onClick={() => imageFileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-2xs"
                  >
                    <UploadCloud className="h-3.5 w-3.5 text-indigo-500" />
                    <span>Choose Local Image File</span>
                  </button>
                  <p className="text-[10px] text-slate-400">
                    Converts PNG, JPG, SVG, WebP into direct embedded Data URL
                  </p>
                </div>

                {/* Or enter Web Image URL */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Or Enter Image URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://yourcompany.com/logo.png"
                    value={sigImgSrc.startsWith('data:') ? '(Local image file uploaded)' : sigImgSrc}
                    onChange={(e) => setSigImgSrc(e.target.value)}
                    disabled={sigImgSrc.startsWith('data:')}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                  />
                  {sigImgSrc.startsWith('data:') && (
                    <button
                      type="button"
                      onClick={() => setSigImgSrc('')}
                      className="text-[10px] text-indigo-600 hover:underline"
                    >
                      Clear uploaded file to enter URL
                    </button>
                  )}
                </div>
              </div>

              {/* Adjustments: Width Slider & Presets, Alignment */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                {/* Width Controls */}
                <div className="sm:col-span-2 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-medium text-slate-700 dark:text-slate-300">
                      Logo Width: <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">{sigImgWidth}px</span>
                    </label>
                    <div className="flex gap-1">
                      {[
                        { label: '80px', val: 80 },
                        { label: '140px', val: 140 },
                        { label: '200px', val: 200 },
                        { label: '280px', val: 280 }
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setSigImgWidth(preset.val)}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                            sigImgWidth === preset.val
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="400"
                    step="5"
                    value={sigImgWidth}
                    onChange={(e) => setSigImgWidth(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                {/* Alignment Controls */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block">
                    Alignment
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-slate-200/60 dark:bg-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setSigImgAlign('left')}
                      className={`py-1 rounded flex items-center justify-center transition-all ${
                        sigImgAlign === 'left'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-2xs font-semibold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                      title="Align Left"
                    >
                      <AlignLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSigImgAlign('center')}
                      className={`py-1 rounded flex items-center justify-center transition-all ${
                        sigImgAlign === 'center'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-2xs font-semibold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                      title="Align Center"
                    >
                      <AlignCenter className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSigImgAlign('right')}
                      className={`py-1 rounded flex items-center justify-center transition-all ${
                        sigImgAlign === 'right'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-2xs font-semibold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                      title="Align Right"
                    >
                      <AlignRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Optional Link and Alt text */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                <div>
                  <label className="text-xs text-slate-500 font-medium">
                    Clickable Link URL (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="https://yourcompany.com"
                    value={sigImgLink}
                    onChange={(e) => setSigImgLink(e.target.value)}
                    className="w-full mt-1 text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium">
                    Alt Text (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Company Logo"
                    value={sigImgAlt}
                    onChange={(e) => setSigImgAlt(e.target.value)}
                    className="w-full mt-1 text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Live Preview of the Image with Selected Settings */}
              {sigImgSrc && (
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Logo Display Preview
                  </span>
                  <div style={{ textAlign: sigImgAlign }}>
                    <img
                      src={sigImgSrc}
                      alt={sigImgAlt || 'Signature Preview'}
                      style={{
                        width: `${sigImgWidth}px`,
                        maxWidth: '100%',
                        height: 'auto',
                        display: 'inline-block',
                      }}
                      className="rounded border border-slate-200/50 dark:border-slate-700/50"
                    />
                  </div>
                </div>
              )}

              {/* Apply / Remove Action Buttons */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleRemoveSignatureImage}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-semibold transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Remove Image</span>
                </button>

                <button
                  type="button"
                  onClick={handleApplySignatureImage}
                  disabled={!sigImgSrc}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Insert / Update in Signature</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Live Preview */}
        {signatureHtml && signatureHtml.trim() && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              <span>Appended Preview (with divider)</span>
            </span>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/60 text-xs">
              <div className="text-slate-400 italic mb-2 text-[11px]">[Email body finishes here...]</div>
              <div className="border-t border-slate-200 dark:border-slate-700 my-2" />
              <div 
                className="prose dark:prose-invert max-w-none text-xs"
                dangerouslySetInnerHTML={{ __html: signatureHtml }} 
              />
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSaveSignature}
            disabled={saveSignatureMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors active:scale-98"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saveSignatureMutation.isPending ? 'Saving...' : 'Save Signature'}</span>
          </button>
        </div>
      </div>

      {/* Security & Token Encryption Card */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-subtle space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Encryption at Rest (AES-256-GCM)
            </h3>
            <p className="text-xs text-slate-500">
              Authenticated military-grade encryption protects all tokens in SQLite
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
          <p>
            Your Google OAuth <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px]">access_token</code> and <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px]">refresh_token</code> are encrypted with random 16-byte initialization vectors (IVs) and 16-byte authentication tags using the <code className="font-mono text-[11px]">ENCRYPTION_KEY</code> defined in your backend <code className="font-mono text-[11px]">.env</code> file.
          </p>
          <p>
            Raw tokens and private email contents are never logged to console outputs or exposed over unauthorized endpoints.
          </p>
        </div>
      </div>

      {/* Google Cloud Console Setup & Redirect URI Reference */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-subtle space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Google Cloud Console Configuration Reference
            </h3>
            <p className="text-xs text-slate-500">
              OAuth 2.0 Credentials checklist
            </p>
          </div>
        </div>

        <div className="space-y-2.5 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/60 space-y-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Authorized Redirect URI:</span>
            <div className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 select-all">
              http://localhost:3000/auth/google/callback
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/60 space-y-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Required OAuth Scopes:</span>
            <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
              <li>https://www.googleapis.com/auth/gmail.send</li>
              <li>https://www.googleapis.com/auth/gmail.readonly</li>
              <li>https://www.googleapis.com/auth/userinfo.email</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Local SQLite Database Info */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-subtle space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Zero-Config SQLite Storage
            </h3>
            <p className="text-xs text-slate-500">
              High performance synchronous WAL (Write-Ahead-Logging) engine
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          All batches, email send audit records, recipient logs, templates, and signatures are stored locally in <code className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">backend/data.db</code>. No external database server or cloud connection is required.
        </p>
      </div>
    </div>
  );
}
