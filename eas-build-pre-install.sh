
#!/bin/bash

# EAS Build Pre-Install Script
# This script runs before dependencies are installed to optimize the build environment

echo "🔧 Configuring build environment for memory optimization..."

# Set environment variables for maximum memory allocation
export GRADLE_OPTS="-Xmx8192m -XX:MaxMetaspaceSize=4096m -XX:ReservedCodeCacheSize=1024m -XX:+HeapDumpOnOutOfMemoryError -XX:+UseG1GC"
export NODE_OPTIONS="--max-old-space-size=8192"

# Clean any existing build artifacts
echo "🧹 Cleaning build artifacts..."
rm -rf android/build 2>/dev/null || true
rm -rf android/app/build 2>/dev/null || true
rm -rf android/.gradle 2>/dev/null || true
rm -rf node_modules/.cache 2>/dev/null || true

# Clear Gradle caches
echo "🗑️  Clearing Gradle caches..."
rm -rf ~/.gradle/caches 2>/dev/null || true
rm -rf ~/.gradle/daemon 2>/dev/null || true

echo "✅ Build environment configured successfully"
