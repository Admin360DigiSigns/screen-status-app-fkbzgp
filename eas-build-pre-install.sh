
#!/bin/bash

# Create android directory if it doesn't exist
mkdir -p android

# Create gradle.properties with MAXIMUM memory settings
cat > android/gradle.properties <<EOL
# Gradle JVM memory settings - MAXIMUM allocation for build
org.gradle.jvmargs=-Xmx10240m -XX:MaxMetaspaceSize=4096m -XX:ReservedCodeCacheSize=1536m -XX:+HeapDumpOnOutOfMemoryError -XX:MaxPermSize=2048m

# Gradle daemon and parallel execution
org.gradle.daemon=true
org.gradle.parallel=false
org.gradle.configureondemand=false
org.gradle.caching=true

# Android settings
android.useAndroidX=true
android.enableJetifier=true

# Kotlin daemon memory settings - INCREASED
kotlin.daemon.jvm.options=-Xmx6144m -XX:MaxMetaspaceSize=2048m

# Memory optimization - Disable memory-intensive features
android.enableR8.fullMode=false
android.enableDexingArtifactTransform=false
android.enableD8.desugaring=false

# New Architecture (required for react-native-reanimated)
newArchEnabled=true

# Build optimization - Single architecture only
android.enableBuildCache=true

# Disable unnecessary features to save memory
org.gradle.jvmargs.kapt=-Xmx4096m
kapt.use.worker.api=false
kapt.incremental.apt=false
EOL

echo "✅ gradle.properties configured with MAXIMUM memory settings"
