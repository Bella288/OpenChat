import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

interface User {
  id: string;
  username: string;
}

interface AuthContextProps {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing user session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // For simplicity, we're using localStorage for auth state
        // In a real application, you'd check for a valid session with the server
        const savedUser = localStorage.getItem('chat_user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
      } catch (err) {
        console.error('Auth check error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Simple login implementation - in a real app, we'd call an API
      // This is just for demonstration purposes
      const mockUser = { id: `user_${Date.now()}`, username };
      
      // Store user in localStorage for persistence
      localStorage.setItem('chat_user', JSON.stringify(mockUser));
      setUser(mockUser);
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Simple signup implementation - in a real app, we'd call an API
      // This is just for demonstration purposes
      const mockUser = { id: `user_${Date.now()}`, username };
      
      // Store user in localStorage for persistence
      localStorage.setItem('chat_user', JSON.stringify(mockUser));
      setUser(mockUser);
    } catch (err: any) {
      setError(err.message || 'Signup failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Remove user from localStorage
      localStorage.removeItem('chat_user');
      setUser(null);
    } catch (err: any) {
      setError(err.message || 'Logout failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};