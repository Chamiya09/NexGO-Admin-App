import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';

export function AdminLoadingScreen() {
  // Using Scale & Opacity for a smoother "breathing" effect
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0.7)).current;
  const lineAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    // Logo Breathing Animation
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.95,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.7,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      ])
    ).start();

    // Line Loading Animation
    Animated.loop(
      Animated.timing(lineAnim, {
        toValue: 200,
        duration: 1200,
        useNativeDriver: true,
      })
    ).start();
  }, [scaleAnim, opacityAnim, lineAnim]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={{ 
          opacity: opacityAnim, 
          transform: [{ scale: scaleAnim }],
          alignItems: 'center' 
        }}>
          {/* Framed Logo Wrapper */}
          <View style={styles.imageWrapper}>
            <Image 
              source={require('@/assets/images/Admin Dark App Logo.png')} 
              style={styles.logoImage} 
              resizeMode="cover" 
            />
          </View>
        </Animated.View>
        
        <View style={styles.loaderArea}>
          <View style={styles.progressBarTrack}>
            <Animated.View style={[styles.progressBarFill, { transform: [{ translateX: lineAnim }] }]} />
          </View>
          <Text style={styles.loadingText}>Initializing Workspace...</Text>
        </View>
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.footerTitle}>NEXGO ADMIN</Text>
        <Text style={styles.footerSubtitle}>Secure Operations Layer</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF', // Strictly absolute white UI per request
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginTop: 40,
  },
  imageWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 8,
    shadowColor: '#008080',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 10,
    marginBottom: 48,
  },
  logoImage: {
    width: 140, // Reduced from 250 to look more appropriately sized in the frame structure
    height: 140,
    borderRadius: 24,
  },
  loaderArea: {
    alignItems: 'center',
    height: 80,
  },
  progressBarTrack: {
    width: 200,
    height: 4,
    backgroundColor: '#E8F0EF',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    width: 80,
    height: 4,
    backgroundColor: '#008080',
    borderRadius: 2,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '600',
    color: '#008080',
    letterSpacing: 0.5,
  },
  footer: {
    paddingBottom: 48,
    alignItems: 'center',
  },
  footerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#123532',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  footerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#617C79',
    letterSpacing: 0.5,
  }
});