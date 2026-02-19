
import { supabase } from './supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';
import { API_ENDPOINTS } from './config';

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
  private pollCount: number = 0;
  private processedCommandIds: Set<string> = new Set();
  private processingCommandIds: Set<string> = new Set();

  /**
   * Initialize the command listener with device ID
   */
  initialize(deviceId: string) {
    console.log('');
    console.log('🎯 ═══════════════════════════════════════════════════════════');
    console.log('🎯 [CommandListener] INITIALIZING');
    console.log('🎯 Device ID:', deviceId);
    console.log('🎯 ═══════════════════════════════════════════════════════════');
    console.log('');
    this.deviceId = deviceId;
  }

  /**
   * Register a command handler
   */
  registerHandler(command: string, handler: CommandHandler) {
    console.log('📝 [CommandListener] Registering handler for command:', command);
    this.commandHandlers.set(command, handler);
    console.log('📝 [CommandListener] Total handlers registered:', this.commandHandlers.size);
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
    console.log('');
    console.log('🎧 ═══════════════════════════════════════════════════════════');
    console.log('🎧 [CommandListener] START LISTENING CALLED');
    console.log('🎧 ═══════════════════════════════════════════════════════════');
    
    if (!this.deviceId) {
      console.error('❌ [CommandListener] Cannot start listening: device ID not set');
      console.log('🎧 ═══════════════════════════════════════════════════════════');
      console.log('');
      return;
    }

    if (this.isListening) {
      console.log('⚠️ [CommandListener] Already listening for commands');
      console.log('🎧 ═══════════════════════════════════════════════════════════');
      console.log('');
      return;
    }

    console.log('🎧 [CommandListener] Device ID:', this.deviceId);
    console.log('🎧 [CommandListener] Registered handlers:', Array.from(this.commandHandlers.keys()));
    console.log('🎧 [CommandListener] Handler count:', this.commandHandlers.size);
    
    this.isListening = true;
    this.connectionStatus = 'connecting';
    this.pollCount = 0;

    // Set up Realtime channel for instant command delivery
    console.log('🎧 [CommandListener] Setting up Realtime channel...');
    this.setupRealtimeChannel();

    // Set up polling as fallback (every 2 seconds for better responsiveness)
    console.log('🎧 [CommandListener] Setting up polling...');
    this.startPolling();
    
    console.log('✅ [CommandListener] Listening started successfully');
    console.log('🎧 ═══════════════════════════════════════════════════════════');
    console.log('');
  }

  /**
   * Stop listening for commands
   */
  async stopListening() {
    console.log('');
    console.log('🛑 ═══════════════════════════════════════════════════════════');
    console.log('🛑 [CommandListener] STOP LISTENING CALLED');
    console.log('🛑 ═══════════════════════════════════════════════════════════');
    
    this.isListening = false;
    this.connectionStatus = 'disconnected';

    // Unsubscribe from Realtime channel
    if (this.channel) {
      console.log('🛑 [CommandListener] Removing Realtime channel...');
      await supabase.removeChannel(this.channel);
      this.channel = null;
      console.log('✓ Realtime channel removed');
    }

    // Stop polling
    if (this.pollInterval) {
      console.log('🛑 [CommandListener] Clearing poll interval...');
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      console.log('✓ Poll interval cleared');
    }
    
    // Clear processed command tracking
    console.log('🛑 [CommandListener] Clearing processed command tracking...');
    console.log('   Total commands processed in this session:', this.processedCommandIds.size);
    this.processedCommandIds.clear();
    this.processingCommandIds.clear();
    this.lastProcessedCommandId = null;
    console.log('✓ Command tracking cleared');
    
    console.log('✅ [CommandListener] Listening stopped');
    console.log('🛑 ═══════════════════════════════════════════════════════════');
    console.log('');
  }

  /**
   * Set up Realtime channel for instant command delivery
   */
  private setupRealtimeChannel() {
    if (!this.deviceId) return;

    const channelName = `app_commands:device_id=eq.${this.deviceId}`;
    console.log('');
    console.log('📡 ═══════════════════════════════════════════════════════════');
    console.log('📡 [CommandListener] SETTING UP REALTIME CHANNEL');
    console.log('📡 Channel name:', channelName);
    console.log('📡 Device ID:', this.deviceId);
    console.log('📡 ═══════════════════════════════════════════════════════════');

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
          console.log('📨 ═══════════════════════════════════════════════════════════');
          console.log('📨 [CommandListener] ✅ REALTIME INSERT EVENT RECEIVED');
          console.log('📨 Payload:', JSON.stringify(payload, null, 2));
          console.log('📨 ═══════════════════════════════════════════════════════════');
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
          console.log('');
          console.log('📨 ═══════════════════════════════════════════════════════════');
          console.log('📨 [CommandListener] REALTIME UPDATE EVENT RECEIVED');
          console.log('📨 Payload:', JSON.stringify(payload, null, 2));
          console.log('📨 ═══════════════════════════════════════════════════════════');
          console.log('');
          
          // Only process if status changed to pending (in case of retry)
          if (payload.new && (payload.new as AppCommand).status === 'pending') {
            this.handleCommand(payload.new as AppCommand);
          } else {
            console.log('⏭️ [CommandListener] Skipping UPDATE - not pending status');
          }
        }
      )
      .subscribe((status) => {
        console.log('');
        console.log('📡 ═══════════════════════════════════════════════════════════');
        console.log('📡 [CommandListener] REALTIME CHANNEL STATUS CHANGE');
        console.log('📡 Status:', status);
        console.log('📡 ═══════════════════════════════════════════════════════════');
        console.log('');
        
        if (status === 'SUBSCRIBED') {
          this.connectionStatus = 'connected';
          console.log('✅ [CommandListener] Successfully subscribed to Realtime channel');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.connectionStatus = 'disconnected';
          console.error('❌ [CommandListener] Realtime channel error:', status);
        } else if (status === 'CLOSED') {
          this.connectionStatus = 'disconnected';
          console.log('🔌 [CommandListener] Realtime channel closed');
        }
      });
      
    console.log('✅ [CommandListener] Realtime channel setup complete');
    console.log('');
  }

  /**
   * Start polling for commands (fallback mechanism)
   */
  private startPolling() {
    console.log('');
    console.log('🔄 ═══════════════════════════════════════════════════════════');
    console.log('🔄 [CommandListener] STARTING COMMAND POLLING');
    console.log('🔄 Interval: 2 seconds');
    console.log('🔄 Device ID:', this.deviceId);
    console.log('🔄 Using API endpoint:', API_ENDPOINTS.getPendingCommands);
    console.log('🔄 ═══════════════════════════════════════════════════════════');
    console.log('');

    // Poll immediately
    this.pollForCommands();

    // Then poll every 2 seconds
    this.pollInterval = setInterval(() => {
      this.pollForCommands();
    }, 2000);
    
    console.log('✅ [CommandListener] Polling started');
  }

  /**
   * Poll for pending commands using the backend API endpoint
   */
  private async pollForCommands() {
    if (!this.deviceId || !this.isListening) {
      console.log('⏸️ [CommandListener] Skipping poll - not listening or no device ID');
      return;
    }

    this.pollCount++;
    console.log(`🔄 [CommandListener] ===== POLL #${this.pollCount} =====`);
    console.log(`🔄 [CommandListener] Polling for commands at: ${new Date().toISOString()}`);
    console.log(`🔄 [CommandListener] Device ID: ${this.deviceId}`);

    try {
      // Call the backend API endpoint to get pending commands
      console.log('🔄 [CommandListener] Calling API endpoint:', API_ENDPOINTS.getPendingCommands);
      
      const response = await fetch(API_ENDPOINTS.getPendingCommands, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          device_id: this.deviceId 
        }),
      });

      console.log('🔄 [CommandListener] API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [CommandListener] API error:', response.status, errorText);
        console.log(`🔄 [CommandListener] ===== POLL #${this.pollCount} FAILED =====`);
        console.log('');
        return;
      }

      const data = await response.json();
      console.log(`🔄 [CommandListener] API response:`, data);

      const commands = data.commands || [];
      console.log(`🔄 [CommandListener] Found ${commands.length} pending command(s)`);

      if (commands.length > 0) {
        console.log('');
        console.log('📬 ═══════════════════════════════════════════════════════════');
        console.log(`📬 [CommandListener] ✅ FOUND ${commands.length} PENDING COMMAND(S)`);
        console.log('📬 ═══════════════════════════════════════════════════════════');
        
        for (const command of commands) {
          console.log('📬 Command:', {
            id: command.id,
            command: command.command,
            device_id: command.device_id,
            screen_name: command.screen_name,
            status: command.status,
            created_at: command.created_at,
          });
          
          // Skip if we've already processed this command
          if (command.id === this.lastProcessedCommandId) {
            console.log('⏭️ [CommandListener] Skipping already processed command:', command.id);
            continue;
          }

          console.log('🎯 [CommandListener] Processing command from poll:', command.id);
          await this.handleCommand(command as AppCommand);
        }
        
        console.log('📬 ═══════════════════════════════════════════════════════════');
        console.log('');
      } else {
        console.log(`🔄 [CommandListener] No pending commands found`);
      }
      
      console.log(`🔄 [CommandListener] ===== POLL #${this.pollCount} COMPLETE =====`);
      console.log('');
    } catch (error) {
      console.error('❌ [CommandListener] Exception in pollForCommands:', error);
      if (error instanceof Error) {
        console.error('❌ [CommandListener] Error message:', error.message);
        console.error('❌ [CommandListener] Error stack:', error.stack);
      }
      console.log(`🔄 [CommandListener] ===== POLL #${this.pollCount} EXCEPTION =====`);
      console.log('');
    }
  }

  /**
   * Handle a received command
   */
  private async handleCommand(command: AppCommand) {
    console.log('');
    console.log('⚙️ ═══════════════════════════════════════════════════════════');
    console.log('⚙️ [CommandListener] HANDLING COMMAND');
    console.log('⚙️ ═══════════════════════════════════════════════════════════');
    console.log('⚙️ Command ID:', command.id);
    console.log('⚙️ Command Type:', command.command);
    console.log('⚙️ Command Status:', command.status);
    console.log('⚙️ Device ID:', command.device_id);
    console.log('⚙️ Screen Name:', command.screen_name);
    console.log('⚙️ Payload:', JSON.stringify(command.payload, null, 2));
    console.log('⚙️ Created At:', command.created_at);
    console.log('⚙️ ═══════════════════════════════════════════════════════════');

    // Skip if already processed
    if (command.status !== 'pending') {
      console.log('⏭️ [CommandListener] Skipping non-pending command (status:', command.status, ')');
      console.log('⚙️ ═══════════════════════════════════════════════════════════');
      console.log('');
      return;
    }

    // CRITICAL: Check if we've already processed this command ID
    if (this.processedCommandIds.has(command.id)) {
      console.log('⏭️ [CommandListener] ⚠️ DUPLICATE DETECTED - Already processed command:', command.id);
      console.log('⚙️ ═══════════════════════════════════════════════════════════');
      console.log('');
      return;
    }

    // CRITICAL: Check if this command is currently being processed
    if (this.processingCommandIds.has(command.id)) {
      console.log('⏭️ [CommandListener] ⚠️ DUPLICATE DETECTED - Command is currently being processed:', command.id);
      console.log('⚙️ ═══════════════════════════════════════════════════════════');
      console.log('');
      return;
    }

    // Mark as currently processing
    this.processingCommandIds.add(command.id);
    console.log('✓ Marked command as processing:', command.id);

    // Update last processed command ID
    this.lastProcessedCommandId = command.id;
    console.log('✓ Updated last processed command ID:', command.id);

    // Mark command as processing
    console.log('🔄 [CommandListener] Marking command as processing...');
    await this.updateCommandStatus(command.id, 'processing');

    // Get handler for this command
    console.log('🔍 [CommandListener] Looking for handler for command:', command.command);
    console.log('🔍 [CommandListener] Available handlers:', Array.from(this.commandHandlers.keys()));
    const handler = this.commandHandlers.get(command.command);

    if (!handler) {
      console.error('❌ [CommandListener] No handler registered for command:', command.command);
      console.error('❌ [CommandListener] Available handlers:', Array.from(this.commandHandlers.keys()));
      await this.updateCommandStatus(command.id, 'failed', 'No handler registered');
      console.log('⚙️ ═══════════════════════════════════════════════════════════');
      console.log('');
      return;
    }

    console.log('✓ Handler found for command:', command.command);

    try {
      // Execute the handler
      console.log('🚀 [CommandListener] Executing handler for command:', command.command);
      await handler(command);

      // Mark command as completed
      await this.updateCommandStatus(command.id, 'completed');
      
      // Add to processed set and remove from processing set
      this.processedCommandIds.add(command.id);
      this.processingCommandIds.delete(command.id);
      
      console.log('✅ [CommandListener] Command completed successfully:', command.id);
      console.log('✅ [CommandListener] Total processed commands:', this.processedCommandIds.size);
      console.log('⚙️ ═══════════════════════════════════════════════════════════');
      console.log('');
    } catch (error) {
      console.error('❌ [CommandListener] Error executing command handler:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.updateCommandStatus(command.id, 'failed', errorMessage);
      
      // Add to processed set and remove from processing set even on failure
      this.processedCommandIds.add(command.id);
      this.processingCommandIds.delete(command.id);
      
      console.log('❌ [CommandListener] Command failed:', command.id);
      console.log('⚙️ ═══════════════════════════════════════════════════════════');
      console.log('');
    }
  }

  /**
   * Update command status using the backend API endpoint
   */
  private async updateCommandStatus(
    commandId: string,
    status: 'processing' | 'completed' | 'failed',
    errorMessage?: string
  ) {
    try {
      const updateData: any = {
        command_id: commandId,
        status,
        executed_at: new Date().toISOString(),
      };

      if (errorMessage) {
        updateData.error_message = errorMessage;
      }

      console.log('💾 [CommandListener] Updating command status:', { commandId, status, errorMessage });

      const response = await fetch(API_ENDPOINTS.updateCommandStatus, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [CommandListener] Error updating command status:', response.status, errorText);
      } else {
        console.log(`✅ [CommandListener] Command status updated to: ${status}`);
      }
    } catch (error) {
      console.error('❌ [CommandListener] Exception in updateCommandStatus:', error);
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
      console.error('❌ [CommandListener] Exception in getCommandHistory:', error);
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
      console.error('❌ [CommandListener] Exception in testCommandListener:', error);
      return false;
    }
  }
}

// Export singleton instance
export const commandListener = new CommandListenerService();
