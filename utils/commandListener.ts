
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
  private lastProcessedCommandId: string | null = null;
  private connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private processingCommands: Set<string> = new Set(); // Track commands being processed

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
   * Start listening for commands via Supabase Realtime
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

    // Set up Realtime channel for instant command delivery
    await this.setupRealtimeChannel();
    
    // Also check for any pending commands that might have been missed
    await this.checkPendingCommands();
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
    
    // Clear processing set
    this.processingCommands.clear();
  }

  /**
   * Check for any pending commands that might have been missed
   */
  private async checkPendingCommands() {
    if (!this.deviceId) return;

    try {
      console.log('🔍 [CommandListener] Checking for pending commands...');
      
      const { data: pendingCommands, error } = await supabase
        .from('app_commands')
        .select('*')
        .eq('device_id', this.deviceId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ [CommandListener] Error fetching pending commands:', error);
        return;
      }

      if (pendingCommands && pendingCommands.length > 0) {
        console.log(`📨 [CommandListener] Found ${pendingCommands.length} pending command(s)`);
        
        // Process each pending command
        for (const command of pendingCommands) {
          console.log('📨 [CommandListener] Processing missed command:', command.id);
          await this.handleCommand(command as AppCommand);
        }
      } else {
        console.log('✅ [CommandListener] No pending commands found');
      }
    } catch (error) {
      console.error('❌ [CommandListener] Error checking pending commands:', error);
    }
  }

  /**
   * Set up Realtime channel for instant command delivery
   */
  private async setupRealtimeChannel() {
    if (!this.deviceId) return;

    console.log('📡 [CommandListener] Setting up Supabase Realtime subscription');
    console.log('📡 [CommandListener] Listening for INSERT events on app_commands table');
    console.log('📡 [CommandListener] Filtering by device_id:', this.deviceId);

    // Create a channel for this device
    this.channel = supabase
      .channel(`commands:${this.deviceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'app_commands',
          filter: `device_id=eq.${this.deviceId}`,
        },
        (payload) => {
          console.log('📨 [CommandListener] ✅ Received command via Realtime:', payload);
          const command = payload.new as AppCommand;
          this.handleCommand(command);
        }
      )
      .subscribe((status) => {
        console.log('📡 [CommandListener] Realtime channel status:', status);
        if (status === 'SUBSCRIBED') {
          this.connectionStatus = 'connected';
          console.log('✅ [CommandListener] Successfully subscribed to Realtime channel');
          console.log('✅ [CommandListener] Commands will be received instantly when inserted into database');
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
   * Handle a received command
   */
  private async handleCommand(command: AppCommand) {
    console.log('⚙️ [CommandListener] ===== HANDLING COMMAND =====');
    console.log('⚙️ [CommandListener] Command ID:', command.id);
    console.log('⚙️ [CommandListener] Command Type:', command.command);
    console.log('⚙️ [CommandListener] Command Status:', command.status);
    console.log('⚙️ [CommandListener] Device ID:', command.device_id);
    console.log('⚙️ [CommandListener] Screen Name:', command.screen_name);

    // Skip if already processed or processing
    if (this.processingCommands.has(command.id)) {
      console.log('⏭️ [CommandListener] Skipping - already processing command:', command.id);
      return;
    }

    // Skip if not pending
    if (command.status !== 'pending') {
      console.log('⏭️ [CommandListener] Skipping non-pending command (status:', command.status, ')');
      return;
    }

    // Add to processing set
    this.processingCommands.add(command.id);

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
      this.processingCommands.delete(command.id);
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
    } finally {
      // Remove from processing set
      this.processingCommands.delete(command.id);
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
        console.error('❌ [CommandListener] Error details:', JSON.stringify(error, null, 2));
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
      console.log('✅ [CommandListener] If Realtime is working, you should see the command being processed above');
      return true;
    } catch (error) {
      console.error('❌ [CommandListener] Error in testCommandListener:', error);
      return false;
    }
  }

  /**
   * Manually process a specific command by ID (for debugging)
   */
  async processCommandById(commandId: string): Promise<boolean> {
    try {
      console.log('🔧 [CommandListener] Manually processing command:', commandId);
      
      const { data: command, error } = await supabase
        .from('app_commands')
        .select('*')
        .eq('id', commandId)
        .single();

      if (error) {
        console.error('❌ [CommandListener] Error fetching command:', error);
        return false;
      }

      if (!command) {
        console.error('❌ [CommandListener] Command not found:', commandId);
        return false;
      }

      await this.handleCommand(command as AppCommand);
      return true;
    } catch (error) {
      console.error('❌ [CommandListener] Error in processCommandById:', error);
      return false;
    }
  }
}

// Export singleton instance
export const commandListener = new CommandListenerService();
