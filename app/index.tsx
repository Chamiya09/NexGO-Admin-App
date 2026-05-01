import React from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAdminAuth } from '@/context/admin-auth-context';

export default function IndexScreen() {
  const { initializing, token } = useAdminAuth();

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F8F7' }}>
        <ActivityIndicator color="#008080" />
      </View>
    );
  }

  return <Redirect href={token ? '/(tabs)' : '/login'} />;
}
