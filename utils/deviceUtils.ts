
import * as Application from 'expo-application';
import * as Device from 'expo-device';
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

// TV detection utility - FIXED FOR ANDROID TV
export const isTV = (): boolean => {
  console.log('🔍 [isTV] Starting TV detection...');
  console.log('🔍 [isTV] Platform.OS:', Platform.OS);
  console.log('🔍 [isTV] Platform.isTV:', Platform.isTV);
  
  // Check if running on TV platform (most reliable)
  if (Platform.isTV) {
    console.log('✅ [isTV] Device detected as TV via Platform.isTV');
    return true;
  }

  // Check Device.deviceType for TV
  if (Device.deviceType === Device.DeviceType.TV) {
    console.log('✅ [isTV] Device detected as TV via Device.deviceType');
    return true;
  }

  // Additional heuristic checks for Android TV
  if (Platform.OS === 'android') {
    const model = (Device.modelName || '').toLowerCase();
    const brand = (Device.brand || '').toLowerCase();
    const deviceName = (Device.deviceName || '').toLowerCase();
    
    console.log('🔍 [isTV] Android device info:', {
      model,
      brand,
      deviceName,
      deviceType: Device.deviceType,
    });
    
    // Check for TV-specific keywords in model, brand, or device name
    const tvKeywords = ['tv', 'aftm', 'aftb', 'firetv', 'chromecast', 'shield', 'mibox', 'androidtv'];
    const isTVModel = tvKeywords.some(keyword => 
      model.includes(keyword) || 
      brand.includes(keyword) || 
      deviceName.includes(keyword)
    );
    
    if (isTVModel) {
      console.log('✅ [isTV] Device detected as TV via model/brand heuristics');
      return true;
    }
  }

  // Check for iOS/tvOS
  if (Platform.OS === 'ios') {
    const model = (Device.modelName || '').toLowerCase();
    if (model.includes('appletv') || model.includes('tv')) {
      console.log('✅ [isTV] Device detected as Apple TV');
      return true;
    }
  }

  console.log('❌ [isTV] Device detected as mobile/tablet');
  return false;
};

export const isAndroid = Platform.OS === 'android';
export const isIOS = Platform.OS === 'ios';
export const isWeb = Platform.OS === 'web';
