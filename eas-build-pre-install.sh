
#!/bin/bash

# This script runs before dependencies are installed during EAS Build

echo "Setting up Gradle properties for memory optimization..."

# Create gradle.properties if it doesn't exist
mkdir -p android
cat > android/gradle.properties << 'EOF'
# Increase memory for build - AGGRESSIVE SETTINGS
org.gradle.jvmargs=-Xmx6144m -XX:MaxMetaspaceSize=2048m -XX:+HeapDumpOnOutOfMemoryError -XX:ReservedCodeCacheSize=512m -Dfile.encoding=UTF-8
org.gradle.parallel=true
org.gradle.caching=true
org.gradle.configureondemand=true
org.gradle.daemon=true

# Android settings
android.useAndroidX=true
android.enableJetifier=true

# React Native settings - Build only arm64-v8a to reduce memory usage
reactNativeArchitectures=arm64-v8a
newArchEnabled=true
hermesEnabled=true

# Kotlin daemon settings - INCREASED
kotlin.daemon.jvmargs=-Xmx3072m -XX:MaxMetaspaceSize=1024m

# Disable unnecessary features to save memory
android.enableR8.fullMode=false
android.enableDexingArtifactTransform=false

# Flipper
FLIPPER_VERSION=0.125.0
EOF

echo "Gradle properties configured successfully"
