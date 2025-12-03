
import { supabase } from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

// Supabase anon key for API calls
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnY2Rva2ZpYWFybmh6cnlmendmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwOTk1OTEsImV4cCI6MjA3OTY3NTU5MX0.wn4-y6x8Q-EbPGci_B27scrRXNOEvg7I4xsqeCEYqag';

export interface AppCommand {
  id: string;
  device_id: string;
  screen_name: string;
  command: 'preview_content' | 'screenshare' | 'sync_status' | 'logout';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payload: Record<string, any>;
  created_at: string;
}

export type CommandHandler = (command: AppCommand) => Promise<void>;

class CommandListenerService {
  private channel: RealtimeChannel | null = null;
  private deviceId: string | null = null;
  private commandHandlers: Map<string, CommandHandler> = new Map();
  private isListening: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private lastProcessedCommandId: string | null = null;
  private connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private consecutiveErrors: number = 0;
  private maxConsecutiveErrors: number = 5;

  /**
   * Initialize the command listener with device ID
   */
  initialize(deviceId: string) {
    console.log('🎯 [CommandListener] Initializing for device:', deviceId);
    this.deviceId = deviceId;
    this.consecutiveErrors = 0;
  }

  /**
   * Register a command handler
   */
  registerHandler(command: string, handler: CommandHandler) {
    console.log('📝 [CommandListener] Registering handler for command:', command);
    this.commandHandlers.set(command, handler);
  }

  /**
   * Unregister a command handler
   */
  unregisterHandler(command: string) {
    console.log('🗑️ [CommandListener] Unregistering handler for command:', command);
    this.commandHandlers.delete(command);
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): 'disconnected' | 'connecting' | 'connected' {
    return this.connectionStatus;
  }

  /**
   * Start listening for commands
   */
  async startListening() {
    if (!this.deviceId) {
      console.error('❌ [CommandListener] Cannot start listening: device ID not set');
      return;
    }

    if (this.isListening) {
      console.log('⚠️ [CommandListener] Already listening for commands');
      return;
    }

    console.log('🎧 [CommandListener] Starting command listener for device:', this.deviceId);
    console.log('📋 [CommandListener] Registered handlers:', Array.from(this.commandHandlers.keys()));
    this.isListening = true;
    this.connectionStatus = 'connecting';
    this.consecutiveErrors = 0;

    // Set up Realtime channel for instant command delivery
    this.setupRealtimeChannel();

    // Set up polling as primary mechanism (every 2 seconds for better responsiveness)
    this.startPolling();
  }

  /**
   * Stop listening for commands
   */
  async stopListening() {
    console.log('🛑 [CommandListener] Stopping command listener');
    this.isListening = false;
    this.connectionStatus = 'disconnected';

    // Unsubscribe from Realtime channel
    if (this.channel) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }

