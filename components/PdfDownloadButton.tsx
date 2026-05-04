import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const teal = '#008080';

type PdfDownloadButtonProps = {
  reportUrl: string;
  jwtToken: string;
  fileName?: string;
  label?: string;
};

export default function PdfDownloadButton({
  reportUrl,
  jwtToken,
  fileName = 'report.pdf',
  label = 'Download PDF',
}: PdfDownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!reportUrl || !jwtToken) {
      Alert.alert('Missing data', 'Report URL or auth token is missing.');
      return;
    }

    try {
      setLoading(true);
      const targetFile = new File(Paths.cache, `${Date.now()}-${fileName}`);

      const result = await File.downloadFileAsync(reportUrl, targetFile, {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          Accept: 'application/pdf',
        },
        idempotent: true,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
        return;
      }

      await Sharing.shareAsync(result.uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Open PDF with...',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to download PDF.';
      Alert.alert('Download error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleDownload} disabled={loading}>
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>{label}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  button: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
