import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { API_BASE_URL, authFetch, parseApiResponse } from '@/lib/api';

type AdminAnalytics = {
  totalRevenue: number;
  activeRides: number;
  cancelledRides: number;
  waitTimeAvg: string | number;
};

export function AdminAnalyticsOverview() {
  const theme = Colors['light'];
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchAnalytics = async () => {
      try {
        const response = await authFetch(`${API_BASE_URL}/admin/dashboard/analytics`);
        const result = await parseApiResponse<AdminAnalytics>(response);
        
        if (isMounted) {
          setData(result);
        }
      } catch (error) {
        console.error('Failed to load dashboard analytics', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000); // Refresh every 30 seconds

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const palette = {
    background: theme.background,
    cardBg: '#FFFFFF',
    text: theme.text,
    subText: '#617C79',
    accent: '#008080',
    border: '#E8F0EF',
    lightAccent: '#F0F5F4',
    secondaryAccent: '#D9534F', // for negative/attention metrics
    secondaryLight: '#FDF0F0'
  };

  const metrics = [
    { 
      title: 'Total Revenue', 
      amount: `Rs. ${data?.totalRevenue.toLocaleString() || 0}`, 
      percent: 'Today', 
      isPositive: true,
      icon: 'wallet-outline' as const
    },
    { 
      title: 'Current Active Rides', 
      amount: data?.activeRides.toString() || '0', 
      percent: 'Live', 
      isPositive: true,
      icon: 'navigate-circle-outline' as const
    },
    { 
      title: 'Wait-time Avg', 
      amount: `${data?.waitTimeAvg || 0} min`, 
      percent: 'Live', 
      isPositive: true,
      icon: 'time-outline' as const
    },
    { 
      title: 'Cancelled Rides', 
      amount: data?.cancelledRides.toString() || '0', 
      percent: 'Today', 
      isPositive: false,
      icon: 'close-circle-outline' as const
    }
  ];

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Platform Performance</Text>
        {loading && !data && <ActivityIndicator size="small" color={palette.accent} />}
      </View>
      
      <View style={styles.grid}>
        {metrics.map((metric, index) => (
          <View key={index} style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.border }]}>
            <View style={styles.cardHeader}>
              <View style={[
                styles.iconBox, 
                { backgroundColor: metric.isPositive ? palette.lightAccent : palette.secondaryLight }
              ]}>
                <Ionicons 
                  name={metric.icon} 
                  size={20} 
                  color={metric.isPositive ? palette.accent : palette.secondaryAccent} 
                />
              </View>
              <View style={[
                styles.badge, 
                { backgroundColor: metric.isPositive ? palette.lightAccent : palette.secondaryLight }
              ]}>
                <Ionicons 
                  name={metric.isPositive ? "trending-up" : "trending-down"} 
                  size={12} 
                  color={metric.isPositive ? palette.accent : palette.secondaryAccent} 
                />
                <Text style={[
                  styles.badgeText, 
                  { color: metric.isPositive ? palette.accent : palette.secondaryAccent }
                ]}>
                  {metric.percent}
                </Text>
              </View>
            </View>
            
            <View style={styles.cardBody}>
              <Text style={[styles.amount, { color: palette.text }]}>{metric.amount}</Text>
              <Text style={[styles.title, { color: palette.subText }]}>{metric.title}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between',
    paddingRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    marginLeft: 4,
    letterSpacing: -0.3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    flex: 1,
    minWidth: '45%',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#008080',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardBody: {
    gap: 4,
  },
  amount: {
    fontSize: 22,
    fontWeight: '800',
  },
  title: {
    fontSize: 13,
    fontWeight: '500',
  }
});