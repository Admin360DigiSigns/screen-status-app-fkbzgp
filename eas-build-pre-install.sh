
#!/bin/bash

# Kill any existing Gradle daemons to ensure fresh start with new memory settings
echo "🔄 Stopping existing Gradle daemons..."
./gradlew --stop 2>/dev/null || true
pkill -f '.*GradleDaemon.*' 2>/dev/null || true

# Create android directory if it doesn't exist
mkdir -p android

# Create gradle.properties with ULTRA-MAXIMIZED memory settings for Metaspace error
cat > android/gradle.properties <<EOL
# Gradle JVM memory settings - ULTRA-MAXIMIZED for Metaspace error
org.gradle.jvmargs=-Xmx16384m -XX:MaxMetaspaceSize=8192m -XX:ReservedCodeCacheSize=2048m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8 -XX:+UseG1GC -XX:MaxGCPauseMillis=200

# DISABLE parallel builds to reduce memory pressure
org.gradle.daemon=true
org.gradle.parallel=false
org.gradle.workers.max=1
org.gradle.configureondemand=false

# Android settings
android.useAndroidX=true
android.enableJetifier=true

# Kotlin daemon memory settings - ULTRA-MAXIMIZED
kotlin.daemon.jvm.options=-Xmx10240m -XX:MaxMetaspaceSize=6144m -XX:ReservedCodeCacheSize=2048m

# KAPT memory settings
kapt.daemon.jvm.options=-Xmx10240m -XX:MaxMetaspaceSize=6144m

# Memory optimization
android.enableR8.fullMode=false
android.enableDexingArtifactTransform=false

# KSP-specific settings - CRITICAL for Metaspace
ksp.incremental=false
ksp.incremental.intermodule=false
ksp.use.worker.api=false

# Kotlin compiler settings
kotlin.incremental=false
kotlin.compiler.execution.strategy=in-process
kotlin.parallel.tasks.in.project=false

# New Architecture (required for react-native-reanimated)
newArchEnabled=true

# Additional optimizations
android.enableD8.desugaring=true
android.enableBuildCache=true
org.gradle.configuration-cache=false
org.gradle.daemon.performance.disable-logging=true
EOL

echo "✅ gradle.properties configured with ULTRA-MAXIMIZED memory settings"

# Create init.gradle to force memory settings
mkdir -p android
cat > android/init.gradle <<EOL
// Force memory settings at initialization
allprojects {
    gradle.projectsEvaluated {
        tasks.withType(JavaCompile) {
            options.fork = true
            options.forkOptions.jvmArgs = [
                '-Xmx8192m',
                '-XX:MaxMetaspaceSize=4096m',
                '-XX:+UseG1GC'
            ]
        }
    }
}

println "==================================="
println "Init Script: Memory Settings Applied"
println "Max Heap: \${Runtime.runtime.maxMemory() / 1024 / 1024} MB"
println "==================================="
EOL

echo "✅ init.gradle created for early memory configuration"

# Clear Gradle cache to ensure clean build
echo "🧹 Clearing Gradle caches..."
rm -rf ~/.gradle/caches/ 2>/dev/null || true
rm -rf android/.gradle/ 2>/dev/null || true
rm -rf android/build/ 2>/dev/null || true
rm -rf android/app/build/ 2>/dev/null || true

echo "✅ Pre-install script completed successfully"
