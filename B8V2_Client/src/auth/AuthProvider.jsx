import { createContext, useContext, useMemo, useState } from 'react';
import { loginApi } from '../api/auth.api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('b8v2_user')) || null;
    } catch {
      return null;
    }
  });

  const login = async (username, password) => {
    const result = await loginApi({ username, password });
    localStorage.setItem('b8v2_token', result.token);
    localStorage.setItem('b8v2_user', JSON.stringify(result.user));
    setUser(result.user);
    return result.user;
  };

  const logout = () => {
    localStorage.removeItem('b8v2_token');
    localStorage.removeItem('b8v2_user');
    setUser(null);
  };

  const hasRole = (...roles) => {
    const owned = user?.roles || [];
    return owned.includes('ADMIN') || roles.some(r => owned.includes(r));
  };

  const value = useMemo(() => ({ user, login, logout, hasRole }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
