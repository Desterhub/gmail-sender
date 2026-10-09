import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FileText, 
  Plus, 
  Edit3, 
  Trash2, 
  Send, 
  Sparkles, 
  X, 
  Check,
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
  ChevronDown
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDate } from '../lib/utils';
import { toast } from 'sonner';

export function Templates({ onUseTemplate }) {
  const queryClient = useQueryClient();

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null); // null for new, or template object
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');

  // Rich Visual Editor states
  const [editorMode, setEditorMode] = useState('visual'); // 'visual' or 'html'
  const [showHighlightMenu, setShowHighlightMenu] = useState(false);
  const [showTextColorMenu, setShowTextColorMenu] = useState(false);
  const [lastFocusedField, setLastFocusedField] = useState('body'); // 'subject' or 'body'
  const subjectInputRef = useRef(null);
  const templateEditorRef = useRef(null);
  const templateTextareaRef = useRef(null);
  const savedRangeRef = useRef(null);

  // Fetch templates
  const { data, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: api.getTemplates
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (newTmpl) => api.createTemplate(newTmpl),
    onSuccess: () => {
      toast.success('Template saved successfully!');
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      closeModal();
    },
    onError: (err) => toast.error(err.message || 'Failed to create template')
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.updateTemplate(id, data),
    onSuccess: () => {
      toast.success('Template updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      closeModal();
    },
    onError: (err) => toast.error(err.message || 'Failed to update template')
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => api.deleteTemplate(id),
    onSuccess: () => {
      toast.success('Template deleted.');
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (err) => toast.error(err.message || 'Failed to delete template')
  });

  // Visual Selection Tracking
  const saveVisualSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && templateEditorRef.current?.contains(sel.anchorNode)) {
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

  const execEditorFormat = (cmd, val = null) => {
    if (editorMode !== 'visual') return;
    if (templateEditorRef.current) {
      templateEditorRef.current.focus();
      restoreVisualSelection();
      document.execCommand(cmd, false, val);
      saveVisualSelection();
      setBodyHtml(templateEditorRef.current.innerHTML);
    }
  };

  const handleHighlightColor = (color) => {
    if (editorMode !== 'visual') return;
    if (templateEditorRef.current) {
      templateEditorRef.current.focus();
      restoreVisualSelection();
      document.execCommand('hiliteColor', false, color);
      saveVisualSelection();
      setBodyHtml(templateEditorRef.current.innerHTML);
      setShowHighlightMenu(false);
    }
  };

  const handleTextColor = (color) => {
    if (editorMode !== 'visual') return;
    if (templateEditorRef.current) {
      templateEditorRef.current.focus();
      restoreVisualSelection();
      document.execCommand('foreColor', false, color);
      saveVisualSelection();
      setBodyHtml(templateEditorRef.current.innerHTML);
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
      if (templateEditorRef.current) {
        setBodyHtml(templateEditorRef.current.innerHTML);
      }
      setEditorMode('html');
    } else {
      setEditorMode('visual');
      setTimeout(() => {
        if (templateEditorRef.current) {
          templateEditorRef.current.innerHTML = bodyHtml || '';
        }
      }, 30);
    }
  };

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
      if (templateEditorRef.current) {
        setBodyHtml(templateEditorRef.current.innerHTML);
        saveVisualSelection();
      }
    }
  };

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
        const el = templateTextareaRef.current;
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
        const el = templateEditorRef.current;
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

  const openNewModal = () => {
    setEditingTemplate(null);
    setName('');
    setSubject('');
    setBodyHtml('');
    setEditorMode('visual');
    setModalOpen(true);
    setTimeout(() => {
      if (templateEditorRef.current) {
        templateEditorRef.current.innerHTML = '';
      }
    }, 40);
  };

  const openEditModal = (tmpl) => {
    setEditingTemplate(tmpl);
    setName(tmpl.name);
    setSubject(tmpl.subject);
    setBodyHtml(tmpl.body_html);
    setEditorMode('visual');
    setModalOpen(true);
    setTimeout(() => {
      if (templateEditorRef.current) {
        templateEditorRef.current.innerHTML = tmpl.body_html || '';
      }
    }, 40);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingTemplate(null);
    setName('');
    setSubject('');
    setBodyHtml('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let currentBody = editorMode === 'visual' && templateEditorRef.current
      ? templateEditorRef.current.innerHTML
      : bodyHtml;

    if (!name.trim() || !subject.trim() || !currentBody.trim()) {
      toast.error('All fields are required.');
      return;
    }

    // If plain text with newlines without HTML tags was entered, convert \n to <br>
    if (!/<[a-z][\s\S]*>/i.test(currentBody)) {
      currentBody = currentBody.replace(/\r?\n/g, '<br>');
    }

    if (editingTemplate) {
      updateMutation.mutate({
        id: editingTemplate.id,
        data: { name: name.trim(), subject: subject.trim(), bodyHtml: currentBody }
      });
    } else {
      createMutation.mutate({ name: name.trim(), subject: subject.trim(), bodyHtml: currentBody });
    }
  };

  const templates = data?.templates || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Email Templates
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Save reusable email templates with variable interpolation slots for high-speed dispatch.
          </p>
        </div>

        <button
          onClick={openNewModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs hover:shadow-indigo-500/20 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>New Template</span>
        </button>
      </div>

      {/* Grid of Templates */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <FileText className="h-6 w-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No Templates Found</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            Create your first reusable template to streamline your outreach or client follow-ups.
          </p>
          <button
            onClick={openNewModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
          >
            <Plus className="h-4 w-4" />
            <span>Create Template</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-subtle flex flex-col justify-between space-y-4 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 transition-colors group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    {tmpl.name}
                  </h3>
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditModal(tmpl)}
                      className="p-1 text-slate-400 hover:text-indigo-600 rounded-md"
                      title="Edit"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete template "${tmpl.name}"?`)) {
                          deleteMutation.mutate(tmpl.id);
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-xs font-medium text-slate-600 dark:text-slate-300 line-clamp-1">
                  Subject: {tmpl.subject}
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 font-sans text-[11px] leading-relaxed overflow-hidden">
                  <div 
                    className="prose dark:prose-invert max-w-none text-xs line-clamp-3"
                    dangerouslySetInnerHTML={{ __html: tmpl.body_html }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">
                  {formatDate(tmpl.created_at)}
                </span>
                <button
                  onClick={() => onUseTemplate(tmpl)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 font-semibold text-xs transition-colors"
                >
                  <Send className="h-3 w-3" />
                  <span>Use in Compose</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal with Rich Visual Editor */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-elevated animate-in zoom-in-95 duration-150 flex flex-col overflow-hidden">
            {/* Header (Sticky at top) */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingTemplate ? 'Edit Email Template' : 'Create New Template'}
                </h3>
                <p className="text-xs text-slate-500">
                  Compose with rich formatting, bolding, highlights, and bullet lists
                </p>
              </div>
              <button onClick={closeModal} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmit} id="template-edit-form" className="p-5 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Template Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sales Outreach Step 1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1.5 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Subject Line
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {subject.length} characters
                  </span>
                </div>
                <input
                  ref={subjectInputRef}
                  type="text"
                  placeholder="e.g. Quick check-in regarding {{company}}..."
                  value={subject}
                  onFocus={() => setLastFocusedField('subject')}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full mt-1.5 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Body Editor with WYSIWYG Toolbar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Template Body
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {editorMode === 'visual' ? '(Visual WYSIWYG)' : '(HTML Source)'}
                    </span>
                  </div>

                  {/* Mode switcher tabs */}
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
                      <span>HTML</span>
                    </button>
                  </div>
                </div>

                {/* Rich Toolbar */}
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
                        title="Highlight Text with Color"
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

                {/* Editor Surface */}
                {editorMode === 'visual' ? (
                  <div
                    ref={templateEditorRef}
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
                    className="w-full min-h-[180px] max-h-[320px] overflow-y-auto text-sm font-sans p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow leading-relaxed prose dark:prose-invert max-w-none"
                    style={{ wordBreak: 'break-word' }}
                  />
                ) : (
                  <textarea
                    ref={templateTextareaRef}
                    rows={8}
                    placeholder="<p>Hi {{name}},</p><p>I'm reaching out regarding...</p>"
                    value={bodyHtml}
                    onFocus={() => setLastFocusedField('body')}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    className="w-full text-xs font-mono p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}

                {/* Quick Variable Chips */}
                <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mr-1 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-indigo-500" />
                    Insert variable at cursor ({lastFocusedField}):
                  </span>
                  {['name', 'company', 'title'].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariableAtCursor(v)}
                      className="px-2 py-0.5 text-[11px] font-mono rounded-md bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/60 hover:bg-indigo-50 dark:hover:bg-indigo-950 font-semibold transition-all shadow-2xs"
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>
            </form>

            {/* Sticky Action Footer */}
            <div className="p-4 px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="template-edit-form"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
