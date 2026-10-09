import React from 'react';
import { 
  LayoutDashboard, 
  Send, 
  History, 
  Layers, 
  FileText, 
  Settings,
  Mail,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  MessageSquareReply
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';

export function Sidebar({ currentTab, setTab, isOpen, setIsOpen }) {
  const { connected, account } = useAuth();

  // Fetch unread replies count
  const { data: repliesData } = useQuery({
    queryKey: ['replies-unread-count'],
    queryFn: () => api.getReplies({ limit: 1 }),
    refetchInterval: 30000,
  });
  const unreadCount = repliesData?.unreadCount || 0;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'compose', label: 'Compose', icon: Send },
    { id: 'replies', label: 'Replies', icon: MessageSquareReply, badge: unreadCount },
    { id: 'history', label: 'History', icon: History },
    { id: 'batches', label: 'Batches', icon: Layers },
    { id: 'templates', label: 'Templates', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed top-0 bottom-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo Header */}
        <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-semibold text-sm tracking-tight text-slate-900 dark:text-white">Gmail Bulk Sender</h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Personal Dispatcher</p>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setTab(item.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group text-left",
                  isActive
                    ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/50"
                )}
              >
                <Icon className={cn(
                  "h-4 w-4 transition-transform group-hover:scale-105",
                  isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500"
                )} />
                <span className="flex-1">{item.label}</span>
                {item.badge > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white shadow-xs">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Account Status Card at Bottom */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80">
          {connected ? (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/50">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Gmail Connected
                </span>
              </div>
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate" title={account?.email}>
                {account?.email}
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  Not Connected
                </span>
              </div>
              <p className="text-[12px] text-amber-800/80 dark:text-amber-300/80 mb-2">
                Connect your Gmail to start dispatching.
              </p>
              <a
                href="http://localhost:3000/auth/google"
                className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors shadow-xs"
              >
                <span>Connect Gmail</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
