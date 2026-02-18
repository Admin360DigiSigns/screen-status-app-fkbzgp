
#!/bin/bash

# This script runs before the build to set up gradle.properties
# It will be executed during the EAS build process

echo "Setting up gradle.properties for Android build..."

# Create android directory if it doesn't exist
mkdir -p android

# Create gradle.properties with optimized memory settings
cat > android/gradle.properties << 'EOF'
# Project-wide Gradle settings.

# Memory allocation for Gradle daemon (maximized for stability)
org.gradle.jvmargs=-Xmx10240m -XX:MaxMetaspaceSize=4096m -XX:ReservedCodeCacheSize=1536m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8 -XX:+UseG1GC

# Memory allocation for Kotlin compiler (increased)
kotlin.daemon.jvm.options=-Xmx5120m -XX:MaxMetaspaceSize=2048m

# AndroidX package structure to make it clearer which packages are bundled with the
# Android operating system, and which are packaged with your app's APK
android.useAndroidX=true

# Automatically convert third-party libraries to use AndroidX
android.enableJetifier=true

# Enable R8 code shrinker
android.enableR8=true

# Use legacy APK creator for stability
android.useNewApkCreator=false

# Gradle caching
org.gradle.caching=true

# Configure on demand (disabled for stability)
org.gradle.configureondemand=false

# Parallel builds
org.gradle.parallel=true

# Disable new architecture (required for react-native-reanimated 3.x)
newArchEnabled=false

# Hermes engine
hermesEnabled=true

# NDK version (for CMake builds)
android.ndkVersion=26.1.10909125

# CMake version
android.cmakeVersion=3.22.1

# Increase build timeout significantly
org.gradle.daemon.idletimeout=10800000

# Additional stability settings
org.gradle.workers.max=4
org.gradle.vfs.watch=false
EOF

echo "gradle.properties created successfully"
echo "Contents:"
cat android/gradle.properties
