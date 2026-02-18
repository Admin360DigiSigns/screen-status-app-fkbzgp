
#!/bin/bash

# Create android/gradle.properties if it doesn't exist
mkdir -p android
if [ ! -f "android/gradle.properties" ]; then
  touch "android/gradle.properties"
fi

# Append or update properties in gradle.properties
{
  echo "org.gradle.jvmargs=-Xmx10240m -XX:MaxMetaspaceSize=4096m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8 -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:G1HeapRegionSize=16M"
  echo "kotlin.daemon.jvmargs=-Xmx5120m -XX:MaxMetaspaceSize=2048m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8 -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:G1HeapRegionSize=16M"
  echo "android.useNewApkCreator=false"
  echo "android.enableR8=true"
  echo "android.injected.build.api=34"
  echo "android.buildCache=true"
  echo "org.gradle.caching=true"
  echo "org.gradle.parallel=true"
  echo "org.gradle.daemon=true"
  echo "org.gradle.workers.max=4"
  echo "org.gradle.configureondemand=false"
  echo "android.ndkVersion=26.1.10909125"
  echo "cmake.version=3.22.1"
  echo "newArchEnabled=false"
  echo "org.gradle.daemon.idletimeout=3600000"
  echo "android.useAndroidX=true"
  echo "android.enableJetifier=true"
  echo "hermesEnabled=true"
  echo "org.gradle.vfs.watch=false"
} >> android/gradle.properties
