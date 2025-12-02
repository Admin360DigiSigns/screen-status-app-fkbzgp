
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

  /**
   * Initialize the command listener with device ID
   */
  initialize(deviceId: string) {
    console.log('🎯 Initializing command listener for device:', deviceId);
    this.deviceId = deviceId;
  }

  /**
   * Register a command handler
   */
  registerHandler(command: string, handler: CommandHandler) {
    console.log('📝 Registering handler for command:', command);
    this.commandHandlers.set(command, handler);
  }

  /**
   * Unregister a command handler
   */
  unregisterHandler(command: string) {
    console.log('🗑️ Unregistering handler for command:', command);
    this.commandHandlers.delete(command);
  }

  /**
   * Start listening for commands
   */
  async startListening() {
    if (!this.deviceId) {
      console.error('❌ Cannot start listening: device ID not set');
      return;
    }

    if (this.isListening) {
      console.log('⚠️ Already listening for commands');
      return;
    }

    console.log('🎧 Starting command listener for device:', this.deviceId);
    this.isListening = true;

    // Set up Realtime channel for instant command delivery
    this.setupRealtimeChannel();

    // Set up polling as fallback (every 5 seconds)
    this.startPolling();
  }

  /**
   * Stop listening for commands
   */
  async stopListening() {
    console.log('🛑 Stopping command listener');
    this.isListening = false;

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
    console.log('📡 Setting up Realtime channel:', channelName);

    this.channel = supabase.channel(channelName);

    this.channel
      .on('broadcast', { event: 'command' }, (payload) => {
        console.log('📨 Received command via Realtime:', payload);
        this.handleCommand(payload.payload as AppCommand);
      })
      .subscribe((status) => {
        console.log('📡 Realtime channel status:', status);
      });
  }

  /**
   * Start polling for commands (fallback mechanism)
   */
  private startPolling() {
    console.log('🔄 Starting command polling (every 5 seconds)');

    // Poll immediately
    this.pollForCommands();

    // Then poll every 5 seconds
    this.pollInterval = setInterval(() => {
      this.pollForCommands();
    }, 5000);
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
        console.error('❌ Error polling for commands:', error);
        return;
      }

      if (commands && commands.length > 0) {
        console.log(`📬 Found ${commands.length} pending command(s)`);
        
        for (const command of commands) {
          // Skip if we've already processed this command
          if (command.id === this.lastProcessedCommandId) {
            continue;
          }

          await this.handleCommand(command as AppCommand);
        }
      }
    } catch (error) {
      console.error('❌ Error in pollForCommands:', error);
    }
  }

  /**
   * Handle a received command
   */
  private async handleCommand(command: AppCommand) {
    console.log('⚙️ Handling command:', {
      id: command.id,
      command: command.command,
      status: command.status,
    });

    // Skip if already processed
    if (command.status !== 'pending') {
      console.log('⏭️ Skipping non-pending command');
      return;
    }

    // Update last processed command ID
    this.lastProcessedCommandId = command.id;

    // Mark command as processing
    await this.updateCommandStatus(command.id, 'processing');

    // Get handler for this command
    const handler = this.commandHandlers.get(command.command);

    if (!handler) {
      console.error('❌ No handler registered for command:', command.command);
      await this.updateCommandStatus(command.id, 'failed', 'No handler registered');
      return;
    }

    try {
      // Execute the handler
      console.log('🚀 Executing handler for command:', command.command);
      await handler(command);

      // Mark command as completed
      await this.updateCommandStatus(command.id, 'completed');
      console.log('✅ Command completed successfully:', command.id);
    } catch (error) {
      console.error('❌ Error executing command handler:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.updateCommandStatus(command.id, 'failed', errorMessage);
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

      const { error } = await supabase
        .from('app_commands')
        .update(updateData)
        .eq('id', commandId);

      if (error) {
        console.error('❌ Error updating command status:', error);
      } else {
        console.log(`✅ Command status updated to: ${status}`);
      }
    } catch (error) {
      console.error('❌ Error in updateCommandStatus:', error);
    }
  }

  /**
   * Get command history for this device
   */
  async getCommandHistory(limit: number = 20): Promise<AppCommand[]> {
    if (!this.deviceId) {
      console.error('❌ Cannot get history: device ID not set');
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
        console.error('❌ Error fetching command history:', error);
        return [];
      }

      return (commands || []) as AppCommand[];
    } catch (error) {
      console.error('❌ Error in getCommandHistory:', error);
      return [];
    }
  }
}

// Export singleton instance
export const commandListener = new CommandListenerService();
