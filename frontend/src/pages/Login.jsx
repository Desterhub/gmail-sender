import React from 'react';
import { 
  Mail, 
  ShieldCheck, 
  Send, 
  MessageSquareReply, 
  Globe, 
  Users, 
  CheckCircle2, 
  Sparkles,
  ArrowRight,
  Sun,
  Moon
} from 'lucide-react';
import { useDarkMode } from '../hooks/useDarkMode';
import { cn } from '../lib/utils';

export function Login({ onSignIn }) {
  const { isDark, toggle: toggleTheme } = useDarkMode();

  const handleSignIn = () => {
    if (onSignIn) {
      onSignIn();
    } else {
      window.location.href = 'http://localhost:3000/auth/google';
    }
  };

  const highlights = [
    {
      icon: Users,
      title: 'Private Isolated Workspaces',
      desc: 'Each salesperson gets their own private send history, batch progress, and lead list.'
    },
    {
      icon: Send,
      title: 'Native Gmail Dispatching',
      desc: 'Dispatches authentically through your company Gmail box with your personal signature.'
    },
    {
      icon: MessageSquareReply,
      title: 'Dedicated Inbound Replies Hub',
      desc: 'Tracks incoming responses from your leads with deep-links to Gmail threads.'
    },
    {
      icon: Globe,
      title: 'Dual Timezone Intelligence',
      desc: 'View your local Indian Standard Time (IST) alongside recipient country local time.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative overflow-hidden transition-colors duration-200">
      {/* Background subtle mesh glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
              Jolly Clamps Pvt. Ltd.
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Enterprise Dispatcher &amp; Reply Tracker
            </p>
          </div>
        </div>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs transition-colors shadow-xs"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </header>

      {/* Center Hero Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none p-8 sm:p-10 space-y-8 animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Multi-User Sales Team Portal</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Sign In to Your Workspace
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              Connect your company Google account to access your personal dashboard, email campaigns, and customer replies.
            </p>
          </div>

          {/* Primary Action Button: Sign in with Google */}
          <div className="space-y-4">
            <button
              onClick={handleSignIn}
              className={cn(
                "w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-200",
                "bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700",
                "text-slate-800 dark:text-slate-100 hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-700/60",
                "shadow-sm hover:shadow-md hover:shadow-indigo-500/10 active:scale-[0.98] group"
              )}
            >
              {/* Google G SVG */}
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign in with Google</span>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-transform group-hover:translate-x-1" />
            </button>

            <div className="flex items-center gap-2 justify-center text-[11px] text-slate-400 dark:text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>Internal Google Workspace Authorization (@jollyclamps.com)</span>
            </div>
          </div>

          {/* Highlights List */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block text-center">
              What Each Team Member Gets
            </span>
            <div className="space-y-2.5">
              {highlights.map((h, i) => {
                const Icon = h.icon;
                return (
                  <div key={i} className="flex items-start gap-2.5 text-left">
                    <div className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {h.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                        {h.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 text-center text-xs text-slate-400 dark:text-slate-600">
        <p>Jolly Clamps Internal Dispatch Infrastructure &bull; No third-party passwords stored</p>
      </footer>
    </div>
  );
}
