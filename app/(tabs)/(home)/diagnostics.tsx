
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/styles/commonStyles';
import { commandListener } from '@/utils/commandListener';
import { supabase } from '@/utils/supabaseClient';

export default function DiagnosticsScreen() {
  const { deviceId, screenName, username } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<any>({});
  const [commandHistory, setCommandHistory] = useState<any[]>([]);
  const [displayInfo, setDisplayInfo] = useState<any>(null);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    setIsLoading(true);
    const results: any = {};

    try {
      // 1. Check device ID
      results.deviceId = {
        status: deviceId ? 'success' : 'error',
        value: deviceId || 'Not set',
      };

      // 2. Check screen name
      results.screenName = {
        status: screenName ? 'success' : 'error',
        value: screenName || 'Not set',
      };

      // 3. Check if display is registered in database
      if (deviceId) {
        const { data: display, error } = await supabase
          .from('displays')
          .select('*')
          .eq('device_id', deviceId)
          .single();

        results.displayRegistered = {
          status: display ? 'success' : 'error',
          value: display ? 'Registered' : 'Not registered',
          data: display,
        };

        setDisplayInfo(display);
      }

      // 4. Check command listener status
      const connectionStatus = commandListener.getConnectionStatus();
      results.commandListener = {
        status: connectionStatus === 'connected' ? 'success' : connectionStatus === 'connecting' ? 'warning' : 'error',
        value: connectionStatus,
      };

      // 5. Check for pending commands
      const { data: pendingCommands, error: commandsError } = await supabase
        .from('app_commands')
        .select('*')
        .eq('device_id', deviceId)
        .eq('status', 'pending');

      results.pendingCommands = {
        status: commandsError ? 'error' : 'success',
        value: `${pendingCommands?.length || 0} pending`,
        data: pendingCommands,
      };

      // 6. Get command history
      const history = await commandListener.getCommandHistory(10);
      setCommandHistory(history);
      results.commandHistory = {
        status: 'success',
        value: `${history.length} commands`,
      };

      // 7. Test Supabase connection
      const { error: connectionError } = await supabase
        .from('app_commands')
        .select('count')
        .limit(1);

      results.supabaseConnection = {
        status: connectionError ? 'error' : 'success',
        value: connectionError ? 'Connection failed' : 'Connected',
      };

      setDiagnosticResults(results);
    } catch (error) {
      console.error('Error running diagnostics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testCommandListener = async () => {
    setIsLoading(true);
    try {
      const success = await commandListener.testCommandListener();
      if (success) {
        alert('Test command created! Check if it appears in the command history.');
        setTimeout(() => runDiagnostics(), 2000);
      } else {
        alert('Failed to create test command. Check console logs.');
      }
    } catch (error) {
      console.error('Error testing command listener:', error);
      alert('Error: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return '#10B981';
      case 'warning':
        return '#F59E0B';
      case 'error':
        return '#EF4444';
      default:
        return colors.text;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return '❓';
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>🔍 Command System Diagnostics</Text>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Running diagnostics...</Text>
          </View>
        )}

        {!isLoading && Object.keys(diagnosticResults).length > 0 && (
          <React.Fragment>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>System Status</Text>
              {Object.entries(diagnosticResults).map(([key, result]: [string, any]) => (
                <View key={key} style={styles.diagnosticItem}>
                  <Text style={styles.diagnosticIcon}>{getStatusIcon(result.status)}</Text>
                  <View style={styles.diagnosticContent}>
                    <Text style={styles.diagnosticLabel}>{key}</Text>
                    <Text style={[styles.diagnosticValue, { color: getStatusColor(result.status) }]}>
                      {result.value}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {displayInfo && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Display Information</Text>
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>Screen Name: {displayInfo.screen_name}</Text>
                  <Text style={styles.infoText}>Device ID: {displayInfo.device_id}</Text>
                  <Text style={styles.infoText}>Status: {displayInfo.status}</Text>
                  <Text style={styles.infoText}>
                    Last Seen: {displayInfo.last_seen ? new Date(displayInfo.last_seen).toLocaleString() : 'Never'}
                  </Text>
                </View>
              </View>
            )}

            {commandHistory.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Command History (Last 10)</Text>
                {commandHistory.map((cmd, index) => (
                  <View key={index} style={styles.commandItem}>
                    <View style={styles.commandHeader}>
                      <Text style={styles.commandType}>{cmd.command}</Text>
                      <Text style={[styles.commandStatus, { color: getStatusColor(cmd.status === 'completed' ? 'success' : cmd.status === 'failed' ? 'error' : 'warning') }]}>
                        {cmd.status}
                      </Text>
                    </View>
                    <Text style={styles.commandTime}>
                      {new Date(cmd.created_at).toLocaleString()}
                    </Text>
                    {cmd.error_message && (
                      <Text style={styles.commandError}>Error: {cmd.error_message}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Actions</Text>
              <TouchableOpacity style={styles.button} onPress={runDiagnostics}>
                <Text style={styles.buttonText}>🔄 Refresh Diagnostics</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={testCommandListener}>
                <Text style={styles.buttonText}>🧪 Test Command Listener</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Troubleshooting Tips</Text>
              <View style={styles.tipBox}>
                <Text style={styles.tipText}>
                  1. Make sure you're logged in and the device is registered
                </Text>
                <Text style={styles.tipText}>
                  2. Check that the device ID matches in both the app and your web app
                </Text>
                <Text style={styles.tipText}>
                  3. Verify the Edge Function URL is correct
                </Text>
                <Text style={styles.tipText}>
                  4. Check the Edge Function logs in Supabase dashboard
                </Text>
                <Text style={styles.tipText}>
                  5. Ensure RLS policies allow command insertion
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>API Endpoint</Text>
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  POST https://gzyywcqlrjimjegbtoyc.supabase.co/functions/v1/send-app-command
                </Text>
                <Text style={styles.infoText} selectable>
                  {'\n'}Example payload:{'\n'}
                  {JSON.stringify({
                    device_id: deviceId,
                    command: 'preview_content',
                  }, null, 2)}
                </Text>
              </View>
            </View>
          </React.Fragment>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.text,
  },
  section: {
    marginBottom: 24,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  diagnosticItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  diagnosticIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  diagnosticContent: {
    flex: 1,
  },
  diagnosticLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 2,
  },
  diagnosticValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
  },
  infoText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  commandItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  commandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commandType: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  commandStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  commandTime: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  commandError: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  tipBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  tipText: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
    lineHeight: 20,
  },
});
