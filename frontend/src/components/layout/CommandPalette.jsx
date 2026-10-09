import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  LayoutDashboard, 
  Send, 
  History, 
  Layers, 
  FileText, 
  Settings, 
  Sun, 
  Moon, 
  Download,
  Mail,
  X
} from 'lucide-react';
import { useDarkMode } from '../../hooks/useDarkMode';

export function CommandPalette({ isOpen, onClose, onSelectTab }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const { isDark, toggle: toggleDark } = useDarkMode();

  const actions = [
    { id: 'dashboard', title: 'Go to Dashboard', category: 'Navigation', icon: LayoutDashboard, action: () => onSelectTab('dashboard') },
    { id: 'compose', title: 'Compose New Email Batch', category: 'Actions', icon: Send, action: () => onSelectTab('compose') },
    { id: 'history', title: 'View Send History', category: 'Navigation', icon: History, action: () => onSelectTab('history') },
    { id: 'batches', title: 'View All Batches', category: 'Navigation', icon: Layers, action: () => onSelectTab('batches') },
    { id: 'templates', title: 'Manage Email Templates', category: 'Navigation', icon: FileText, action: () => onSelectTab('templates') },
    { id: 'settings', title: 'Application Settings', category: 'Navigation', icon: Settings, action: () => onSelectTab('settings') },
    { 
      id: 'theme', 
      title: isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme', 
      category: 'Preferences', 
      icon: isDark ? Sun : Moon, 
      action: () => toggleDark() 
    },
    { 
      id: 'export', 
      title: 'Export Full History as CSV', 
      category: 'Actions', 
      icon: Download, 
      action: () => { window.location.href = '/api/export/csv'; } 
    },
    { 
      id: 'connect', 
      title: 'Connect / Reconnect Gmail', 
      category: 'Authentication', 
      icon: Mail, 
      action: () => { window.location.href = 'http://localhost:3000/auth/google'; } 
    }
  ];

  const filtered = actions.filter((a) =>
    a.title.toLowerCase().includes(query.toLowerCase()) ||
    a.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-950/60 backdrop-blur-xs">
      <div 
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-elevated border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="relative flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search className="h-4 w-4 text-slate-400 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No matching actions or commands found.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-colors ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span>{item.title}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-normal px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                    {item.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span>Navigate with <kbd className="font-mono">↑</kbd> <kbd className="font-mono">↓</kbd></span>
          <span>Select with <kbd className="font-mono">Enter</kbd></span>
          <span>Close with <kbd className="font-mono">Esc</kbd></span>
        </div>
      </div>
    </div>
  );
}
