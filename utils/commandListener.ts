
import { supabase } from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

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

  /**
   * Initialize the command listener with device ID
   */
  initialize(deviceId: string) {
    console.log('🎯 [CommandListener] Initializing for device:', deviceId);
    this.deviceId = deviceId;
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

    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║           STARTING COMMAND LISTENER                            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('🎧 Device ID:', this.deviceId);
    console.log('📋 Registered handlers:', Array.from(this.commandHandlers.keys()));
    console.log('📡 Supabase URL:', 'https://pgcdokfiaarnhzryfzwf.supabase.co');
    console.log('');
    
    this.isListening = true;
    this.connectionStatus = 'connecting';

    // Set up Realtime channel for instant command delivery
    this.setupRealtimeChannel();

    // Set up polling as fallback (every 2 seconds for better responsiveness)
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

    const channelName = `app_commands:device_id=eq.${this.deviceId}`;
    console.log('📡 [CommandListener] Setting up Realtime channel:', channelName);
    console.log('📡 [CommandListener] Listening for INSERT events on app_commands table');
    console.log('📡 [CommandListener] Filter: device_id=eq.' + this.deviceId);

    this.channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'app_commands',
          filter: `device_id=eq.${this.deviceId}`,
        },
        (payload) => {
          console.log('');
          console.log('╔════════════════════════════════════════════════════════════════╗');
          console.log('║     📨 REALTIME COMMAND RECEIVED (INSERT)                      ║');
          console.log('╚════════════════════════════════════════════════════════════════╝');
          console.log('📨 Full payload:', JSON.stringify(payload, null, 2));
          console.log('');
          
          if (payload.new) {
            this.handleCommand(payload.new as AppCommand);
          } else {
            console.error('❌ [CommandListener] No payload.new in INSERT event');
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_commands',
          filter: `device_id=eq.${this.deviceId}`,
        },
        (payload) => {
          console.log('📨 [CommandListener] Received command via Realtime UPDATE:', payload);
          // Only process if status changed to pending (in case of retry)
          if (payload.new && (payload.new as AppCommand).status === 'pending') {
            this.handleCommand(payload.new as AppCommand);
          }
        }
      )
      .subscribe((status) => {
        console.log('');
        console.log('📡 [CommandListener] ═══════════════════════════════════════');
        console.log('📡 [CommandListener] Realtime channel status:', status);
        console.log('📡 [CommandListener] ═══════════════════════════════════════');
        console.log('');
        
        if (status === 'SUBSCRIBED') {
          this.connectionStatus = 'connected';
          console.log('✅ [CommandListener] ✅✅✅ Successfully subscribed to Realtime channel ✅✅✅');
          console.log('✅ [CommandListener] Now listening for commands from webapp');
          console.log('✅ [CommandListener] Device ID:', this.deviceId);
          console.log('');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.connectionStatus = 'disconnected';
          console.error('❌ [CommandListener] Realtime channel error:', status);
        } else if (status === 'CLOSED') {
          this.connectionStatus = 'disconnected';
          console.log('🔌 [CommandListener] Realtime channel closed');
        }
      });
  }

  /**
   * Start polling for commands (fallback mechanism)
   */
  private startPolling() {
    console.log('🔄 [CommandListener] Starting command polling (every 2 seconds)');

    // Poll immediately
    this.pollForCommands();

    // Then poll every 2 seconds
    this.pollInterval = setInterval(() => {
      this.pollForCommands();
    }, 2000);
  }

  /**
   * Poll for pending commands
   */
  private async pollForCommands() {
    if (!this.deviceId || !this.isListening) return;

    try {
      // Query for pending commands for this device
      const { data: commands, error } = await supabase
        .from('app_commands')
        .select('*')
        .eq('device_id', this.deviceId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(10);

      if (error) {
        console.error('❌ [CommandListener] Error polling for commands:', error);
        return;
      }

      if (commands && commands.length > 0) {
        console.log('');
        console.log('╔════════════════════════════════════════════════════════════════╗');
        console.log(`║     📬 FOUND ${commands.length} PENDING COMMAND(S) VIA POLLING              ║`);
        console.log('╚════════════════════════════════════════════════════════════════╝');
        console.log('');
        
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
    console.log('⚙️ [CommandListener] Payload:', command.payload);

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
   * Update command status in database
   */
  private async updateCommandStatus(
    commandId: string,
    status: 'processing' | 'completed' | 'failed',
    errorMessage?: string
  ) {
    try {
      const updateData: any = {
        status,
        executed_at: new Date().toISOString(),
      };

      if (errorMessage) {
        updateData.error_message = errorMessage;
      }

      console.log('💾 [CommandListener] Updating command status:', { commandId, status, errorMessage });

      const { error } = await supabase
        .from('app_commands')
        .update(updateData)
        .eq('id', commandId);

      if (error) {
        console.error('❌ [CommandListener] Error updating command status:', error);
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
