import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, ActivityIndicator, View, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { useState } from 'react';
import { BACKEND_URL } from './config';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Impossibile connettersi</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>
            Il backend non è raggiungibile su{'\n'}
            {BACKEND_URL}{'\n\n'}
            Sul Mac:{'\n'}
            cd economia/backend && python3 app.py
          </Text>
        </View>
        <StatusBar style="light" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <WebView
        source={{ uri: BACKEND_URL }}
        style={styles.webview}
        onLoadEnd={() => setLoading(false)}
        onError={(e) => setError(e.nativeEvent.description)}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsBackForwardNavigationGestures={true}
      />
      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#22d3ee" />
          <Text style={styles.loadingText}>Caricamento DevFinance...</Text>
        </View>
      )}
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0a0f1e',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0f1e',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorTitle: {
    color: '#fb7185',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorText: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'monospace',
  },
  errorHint: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: 'monospace',
  },
});
