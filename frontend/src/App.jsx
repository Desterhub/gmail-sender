import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Compose } from './pages/Compose';
import { History } from './pages/History';
import { Batches } from './pages/Batches';
import { Templates } from './pages/Templates';
import { Settings } from './pages/Settings';
import { Replies } from './pages/Replies';
import { Login } from './pages/Login';
import { useAuth } from './hooks/useAuth';
import { useDarkMode } from './hooks/useDarkMode';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  },
});

export function MainApp() {
  const [currentTab, setCurrentTab] = useState(() => {
    try {
      return localStorage.getItem('gmail_sender_active_tab') || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });
  const [selectedTemplateForCompose, setSelectedTemplateForCompose] = useState(null);
  const [activeBatchId, setActiveBatchId] = useState(null);
  const { isDark } = useDarkMode();
  const { isAuthenticated, isLoading, loginWithGoogle } = useAuth();

  // Persist active tab across browser reloads / navigations
  React.useEffect(() => {
    try {
      localStorage.setItem('gmail_sender_active_tab', currentTab);
    } catch (e) {}
  }, [currentTab]);

  const handleUseTemplate = (template) => {
    setSelectedTemplateForCompose(template);
    setCurrentTab('compose');
  };

  const handleSentBatch = (batchId) => {
    setActiveBatchId(batchId);
    setCurrentTab('batches');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="h-10 w-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Loading your workspace...</p>
      </div>
    );
  }

  // Unauthenticated: Render Sign-in Page
  if (!isAuthenticated) {
    return (
      <>
        <Toaster 
          richColors 
          position="top-right" 
          theme={isDark ? 'dark' : 'light'} 
        />
        <Login onSignIn={loginWithGoogle} />
      </>
    );
  }

  return (
    <>
      <Toaster 
        richColors 
        position="top-right" 
        theme={isDark ? 'dark' : 'light'} 
      />

      <Layout currentTab={currentTab} setTab={setCurrentTab}>
        {/* Keep Compose mounted so switching in-app tabs never unmounts or wipes half-filled draft */}
        <div className={currentTab === 'compose' ? 'block' : 'hidden'}>
          <Compose 
            prefillTemplate={selectedTemplateForCompose} 
            onClearPrefill={() => setSelectedTemplateForCompose(null)}
            onSentBatch={handleSentBatch}
          />
        </div>

        {currentTab === 'dashboard' && (
          <Dashboard onNavigate={(tab) => setCurrentTab(tab)} />
        )}

        {currentTab === 'replies' && (
          <Replies />
        )}

        {currentTab === 'history' && (
          <History />
        )}

        {currentTab === 'batches' && (
          <Batches initialBatchId={activeBatchId} />
        )}

        {currentTab === 'templates' && (
          <Templates onUseTemplate={handleUseTemplate} />
        )}

        {currentTab === 'settings' && (
          <Settings />
        )}
      </Layout>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainApp />
    </QueryClientProvider>
  );
}
