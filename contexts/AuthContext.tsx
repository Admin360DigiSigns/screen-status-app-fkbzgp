
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as apiService from '@/utils/apiService';
import { getDeviceId } from '@/utils/deviceUtils';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  screenName: string | null;
  displayId: string | null;
  location: string | null;
  assignedSolutionId: string | null;
  organizationId: string | null;
  login: (username: string, password: string, screenName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [screenName, setScreenName] = useState<string | null>(null);
  const [displayId, setDisplayId] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [assignedSolutionId, setAssignedSolutionId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    loadAuthState();
  }, []);

  const loadAuthState = async () => {
    try {
      const storedUsername = await AsyncStorage.getItem('username');
      const storedScreenName = await AsyncStorage.getItem('screenName');
      const storedDisplayId = await AsyncStorage.getItem('displayId');
      const storedLocation = await AsyncStorage.getItem('location');
      const storedAssignedSolutionId = await AsyncStorage.getItem('assignedSolutionId');
      const storedOrganizationId = await AsyncStorage.getItem('organizationId');
      
      if (storedUsername && storedScreenName) {
        setUsername(storedUsername);
        setScreenName(storedScreenName);
        setDisplayId(storedDisplayId);
        setLocation(storedLocation);
        setAssignedSolutionId(storedAssignedSolutionId);
        setOrganizationId(storedOrganizationId);
        setIsAuthenticated(true);
        console.log('Loaded auth state:', { 
          storedUsername, 
          storedScreenName, 
          storedDisplayId,
          storedLocation 
        });
      }
    } catch (error) {
      console.error('Error loading auth state:', error);
    }
  };

  const login = async (
    inputUsername: string,
    inputPassword: string,
    inputScreenName: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('Login attempt:', { inputUsername, inputScreenName });
      
      // Call the API service to authenticate
      const response = await apiService.login(inputUsername, inputPassword, inputScreenName);
      
      if (response.success) {
        // Store credentials on successful login
        await AsyncStorage.setItem('username', inputUsername);
        await AsyncStorage.setItem('password', inputPassword);
        await AsyncStorage.setItem('screenName', inputScreenName);
        
        // Store additional data from the response if available
        if (response.data) {
          if (response.data.display_id) {
            await AsyncStorage.setItem('displayId', response.data.display_id);
            setDisplayId(response.data.display_id);
          }
          if (response.data.location) {
            await AsyncStorage.setItem('location', response.data.location);
            setLocation(response.data.location);
          }
          if (response.data.solution) {
            // Store solution data if needed
            console.log('Solution data received:', response.data.solution);
          }
        }
        
        setUsername(inputUsername);
        setScreenName(inputScreenName);
        setIsAuthenticated(true);
        
        console.log('Login successful, credentials stored');
        
        // Send display status after successful login
        try {
          const deviceId = await getDeviceId();
          console.log('Sending display status with device ID:', deviceId);
          
          const statusResponse = await apiService.sendDisplayStatus(
            deviceId,
            inputScreenName,
            inputUsername,
            inputPassword,
            'online',
            response.data?.location,
            response.data?.solution?.id,
            response.data?.solution?.organization_id
          );
          
          if (statusResponse.success) {
            console.log('Display status sent successfully');
          } else {
            console.error('Failed to send display status:', statusResponse.error);
          }
        } catch (statusError) {
          console.error('Error sending display status:', statusError);
          // Don't fail the login if status update fails
        }
        
        return { success: true };
      } else {
        console.log('Login failed:', response.error);
        return { success: false, error: response.error };
      }
    } catch (error) {
      console.error('Error during login:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('username');
      await AsyncStorage.removeItem('password');
      await AsyncStorage.removeItem('screenName');
      await AsyncStorage.removeItem('displayId');
      await AsyncStorage.removeItem('location');
      await AsyncStorage.removeItem('assignedSolutionId');
      await AsyncStorage.removeItem('organizationId');
      
      setUsername(null);
      setScreenName(null);
      setDisplayId(null);
      setLocation(null);
      setAssignedSolutionId(null);
      setOrganizationId(null);
      setIsAuthenticated(false);
      
      console.log('Logout successful');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      username, 
      screenName, 
      displayId,
      location,
      assignedSolutionId,
      organizationId,
      login, 
      logout 
    }}>
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
