
#!/bin/bash

# Create android directory if it doesn't exist
mkdir -p android

# Create gradle.properties with optimized memory settings
cat > android/gradle.properties <<EOL
# Gradle JVM memory settings - Increased for large builds
org.gradle.jvmargs=-Xmx8192m -XX:MaxMetaspaceSize=3072m -XX:ReservedCodeCacheSize=1024m -XX:+HeapDumpOnOutOfMemoryError

# Gradle daemon and parallel execution
org.gradle.daemon=true
org.gradle.parallel=true
org.gradle.configureondemand=true

# Android settings
android.useAndroidX=true
android.enableJetifier=true

# Kotlin daemon memory settings
kotlin.daemon.jvm.options=-Xmx4096m -XX:MaxMetaspaceSize=1536m

# Memory optimization - Disable R8 full mode and dexing artifact transform
android.enableR8.fullMode=false
android.enableDexingArtifactTransform=false

# New Architecture (required for react-native-reanimated)
newArchEnabled=true

# Reduce build complexity
android.enableD8.desugaring=true
android.enableBuildCache=true
EOL

echo "✅ gradle.properties configured with optimized memory settings"
