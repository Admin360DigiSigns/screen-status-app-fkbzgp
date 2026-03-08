
const { withAndroidManifest, withMainActivity } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Modify MainActivity to enable immersive kiosk mode
 */
function withKioskMainActivity(config) {
  return withMainActivity(config, async (config) => {
    const { modResults } = config;
    let contents = modResults.contents;
    
    // Add imports for immersive mode
    const importsToAdd = [
      'import android.view.View;',
      'import android.view.WindowManager;',
      'import android.os.Build;',
      'import android.view.WindowInsets;',
      'import android.view.WindowInsetsController;'
    ];
    
    // Check if imports already exist, if not add them
    importsToAdd.forEach(importStatement => {
      if (!contents.includes(importStatement)) {
        // Add after package declaration
        contents = contents.replace(
          /(package .*?;)/,
          `$1\n${importStatement}`
        );
      }
    });
    
    // Add immersive mode setup in onCreate
    const immersiveModeCode = `
        // Enable immersive fullscreen mode for kiosk/signage use
        enableImmersiveMode();
        
        // Keep screen on
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        
        // Prevent screen timeout
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
    `;
    
    // Add the code after super.onCreate() if not already present
    if (!contents.includes('enableImmersiveMode()')) {
      contents = contents.replace(
        /(super\.onCreate\(savedInstanceState\);)/,
        `$1${immersiveModeCode}`
      );
    }
    
    // Add enableImmersiveMode method
    const immersiveModeMethod = `
    /**
     * Enable immersive fullscreen mode - hides status and navigation bars
     */
    private void enableImmersiveMode() {
        View decorView = getWindow().getDecorView();
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11+ (API 30+)
            WindowInsetsController controller = decorView.getWindowInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            // Android 10 and below
            int uiOptions = View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN;
            decorView.setSystemUiVisibility(uiOptions);
        }
    }
    
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            // Re-enable immersive mode when window regains focus
            enableImmersiveMode();
        }
    }
    
    @Override
    public void onBackPressed() {
        // Disable back button for kiosk mode
        // Uncomment the line below to completely prevent exit
        // Do nothing - prevents exit via back button
        
        // Or allow exit with confirmation (current behavior)
        super.onBackPressed();
    }
`;
    
    // Add the method before the last closing brace if not already present
    if (!contents.includes('enableImmersiveMode()')) {
      const lastBraceIndex = contents.lastIndexOf('}');
      contents = contents.substring(0, lastBraceIndex) + immersiveModeMethod + '\n' + contents.substring(lastBraceIndex);
    }
    
    modResults.contents = contents;
    return config;
  });
}

/**
 * Add BootReceiver Java class to the Android project
 */
function withBootReceiver(config) {
  return withMainActivity(config, async (config) => {
    const { modResults } = config;
    const mainActivityPath = modResults.path;
    const packagePath = path.dirname(mainActivityPath);
    
    // Create BootReceiver.java file
    const bootReceiverContent = `package ${config.android.package};

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * BootReceiver - Automatically launches the app after device restart
 * This enables kiosk-style behavior for digital signage use cases
 */
public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        Log.d(TAG, "BootReceiver triggered with action: " + action);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || 
            "android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            
            Log.d(TAG, "Device boot completed - launching app");
            
            // Launch the main activity
            Intent launchIntent = new Intent(context, MainActivity.class);
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
            
            try {
                context.startActivity(launchIntent);
                Log.d(TAG, "App launched successfully after boot");
            } catch (Exception e) {
                Log.e(TAG, "Failed to launch app after boot: " + e.getMessage());
            }
        }
    }
}
`;
    
    const bootReceiverPath = path.join(packagePath, 'BootReceiver.java');
    
    try {
      // Ensure directory exists
      if (!fs.existsSync(packagePath)) {
        fs.mkdirSync(packagePath, { recursive: true });
      }
      
      // Write BootReceiver.java
      fs.writeFileSync(bootReceiverPath, bootReceiverContent);
      console.log('✅ BootReceiver.java created at:', bootReceiverPath);
    } catch (error) {
      console.warn('⚠️  Could not create BootReceiver.java:', error.message);
      console.warn('   This file will be generated during prebuild');
    }
    
    return config;
  });
}

/**
 * Custom config plugin to configure Android TV settings with Launcher and Kiosk mode
 */
