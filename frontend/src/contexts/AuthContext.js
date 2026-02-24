import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const getStoredUser = () => {
    try {
      const raw = localStorage.getItem('diet_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      localStorage.removeItem('diet_user');
      return null;
    }
  };

  const [user, setUser] = useState(getStoredUser);
  const [token, setToken] = useState(localStorage.getItem('diet_token'));
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const res = await api.get('/profile');
      setUser(res.data);
      localStorage.setItem('diet_user', JSON.stringify(res.data));
    } catch (err) {
      if (err?.response?.status === 401) {
        localStorage.removeItem('diet_token');
        localStorage.removeItem('diet_user');
        setToken(null);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('diet_token', res.data.token);
    localStorage.setItem('diet_user', JSON.stringify(res.data.user));
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    localStorage.setItem('diet_token', res.data.token);
    localStorage.setItem('diet_user', JSON.stringify(res.data.user));
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const updateUser = (data) => {
    setUser((prev) => {
      const nextUser = { ...prev, ...data };
      localStorage.setItem('diet_user', JSON.stringify(nextUser));
      return nextUser;
    });
  };

  const logout = () => {
    localStorage.removeItem('diet_token');
    localStorage.removeItem('diet_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser, loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
