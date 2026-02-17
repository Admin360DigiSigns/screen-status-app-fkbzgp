
#!/bin/bash

# This script runs before dependencies are installed during EAS Build

echo "Setting up Gradle properties for memory optimization..."

# Create gradle.properties if it doesn't exist
mkdir -p android
cat > android/gradle.properties << 'EOF'
# Increase memory for build
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8
org.gradle.parallel=true
org.gradle.caching=true

# Android settings
android.useAndroidX=true
android.enableJetifier=true

# React Native settings
reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
newArchEnabled=false
hermesEnabled=true

# Kotlin daemon settings
kotlin.daemon.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m

# Flipper
FLIPPER_VERSION=0.125.0
EOF

echo "Gradle properties configured successfully"
