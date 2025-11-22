
import * as Application from 'expo-application';
import { Platform } from 'react-native';

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
      console.log('Web platform - using random ID');
      return 'web-device-' + Math.random().toString(36).substring(7);
    }
  } catch (error) {
    console.error('Error getting device ID:', error);
    return 'unknown-device';
  }
};
