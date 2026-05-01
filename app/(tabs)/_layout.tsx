import { Tabs } from 'expo-router';
import React from 'react';
import { Ionicons } from '@expo/vector-icons';

import { HapticTab } from '@/components/haptic-tab';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: '#008080',
        tabBarInactiveTintColor: '#8AA09D',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E3ECEA',
          height: 70,
          paddingBottom: 10,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
          marginTop: -2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="grid-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          title: 'Support',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="headset-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="person-circle-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}
