
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/utils/supabaseClient';
import { commandListener } from '@/utils/commandListener';
import { colors } from '@/styles/commonStyles';

export default function DiagnosticsScreen() {
  const { deviceId, screenName, username, password } = useAuth();
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    runDiagnostics();
  }, [deviceId, screenName, username, password]);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const results: any = {
      timestamp: new Date().toISOString(),
      deviceInfo: {
        deviceId: deviceId || 'Not set',
        screenName: screenName || 'Not set',
        username: username || 'Not set',
        hasPassword: !!password,
      },
      supabase: {
        status: 'unknown',
        error: null,
      },
      commandListener: {
        status: commandListener.getConnectionStatus(),
        deviceId: deviceId || 'Not set',
      },
      pendingCommands: {
        count: 0,
        commands: [],
      },
    };

    // Test Supabase connection
    try {
      const { data, error } = await supabase
        .from('app_commands')
        .select('count')
        .limit(1);

      if (error) {
        results.supabase.status = 'error';
        results.supabase.error = error.message;
      } else {
        results.supabase.status = 'connected';
      }
    } catch (error) {
      results.supabase.status = 'error';
      results.supabase.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Check for pending commands
    if (deviceId) {
      try {
        const { data: pendingCommands, error } = await supabase
          .from('app_commands')
          .select('*')
          .eq('device_id', deviceId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (!error && pendingCommands) {
          results.pendingCommands.count = pendingCommands.length;
          results.pendingCommands.commands = pendingCommands;
        }
      } catch (error) {
        console.error('Error fetching pending commands:', error);
      }
    }

    setDiagnostics(results);
    setIsRunning(false);
  };

  const testCommandListener = async () => {
    if (!deviceId) {
      alert('Device ID not available');
      return;
    }

    setIsRunning(true);
    try {
      const success = await commandListener.testCommandListener();
      if (success) {
        alert('Test command created! Check the logs to see if it was processed.');
      } else {
        alert('Failed to create test command. Check the logs for details.');
      }
    } catch (error) {
      alert('Error testing command listener: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsRunning(false);
      // Refresh diagnostics after test
      setTimeout(() => runDiagnostics(), 1000);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return colors.success;
      case 'connecting':
        return colors.warning;
      case 'error':
      case 'disconnected':
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return '✅';
      case 'connecting':
        return '🔄';
      case 'error':
      case 'disconnected':
        return '❌';
      default:
        return '❓';
    }
  };

  if (!diagnostics) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Running diagnostics...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>System Diagnostics</Text>
      <Text style={styles.subtitle}>Last run: {new Date(diagnostics.timestamp).toLocaleString()}</Text>

      {/* Device Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Device Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Device ID:</Text>
          <Text style={styles.value}>{diagnostics.deviceInfo.deviceId}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Screen Name:</Text>
          <Text style={styles.value}>{diagnostics.deviceInfo.screenName}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Username:</Text>
          <Text style={styles.value}>{diagnostics.deviceInfo.username}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Password Set:</Text>
          <Text style={styles.value}>{diagnostics.deviceInfo.hasPassword ? 'Yes' : 'No'}</Text>
        </View>
      </View>

      {/* Supabase Connection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Supabase Connection</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusIcon}>{getStatusIcon(diagnostics.supabase.status)}</Text>
          <Text style={[styles.statusText, { color: getStatusColor(diagnostics.supabase.status) }]}>
            {diagnostics.supabase.status.toUpperCase()}
          </Text>
        </View>
        {diagnostics.supabase.error && (
          <Text style={styles.errorText}>Error: {diagnostics.supabase.error}</Text>
        )}
      </View>

      {/* Command Listener */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Command Listener</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusIcon}>{getStatusIcon(diagnostics.commandListener.status)}</Text>
          <Text style={[styles.statusText, { color: getStatusColor(diagnostics.commandListener.status) }]}>
            {diagnostics.commandListener.status.toUpperCase()}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Listening for device:</Text>
          <Text style={styles.value}>{diagnostics.commandListener.deviceId}</Text>
        </View>
      </View>

      {/* Pending Commands */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pending Commands</Text>
        <Text style={styles.value}>Count: {diagnostics.pendingCommands.count}</Text>
        {diagnostics.pendingCommands.commands.length > 0 && (
          <View style={styles.commandsList}>
            {diagnostics.pendingCommands.commands.map((cmd: any, index: number) => (
              <View key={index} style={styles.commandItem}>
                <Text style={styles.commandType}>{cmd.command}</Text>
                <Text style={styles.commandTime}>
                  {new Date(cmd.created_at).toLocaleTimeString()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <TouchableOpacity
        style={[styles.button, styles.primaryButton]}
        onPress={runDiagnostics}
        disabled={isRunning}
      >
        {isRunning ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.buttonText}>Refresh Diagnostics</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.secondaryButton]}
        onPress={testCommandListener}
        disabled={isRunning}
      >
        <Text style={styles.buttonTextSecondary}>Test Command Listener</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  loadingText: {
    marginTop: 16,
    color: colors.text,
    fontSize: 16,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 8,
  },
  commandsList: {
    marginTop: 12,
  },
  commandItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderRadius: 8,
    marginBottom: 8,
  },
  commandType: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  commandTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
