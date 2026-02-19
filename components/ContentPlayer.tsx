
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet, Image, Dimensions, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { colors } from '@/styles/commonStyles';
import type { PlaylistItem, Playlist } from '@/utils/apiService';
import { isTV } from '@/utils/deviceUtils';

interface ContentPlayerProps {
  playlists: Playlist[];
  onClose: () => void;
}

export default function ContentPlayer({ playlists, onClose }: ContentPlayerProps) {
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [screenDimensions, setScreenDimensions] = useState(Dimensions.get('window'));
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isTVDevice = isTV();

  // TV-specific scaling factor to make content smaller
  const tvScaleFactor = isTVDevice ? 0.7 : 1;

  // Listen for dimension changes (orientation, window resize)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      console.log('Screen dimensions changed:', window);
      setScreenDimensions(window);
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, []);

  // Get active playlists sorted by display order
  const activePlaylists = playlists
    .filter(playlist => playlist.is_active)
    .sort((a, b) => a.display_order - b.display_order);

  // Get current playlist and item
  const currentPlaylist = activePlaylists[currentPlaylistIndex];
  const currentItems = currentPlaylist?.items?.sort((a, b) => a.display_order - b.display_order) || [];
  const currentItem = currentItems[currentItemIndex];

  // Create video player for video items
  const videoPlayer = useVideoPlayer(
    currentItem?.media_type === 'video' ? currentItem.media_url : null,
    (player) => {
      if (currentItem?.media_type === 'video') {
        console.log('🎥 [ContentPlayer] Initializing video player for:', currentItem.media_url);
        player.loop = false;
        player.muted = false;
        player.volume = 1.0;
        
        // Add error handling
        player.addListener('statusChange', (status) => {
          console.log('🎥 [ContentPlayer] Video status changed:', status);
          if (status.error) {
            console.error('🎥 [ContentPlayer] Video error:', status.error);
            setVideoError(status.error.message || 'Video playback error');
            setIsLoading(false);
          }
        });
        
        player.play().catch((error) => {
          console.error('🎥 [ContentPlayer] Failed to play video:', error);
          setVideoError('Failed to play video');
          setIsLoading(false);
        });
      }
    }
  );

  const moveToNextItem = useCallback(() => {
    console.log('Moving to next item');
    setVideoError(null); // Clear any video errors
    setLoadError(null); // Clear any load errors
    
    if (currentItemIndex < currentItems.length - 1) {
      // Move to next item in current playlist
      setCurrentItemIndex(currentItemIndex + 1);
    } else if (currentPlaylistIndex < activePlaylists.length - 1) {
      // Move to first item of next playlist
      setCurrentPlaylistIndex(currentPlaylistIndex + 1);
      setCurrentItemIndex(0);
    } else {
      // Loop back to first playlist and first item
      setCurrentPlaylistIndex(0);
      setCurrentItemIndex(0);
    }
  }, [currentItemIndex, currentItems.length, currentPlaylistIndex, activePlaylists.length]);

  // Calculate optimal resize mode based on image and screen dimensions
  const getOptimalResizeMode = useCallback(() => {
    if (!imageAspectRatio) {
      return 'contain'; // Default to contain until we know the image dimensions
    }

    const screenAspectRatio = screenDimensions.width / screenDimensions.height;
    const isImageLandscape = imageAspectRatio > 1;
    const isScreenLandscape = screenAspectRatio > 1;

    console.log('Calculating resize mode:', {
      imageAspectRatio,
      screenAspectRatio,
      isImageLandscape,
      isScreenLandscape,
      isTVDevice,
      screenSize: `${screenDimensions.width}x${screenDimensions.height}`,
    });

    // Always use contain for best compatibility
    return 'contain';
  }, [imageAspectRatio, screenDimensions, isTVDevice]);

  // Get image dimensions when image loads
  const handleImageLoad = useCallback((uri: string) => {
    console.log('📷 [ContentPlayer] Loading image:', uri);
    
    // Set a timeout for image loading
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
    
    loadTimeoutRef.current = setTimeout(() => {
      console.error('📷 [ContentPlayer] Image load timeout');
      setLoadError('Image took too long to load');
      setIsLoading(false);
    }, 15000); // 15 second timeout
    
    Image.getSize(
      uri,
      (width, height) => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
        }
        const aspectRatio = width / height;
        console.log('📷 [ContentPlayer] Image dimensions loaded:', {
          width,
          height,
          aspectRatio,
          isLandscape: aspectRatio > 1,
        });
        setImageAspectRatio(aspectRatio);
        setIsLoading(false);
        setLoadError(null);
      },
      (error) => {
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
        }
        console.error('📷 [ContentPlayer] Failed to get image dimensions:', error);
        setLoadError('Failed to load image');
        setImageAspectRatio(1); // Default to square aspect ratio
        setIsLoading(false);
      }
    );
  }, []);

  useEffect(() => {
    if (!currentItem) {
      console.log('No current item available');
      return;
    }

    console.log('🎬 [ContentPlayer] Playing item:', {
      type: currentItem.media_type,
      url: currentItem.media_url,
      duration: currentItem.duration,
      screenSize: `${screenDimensions.width}x${screenDimensions.height}`,
      deviceType: isTVDevice ? 'TV' : 'Mobile/Tablet',
    });

    setIsLoading(true);
    setImageAspectRatio(null); // Reset aspect ratio for new item
    setVideoError(null); // Clear any video errors
    setLoadError(null); // Clear any load errors

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (currentItem.media_type === 'image') {
      // For images, get dimensions first, then show for the specified duration
      handleImageLoad(currentItem.media_url);
      
      timeoutRef.current = setTimeout(() => {
        moveToNextItem();
      }, currentItem.duration);
    } else if (currentItem.media_type === 'video') {
      // For videos, replace the source and play
      if (videoPlayer) {
        console.log('🎥 [ContentPlayer] Replacing video source');
        videoPlayer.replace(currentItem.media_url);
        
        // Wait a bit for the video to load before playing
        setTimeout(() => {
          videoPlayer.play().then(() => {
            console.log('🎥 [ContentPlayer] Video playing successfully');
            setIsLoading(false);
          }).catch((error) => {
            console.error('🎥 [ContentPlayer] Failed to play video:', error);
            setVideoError('Failed to play video');
            setIsLoading(false);
          });
        }, 500);

        // Set timeout based on duration
        timeoutRef.current = setTimeout(() => {
          moveToNextItem();
        }, currentItem.duration);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentPlaylistIndex, currentItemIndex, currentItem, screenDimensions, moveToNextItem, videoPlayer, handleImageLoad, isTVDevice]);

  if (!currentItem) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { fontSize: 18 * tvScaleFactor }]}>No content available to play</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={[styles.closeButtonText, { fontSize: 18 * tvScaleFactor }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const resizeMode = getOptimalResizeMode();

  return (
    <View style={styles.container}>
      {/* Content display - Full screen with responsive sizing - NO UI OVERLAYS */}
      <View style={styles.contentContainer}>
        {isLoading && !loadError && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { fontSize: 16 * tvScaleFactor }]}>Loading content...</Text>
          </View>
        )}

        {loadError && (
          <View style={styles.errorOverlay}>
            <Text style={[styles.errorText, { fontSize: 16 * tvScaleFactor }]}>⚠️ {loadError}</Text>
            <Text style={[styles.errorSubText, { fontSize: 14 * tvScaleFactor }]}>Moving to next item...</Text>
            <TouchableOpacity 
              style={styles.skipButton} 
              onPress={moveToNextItem}
            >
              <Text style={[styles.skipButtonText, { fontSize: 14 * tvScaleFactor }]}>Skip Now</Text>
            </TouchableOpacity>
          </View>
        )}

        {videoError && (
          <View style={styles.errorOverlay}>
            <Text style={[styles.errorText, { fontSize: 16 * tvScaleFactor }]}>⚠️ {videoError}</Text>
            <Text style={[styles.errorSubText, { fontSize: 14 * tvScaleFactor }]}>Moving to next item...</Text>
            <TouchableOpacity 
              style={styles.skipButton} 
              onPress={moveToNextItem}
            >
              <Text style={[styles.skipButtonText, { fontSize: 14 * tvScaleFactor }]}>Skip Now</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loadError && currentItem.media_type === 'image' ? (
          <Image
            source={{ uri: currentItem.media_url }}
            style={styles.media}
            resizeMode={resizeMode}
            onLoadStart={() => {
              console.log('📷 [ContentPlayer] Image load started');
            }}
            onLoadEnd={() => {
              console.log('📷 [ContentPlayer] Image loaded successfully with resizeMode:', resizeMode);
            }}
            onError={(error) => {
              console.error('📷 [ContentPlayer] Image load error:', error);
              setLoadError('Failed to load image');
              setIsLoading(false);
            }}
          />
        ) : !videoError && currentItem.media_type === 'video' ? (
          <VideoView
            player={videoPlayer}
            style={styles.media}
            contentFit="contain"
            nativeControls={false}
            onLoadStart={() => {
              console.log('🎥 [ContentPlayer] Video load started');
            }}
          />
        ) : null}
      </View>

      {/* NO UI OVERLAYS - Pure fullscreen slideshow mode */}
      {/* User requested: "When the preview is pressed it shows all the details and the close preview button, it should only show the solution in the screen no details or buttons" */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 16,
    fontWeight: '600',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    padding: 20,
  },
  skipButton: {
    marginTop: 20,
    backgroundColor: colors.secondary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  skipButtonText: {
    color: colors.card,
    fontWeight: '600',
  },
  closeButtonTop: {
    position: 'absolute',
    top: 48,
    right: 20,
    backgroundColor: colors.secondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    zIndex: 100,
    elevation: 5,
  },
  closeButtonTopTV: {
    top: 30,
    right: 30,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  closeButtonTopText: {
    color: colors.card,
    fontWeight: '600',
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 12,
    borderRadius: 8,
    zIndex: 50,
  },
  infoOverlayTV: {
    bottom: 30,
    left: 30,
    right: 30,
    padding: 16,
  },
  infoText: {
    color: colors.card,
    marginVertical: 2,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#000',
  },
  errorText: {
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
  errorSubText: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 8,
    textAlign: 'center',
  },
  closeButton: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  closeButtonText: {
    color: colors.card,
    fontWeight: '600',
  },
});
