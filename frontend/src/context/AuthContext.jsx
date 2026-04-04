import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(localStorage.getItem('accessToken'));
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refreshToken'));
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef(null);

  const isAuthenticated = !!user && !!accessToken;

  const clearAuth = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const scheduleTokenRefresh = useCallback((token) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = payload.exp * 1000;
      const refreshAt = expiresAt - 60 * 1000; // 1 minute before expiry
      const delay = refreshAt - Date.now();

      if (delay > 0) {
        refreshTimerRef.current = setTimeout(async () => {
          const stored = localStorage.getItem('refreshToken');
          if (!stored) return;
          try {
            const data = await authService.refreshToken(stored);
            const newAccess = data.access;
            setAccessToken(newAccess);
            localStorage.setItem('accessToken', newAccess);
            if (data.refresh) {
              setRefreshToken(data.refresh);
              localStorage.setItem('refreshToken', data.refresh);
            }
            scheduleTokenRefresh(newAccess);
          } catch {
            clearAuth();
          }
        }, delay);
      }
    } catch {
      // Token is not a valid JWT — skip scheduling
    }
  }, [clearAuth]);

  const login = async (email, password) => {
    const data = await authService.login(email, password);
    const { tokens, user: userData } = data;
    const { access, refresh } = tokens;

    setAccessToken(access);
    setRefreshToken(refresh);
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);

    if (userData) {
      setUser(userData);
    } else {
      const me = await authService.getCurrentUser();
      setUser(me);
    }

    scheduleTokenRefresh(access);
    return data;
  };

  const register = async (userData) => {
    const data = await authService.register(userData);
    const { tokens, user: newUser } = data;
    const access = tokens?.access;
    const refresh = tokens?.refresh;

    if (access && refresh) {
      setAccessToken(access);
      setRefreshToken(refresh);
      localStorage.setItem('accessToken', access);
      localStorage.setItem('refreshToken', refresh);

      if (newUser) {
        setUser(newUser);
      } else {
        const me = await authService.getCurrentUser();
        setUser(me);
      }

      scheduleTokenRefresh(access);
    }

    return data;
  };

  const refreshUser = async () => {
    try {
      const me = await authService.getCurrentUser();
      setUser(me);
    } catch {
      // ignore
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Logout endpoint may fail — clear local state regardless
    }
    clearAuth();
  };

  useEffect(() => {
    const loadUser = async () => {
      if (!accessToken) {
        setLoading(false);
        return;
      }
      try {
        const me = await authService.getCurrentUser();
        setUser(me);
        scheduleTokenRefresh(accessToken);
      } catch {
        clearAuth();
      } finally {
        setLoading(false);
      }
    };

    loadUser();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider
      value={{ user, accessToken, refreshToken, isAuthenticated, loading, login, logout, register, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