function withAndroidTVManifest(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application[0];

    // Set the app as a TV app
    mainApplication.$['android:isGame'] = 'false';
    mainApplication.$['android:banner'] = '@mipmap/ic_launcher';

    // Find or create the main activity
    const mainActivity = mainApplication.activity?.find(
      (activity) =>
        activity['intent-filter']?.some((filter) =>
          filter.action?.some((action) => action.$['android:name'] === 'android.intent.action.MAIN')
        )
    );

    if (mainActivity) {
      // Set screen orientation to landscape for TV
      mainActivity.$['android:screenOrientation'] = 'landscape';
      
      // Enable immersive mode (hide status/navigation bars)
      mainActivity.$['android:theme'] = '@android:style/Theme.NoTitleBar.Fullscreen';
      
      // Launch mode for kiosk behavior
      mainActivity.$['android:launchMode'] = 'singleTask';
      
      // Exclude from recents to prevent exit via task switcher
      mainActivity.$['android:excludeFromRecents'] = 'false';
      
      // Keep screen on for signage use
      mainActivity.$['android:keepScreenOn'] = 'true';
      
      // Ensure the LEANBACK_LAUNCHER, HOME, and DEFAULT categories are present
      const intentFilters = mainActivity['intent-filter'] || [];
      const mainIntentFilter = intentFilters.find((filter) =>
        filter.action?.some((action) => action.$['android:name'] === 'android.intent.action.MAIN')
      );

      if (mainIntentFilter) {
        const categories = mainIntentFilter.category || [];
        
        // Add LEANBACK_LAUNCHER for Android TV
        const hasLeanback = categories.some(
          (cat) => cat.$['android:name'] === 'android.intent.category.LEANBACK_LAUNCHER'
        );
        if (!hasLeanback) {
          categories.push({
            $: { 'android:name': 'android.intent.category.LEANBACK_LAUNCHER' },
          });
        }
        
        // Add HOME category to make app eligible as home launcher
        const hasHome = categories.some(
          (cat) => cat.$['android:name'] === 'android.intent.category.HOME'
        );
        if (!hasHome) {
          categories.push({
            $: { 'android:name': 'android.intent.category.HOME' },
          });
        }
        
        // Add DEFAULT category for home launcher
        const hasDefault = categories.some(
          (cat) => cat.$['android:name'] === 'android.intent.category.DEFAULT'
        );
        if (!hasDefault) {
          categories.push({
            $: { 'android:name': 'android.intent.category.DEFAULT' },
          });
        }
        
        mainIntentFilter.category = categories;
      }
    }

    // Add BootReceiver for auto-start after device restart
    if (!mainApplication.receiver) {
      mainApplication.receiver = [];
    }
    
    const bootReceiver = {
      $: {
        'android:name': '.BootReceiver',
        'android:enabled': 'true',
        'android:exported': 'true',
      },
      'intent-filter': [
        {
          action: [
            {
              $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' },
            },
            {
              $: { 'android:name': 'android.intent.action.QUICKBOOT_POWERON' },
            },
          ],
          category: [
            {
              $: { 'android:name': 'android.intent.category.DEFAULT' },
            },
          ],
        },
      ],
    };
    
    // Check if BootReceiver already exists
    const hasBootReceiver = mainApplication.receiver.some(
      (receiver) => receiver.$['android:name'] === '.BootReceiver'
    );
    
    if (!hasBootReceiver) {
      mainApplication.receiver.push(bootReceiver);
    }

    // Add uses-feature declarations for TV
    if (!androidManifest.manifest['uses-feature']) {
      androidManifest.manifest['uses-feature'] = [];
    }

    const usesFeatures = androidManifest.manifest['uses-feature'];

    // Touchscreen not required for TV
    const touchscreenFeature = usesFeatures.find(
      (feature) => feature.$['android:name'] === 'android.hardware.touchscreen'
    );
    if (!touchscreenFeature) {
      usesFeatures.push({
        $: {
          'android:name': 'android.hardware.touchscreen',
          'android:required': 'false',
        },
      });
    } else {
      touchscreenFeature.$['android:required'] = 'false';
    }

    // Leanback (TV) feature required
    const leanbackFeature = usesFeatures.find(
      (feature) => feature.$['android:name'] === 'android.software.leanback'
    );
    if (!leanbackFeature) {
      usesFeatures.push({
        $: {
          'android:name': 'android.software.leanback',
          'android:required': 'true',
        },
      });
    }

    console.log('✅ Android TV Launcher & Kiosk configuration applied successfully');
    console.log('   - LEANBACK_LAUNCHER: Enabled');
    console.log('   - HOME launcher: Enabled');
    console.log('   - DEFAULT category: Enabled');
    console.log('   - Boot auto-start: Enabled');
    console.log('   - Immersive fullscreen: Enabled');
    console.log('   - Landscape orientation: Locked');
    
    return config;
  });
}

/**
 * Main export - combines all Android TV configurations
 */
module.exports = function withAndroidTV(config) {
  // Apply manifest changes
  config = withAndroidTVManifest(config);
  
  // Add BootReceiver
  config = withBootReceiver(config);
  
  // Enable kiosk mode in MainActivity
  config = withKioskMainActivity(config);
  
  return config;
};
