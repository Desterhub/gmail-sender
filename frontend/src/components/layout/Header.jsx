import React from 'react';
import { 
  Menu, 
  Sun, 
  Moon, 
  LogOut, 
  Command, 
  Plus, 
  Mail,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useDarkMode } from '../../hooks/useDarkMode';

export function Header({ onMenuClick, onOpenCommandPalette, onNewEmail }) {
  const { connected, account, disconnect, isDisconnecting } = useAuth();
  const { isDark, toggle: toggleTheme } = useDarkMode();

  return (
    <header className="sticky top-0 z-20 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 lg:px-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-700/80 text-slate-500 dark:text-slate-400 text-xs font-medium transition-colors border border-slate-200/50 dark:border-slate-700/50"
        >
          <Command className="h-3.5 w-3.5" />
          <span>Quick actions...</span>
          <kbd className="ml-2 px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded shadow-xs">
            Ctrl+K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-3">
        {/* Quick New Email Button */}
        <button
          onClick={onNewEmail}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-all shadow-xs hover:shadow-indigo-500/20 active:scale-98"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Email</span>
        </button>

        {/* Connected Salesperson Account & Actions */}
        {connected ? (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-medium" title={account?.email}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="truncate max-w-[170px]">{account?.email}</span>
            </div>

            {/* Switch / Add Colleague Account */}
            <a
              href="http://localhost:3000/auth/google"
              title="Switch account or sign in with another Google mailbox"
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors hidden md:inline-flex items-center gap-1"
            >
              <span>Switch Account</span>
            </a>

            {/* Sign Out */}
            <button
              onClick={() => {
                if (window.confirm('Sign out of your session?')) {
                  disconnect();
                }
              }}
              disabled={isDisconnecting}
              title="Sign Out"
              className="p-2 rounded-xl text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <a
            href="http://localhost:3000/auth/google"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors shadow-xs"
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Sign In with Google</span>
          </a>
        )}

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
