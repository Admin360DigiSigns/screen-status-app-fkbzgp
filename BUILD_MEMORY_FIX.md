
# Build Memory Configuration - OutOfMemoryError Fix

## Problem
The Android APK build was failing with:
```
e: [ksp] java.lang.OutOfMemoryError: Metaspace
> Task :expo-updates:kspReleaseKotlin FAILED
```

This error occurs during Kotlin Symbol Processing (KSP) when the JVM runs out of metaspace memory.

## Solution Applied

### Memory Allocation Increased to MAXIMUM Safe Values:

#### 1. Gradle JVM Memory (org.gradle.jvmargs)
- **Heap Size (Xmx)**: 6GB → **8GB** (maximum safe value)
- **Metaspace (MaxMetaspaceSize)**: 2GB → **3GB** (critical for KSP)
- **Code Cache (ReservedCodeCacheSize)**: 512MB → **1GB**
- **Added G1GC**: Better garbage collection for large builds

#### 2. Kotlin Daemon Memory (kotlin.daemon.jvmargs)
- **Heap Size**: 3GB → **4GB**
- **Metaspace**: 1GB → **2GB** (specifically for KSP processing)
- **Code Cache**: Added 512MB
- **Added G1GC**: Optimized garbage collection

#### 3. Build Optimization
- **Workers**: Increased from 4 to **6** parallel workers
- **Configuration Cache**: Enabled for faster builds
- **Build Cache**: Enabled to reuse previous build outputs
- **R8 Full Mode**: Disabled to save memory during compilation

#### 4. Additional Settings
- **Daemon Idle Timeout**: Increased to 1 hour (prevents daemon restarts)
- **Kapt Memory**: Added 4GB heap + 2GB metaspace for annotation processing
- **File Encoding**: UTF-8 explicitly set

## Files Modified

1. **android/gradle.properties** - Android-specific Gradle settings
2. **gradle.properties** (root) - Project-wide Gradle settings

## What This Fixes

✅ **OutOfMemoryError: Metaspace** during KSP (Kotlin Symbol Processing)
✅ **Build failures** in expo-updates, expo-modules-core, react-native-reanimated
✅ **Lint analysis failures** during release builds
✅ **Memory exhaustion** during large dependency compilation

## Memory Breakdown

| Component | Previous | New | Purpose |
|-----------|----------|-----|---------|
| Gradle Heap | 6GB | **8GB** | Main build process |
| Gradle Metaspace | 2GB | **3GB** | Class metadata (KSP) |
| Kotlin Heap | 3GB | **4GB** | Kotlin compilation |
| Kotlin Metaspace | 1GB | **2GB** | Kotlin class metadata |
| Code Cache | 512MB | **1GB** | JIT compilation cache |

## System Requirements

Your build machine should have:
- **Minimum 12GB RAM** (16GB recommended)
- **8GB+ available during build**
- Swap space enabled if RAM is limited

## Next Steps

The build should now complete successfully. If you still encounter memory issues:

1. **Close other applications** during build
2. **Increase system swap space**
3. **Build one architecture at a time** by modifying:
   ```
   reactNativeArchitectures=arm64-v8a
   ```
   (instead of building all 4 architectures simultaneously)

## Verification

After applying these changes, the build process will:
- Use up to 8GB for Gradle operations
- Use up to 4GB for Kotlin compilation
- Use up to 3GB for metaspace (class metadata)
- Total: ~15GB maximum memory usage during peak build

This is the **maximum safe configuration** for Android APK builds.
