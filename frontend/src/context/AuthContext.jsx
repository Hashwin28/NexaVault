import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/authApi';

/**
 * Authentication Context
 * Provides centralized authentication state (user, token, session validation)
 * and authentication methods (login, register, logout) across the application.
 */
const AuthContext = createContext(null);

/**
 * AuthProvider Component
 * Manages token persistence in localStorage and automatically verifies sessions on mount.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('nexavault_jwt_token'));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Validate stored JWT token on app mount
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('nexavault_jwt_token');
      if (storedToken) {
        try {
          const userData = await authApi.getMe(storedToken);
          setUser(userData);
          setToken(storedToken);
        } catch (err) {
          console.warn('Stored JWT invalid or expired:', err.message);
          localStorage.removeItem('nexavault_jwt_token');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authApi.login(email, password);
      setToken(res.access_token);
      setUser(res.user);
      localStorage.setItem('nexavault_jwt_token', res.access_token);
      setIsLoading(false);
      return res.user;
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
      throw err;
    }
  };

  const register = async (email, password, fullName, role) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authApi.register(email, password, fullName, role);
      setToken(res.access_token);
      setUser(res.user);
      localStorage.setItem('nexavault_jwt_token', res.access_token);
      setIsLoading(false);
      return res.user;
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('nexavault_jwt_token');
    setToken(null);
    setUser(null);
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        error,
        setError,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
