
#!/bin/bash

# Kill any existing Gradle daemons to ensure fresh start with new memory settings
echo "🔄 Stopping existing Gradle daemons..."
./gradlew --stop 2>/dev/null || true
pkill -f '.*GradleDaemon.*' 2>/dev/null || true
pkill -f '.*KotlinCompileDaemon.*' 2>/dev/null || true

# Wait for processes to fully terminate
sleep 3

# Create android directory if it doesn't exist
mkdir -p android

# Create gradle.properties with EXTREME memory settings for Metaspace error
cat > android/gradle.properties <<EOL
# Gradle JVM memory settings - EXTREME ALLOCATION for Metaspace error
# Increased Metaspace from 8GB to 12GB to handle KSP compilation
org.gradle.jvmargs=-Xmx20480m -XX:MaxMetaspaceSize=12288m -XX:ReservedCodeCacheSize=3072m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8 -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions

# DISABLE parallel builds to reduce memory pressure
org.gradle.daemon=true
org.gradle.parallel=false
org.gradle.workers.max=1
org.gradle.configureondemand=false

# Android settings
android.useAndroidX=true
android.enableJetifier=true

# Kotlin daemon memory settings - EXTREME ALLOCATION
# Increased from 10GB to 12GB Metaspace for KSP tasks
kotlin.daemon.jvm.options=-Xmx12288m -XX:MaxMetaspaceSize=8192m -XX:ReservedCodeCacheSize=3072m -XX:+UseG1GC -XX:+UnlockExperimentalVMOptions

# KAPT memory settings
kapt.daemon.jvm.options=-Xmx12288m -XX:MaxMetaspaceSize=8192m

# Memory optimization
android.enableR8.fullMode=false
android.enableDexingArtifactTransform=false

# KSP-specific settings - CRITICAL for Metaspace
ksp.incremental=false
ksp.incremental.intermodule=false
ksp.use.worker.api=false
ksp.jvm.args=-Xmx12288m -XX:MaxMetaspaceSize=8192m -XX:+UseG1GC -XX:MaxGCPauseMillis=200

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

echo "✅ gradle.properties configured with EXTREME memory settings (12GB Metaspace)"

# Create init.gradle to force memory settings and catch KSP tasks early
mkdir -p android
cat > android/init.gradle <<EOL
// Force memory settings at initialization - CRITICAL for KSP Metaspace error
allprojects {
    gradle.projectsEvaluated {
        // Apply to all Java compilation tasks
        tasks.withType(JavaCompile) {
            options.fork = true
            options.forkOptions.jvmArgs = [
                '-Xmx10240m',
                '-XX:MaxMetaspaceSize=6144m',
                '-XX:+UseG1GC',
                '-XX:MaxGCPauseMillis=200'
            ]
        }

        // Apply to all Kotlin compilation tasks
        tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile) {
            kotlinOptions {
                jvmTarget = "1.8"
                freeCompilerArgs += [
                    "-Xjvm-default=all",
                    "-Xmx12288m",
                    "-XX:MaxMetaspaceSize=8192m"
                ]
            }
        }

        // CRITICAL: Apply extreme memory settings to KSP tasks
        tasks.matching { it.name.contains("ksp") || it.name.contains("Ksp") }.configureEach {
            doFirst {
                println "================================================"
                println "🔧 Configuring KSP task: \${it.name}"
                println "   Max Heap: 12GB"
                println "   Max Metaspace: 8GB"
                println "================================================"
            }
            
            // Force KSP to use extreme memory settings
            if (it.hasProperty('kotlinOptions')) {
                it.kotlinOptions {
                    jvmTarget = "1.8"
                    freeCompilerArgs += [
                        "-Xjvm-default=all",
                        "-Xmx12288m",
                        "-XX:MaxMetaspaceSize=8192m",
                        "-XX:+UseG1GC"
                    ]
                }
            }
        }
    }
}

println "==================================="
println "Init Script: EXTREME Memory Settings Applied"
println "Max Heap: \${Runtime.runtime.maxMemory() / 1024 / 1024} MB"
println "Target Metaspace: 12GB"
println "==================================="
EOL

echo "✅ init.gradle created with KSP-specific memory configuration"

# Clear Gradle cache to ensure clean build
echo "🧹 Clearing Gradle caches..."
rm -rf ~/.gradle/caches/ 2>/dev/null || true
rm -rf ~/.gradle/daemon/ 2>/dev/null || true
rm -rf ~/.kotlin/daemon/ 2>/dev/null || true
rm -rf android/.gradle/ 2>/dev/null || true
rm -rf android/build/ 2>/dev/null || true
rm -rf android/app/build/ 2>/dev/null || true

# Clear any KSP-specific caches
find android -type d -name "ksp" -exec rm -rf {} + 2>/dev/null || true

echo "✅ Pre-install script completed successfully"
echo "🚀 Build will use EXTREME memory allocation:"
echo "   - Gradle Heap: 20GB"
echo "   - Gradle Metaspace: 12GB"
echo "   - Kotlin Daemon Heap: 12GB"
echo "   - Kotlin Daemon Metaspace: 8GB"
echo "   - KSP JVM Args: 12GB Heap, 8GB Metaspace"
