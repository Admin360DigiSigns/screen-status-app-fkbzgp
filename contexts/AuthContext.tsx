
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
      console.log('=== AUTH CONTEXT LOGIN START ===');
      console.log('Login attempt:', { inputUsername, inputScreenName });
      
      // Call the API service to authenticate
      const response = await apiService.login(inputUsername, inputPassword, inputScreenName);
      
      console.log('API response received:', { success: response.success, hasData: !!response.data });
      
      // Only proceed with login if the API response is successful (status 200-299)
      if (response.success) {
        console.log('✅ API returned success - proceeding with login');
        
        // Store credentials on successful login
        await AsyncStorage.setItem('username', inputUsername);
        await AsyncStorage.setItem('password', inputPassword);
        await AsyncStorage.setItem('screenName', inputScreenName);
        
        // Store additional data from the response if available
        if (response.data) {
          console.log('Storing response data:', response.data);
          
          if (response.data.display_id) {
            await AsyncStorage.setItem('displayId', response.data.display_id);
            setDisplayId(response.data.display_id);
            console.log('Stored display_id:', response.data.display_id);
          }
          if (response.data.location) {
            await AsyncStorage.setItem('location', response.data.location);
            setLocation(response.data.location);
            console.log('Stored location:', response.data.location);
          }
          if (response.data.solution) {
            console.log('Solution data received:', response.data.solution);
            
            // Store solution IDs if available
            if (response.data.solution.id) {
              await AsyncStorage.setItem('assignedSolutionId', response.data.solution.id);
              setAssignedSolutionId(response.data.solution.id);
            }
            if (response.data.solution.organization_id) {
              await AsyncStorage.setItem('organizationId', response.data.solution.organization_id);
              setOrganizationId(response.data.solution.organization_id);
            }
          }
        }
        
        setUsername(inputUsername);
        setScreenName(inputScreenName);
        setIsAuthenticated(true);
        
        console.log('✅ Login successful, credentials stored, user authenticated');
        
        // Send display status after successful login
        try {
          const deviceId = await getDeviceId();
          console.log('Sending initial display status with device ID:', deviceId);
          
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
            console.log('✅ Initial display status sent successfully');
          } else {
            console.error('❌ Failed to send initial display status:', statusResponse.error);
          }
        } catch (statusError) {
          console.error('❌ Error sending initial display status:', statusError);
          // Don't fail the login if status update fails
        }
        
        console.log('=== AUTH CONTEXT LOGIN END (SUCCESS) ===');
        return { success: true };
      } else {
        // API returned an error or non-2xx status code
        console.log('❌ API returned failure - login denied');
        console.log('Error from API:', response.error);
        console.log('=== AUTH CONTEXT LOGIN END (FAILED) ===');
        return { success: false, error: response.error || 'Login failed' };
      }
    } catch (error) {
      console.error('❌ Exception during login:', error);
      console.log('=== AUTH CONTEXT LOGIN END (EXCEPTION) ===');
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      };
    }
  };

  const logout = async () => {
    try {
      console.log('=== LOGOUT START ===');
      
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
      
      console.log('✅ Logout successful - all data cleared');
      console.log('=== LOGOUT END ===');
    } catch (error) {
      console.error('❌ Error during logout:', error);
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
