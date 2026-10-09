import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import Papa from 'papaparse';
import { 
  Send, 
  Paperclip, 
  X, 
  Eye, 
  ChevronDown, 
  ChevronUp, 
  FileSpreadsheet, 
  Sparkles, 
  AlertCircle, 
  AlertTriangle,
  CheckCircle2, 
  Sliders, 
  FileText,
  Trash2,
  UploadCloud,
  File,
  Loader2,
  Filter,
  Check,
  RotateCcw,
  Info,
  Layers,
  Bold,
  Italic,
  Underline,
  Highlighter,
  Palette,
  List,
  ListOrdered,
  Link2,
  RemoveFormatting,
  Code,
  Type,
  Image as ImageIcon
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { formatBytes, formatDate } from '../lib/utils';
import { toast } from 'sonner';

export function Compose({ onSentBatch, prefillTemplate, onClearPrefill }) {
  const { connected, user } = useAuth();

  // Helper to read saved draft from localStorage
  const getSavedDraft = () => {
    try {
      const key = user?.email ? `gmail_sender_compose_draft_${user.email}` : 'gmail_sender_compose_draft';
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  };

  const initialDraft = useMemo(() => getSavedDraft(), []);

  // Recipient objects: { id, email, normalized, vars: {}, hasBeenEmailed, lastSentDate, sendCount, daysAgo, manualOverride }
  const [recipientsList, setRecipientsList] = useState(() => initialDraft?.recipientsList || []);
  const [recipientInput, setRecipientInput] = useState(() => initialDraft?.recipientInput || '');
  const [csvColumns, setCsvColumns] = useState(() => initialDraft?.csvColumns || []);
  const [isParsingCsv, setIsParsingCsv] = useState(false);

  // Duplicate smart filtering mode
  // Options: 'exclude_7' (default), 'all', 'only_new', 'exclude_30', 'exclude_90'
  const [filterMode, setFilterMode] = useState(() => initialDraft?.filterMode || 'exclude_7');

  // Collapsible CC/BCC
  const [showCcBcc, setShowCcBcc] = useState(() => Boolean(initialDraft?.showCcBcc || initialDraft?.cc || initialDraft?.bcc));
  const [cc, setCc] = useState(() => initialDraft?.cc || '');
  const [bcc, setBcc] = useState(() => initialDraft?.bcc || '');

  // Subject and Body
  const [subject, setSubject] = useState(() => prefillTemplate?.subject || initialDraft?.subject || '');
  const [bodyHtml, setBodyHtml] = useState(() => prefillTemplate?.body_html || initialDraft?.bodyHtml || '');

  // Rich Visual Editor Mode: 'visual' (WYSIWYG) or 'html' (Source code)
  const [editorMode, setEditorMode] = useState(() => initialDraft?.editorMode || 'visual');
  const [showHighlightMenu, setShowHighlightMenu] = useState(false);
  const [showTextColorMenu, setShowTextColorMenu] = useState(false);

  // Focus, refs, and cursor tracking
  const [lastFocusedField, setLastFocusedField] = useState('body'); // 'subject' or 'body'
  const subjectInputRef = useRef(null);
  const bodyTextareaRef = useRef(null);
  const bodyEditorRef = useRef(null);
  const savedRangeRef = useRef(null);
  const csvFileInputRef = useRef(null);

  // Settings & options
  const [sendMode, setSendMode] = useState(() => initialDraft?.sendMode || 'individual'); // 'individual' or 'single'
  const [throttle, setThrottle] = useState(() => initialDraft?.throttle ?? 20); // 20 per min = 1 every 3s
  const [appendSignature, setAppendSignature] = useState(() => initialDraft?.appendSignature ?? true); // default ON
  const [attachments, setAttachments] = useState([]);

  // Save tracking
  const [lastSavedAt, setLastSavedAt] = useState(() => initialDraft?.savedAt ? new Date(initialDraft.savedAt) : null);

  // Modals & UI states
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch saved signature & templates
  const { data: signatureData } = useQuery({
    queryKey: ['signature'],
    queryFn: api.getSignature,
    enabled: connected,
  });

  const { data: templatesData } = useQuery({
    queryKey: ['templates'],
    queryFn: api.getTemplates,
  });

  // Autocomplete suggestions state for recipient input
  const [recipientSuggestions, setRecipientSuggestions] = useState([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [showRecipientSuggestions, setShowRecipientSuggestions] = useState(false);

  // CC / BCC Autocomplete states
  const [ccSuggestions, setCcSuggestions] = useState([]);
  const [showCcSuggestions, setShowCcSuggestions] = useState(false);
  const [activeCcIndex, setActiveCcIndex] = useState(0);
  const [bccSuggestions, setBccSuggestions] = useState([]);
  const [showBccSuggestions, setShowBccSuggestions] = useState(false);
  const [activeBccIndex, setActiveBccIndex] = useState(0);

  // Extract the active query token from recipientInput (the word after last separator)
  const activeRecipientToken = useMemo(() => {
    if (!recipientInput) return '';
    const tokens = recipientInput.split(/[\n,;]+/);
    return (tokens[tokens.length - 1] || '').trim();
  }, [recipientInput]);

  // Query suggestions when active token has >= 3 characters
  useEffect(() => {
    const q = activeRecipientToken.trim();
    if (q.length < 3) {
      setRecipientSuggestions([]);
      setShowRecipientSuggestions(false);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsSearchingSuggestions(true);
      try {
        const res = await api.getRecipientSuggestions(q);
        if (isMounted) {
          const list = res.suggestions || [];
          setRecipientSuggestions(list);
          setActiveSuggestionIndex(0);
          setShowRecipientSuggestions(list.length > 0);
        }
      } catch (err) {
        if (isMounted) {
          setRecipientSuggestions([]);
          setShowRecipientSuggestions(false);
        }
      } finally {
        if (isMounted) {
          setIsSearchingSuggestions(false);
        }
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activeRecipientToken]);

  // CC suggestions
  const activeCcToken = useMemo(() => {
    if (!cc) return '';
    const tokens = cc.split(/[\n,;]+/);
    return (tokens[tokens.length - 1] || '').trim();
  }, [cc]);

  useEffect(() => {
    const q = activeCcToken.trim();
    if (q.length < 3) {
      setCcSuggestions([]);
      setShowCcSuggestions(false);
      return;
    }
    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        const res = await api.getRecipientSuggestions(q);
        if (isMounted) {
          setCcSuggestions(res.suggestions || []);
          setActiveCcIndex(0);
          setShowCcSuggestions((res.suggestions || []).length > 0);
        }
      } catch (e) {}
    }, 150);
    return () => { isMounted = false; clearTimeout(timer); };
  }, [activeCcToken]);

  // BCC suggestions
  const activeBccToken = useMemo(() => {
    if (!bcc) return '';
    const tokens = bcc.split(/[\n,;]+/);
    return (tokens[tokens.length - 1] || '').trim();
  }, [bcc]);

  useEffect(() => {
    const q = activeBccToken.trim();
    if (q.length < 3) {
      setBccSuggestions([]);
      setShowBccSuggestions(false);
      return;
    }
    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        const res = await api.getRecipientSuggestions(q);
        if (isMounted) {
          setBccSuggestions(res.suggestions || []);
          setActiveBccIndex(0);
          setShowBccSuggestions((res.suggestions || []).length > 0);
        }
      } catch (e) {}
    }, 150);
    return () => { isMounted = false; clearTimeout(timer); };
  }, [activeBccToken]);

  // Autofill selection handler for recipientInput
  const applyAutofillEmail = (selectedEmail, addDirectly = true, contactName = '') => {
    if (!selectedEmail) return;

    if (addDirectly) {
      const norm = selectedEmail.toLowerCase().trim();
      const existing = recipientsList.some((r) => r.normalized === norm);
      if (!existing) {
        const item = {
          id: Math.random().toString(36).substring(2, 9),
          email: selectedEmail,
          normalized: norm,
          vars: contactName ? { name: contactName } : {},
          hasBeenEmailed: false,
          lastSentDate: null,
          sendCount: 0,
          daysAgo: null,
          manualOverride: null,
        };
        setRecipientsList((prev) => [...prev, item]);
        checkHistoryForEmails([selectedEmail]);
        toast.success(`Autofilled & added ${selectedEmail}`);
      } else {
        toast.info(`${selectedEmail} is already in the recipient list.`);
      }

      // Remove the partial token from recipientInput
      const tokens = recipientInput.split(/[\n,;]+/);
      tokens.pop();
      const remaining = tokens.map((t) => t.trim()).filter(Boolean).join(', ');
      setRecipientInput(remaining ? remaining + ', ' : '');
    } else {
      // Tab completion in text input
      const tokens = recipientInput.split(/[\n,;]+/);
      tokens.pop();
      tokens.push(selectedEmail);
      setRecipientInput(tokens.map((t) => t.trim()).filter(Boolean).join(', ') + ', ');
      toast.info(`Autofilled ${selectedEmail}`);
    }

    setRecipientSuggestions([]);
    setShowRecipientSuggestions(false);
  };

  const handleKeyDownRecipientInput = (e) => {
    if (showRecipientSuggestions && recipientSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestionIndex((prev) => (prev + 1) % recipientSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestionIndex((prev) => (prev - 1 + recipientSuggestions.length) % recipientSuggestions.length);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const selected = recipientSuggestions[activeSuggestionIndex] || recipientSuggestions[0];
        if (selected) {
          applyAutofillEmail(selected.email, false);
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const selected = recipientSuggestions[activeSuggestionIndex] || recipientSuggestions[0];
        if (selected) {
          applyAutofillEmail(selected.email, true, selected.name);
        } else {
          handleAddTypedRecipients();
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowRecipientSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTypedRecipients();
    }
  };

  const handleBlurRecipientInput = () => {
    // Delay to allow onMouseDown on suggestion items
    setTimeout(() => {
      setShowRecipientSuggestions(false);
      handleAddTypedRecipients();
    }, 200);
  };

  // CC / BCC Autofill helpers
  const applyAutofillCc = (email) => {
    const tokens = (cc || '').split(/[\n,;]+/);
    tokens.pop();
    tokens.push(email);
    setCc(tokens.map(t => t.trim()).filter(Boolean).join(', ') + ', ');
    setShowCcSuggestions(false);
    toast.info(`Autofilled CC: ${email}`);
  };

  const applyAutofillBcc = (email) => {
    const tokens = (bcc || '').split(/[\n,;]+/);
    tokens.pop();
    tokens.push(email);
    setBcc(tokens.map(t => t.trim()).filter(Boolean).join(', ') + ', ');
    setShowBccSuggestions(false);
    toast.info(`Autofilled BCC: ${email}`);
  };

  // Keep latest state ref for synchronous flushing on unload or visibilitychange
  const latestDraftRef = useRef();
  latestDraftRef.current = {
    subject,
    bodyHtml,
    recipientsList,
    recipientInput,
    csvColumns,
    filterMode,
    showCcBcc,
    cc,
    bcc,
    editorMode,
    sendMode,
    throttle,
    appendSignature,
    userEmail: user?.email
  };

  // Helper to persist draft to localStorage
  const saveDraftToStorage = () => {
    const cur = latestDraftRef.current;
    if (!cur) return;
    try {
      const key = cur.userEmail ? `gmail_sender_compose_draft_${cur.userEmail}` : 'gmail_sender_compose_draft';
      const hasContent = 
        cur.subject.trim() || 
        cur.bodyHtml.trim() || 
        cur.recipientsList.length > 0 || 
        cur.recipientInput.trim() || 
        cur.cc.trim() || 
        cur.bcc.trim();

      if (!hasContent) {
        localStorage.removeItem(key);
        setLastSavedAt(null);
        return;
      }

      const draft = {
        ...cur,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(key, JSON.stringify(draft));
      setLastSavedAt(new Date());
    } catch (err) {
      console.warn('Auto-save draft error:', err);
    }
  };

  // Debounced auto-save on any change
  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraftToStorage();
    }, 400);

    return () => clearTimeout(timer);
  }, [
    subject,
    bodyHtml,
    recipientsList,
    recipientInput,
    csvColumns,
    filterMode,
    showCcBcc,
    cc,
    bcc,
    editorMode,
    sendMode,
    throttle,
    appendSignature,
    user?.email
  ]);

  // Immediate save when user switches browser tabs, minimizes window, or navigates away
  useEffect(() => {
    const handleImmediateSave = () => {
      saveDraftToStorage();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveDraftToStorage();
      }
    };

    window.addEventListener('beforeunload', handleImmediateSave);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleImmediateSave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Announce restoration once if an existing draft was populated
  const hasAnnouncedRestoreRef = useRef(false);
  useEffect(() => {
    if (!hasAnnouncedRestoreRef.current && initialDraft && (initialDraft.subject || initialDraft.bodyHtml || initialDraft.recipientsList?.length > 0)) {
      hasAnnouncedRestoreRef.current = true;
      toast.info('Restored your draft in progress.', { duration: 3000 });
    }
  }, [initialDraft]);

  // Clear draft helper
  const clearDraftData = (notify = false) => {
    const key = user?.email ? `gmail_sender_compose_draft_${user.email}` : 'gmail_sender_compose_draft';
    try {
      localStorage.removeItem(key);
    } catch (e) {}

    setSubject('');
    setBodyHtml('');
    setRecipientsList([]);
    setRecipientInput('');
    setCsvColumns([]);
    setCc('');
    setBcc('');
    setShowCcBcc(false);
    setAttachments([]);
    setLastSavedAt(null);
    if (bodyEditorRef.current) {
      bodyEditorRef.current.innerHTML = '';
    }
    if (onClearPrefill) {
      onClearPrefill();
    }
    if (notify) {
      toast.info('Draft discarded. Form cleared.');
    }
  };

  const handleClearDraft = () => {
    if (window.confirm('Are you sure you want to discard this draft and reset all fields?')) {
      clearDraftData(true);
    }
  };

  // Apply template when passed as prop
  useEffect(() => {
    if (prefillTemplate) {
      if (prefillTemplate.subject) setSubject(prefillTemplate.subject);
      if (prefillTemplate.body_html) {
        setBodyHtml(prefillTemplate.body_html);
        if (bodyEditorRef.current) {
          bodyEditorRef.current.innerHTML = prefillTemplate.body_html;
        }
      }
      if (onClearPrefill) {
        onClearPrefill();
      }
    }
  }, [prefillTemplate, onClearPrefill]);

  // Check duplicate history on backend whenever recipients are added/modified
  const checkHistoryForEmails = async (emailAddresses, currentList) => {
    if (!emailAddresses || emailAddresses.length === 0) return;
    try {
      const res = await api.checkRecipientHistory(emailAddresses);
      const results = res.results || [];
      const resultMap = new Map();
      results.forEach((r) => resultMap.set(r.normalized, r));

      setRecipientsList((prev) =>
        prev.map((item) => {
          const match = resultMap.get(item.normalized);
          if (match) {
            return {
              ...item,
              hasBeenEmailed: match.hasBeenEmailed,
              lastSentDate: match.lastSentDate,
              sendCount: match.sendCount,
              daysAgo: match.daysAgo,
            };
          }
          return item;
        })
      );
    } catch (err) {
      console.error('Failed to check recipient send history:', err);
    }
  };

  // Add typed recipients (separated by comma, semicolon, newline)
  const handleAddTypedRecipients = () => {
    if (!recipientInput.trim()) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const tokens = recipientInput
      .split(/[\n,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const newlyAdded = [];
    setRecipientsList((prev) => {
      const next = [...prev];
      for (const token of tokens) {
        const norm = token.toLowerCase();
        if (emailRegex.test(token) && !next.some((r) => r.normalized === norm)) {
          const item = {
            id: Math.random().toString(36).substring(2, 9),
            email: token,
            normalized: norm,
            vars: {},
            hasBeenEmailed: false,
            lastSentDate: null,
            sendCount: 0,
            daysAgo: null,
            manualOverride: null,
          };
          next.push(item);
          newlyAdded.push(token);
        }
      }
      return next;
    });

    setRecipientInput('');
    if (newlyAdded.length > 0) {
      checkHistoryForEmails(newlyAdded);
    }
  };

  // Handle CSV Import via PapaParse
  const handleCsvImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingCsv(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      encoding: 'UTF-8',
      transformHeader: (h) => h.trim().replace(/^\uFEFF/, ''), // Strip BOM
      complete: (results) => {
        setIsParsingCsv(false);
        if (results.errors && results.errors.length > 0) {
          console.warn('PapaParse warnings:', results.errors);
        }

        const rows = results.data || [];
        if (rows.length === 0) {
          toast.error('The uploaded CSV file contains no data rows.');
          return;
        }

        // Auto-detect email column (case-insensitive "email" preferred)
        const headers = Object.keys(rows[0] || {});
        let emailKey = headers.find((h) => h.toLowerCase().trim() === 'email');
        if (!emailKey) {
          emailKey = headers.find((h) => /email|e-mail|recipient|to/i.test(h)) || headers[0];
        }

        if (!emailKey) {
          toast.error('Could not detect an email column in this CSV.');
          return;
        }

        setCsvColumns(headers);

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const newRecipients = [];
        const emailsToCheck = [];

        setRecipientsList((prev) => {
          const existingNorms = new Set(prev.map((r) => r.normalized));
          const next = [...prev];

          for (const row of rows) {
            const rawEmail = row[emailKey] ? String(row[emailKey]).trim() : '';
            const norm = rawEmail.toLowerCase();
            if (rawEmail && emailRegex.test(rawEmail) && !existingNorms.has(norm)) {
              existingNorms.add(norm);
              const item = {
                id: Math.random().toString(36).substring(2, 9),
                email: rawEmail,
                normalized: norm,
                vars: row,
                hasBeenEmailed: false,
                lastSentDate: null,
                sendCount: 0,
                daysAgo: null,
                manualOverride: null,
              };
              next.push(item);
              emailsToCheck.push(rawEmail);
            }
          }
          return next;
        });

        toast.success(`Imported ${emailsToCheck.length} recipients with ${headers.length} variable columns!`);

        // Check send history in background
        if (emailsToCheck.length > 0) {
          checkHistoryForEmails(emailsToCheck);
        }

        // Reset file input
        if (csvFileInputRef.current) {
          csvFileInputRef.current.value = '';
        }
      },
      error: (err) => {
        setIsParsingCsv(false);
        toast.error(`CSV Parsing error: ${err.message}`);
      },
    });
  };

  // Smart filter logic
  const isIncludedByFilter = (item) => {
    if (item.manualOverride !== null && item.manualOverride !== undefined) {
      return item.manualOverride;
    }
    switch (filterMode) {
      case 'all':
        return true;
      case 'only_new':
        return !item.hasBeenEmailed;
      case 'exclude_7':
        return !item.hasBeenEmailed || (item.daysAgo !== null && item.daysAgo > 7);
      case 'exclude_30':
        return !item.hasBeenEmailed || (item.daysAgo !== null && item.daysAgo > 30);
      case 'exclude_90':
        return !item.hasBeenEmailed || (item.daysAgo !== null && item.daysAgo > 90);
      default:
        return true;
    }
  };

  // Filter stats calculations
  const totalCount = recipientsList.length;
  const newCount = useMemo(() => recipientsList.filter((r) => !r.hasBeenEmailed).length, [recipientsList]);
  const previouslyEmailedCount = useMemo(() => recipientsList.filter((r) => r.hasBeenEmailed).length, [recipientsList]);
  const recentCount = useMemo(
    () => recipientsList.filter((r) => r.hasBeenEmailed && r.daysAgo !== null && r.daysAgo <= 7).length,
    [recipientsList]
  );

  const includedRecipients = useMemo(() => recipientsList.filter(isIncludedByFilter), [recipientsList, filterMode]);
  const excludedCount = totalCount - includedRecipients.length;

  // Toggle recipient manual override
  const handleToggleRecipientOverride = (id) => {
    setRecipientsList((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const currentlyIncluded = isIncludedByFilter(item);
          return {
            ...item,
            manualOverride: !currentlyIncluded,
          };
        }
        return item;
      })
    );
  };

  // Remove single recipient
  const handleRemoveRecipient = (id) => {
    setRecipientsList((prev) => prev.filter((r) => r.id !== id));
  };

  // Clear all recipients
  const handleClearAllRecipients = () => {
    if (recipientsList.length === 0) return;
    if (window.confirm('Clear all parsed recipients?')) {
      setRecipientsList([]);
      setCsvColumns([]);
    }
  };

  // Visual Selection Tracking
  const saveVisualSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && bodyEditorRef.current?.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreVisualSelection = () => {
    if (savedRangeRef.current) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
      return true;
    }
    return false;
  };

  // Rich formatting commands
  const execEditorFormat = (cmd, val = null) => {
    if (editorMode !== 'visual') return;
    if (bodyEditorRef.current) {
      bodyEditorRef.current.focus();
      restoreVisualSelection();
      document.execCommand(cmd, false, val);
      saveVisualSelection();
      setBodyHtml(bodyEditorRef.current.innerHTML);
    }
  };

  const handleHighlightColor = (color) => {
    if (editorMode !== 'visual') return;
    if (bodyEditorRef.current) {
      bodyEditorRef.current.focus();
      restoreVisualSelection();
      document.execCommand('hiliteColor', false, color);
      saveVisualSelection();
      setBodyHtml(bodyEditorRef.current.innerHTML);
      setShowHighlightMenu(false);
    }
  };

  const handleTextColor = (color) => {
    if (editorMode !== 'visual') return;
    if (bodyEditorRef.current) {
      bodyEditorRef.current.focus();
      restoreVisualSelection();
      document.execCommand('foreColor', false, color);
      saveVisualSelection();
      setBodyHtml(bodyEditorRef.current.innerHTML);
      setShowTextColorMenu(false);
    }
  };

  const handleInsertLink = () => {
    if (editorMode !== 'visual') return;
    const url = prompt('Enter URL for link:', 'https://');
    if (url) {
      execEditorFormat('createLink', url);
    }
  };

  const switchEditorMode = (mode) => {
    if (mode === editorMode) return;
    if (mode === 'html') {
      setEditorMode('html');
    } else {
      setEditorMode('visual');
      setTimeout(() => {
        if (bodyEditorRef.current) {
          bodyEditorRef.current.innerHTML = bodyHtml || '';
        }
      }, 20);
    }
  };

  // Plain text pasting handler preserving line breaks
  const handlePasteInVisual = (e) => {
    const text = e.clipboardData.getData('text/plain');
    const html = e.clipboardData.getData('text/html');
    if (!html && text) {
      e.preventDefault();
      const lines = text.split(/\r?\n/);
      const formatted = lines
        .map((line) => {
          if (!line.trim()) return '<div><br></div>';
          return `<div>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
        })
        .join('');
      document.execCommand('insertHTML', false, formatted);
      if (bodyEditorRef.current) {
        setBodyHtml(bodyEditorRef.current.innerHTML);
        saveVisualSelection();
      }
    }
  };

  // Keep contentEditable in sync if bodyHtml updated externally
  useEffect(() => {
    if (bodyEditorRef.current && editorMode === 'visual') {
      if (bodyEditorRef.current.innerHTML !== bodyHtml) {
        bodyEditorRef.current.innerHTML = bodyHtml || '';
      }
    }
  }, [bodyHtml, editorMode]);

  // Variable insertion at cursor position in whichever field was last focused
  const insertVariableAtCursor = (varName) => {
    const placeholder = `{{${varName}}}`;
    if (lastFocusedField === 'subject') {
      const el = subjectInputRef.current;
      if (el) {
        const start = el.selectionStart ?? subject.length;
        const end = el.selectionEnd ?? subject.length;
        const next = subject.slice(0, start) + placeholder + subject.slice(end);
        setSubject(next);
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(start + placeholder.length, start + placeholder.length);
        }, 10);
      } else {
        setSubject((prev) => `${prev} ${placeholder}`);
      }
    } else {
      if (editorMode === 'html') {
        const el = bodyTextareaRef.current;
        if (el) {
          const start = el.selectionStart ?? bodyHtml.length;
          const end = el.selectionEnd ?? bodyHtml.length;
          const next = bodyHtml.slice(0, start) + placeholder + bodyHtml.slice(end);
          setBodyHtml(next);
          setTimeout(() => {
            el.focus();
            el.setSelectionRange(start + placeholder.length, start + placeholder.length);
          }, 10);
        } else {
          setBodyHtml((prev) => `${prev} ${placeholder}`);
        }
      } else {
        // Visual WYSIWYG mode
        const el = bodyEditorRef.current;
        if (el) {
          el.focus();
          const restored = restoreVisualSelection();
          if (!restored) {
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
          document.execCommand('insertText', false, placeholder);
          saveVisualSelection();
          setBodyHtml(el.innerHTML);
        } else {
          setBodyHtml((prev) => `${prev} ${placeholder}`);
        }
      }
    }
  };

  // Detect template variables missing from CSV
  const missingVariables = useMemo(() => {
    if (csvColumns.length === 0) return [];
    const used = [
      ...subject.matchAll(/\{\{\s*([\w.\-_]+)\s*\}\}/g),
      ...bodyHtml.matchAll(/\{\{\s*([\w.\-_]+)\s*\}\}/g),
    ].map((m) => m[1].toLowerCase().trim());

    const available = csvColumns.map((c) => c.toLowerCase().trim());
    return [...new Set(used.filter((v) => !available.includes(v)))];
  }, [subject, bodyHtml, csvColumns]);

  // Attachment handling
  const totalAttachmentBytes = useMemo(() => {
    return attachments.reduce((sum, file) => sum + file.size, 0);
  }, [attachments]);

  const isAttachmentSizeExceeded = totalAttachmentBytes > 25 * 1024 * 1024;

  const addAttachments = (newFiles) => {
    setAttachments((prev) => [...prev, ...newFiles]);
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Apply saved template
  const applyTemplate = (tmplId) => {
    const tmpl = templatesData?.templates?.find((t) => t.id === tmplId);
    if (tmpl) {
      setSubject(tmpl.subject);
      setBodyHtml(tmpl.body_html);
      if (bodyEditorRef.current) {
        bodyEditorRef.current.innerHTML = tmpl.body_html;
      }
      toast.success(`Applied template "${tmpl.name}"`);
    }
  };

  // First recipient preview rendering with 100% newline fidelity
  const firstRecipient = includedRecipients[0] || null;
  const renderedPreview = useMemo(() => {
    const vars = firstRecipient ? firstRecipient.vars : { name: 'Alex', company: 'Acme Corp', role: 'Director' };
    const email = firstRecipient ? firstRecipient.email : 'sample.recipient@example.com';

    // Interpolate
    const renderStr = (str) => {
      if (!str) return '';
      const lookup = {};
      Object.entries(vars || {}).forEach(([k, v]) => (lookup[k.toLowerCase().trim()] = v));
      return str.replace(/\{\{\s*([\w.\-_]+)\s*\}\}/g, (match, key) => {
        const norm = key.toLowerCase().trim();
        return lookup[norm] !== undefined && lookup[norm] !== null ? String(lookup[norm]) : '';
      });
    };

    const renderedSubject = renderStr(subject);
    let rawBody = renderStr(bodyHtml);

    // If rawBody has no HTML tags (e.g. plain text with \n), convert newlines to <br> so lines never collapse!
    let renderedBody = rawBody;
    const hasHtmlTags = /<[a-z][\s\S]*>/i.test(renderedBody);
    if (!hasHtmlTags) {
      renderedBody = renderedBody.replace(/\r?\n/g, '<br>');
    }

    // Append signature if enabled
    if (appendSignature && signatureData?.signatureHtml) {
      renderedBody += `<br><br><div style="border-top: 1px solid #e2e8f0; margin-top: 16px; padding-top: 12px;">${signatureData.signatureHtml}</div>`;
    }

    return {
      to: email,
      subject: renderedSubject,
      bodyHtml: renderedBody,
    };
  }, [firstRecipient, subject, bodyHtml, appendSignature, signatureData]);

  // Trigger Send All submission
  const handleSendSubmit = async () => {
    if (!connected) {
      toast.error('Please connect your Gmail account before sending.');
      return;
    }

    if (includedRecipients.length === 0) {
      toast.error('No recipients to send to. Check your filters or add recipients.');
      return;
    }

    if (!subject.trim()) {
      toast.error('Please enter an email subject.');
      return;
    }

    if (!bodyHtml.trim()) {
      toast.error('Please enter an email body.');
      return;
    }

    if (isAttachmentSizeExceeded) {
      toast.error('Total attachments exceed the 25MB Gmail limit.');
      return;
    }

    setIsSubmitting(true);
    setConfirmOpen(false);

    try {
      let finalBodyHtml = bodyHtml;
      if (!/<[a-z][\s\S]*>/i.test(finalBodyHtml)) {
        finalBodyHtml = finalBodyHtml.replace(/\r?\n/g, '<br>');
      }

      const formData = new FormData();
      formData.append('subject', subject);
      formData.append('bodyHtml', finalBodyHtml);
      formData.append('bodyText', finalBodyHtml.replace(/<[^>]*>?/gm, ''));
      formData.append('mode', sendMode);
      formData.append('throttle', throttle);
      formData.append('appendSignature', String(appendSignature));
      formData.append('skippedCount', String(excludedCount));

      // Pass formatted recipient list with row variable data
      const payloadRecipients = includedRecipients.map((r) => ({
        email: r.email,
        vars: r.vars || {},
      }));

      formData.append('recipients', JSON.stringify(payloadRecipients));

      if (cc) formData.append('cc', cc);
      if (bcc) formData.append('bcc', bcc);

      attachments.forEach((file) => {
        formData.append('attachments', file);
      });

      const res = await api.sendBatch(formData);
      toast.success(`Batch queued! Sending to ${res.total} recipients (skipped ${excludedCount} duplicates).`);

      // Clear draft on successful batch dispatch
      clearDraftData(false);

      // Redirect user to Batches tab
      if (onSentBatch) {
        onSentBatch(res.batch_id);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to dispatch email batch.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard shortcut: Cmd/Ctrl + Enter to trigger confirmation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        setConfirmOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Compose & Dispatch
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Personalized bulk emails with CSV variable mapping, duplicate protection, and automated signature.
          </p>
        </div>

        {/* Template Quick Select, Preview, Draft Status & Clear */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Draft Auto-save Indicator & Clear */}
          {(subject.trim() || bodyHtml.trim() || recipientsList.length > 0 || recipientInput.trim()) && (
            <div className="flex items-center gap-1.5">
              <span 
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs"
                title={lastSavedAt ? `Auto-saved at ${lastSavedAt.toLocaleTimeString()}` : 'Draft is saved locally'}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>Draft saved</span>
              </span>

              <button
                type="button"
                onClick={handleClearDraft}
                title="Discard draft and reset all fields"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors border border-transparent hover:border-rose-200 dark:hover:border-rose-800"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
            </div>
          )}

          {templatesData?.templates && templatesData.templates.length > 0 && (
            <select
              onChange={(e) => {
                if (e.target.value) applyTemplate(e.target.value);
                e.target.value = '';
              }}
              defaultValue=""
              className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-xs outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="" disabled>Load Template...</option>
              {templatesData.templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Preview</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Compose Editor (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-5 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-subtle">
          
          {/* FEATURE 1 & 3: Recipients Section with CSV Import & Duplicate Smart Filtering */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Recipients
                </label>
                {totalCount > 0 && (
                  <span className="text-[11px] text-slate-400 font-medium">
                    ({totalCount} total)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Hidden CSV Input */}
                <input
                  ref={csvFileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleCsvImport}
                />

                {/* Import from CSV Button */}
                <button
                  type="button"
                  disabled={isParsingCsv}
                  onClick={() => csvFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold transition-colors border border-indigo-200 dark:border-indigo-800"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                  <span>{isParsingCsv ? 'Parsing CSV...' : 'Import from CSV'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCcBcc(!showCcBcc)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center gap-1"
                >
                  <span>{showCcBcc ? 'Hide CC/BCC' : 'CC/BCC'}</span>
                  {showCcBcc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>
            </div>

            {/* Smart Duplicate Summary Counter */}
            {totalCount > 0 && (
              <div className="flex items-center justify-between flex-wrap gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/60 text-xs">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <strong>{newCount}</strong> new
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <strong>{previouslyEmailedCount}</strong> previously emailed
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    <strong>{recentCount}</strong> recent (&le;7d)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleClearAllRecipients}
                  className="text-[11px] text-slate-400 hover:text-rose-500 transition-colors"
                >
                  Clear All
                </button>
              </div>
            )}

            {/* Smart Filter Buttons Toolbar */}
            {totalCount > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Filter className="h-3 w-3" />
                    <span>Smart Exclusion Filters:</span>
                  </span>
                  <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                    Will send to {includedRecipients.length} recipients ({excludedCount} excluded)
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 text-xs">
                  {[
                    { id: 'exclude_7', label: 'Exclude recent (last 7 days)', tooltip: 'Default: Prevents re-emailing anyone contacted in the past week' },
                    { id: 'only_new', label: 'Only new (never emailed)', tooltip: 'Sends only to contacts with 0 prior sent records' },
                    { id: 'exclude_30', label: 'Exclude if emailed in last 30 days', tooltip: 'Skips contacts emailed within the last month' },
                    { id: 'exclude_90', label: 'Exclude if emailed in last 90 days', tooltip: 'Skips contacts emailed within the last quarter' },
                    { id: 'all', label: 'Include all', tooltip: 'Sends to all imported contacts without history exclusions' },
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      title={btn.tooltip}
                      onClick={() => setFilterMode(btn.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                        filterMode === btn.id
                          ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recipient Input Area with Live Autofill Suggestions */}
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <textarea
                    rows={2}
                    placeholder="Type or paste emails... (autofills contacts from past emails & Gmail after typing 3 letters)"
                    value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    onBlur={handleBlurRecipientInput}
                    onFocus={() => {
                      if (activeRecipientToken.length >= 3 && recipientSuggestions.length > 0) {
                        setShowRecipientSuggestions(true);
                      }
                    }}
                    onKeyDown={handleKeyDownRecipientInput}
                    className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow"
                  />
                  {isSearchingSuggestions && (
                    <div className="absolute right-3 top-3 flex items-center gap-1 text-[11px] text-indigo-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleAddTypedRecipients()}
                  className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold shrink-0 h-fit self-start"
                >
                  Add
                </button>
              </div>

              {/* Floating Autocomplete Dropdown */}
              {showRecipientSuggestions && recipientSuggestions.length > 0 && (
                <div className="absolute left-0 right-14 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Matching Past Contacts & Gmail ({recipientSuggestions.length})</span>
                    </span>
                    <span className="text-[10px] text-slate-400 hidden sm:inline">
                      Press <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">Tab</kbd> to complete · <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">Enter ↵</kbd> to add directly
                    </span>
                  </div>

                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                    {recipientSuggestions.map((s, idx) => {
                      const isSelected = idx === activeSuggestionIndex;
                      const initials = s.name
                        ? s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                        : s.email.slice(0, 2).toUpperCase();

                      return (
                        <div
                          key={s.email}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            applyAutofillEmail(s.email, true, s.name);
                          }}
                          onMouseEnter={() => setActiveSuggestionIndex(idx)}
                          className={`flex items-center justify-between px-3.5 py-2.5 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-100'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                              s.source === 'both' || s.source === 'reply'
                                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800'
                            }`}>
                              {initials}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-semibold truncate">
                                  {s.email}
                                </span>
                                {s.name && (
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                    • {s.name}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                                <span>{s.label}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {isSelected && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-600 text-white shadow-2xs">
                                <span>Add</span>
                                <Check className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Color-Coded Interactive Recipient Chips */}
            {recipientsList.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Click any chip to toggle force-include or force-exclude</span>
                  <span>🟢 New &nbsp; 🟡 &gt;7d ago &nbsp; 🔴 &le;7d ago</span>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/60">
                  {recipientsList.slice(0, 150).map((r) => {
                    const isIncluded = isIncludedByFilter(r);
                    const isRecent = r.hasBeenEmailed && r.daysAgo !== null && r.daysAgo <= 7;
                    const isOlder = r.hasBeenEmailed && r.daysAgo !== null && r.daysAgo > 7;

                    let colorClasses = 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80';
                    let dotColor = 'bg-emerald-500';
                    let statusLabel = 'Never emailed before';

                    if (isRecent) {
                      colorClasses = 'bg-rose-50 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/80';
                      dotColor = 'bg-rose-500';
                      statusLabel = `Emailed ${r.daysAgo} day${r.daysAgo === 1 ? '' : 's'} ago (${formatDate(r.lastSentDate)})`;
                    } else if (isOlder) {
                      colorClasses = 'bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/80';
                      dotColor = 'bg-amber-500';
                      statusLabel = `Emailed ${r.daysAgo} days ago (${formatDate(r.lastSentDate)})`;
                    }

                    return (
                      <span
                        key={r.id}
                        onClick={() => handleToggleRecipientOverride(r.id)}
                        title={`${statusLabel} • Click to ${isIncluded ? 'exclude' : 'force-include'}`}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono border cursor-pointer select-none transition-all ${
                          isIncluded
                            ? colorClasses
                            : 'opacity-40 line-through bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
                        <span>{r.email}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveRecipient(r.id);
                          }}
                          className="hover:text-rose-600 rounded-xs"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                  {recipientsList.length > 150 && (
                    <span className="text-[11px] text-slate-400 self-center px-2">
                      +{recipientsList.length - 150} more recipients in memory
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Collapsible CC / BCC with Autocomplete */}
            {showCcBcc && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="relative">
                  <label className="text-xs text-slate-500 font-medium">CC</label>
                  <input
                    type="text"
                    placeholder="cc@example.com (type 3 chars to autofill)"
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    onFocus={() => {
                      if (activeCcToken.length >= 3 && ccSuggestions.length > 0) {
                        setShowCcSuggestions(true);
                      }
                    }}
                    onBlur={() => setTimeout(() => setShowCcSuggestions(false), 200)}
                    className="w-full mt-1 text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {showCcSuggestions && ccSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
                      <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                        {ccSuggestions.map((s) => (
                          <div
                            key={s.email}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              applyAutofillCc(s.email);
                            }}
                            className="px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer flex items-center justify-between"
                          >
                            <span className="font-mono font-medium truncate">{s.email}</span>
                            {s.name && <span className="text-[10px] text-slate-400 truncate ml-2">{s.name}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <label className="text-xs text-slate-500 font-medium">BCC</label>
                  <input
                    type="text"
                    placeholder="bcc@example.com (type 3 chars to autofill)"
                    value={bcc}
                    onChange={(e) => setBcc(e.target.value)}
                    onFocus={() => {
                      if (activeBccToken.length >= 3 && bccSuggestions.length > 0) {
                        setShowBccSuggestions(true);
                      }
                    }}
                    onBlur={() => setTimeout(() => setShowBccSuggestions(false), 200)}
                    className="w-full mt-1 text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {showBccSuggestions && bccSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
                      <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                        {bccSuggestions.map((s) => (
                          <div
                            key={s.email}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              applyAutofillBcc(s.email);
                            }}
                            className="px-3 py-2 text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/50 cursor-pointer flex items-center justify-between"
                          >
                            <span className="font-mono font-medium truncate">{s.email}</span>
                            {s.name && <span className="text-[10px] text-slate-400 truncate ml-2">{s.name}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Subject Field with Character Counter & Focus Tracking */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Subject
              </label>
              <span className={`text-[11px] ${subject.length > 78 ? 'text-amber-500 font-medium' : 'text-slate-400'}`}>
                {subject.length} characters
              </span>
            </div>
            <input
              ref={subjectInputRef}
              type="text"
              placeholder="e.g. Quick follow-up regarding {{company}}..."
              value={subject}
              onFocus={() => setLastFocusedField('subject')}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full text-sm font-medium px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Body Editor with Focus Tracking and Visual WYSIWYG Toolbar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Email Body
                </label>
                <span className="text-[11px] text-slate-400">
                  {editorMode === 'visual' ? '(Visual WYSIWYG Mode)' : '(HTML Code Mode)'}
                </span>
              </div>

              {/* Mode Toggle Tabs */}
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => switchEditorMode('visual')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    editorMode === 'visual'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Visual Editor
                </button>
                <button
                  type="button"
                  onClick={() => switchEditorMode('html')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                    editorMode === 'html'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Code className="h-3 w-3" />
                  <span>HTML Source</span>
                </button>
              </div>
            </div>

            {/* Visual Toolbar */}
            {editorMode === 'visual' && (
              <div className="relative flex flex-wrap items-center gap-1 p-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200">
                <button
                  type="button"
                  onClick={() => execEditorFormat('bold')}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-xs transition-colors"
                  title="Bold (Ctrl+B)"
                >
                  <Bold className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execEditorFormat('italic')}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-xs transition-colors"
                  title="Italic (Ctrl+I)"
                >
                  <Italic className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execEditorFormat('underline')}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-xs transition-colors"
                  title="Underline (Ctrl+U)"
                >
                  <Underline className="h-3.5 w-3.5" />
                </button>

                <span className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

                {/* Highlight Dropdown Palette */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowHighlightMenu(!showHighlightMenu);
                      setShowTextColorMenu(false);
                    }}
                    className="flex items-center gap-1 px-2 py-1 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-xs transition-colors"
                    title="Highlight Selection with Color"
                  >
                    <Highlighter className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-[11px] font-medium">Highlight</span>
                    <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                  </button>

                  {showHighlightMenu && (
                    <div className="absolute left-0 top-full mt-1.5 z-30 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-elevated w-48 space-y-2 animate-in fade-in zoom-in-95">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Highlight Color
                      </span>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[
                          { color: '#fef08a', name: 'Yellow' },
                          { color: '#bbf7d0', name: 'Light Green' },
                          { color: '#bae6fd', name: 'Soft Cyan' },
                          { color: '#fbcfe8', name: 'Soft Pink' },
                          { color: '#fed7aa', name: 'Orange' },
                        ].map((c) => (
                          <button
                            key={c.color}
                            type="button"
                            onClick={() => handleHighlightColor(c.color)}
                            title={c.name}
                            style={{ backgroundColor: c.color }}
                            className="h-6 w-6 rounded-md border border-slate-300 dark:border-slate-700 shadow-2xs hover:scale-110 transition-transform"
                          />
                        ))}
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleHighlightColor('transparent')}
                          className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        >
                          Remove
                        </button>
                        <label className="cursor-pointer text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                          <span>Custom</span>
                          <input
                            type="color"
                            className="sr-only"
                            onChange={(e) => handleHighlightColor(e.target.value)}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Text Color Dropdown Palette */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTextColorMenu(!showTextColorMenu);
                      setShowHighlightMenu(false);
                    }}
                    className="flex items-center gap-1 px-2 py-1 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-xs transition-colors"
                    title="Change Text Color"
                  >
                    <Palette className="h-3.5 w-3.5 text-indigo-500" />
                    <span className="text-[11px] font-medium">Color</span>
                    <ChevronDown className="h-2.5 w-2.5 opacity-60" />
                  </button>

                  {showTextColorMenu && (
                    <div className="absolute left-0 top-full mt-1.5 z-30 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-elevated w-48 space-y-2 animate-in fade-in zoom-in-95">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Font Color
                      </span>
                      <div className="grid grid-cols-6 gap-1.5">
                        {[
                          { color: '#0f172a', name: 'Dark Slate' },
                          { color: '#4f46e5', name: 'Indigo' },
                          { color: '#059669', name: 'Emerald' },
                          { color: '#dc2626', name: 'Crimson' },
                          { color: '#d97706', name: 'Amber' },
                          { color: '#7c3aed', name: 'Purple' },
                        ].map((c) => (
                          <button
                            key={c.color}
                            type="button"
                            onClick={() => handleTextColor(c.color)}
                            title={c.name}
                            style={{ backgroundColor: c.color }}
                            className="h-5 w-5 rounded-md border border-slate-300 dark:border-slate-700 shadow-2xs hover:scale-110 transition-transform"
                          />
                        ))}
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleTextColor('#0f172a')}
                          className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        >
                          Default
                        </button>
                        <label className="cursor-pointer text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                          <span>Custom</span>
                          <input
                            type="color"
                            className="sr-only"
                            onChange={(e) => handleTextColor(e.target.value)}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                <span className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" />

                {/* Lists & Links */}
                <button
                  type="button"
                  onClick={() => execEditorFormat('insertUnorderedList')}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-xs transition-colors"
                  title="Bullet List"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execEditorFormat('insertOrderedList')}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-xs transition-colors"
                  title="Numbered List"
                >
                  <ListOrdered className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleInsertLink}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-xs transition-colors"
                  title="Insert Hyperlink"
                >
                  <Link2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execEditorFormat('removeFormat')}
                  className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-xs transition-colors text-slate-500"
                  title="Clear Formatting"
                >
                  <RemoveFormatting className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Visual Editor (contentEditable) or Code Area */}
            {editorMode === 'visual' ? (
              <div
                ref={bodyEditorRef}
                contentEditable
                suppressContentEditableWarning
                onFocus={() => {
                  setLastFocusedField('body');
                  saveVisualSelection();
                }}
                onBlur={saveVisualSelection}
                onKeyUp={saveVisualSelection}
                onMouseUp={saveVisualSelection}
                onPaste={handlePasteInVisual}
                onInput={(e) => {
                  setBodyHtml(e.currentTarget.innerHTML);
                  saveVisualSelection();
                }}
                className="w-full min-h-[220px] max-h-[420px] overflow-y-auto text-sm font-sans p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow leading-relaxed prose dark:prose-invert max-w-none"
                style={{ wordBreak: 'break-word' }}
              />
            ) : (
              <textarea
                ref={bodyTextareaRef}
                rows={10}
                placeholder="<p>Hi {{name}},</p><p>Best regards,</p>"
                value={bodyHtml}
                onFocus={() => setLastFocusedField('body')}
                onChange={(e) => setBodyHtml(e.target.value)}
                className="w-full text-xs font-mono p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow"
              />
            )}

            {/* FEATURE 1: Dynamic Variable Chips below body editor */}
            <div className="space-y-2 pt-1">
              <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mr-1 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                  Insert variable at cursor ({lastFocusedField}):
                </span>

                {/* Standard Variables */}
                {['name', 'company', 'title'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariableAtCursor(v)}
                    className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/60 hover:bg-indigo-50 dark:hover:bg-indigo-950 font-semibold transition-all shadow-2xs active:scale-95"
                  >
                    {`{{${v}}}`}
                  </button>
                ))}

                {/* CSV Detected Column Variables */}
                {csvColumns.map((col) => {
                  const normCol = col.toLowerCase().trim();
                  if (['name', 'company', 'title', 'email'].includes(normCol)) return null;
                  return (
                    <button
                      key={col}
                      type="button"
                      onClick={() => insertVariableAtCursor(col)}
                      className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 font-semibold transition-all shadow-2xs active:scale-95"
                    >
                      {`{{${col}}}`}
                    </button>
                  );
                })}
              </div>

              {/* Warning banner if template uses missing variables */}
              {missingVariables.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                  <div>
                    <strong>Variable Warning:</strong> The template uses {missingVariables.map((v) => `{{${v}}}`).join(', ')} which were not found as columns in your uploaded CSV. For recipients without this column, it will be left blank.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* FEATURE 2: Signature Auto-Append Toggle */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer">
                <span>Append signature to every email</span>
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {signatureData?.signatureHtml
                  ? 'Your saved signature will automatically appear below the body with a divider.'
                  : 'No signature saved yet. Configure one in Settings > Email Signature.'}
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={appendSignature}
                onChange={(e) => setAppendSignature(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          {/* Attachments Dropzone */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Attachments
              </label>
              <span className={`text-[11px] font-medium ${isAttachmentSizeExceeded ? 'text-rose-500 font-semibold' : 'text-slate-400'}`}>
                {formatBytes(totalAttachmentBytes)} / 25 MB Max
              </span>
            </div>

            {isAttachmentSizeExceeded && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Total attachments exceed the 25MB Gmail limit. Please remove some files.</span>
              </div>
            )}

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files) addAttachments(Array.from(e.dataTransfer.files));
              }}
              className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-950/40 group"
              onClick={() => document.getElementById('file-upload-input')?.click()}
            >
              <input
                id="file-upload-input"
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addAttachments(Array.from(e.target.files));
                }}
              />
              <UploadCloud className="h-6 w-6 text-slate-400 group-hover:text-indigo-500 mx-auto mb-1 transition-colors" />
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Drag and drop files here, or <span className="text-indigo-600 dark:text-indigo-400">browse</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                PDFs, Images, Documents, Spreadsheets (25MB total limit)
              </p>
            </div>

            {/* Attachment Chips */}
            {attachments.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {attachments.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <File className="h-4 w-4 text-indigo-500 shrink-0" />
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{file.name}</span>
                      <span className="text-slate-400 text-[11px]">({formatBytes(file.size)})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="text-slate-400 hover:text-rose-500 p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar Controls */}
        <div className="space-y-5">
          {/* Dispatch Options & Throttle */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-subtle space-y-4">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="h-4 w-4 text-indigo-500" />
              <span>Sending Options</span>
            </h3>

            {/* Send Mode Toggle */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Send Mode
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setSendMode('individual')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    sendMode === 'individual'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Individual Sends
                </button>
                <button
                  type="button"
                  onClick={() => setSendMode('single')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    sendMode === 'single'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Single Email
                </button>
              </div>
            </div>

            {/* Throttle Slider (Default 20 = 1 send every 3s) */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-slate-600 dark:text-slate-400">
                  Rate Throttle
                </label>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  {throttle} emails / min (1 every {Math.round(60 / throttle)}s)
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={throttle}
                onChange={(e) => setThrottle(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400">
                Default 20/min = one send every 3 seconds to stay comfortably within Gmail API quotas.
              </p>
            </div>

            {/* Campaign Dispatch Summary */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Sending To:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {includedRecipients.length} recipients
                </span>
              </div>
              {excludedCount > 0 && (
                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                  <span>Filtered / Skipped:</span>
                  <span className="font-medium">{excludedCount} duplicates</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Attachments:</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {attachments.length} ({formatBytes(totalAttachmentBytes)})
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Estimated Time:</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {Math.ceil(includedRecipients.length / (throttle || 20))} min
                </span>
              </div>
            </div>

            {/* Send All Button */}
            <button
              type="button"
              disabled={isSubmitting || includedRecipients.length === 0 || isAttachmentSizeExceeded}
              onClick={() => setConfirmOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-md shadow-indigo-500/20 transition-all active:scale-98"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Enqueuing Dispatch...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Send Campaign ({includedRecipients.length})</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-slate-400 flex items-center justify-center gap-1">
              <span>Press</span>
              <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-[9px] border border-slate-200 dark:border-slate-700">
                Ctrl+Enter
              </kbd>
              <span>to send</span>
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-elevated animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Confirm Campaign Dispatch</h3>
                <p className="text-xs text-slate-500">Review parameters before enqueuing</p>
              </div>
            </div>

            <div className="space-y-2 py-2 text-xs border-y border-slate-100 dark:border-slate-800">
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Recipients to Send:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{includedRecipients.length} emails</span>
              </div>
              {excludedCount > 0 && (
                <div className="flex justify-between py-1 text-amber-600">
                  <span>Filtered / Excluded:</span>
                  <span className="font-semibold">{excludedCount} duplicates</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Subject:</span>
                <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">{subject}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Signature Appended:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{appendSignature ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Throttle:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{throttle} emails / minute (1 every {Math.round(60 / throttle)}s)</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendSubmit}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs"
              >
                Confirm & Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal: Renders FIRST recipient's email with all variables filled + signature */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-elevated overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Email Preview (Rendered)</h3>
                <p className="text-xs text-slate-500">
                  Rendered for 1st recipient: <strong>{renderedPreview.to}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Header Info */}
              <div className="space-y-1.5 text-xs border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex gap-2">
                  <span className="font-semibold text-slate-500 w-16">To:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-mono font-medium">{renderedPreview.to}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold text-slate-500 w-16">Subject:</span>
                  <span className="text-slate-900 dark:text-slate-100 font-bold">{renderedPreview.subject || '(No subject)'}</span>
                </div>
              </div>

              {/* Dedicated Attachments Section in Preview */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Attached Files ({attachments.length})
                    </span>
                    {attachments.length > 0 && (
                      <span className="text-[11px] text-slate-500 font-medium">
                        ({formatBytes(totalAttachmentBytes)})
                      </span>
                    )}
                  </div>
                  {attachments.length > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                      <Check className="h-3 w-3" /> Ready to dispatch
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">No attachments</span>
                  )}
                </div>

                {attachments.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {attachments.map((file, idx) => {
                      const isImg = file.type && file.type.startsWith('image/');
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs"
                        >
                          {isImg ? (
                            <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                              <img
                                src={URL.createObjectURL(file)}
                                alt={file.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="h-9 w-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 shrink-0 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50">
                              <File className="h-4 w-4" />
                            </div>
                          )}
                          <div className="truncate min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={file.name}>
                              {file.name}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {formatBytes(file.size)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">
                    No attachments uploaded for this email.
                  </p>
                )}
              </div>

              {/* Rendered Body with Signature (Preserves exact formatting & line breaks) */}
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Rendered Message Content
                </span>
                <div 
                  className="prose dark:prose-invert max-w-none text-sm p-5 rounded-xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800 leading-relaxed font-sans"
                  style={{ minHeight: '160px', wordBreak: 'break-word' }}
                  dangerouslySetInnerHTML={{ __html: renderedPreview.bodyHtml || '<p class="text-slate-400 italic">Empty body...</p>' }}
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
