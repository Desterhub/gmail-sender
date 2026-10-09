import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from 'sonner';

export function useAuth() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('auth_token') || '';
    } catch (e) {
      return '';
    }
  });

  // Check URL query parameters for auth_token on OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authToken = params.get('auth_token');
    const authSuccess = params.get('auth_success');
    const authError = params.get('auth_error');

    if (authToken) {
      try {
        localStorage.setItem('auth_token', authToken);
      } catch (e) {}
      setToken(authToken);
      toast.success('Signed in successfully with Google!');
      // Clean query params from URL cleanly without reloading
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    } else if (authSuccess === 'true') {
      toast.success('Gmail account connected successfully!');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authError) {
      toast.error(`Authentication failed: ${decodeURIComponent(authError)}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Fetch current authenticated salesperson
  const { data: meData, isLoading, error, refetch } = useQuery({
    queryKey: ['authMe', token],
    queryFn: async () => {
      try {
        return await api.getMe();
      } catch (err) {
        // Fallback to auth status check for dev/transition
        const status = await api.getAuthStatus();
        if (status && status.connected && status.account) {
          return { authenticated: true, user: status.account };
        }
        throw err;
      }
    },
    staleTime: 60 * 1000,
    retry: false
  });

  const disconnectMutation = useMutation({
    mutationFn: api.disconnectAuth,
    onSuccess: () => {
      try {
        localStorage.removeItem('auth_token');
      } catch (e) {}
      setToken('');
      queryClient.clear();
      toast.success('Account disconnected successfully');
    },
    onError: (err) => {
      toast.error(`Failed to disconnect: ${err.message}`);
    }
  });

  const logout = () => {
    try {
      localStorage.removeItem('auth_token');
    } catch (e) {}
    setToken('');
    queryClient.clear();
    toast.info('Signed out successfully');
  };

  const loginWithGoogle = () => {
    window.location.href = 'http://localhost:3000/auth/google';
  };

  const user = meData?.user || null;
  const isAuthenticated = !!user;

  return {
    isAuthenticated,
    connected: isAuthenticated,
    user,
    account: user,
    token,
    isLoading,
    error,
    refetch,
    logout,
    loginWithGoogle,
    disconnect: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending
  };
}
