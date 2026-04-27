import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function AdminLoginScreen() {
  const [email, setEmail] = useState('admin@nexgo.lk');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = () => {
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter your admin email and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    setTimeout(() => {
      setIsSubmitting(false);
      router.replace('/(tabs)');
    }, 350);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.keyboardWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.authWrap}>
            <View style={styles.brandHeader}>
              <View style={styles.logoMark}>
                <Ionicons name="navigate" size={22} color="#FFFFFF" />
              </View>
              <View>
                <Text style={styles.brandName}>NexGO</Text>
                <Text style={styles.brandCaption}>Admin</Text>
              </View>
            </View>

            <View style={styles.hero}>
              <Text style={styles.eyebrow}>Welcome back</Text>
              <Text style={styles.title}>Sign in to admin control</Text>
              <Text style={styles.subtitle}>
                Continue to your admin workspace and manage approvals, users, support, and live operations.
              </Text>
            </View>

            <View style={styles.content}>
              <View style={styles.formStack}>
                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email address</Text>
                  <View style={styles.inputRow}>
                    <Ionicons name="mail-outline" size={20} color="#14988F" />
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="admin@nexgo.lk"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="emailAddress"
                      placeholderTextColor="#93A5A2"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputRow}>
                    <Ionicons name="lock-closed-outline" size={20} color="#14988F" />
                    <TextInput
                      style={styles.input}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Enter password"
                      secureTextEntry={!isPasswordVisible}
                      textContentType="password"
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholderTextColor="#93A5A2"
                    />
                    <Pressable
                      style={styles.iconButton}
                      onPress={() => setIsPasswordVisible((current) => !current)}
                      hitSlop={8}>
                      <Ionicons
                        name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                        size={21}
                        color="#617C79"
                      />
                    </Pressable>
                  </View>
                </View>
              </View>

              <Pressable
                style={[styles.primaryButton, isSubmitting ? styles.buttonDisabled : null]}
                disabled={isSubmitting}
                onPress={handleSignIn}>
                <Text style={styles.primaryButtonText}>{isSubmitting ? 'Signing in...' : 'Sign in'}</Text>
                <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
              </Pressable>

              <View style={styles.footerRow}>
                <Text style={styles.footerText}>Authorized NexGO staff only</Text>
                <Text style={styles.footerLink}>Admin access</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F8F7',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  keyboardWrap: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingTop: 20,
    paddingBottom: 24,
  },
  authWrap: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 28,
  },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14988F',
    shadowColor: '#0C5E59',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
  },
  brandName: {
    color: '#123532',
    fontSize: 18,
    fontWeight: '900',
  },
  brandCaption: {
    color: '#617C79',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 24,
  },
  eyebrow: {
    color: '#14988F',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: '#123532',
    fontSize: 28,
    lineHeight: 33,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: '#617C79',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    marginTop: 9,
    maxWidth: 300,
    textAlign: 'center',
  },
  content: {
    gap: 14,
  },
  formStack: {
    gap: 15,
  },
  errorText: {
    color: '#C13B3B',
    fontSize: 12,
    fontWeight: '700',
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    color: '#2E4644',
    fontWeight: '800',
  },
  inputRow: {
    minHeight: 48,
    borderBottomWidth: 1.5,
    borderBottomColor: '#CFE0DD',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#102A28',
    fontWeight: '600',
    paddingVertical: 9,
  },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    marginTop: 6,
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
    backgroundColor: '#14988F',
    shadowColor: '#0C5E59',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  footerRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    color: '#617C79',
    fontSize: 14,
    fontWeight: '600',
  },
  footerLink: {
    color: '#0C7B73',
    fontSize: 14,
    fontWeight: '900',
  },
});
