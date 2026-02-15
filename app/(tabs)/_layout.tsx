
import React from 'react';
import { Stack } from 'expo-router';

export default function TabLayout() {
  // Removed FloatingTabBar - no tab navigation needed
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'none',
      }}
    >
      <Stack.Screen name="(home)" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}
