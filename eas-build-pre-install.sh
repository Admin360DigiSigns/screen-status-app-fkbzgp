
#!/bin/bash

# This script runs before the build to set up gradle.properties
# It will be executed during the EAS build process

echo "Setting up gradle.properties for Android build..."

# Create android directory if it doesn't exist
mkdir -p android

# Create gradle.properties with optimized memory settings
cat > android/gradle.properties << 'EOF'
# Project-wide Gradle settings.

# Memory allocation for Gradle daemon
org.gradle.jvmargs=-Xmx6144m -XX:MaxMetaspaceSize=2048m -XX:ReservedCodeCacheSize=512m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8

# Memory allocation for Kotlin compiler
kotlin.daemon.jvm.options=-Xmx3072m -XX:MaxMetaspaceSize=1024m

# AndroidX package structure to make it clearer which packages are bundled with the
# Android operating system, and which are packaged with your app's APK
android.useAndroidX=true

# Automatically convert third-party libraries to use AndroidX
android.enableJetifier=true

# Enable R8 code shrinker
android.enableR8=true

# Use new APK creator
android.useNewApkCreator=true

# Gradle caching
org.gradle.caching=true

# Configure on demand
org.gradle.configureondemand=true

# Parallel builds
org.gradle.parallel=true

# Disable new architecture (required for react-native-reanimated 3.x)
newArchEnabled=false

# Hermes engine
hermesEnabled=true
EOF

echo "gradle.properties created successfully"