    // Stop polling
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Set up Realtime channel for instant command delivery
   */
  private setupRealtimeChannel() {
    if (!this.deviceId) return;

    const channelName = `app_commands:${this.deviceId}`;
    console.log('📡 [CommandListener] Setting up Realtime channel:', channelName);

    this.channel = supabase.channel(channelName);

    this.channel
      .on('broadcast', { event: 'command' }, (payload) => {
        console.log('📨 [CommandListener] ✅ Received command via Realtime:', payload);
        this.handleCommand(payload.payload as AppCommand);
      })
      .subscribe((status) => {
        console.log('📡 [CommandListener] Realtime channel status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ [CommandListener] Successfully subscribed to Realtime channel');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('❌ [CommandListener] Realtime channel error:', status);
        }
      });
  }

  /**
   * Start polling for commands (primary mechanism)
   */
  private startPolling() {
    console.log('🔄 [CommandListener] Starting command polling (every 2 seconds)');

    // Poll immediately
    this.pollForCommands();

    // Then poll every 2 seconds for better responsiveness
    this.pollInterval = setInterval(() => {
      if (this.isListening) {
        this.pollForCommands();
      }
    }, 2000);
  }

  /**
   * Poll for pending commands using the get-pending-commands Edge Function
   */
  private async pollForCommands() {
    if (!this.deviceId || !this.isListening) return;

    // Stop polling if too many consecutive errors
    if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
      console.error('❌ [CommandListener] Too many consecutive errors, stopping polling');
      this.connectionStatus = 'disconnected';
      return;
    }

    try {
      // Call the get-pending-commands Edge Function
      const response = await fetch(
        'https://pgcdokfiaarnhzryfzwf.supabase.co/functions/v1/get-pending-commands',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            device_id: this.deviceId,
          }),
        }
      );

      if (!response.ok) {
        console.error('❌ [CommandListener] Error polling for commands:', response.status, response.statusText);
        this.consecutiveErrors++;
        this.connectionStatus = 'disconnected';
        return;
      }

      const result = await response.json();

      if (!result.success) {
        console.error('❌ [CommandListener] Error polling for commands:', result.error);
        this.consecutiveErrors++;
        this.connectionStatus = 'disconnected';
        return;
      }

      // Reset error counter on successful poll
      this.consecutiveErrors = 0;
      this.connectionStatus = 'connected';

      const commands = result.commands || [];

      if (commands.length > 0) {
        console.log(`📬 [CommandListener] ✅ Found ${commands.length} pending command(s) via polling`);
        
        for (const command of commands) {
          // Skip if we've already processed this command
          if (command.id === this.lastProcessedCommandId) {
            console.log('⏭️ [CommandListener] Skipping already processed command:', command.id);
            continue;
          }

          console.log('🎯 [CommandListener] Processing command from poll:', {
            id: command.id,
            command: command.command,
            device_id: command.device_id,
            status: command.status,
          });
          await this.handleCommand(command as AppCommand);
        }
      }
    } catch (error) {
      console.error('❌ [CommandListener] Error in pollForCommands:', error);
      this.consecutiveErrors++;
      this.connectionStatus = 'disconnected';
    }
  }

  /**
   * Handle a received command
   */
  private async handleCommand(command: AppCommand) {
    console.log('⚙️ [CommandListener] ===== HANDLING COMMAND =====');
    console.log('⚙️ [CommandListener] Command ID:', command.id);
    console.log('⚙️ [CommandListener] Command Type:', command.command);
    console.log('⚙️ [CommandListener] Command Status:', command.status);
    console.log('⚙️ [CommandListener] Device ID:', command.device_id);
    console.log('⚙️ [CommandListener] Screen Name:', command.screen_name);

    // Skip if already processed
    if (command.status !== 'pending') {
      console.log('⏭️ [CommandListener] Skipping non-pending command (status:', command.status, ')');
      return;
    }

    // Skip if we've already processed this command
    if (command.id === this.lastProcessedCommandId) {
      console.log('⏭️ [CommandListener] Skipping already processed command:', command.id);
      return;
    }

    // Update last processed command ID
    this.lastProcessedCommandId = command.id;

    // Mark command as processing
    console.log('🔄 [CommandListener] Marking command as processing...');
    await this.updateCommandStatus(command.id, 'processing');

    // Get handler for this command
    const handler = this.commandHandlers.get(command.command);

    if (!handler) {
      console.error('❌ [CommandListener] No handler registered for command:', command.command);
      console.error('❌ [CommandListener] Available handlers:', Array.from(this.commandHandlers.keys()));
      await this.updateCommandStatus(command.id, 'failed', 'No handler registered');
      return;
    }

    try {
      // Execute the handler
      console.log('🚀 [CommandListener] Executing handler for command:', command.command);
      await handler(command);

      // Mark command as completed
      await this.updateCommandStatus(command.id, 'completed');
      console.log('✅ [CommandListener] Command completed successfully:', command.id);
      console.log('✅ [CommandListener] ===== COMMAND HANDLED =====');
    } catch (error) {
      console.error('❌ [CommandListener] Error executing command handler:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.updateCommandStatus(command.id, 'failed', errorMessage);
      console.log('❌ [CommandListener] ===== COMMAND FAILED =====');
    }
  }

  /**
   * Update command status using the acknowledge-command Edge Function
   */
  private async updateCommandStatus(
    commandId: string,
    status: 'processing' | 'completed' | 'failed',
    errorMessage?: string
  ) {
    try {
      console.log('💾 [CommandListener] Updating command status:', { commandId, status, errorMessage });

      // Call the acknowledge-command Edge Function
      const response = await fetch(
        'https://pgcdokfiaarnhzryfzwf.supabase.co/functions/v1/acknowledge-command',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            command_id: commandId,
            status,
            error_message: errorMessage,
          }),
        }
      );

      if (!response.ok) {
        console.error('❌ [CommandListener] Error updating command status:', response.status, response.statusText);
        return;
      }

      const result = await response.json();

      if (!result.success) {
        console.error('❌ [CommandListener] Error updating command status:', result.error);
      } else {
        console.log(`✅ [CommandListener] Command status updated to: ${status}`);
      }
    } catch (error) {
      console.error('❌ [CommandListener] Error in updateCommandStatus:', error);
    }
  }

  /**
   * Get command history for this device
   */
  async getCommandHistory(limit: number = 20): Promise<AppCommand[]> {
    if (!this.deviceId) {
      console.error('❌ [CommandListener] Cannot get history: device ID not set');
      return [];
    }

    try {
      const { data: commands, error } = await supabase
        .from('app_commands')
        .select('*')
        .eq('device_id', this.deviceId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ [CommandListener] Error fetching command history:', error);
        return [];
      }

      console.log(`📜 [CommandListener] Fetched ${commands?.length || 0} commands from history`);
      return (commands || []) as AppCommand[];
    } catch (error) {
      console.error('❌ [CommandListener] Error in getCommandHistory:', error);
      return [];
    }
  }

  /**
   * Test the command listener by creating a test command
   */
  async testCommandListener(): Promise<boolean> {
    if (!this.deviceId) {
      console.error('❌ [CommandListener] Cannot test: device ID not set');
      return false;
    }

    try {
      console.log('🧪 [CommandListener] Creating test command...');
      
      const { data, error } = await supabase
        .from('app_commands')
        .insert({
          device_id: this.deviceId,
          screen_name: 'test',
          command: 'sync_status',
          status: 'pending',
          payload: { test: true },
        })
        .select()
        .single();

      if (error) {
        console.error('❌ [CommandListener] Error creating test command:', error);
        return false;
      }

      console.log('✅ [CommandListener] Test command created:', data.id);
      return true;
    } catch (error) {
      console.error('❌ [CommandListener] Error in testCommandListener:', error);
      return false;
    }
  }
}

// Export singleton instance
export const commandListener = new CommandListenerService();
