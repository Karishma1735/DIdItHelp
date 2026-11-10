import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from './api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('token')) return setReady(true);
    api
      .get('/auth/me')
      .then((r) => setUser(r.data.user))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setReady(true));
  }, []);

  const signIn = useCallback((data) => {
    localStorage.setItem('token', data.token);
    setUser(data.user);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, setUser, ready, signIn, signOut }}>{children}</AuthContext.Provider>;
}
