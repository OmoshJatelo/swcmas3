import React, { createContext, useContext, useEffect, useState } from 'react';
import { login as loginApi, register as registerApi, refreshToken as refreshTokenApi, logout as logoutApi } from '@/api/auth.api.js';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);

  // Load from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      try {
        const { exp } = jwtDecode(storedToken);
        const now = Date.now() / 1000;
        if (exp > now) {
          setAccessToken(storedToken);
          setUser(JSON.parse(storedUser));
        } else {
          // Token expired, clear storage
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
        }
      } catch (e) {
        console.error('Invalid token in storage', e);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
      }
    }
  }, []);

  // Refresh token automatically when access token is about to expire
  useEffect(() => {
    if (!accessToken) return;
    const { exp } = jwtDecode(accessToken);
    const now = Date.now() / 1000;
    const delay = (exp - now - 60) * 1000; // 60 seconds before expiry
    if (delay <= 0) return;
    const timer = setTimeout(async () => {
      try {
        const { accessToken: newToken, user: refreshedUser } = await refreshTokenApi();
        setAccessToken(newToken);
        setUser(refreshedUser);
        localStorage.setItem('accessToken', newToken);
        localStorage.setItem('user', JSON.stringify(refreshedUser));
      } catch (err) {
        console.error('Token refresh failed', err);
        logout();
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [accessToken]);

  const login = async (email, password) => {
    const { accessToken: token, user: loggedUser } = await loginApi(email, password);
    setAccessToken(token);
    setUser(loggedUser);
    localStorage.setItem('accessToken', token);
    localStorage.setItem('user', JSON.stringify(loggedUser));
  };

  const register = async (payload) => {
    const { accessToken: token, user: newUser } = await registerApi(payload);
    setAccessToken(token);
    setUser(newUser);
    localStorage.setItem('accessToken', token);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  const logout = async () => {
    try {
      await logoutApi();
    } catch (e) {
      console.error('Logout error', e);
    }
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
  };

  const value = {
    user,
    accessToken,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
