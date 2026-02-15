
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WEB_DEVICE_ID_KEY = '@web_device_id';

export const getDeviceId = async (): Promise<string> => {
  try {
    if (Platform.OS === 'android') {
      const androidId = await Application.getAndroidId();
      console.log('Android Device ID:', androidId);
      return androidId || 'unknown-android-device';
    } else if (Platform.OS === 'ios') {
      const iosId = await Application.getIosIdForVendorAsync();
      console.log('iOS Device ID:', iosId);
      return iosId || 'unknown-ios-device';
    } else {
      // For web, persist the device ID in AsyncStorage so it doesn't change on reload
      console.log('Web platform - checking for persisted device ID');
      let webDeviceId = await AsyncStorage.getItem(WEB_DEVICE_ID_KEY);
      
      if (!webDeviceId) {
        webDeviceId = 'web-device-' + Math.random().toString(36).substring(7);
        await AsyncStorage.setItem(WEB_DEVICE_ID_KEY, webDeviceId);
        console.log('Generated new web device ID:', webDeviceId);
      } else {
        console.log('Using persisted web device ID:', webDeviceId);
      }
      
      return webDeviceId;
    }
  } catch (error) {
    console.error('Error getting device ID:', error);
    return 'unknown-device';
  }
};

// TV detection utility
export const isTV = (): boolean => {
  // Check if running on TV platform
  if (Platform.isTV) {
    console.log('Device detected as TV via Platform.isTV');
    return true;
  }

  // Additional heuristic checks for Android TV
  if (Platform.OS === 'android') {
    const model = Platform.constants?.Model || '';
    const brand = Platform.constants?.Brand || '';
    
    const isTVModel = model.toLowerCase().includes('tv') || 
                      brand.toLowerCase().includes('tv') ||
                      model.toLowerCase().includes('aftm') || // Fire TV
                      model.toLowerCase().includes('aftb'); // Fire TV
    
    if (isTVModel) {
      console.log('Device detected as TV via model/brand heuristics:', { model, brand });
      return true;
    }
  }

  console.log('Device detected as mobile/tablet');
  return false;
};

export const isAndroid = Platform.OS === 'android';
export const isIOS = Platform.OS === 'ios';
export const isWeb = Platform.OS === 'web';
