import React, { useState, useEffect } from 'react';
import { Redirect } from 'expo-router';

import { useAdminAuth } from '@/context/admin-auth-context';
import { AdminLoadingScreen } from '@/components/AdminLoadingScreen';

export default function IndexScreen() {
  const { initializing, token } = useAdminAuth();
  const [minLoadingComplete, setMinLoadingComplete] = useState(false);

  useEffect(() => {
    // Add a minimum delay of 2.5 seconds to show the loading screen animation
    const timer = setTimeout(() => {
      setMinLoadingComplete(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  if (initializing || !minLoadingComplete) {
    return <AdminLoadingScreen />;
  }

  return <Redirect href={token ? '/(tabs)' : '/login'} />;
}
