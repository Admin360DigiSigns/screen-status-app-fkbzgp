
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet, Image, Dimensions, ActivityIndicator, Text, TouchableOpacity, Platform, Pressable, TVEventHandler } from 'react-native';
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
  const [showControls, setShowControls] = useState(false);
  const [hideControlsTimeout, setHideControlsTimeout] = useState<NodeJS.Timeout | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tvEventHandlerRef = useRef<TVEventHandler | null>(null);

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

  // TV Remote Control Handler
  useEffect(() => {
    if (isTVDevice && Platform.OS !== 'web') {
      console.log('Setting up TV remote control handler');
      
      // Create TV event handler for remote control
      tvEventHandlerRef.current = new TVEventHandler();
      
      tvEventHandlerRef.current.enable(null, (component: any, evt: any) => {
        console.log('TV Remote Event:', evt.eventType);
        
        // Show controls when any button is pressed on the remote
        if (evt && evt.eventType) {
          // Common TV remote events: select, playPause, menu, up, down, left, right
          if (['select', 'playPause', 'menu', 'up', 'down', 'left', 'right'].includes(evt.eventType)) {
            console.log('TV Remote button pressed - showing controls');
            handleShowControls();
          }
        }
      });

      return () => {
        if (tvEventHandlerRef.current) {
          console.log('Disabling TV remote control handler');
          tvEventHandlerRef.current.disable();
        }
      };
    }
  }, [isTVDevice]);

  // Handle showing controls with auto-hide
  const handleShowControls = useCallback(() => {
    console.log('Showing controls');
    setShowControls(true);

    // Clear existing timeout
    if (hideControlsTimeout) {
      clearTimeout(hideControlsTimeout);
    }

    // Auto-hide controls after 5 seconds
    const timeout = setTimeout(() => {
      console.log('Auto-hiding controls');
      setShowControls(false);
    }, 5000);

    setHideControlsTimeout(timeout);
  }, [hideControlsTimeout]);

  // Handle screen tap/click for mobile
  const handleScreenPress = useCallback(() => {
    if (!isTVDevice) {
      console.log('Screen pressed - toggling controls');
      if (showControls) {
        // If controls are visible, hide them
        setShowControls(false);
        if (hideControlsTimeout) {
          clearTimeout(hideControlsTimeout);
          setHideControlsTimeout(null);
        }
      } else {
        // If controls are hidden, show them with auto-hide
        handleShowControls();
      }
    }
  }, [isTVDevice, showControls, hideControlsTimeout, handleShowControls]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideControlsTimeout) {
        clearTimeout(hideControlsTimeout);
      }
    };
  }, [hideControlsTimeout]);

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
    Image.getSize(
      uri,
      (width, height) => {
        const aspectRatio = width / height;
        console.log('📷 [ContentPlayer] Image dimensions loaded:', {
          width,
          height,
          aspectRatio,
          isLandscape: aspectRatio > 1,
        });
        setImageAspectRatio(aspectRatio);
        setIsLoading(false);
      },
      (error) => {
        console.error('📷 [ContentPlayer] Failed to get image dimensions:', error);
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
    <Pressable 
      style={styles.container}
      onPress={handleScreenPress}
    >
      {/* Content display - Full screen with responsive sizing */}
      <View style={styles.contentContainer}>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { fontSize: 16 * tvScaleFactor }]}>Loading content...</Text>
          </View>
        )}

        {videoError && (
          <View style={styles.errorOverlay}>
            <Text style={[styles.errorText, { fontSize: 16 * tvScaleFactor }]}>⚠️ {videoError}</Text>
            <Text style={[styles.errorSubText, { fontSize: 14 * tvScaleFactor }]}>Moving to next item...</Text>
          </View>
        )}

        {currentItem.media_type === 'image' ? (
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
              setIsLoading(false);
            }}
          />
        ) : currentItem.media_type === 'video' ? (
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

      {/* Conditional Controls Overlay - Only shown when showControls is true */}
      {showControls && (
        <React.Fragment>
          {/* Close button */}
          <TouchableOpacity 
            style={[styles.closeButtonTop, isTVDevice && styles.closeButtonTopTV]} 
            onPress={onClose}
            onFocus={() => console.log('Close button focused')}
          >
            <Text style={[styles.closeButtonTopText, { fontSize: 16 * tvScaleFactor }]}>✕ Close Preview</Text>
          </TouchableOpacity>

          {/* Info overlay - Description */}
          <View style={[styles.infoOverlay, isTVDevice && styles.infoOverlayTV]}>
            <Text style={[styles.infoText, { fontSize: 14 * tvScaleFactor }]}>
              Playlist: {currentPlaylist.name} ({currentPlaylistIndex + 1}/{activePlaylists.length})
            </Text>
            <Text style={[styles.infoText, { fontSize: 14 * tvScaleFactor }]}>
              Item: {currentItemIndex + 1}/{currentItems.length} - {currentItem.media_type}
            </Text>
            <Text style={[styles.infoText, { fontSize: 14 * tvScaleFactor }]}>
              Screen: {Math.round(screenDimensions.width)}x{Math.round(screenDimensions.height)} 
              {isTVDevice ? ' (TV)' : ' (Mobile)'}
            </Text>
            {imageAspectRatio && (
              <Text style={[styles.infoText, { fontSize: 14 * tvScaleFactor }]}>
                Image: {imageAspectRatio > 1 ? 'Landscape' : 'Portrait'} ({imageAspectRatio.toFixed(2)}) - Mode: {resizeMode}
              </Text>
            )}
            <Text style={[styles.infoText, { marginTop: 8, fontStyle: 'italic', opacity: 0.8, fontSize: 12 * tvScaleFactor }]}>
              {isTVDevice ? 'Press any button on remote to show/hide controls' : 'Tap screen to show/hide controls'}
            </Text>
          </View>
        </React.Fragment>
      )}
    </Pressable>
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
  closeButtonTop: {
    position: 'absolute',
    top: 48,
    right: 20,
    backgroundColor: colors.secondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    zIndex: 100,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.3)',
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
