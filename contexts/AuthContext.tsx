
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  screenName: string | null;
  login: (username: string, password: string, screenName: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [screenName, setScreenName] = useState<string | null>(null);

  useEffect(() => {
    loadAuthState();
  }, []);

  const loadAuthState = async () => {
    try {
      const storedUsername = await AsyncStorage.getItem('username');
      const storedScreenName = await AsyncStorage.getItem('screenName');
      
      if (storedUsername && storedScreenName) {
        setUsername(storedUsername);
        setScreenName(storedScreenName);
        setIsAuthenticated(true);
        console.log('Loaded auth state:', { storedUsername, storedScreenName });
      }
    } catch (error) {
      console.error('Error loading auth state:', error);
    }
  };

  const login = async (
    inputUsername: string,
    inputPassword: string,
    inputScreenName: string
  ): Promise<boolean> => {
    try {
      // Mock authentication - replace with real authentication
      // For demo purposes, accept any username/password combination
      console.log('Login attempt:', { inputUsername, inputScreenName });
      
      // In a real app, you would validate credentials against a backend
      if (inputUsername && inputPassword && inputScreenName) {
        await AsyncStorage.setItem('username', inputUsername);
        await AsyncStorage.setItem('screenName', inputScreenName);
        
        setUsername(inputUsername);
        setScreenName(inputScreenName);
        setIsAuthenticated(true);
        
        console.log('Login successful');
        return true;
      }
      
      console.log('Login failed - missing credentials');
      return false;
    } catch (error) {
      console.error('Error during login:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('username');
      await AsyncStorage.removeItem('screenName');
      
      setUsername(null);
      setScreenName(null);
      setIsAuthenticated(false);
      
      console.log('Logout successful');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, screenName, login, logout }}>
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
