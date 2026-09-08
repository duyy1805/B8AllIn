import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loginApi, meApi } from '../api/auth.api';
import { clearAuth, getAuthToken, getStoredUser, storeAuth, updateStoredUser } from './authStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);

  useEffect(() => {
    if (!getAuthToken()) return;
    meApi().then(currentUser => {
      updateStoredUser(currentUser);
      setUser(currentUser);
    }).catch(() => {
      clearAuth();
      setUser(null);
    });
  }, []);

  const login = async (username, password, remember = true) => {
    const result = await loginApi({ username, password });
    storeAuth(result.token, result.user, remember);
    setUser(result.user);
    return result.user;
  };

  const logout = () => {
    clearAuth();
    setUser(null);
  };

  const hasRole = (...roles) => {
    const owned = user?.roles || [];
    return owned.includes('ADMIN') || roles.some(r => owned.includes(r));
  };

  const hasPermission = (...permissions) => {
    const roles = user?.roles || [];
    const owned = user?.permissions || [];
    return roles.includes('ADMIN') || permissions.every(permission => owned.includes(permission));
  };

  const value = useMemo(() => ({ user, login, logout, hasRole, hasPermission }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
