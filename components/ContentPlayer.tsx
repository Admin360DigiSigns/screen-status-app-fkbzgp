
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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tvEventHandlerRef = useRef<TVEventHandler | null>(null);

  const isTVDevice = isTV();

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
        player.loop = false;
        player.play();
      }
    }
  );

  const moveToNextItem = useCallback(() => {
    console.log('Moving to next item');
    
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

    // For TV devices
    if (isTVDevice) {
      if (isImageLandscape) {
        // Landscape image on TV: fit width, height adjusts
        return 'contain';
      } else {
        // Portrait image on TV: fit height, width adjusts
        return 'contain';
      }
    }

    // For mobile/tablet devices
    if (isScreenLandscape) {
      // Mobile in landscape mode
      if (isImageLandscape) {
        // Landscape image on landscape screen: fit width
        return 'contain';
      } else {
        // Portrait image on landscape screen: fit height
        return 'contain';
      }
    } else {
      // Mobile in portrait mode
      if (isImageLandscape) {
        // Landscape image on portrait screen: fit width
        return 'contain';
      } else {
        // Portrait image on portrait screen: fit height
        return 'contain';
      }
    }
  }, [imageAspectRatio, screenDimensions, isTVDevice]);

  // Get image dimensions when image loads
  const handleImageLoad = useCallback((uri: string) => {
    Image.getSize(
      uri,
      (width, height) => {
        const aspectRatio = width / height;
        console.log('Image dimensions loaded:', {
          width,
          height,
          aspectRatio,
          isLandscape: aspectRatio > 1,
        });
        setImageAspectRatio(aspectRatio);
        setIsLoading(false);
      },
      (error) => {
        console.error('Failed to get image dimensions:', error);
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

    console.log('Playing item:', {
      type: currentItem.media_type,
      url: currentItem.media_url,
      duration: currentItem.duration,
      screenSize: `${screenDimensions.width}x${screenDimensions.height}`,
      deviceType: isTVDevice ? 'TV' : 'Mobile/Tablet',
    });

    setIsLoading(true);
    setImageAspectRatio(null); // Reset aspect ratio for new item

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
        videoPlayer.replace(currentItem.media_url);
        videoPlayer.play();
        setIsLoading(false);

        // Set timeout based on duration or video length
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
          <Text style={styles.errorText}>No content available to play</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
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
          </View>
        )}

        {currentItem.media_type === 'image' ? (
          <Image
            source={{ uri: currentItem.media_url }}
            style={styles.media}
            resizeMode={resizeMode}
            onLoadEnd={() => {
              console.log('Image loaded successfully with resizeMode:', resizeMode);
            }}
            onError={(error) => {
              console.error('Image load error:', error);
              setIsLoading(false);
            }}
          />
        ) : currentItem.media_type === 'video' ? (
          <VideoView
            player={videoPlayer}
            style={styles.media}
            contentFit="contain"
            nativeControls={false}
          />
        ) : null}
      </View>

      {/* Conditional Controls Overlay - Only shown when showControls is true */}
      {showControls && (
        <React.Fragment>
          {/* Close button */}
          <TouchableOpacity 
            style={styles.closeButtonTop} 
            onPress={onClose}
            onFocus={() => console.log('Close button focused')}
          >
            <Text style={styles.closeButtonTopText}>✕ Close Preview</Text>
          </TouchableOpacity>

          {/* Info overlay - Description */}
          <View style={styles.infoOverlay}>
            <Text style={styles.infoText}>
              Playlist: {currentPlaylist.name} ({currentPlaylistIndex + 1}/{activePlaylists.length})
            </Text>
            <Text style={styles.infoText}>
              Item: {currentItemIndex + 1}/{currentItems.length} - {currentItem.media_type}
            </Text>
            <Text style={styles.infoText}>
              Screen: {Math.round(screenDimensions.width)}x{Math.round(screenDimensions.height)} 
              {isTVDevice ? ' (TV)' : ' (Mobile)'}
            </Text>
            {imageAspectRatio && (
              <Text style={styles.infoText}>
                Image: {imageAspectRatio > 1 ? 'Landscape' : 'Portrait'} ({imageAspectRatio.toFixed(2)}) - Mode: {resizeMode}
              </Text>
            )}
            <Text style={[styles.infoText, { marginTop: 8, fontStyle: 'italic', opacity: 0.8 }]}>
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
    backgroundColor: colors.background,
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
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
  closeButtonTopText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '600',
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderRadius: 8,
    zIndex: 50,
  },
  infoText: {
    color: colors.card,
    fontSize: 14,
    marginVertical: 2,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    color: colors.text,
    fontSize: 18,
    marginBottom: 20,
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
    fontSize: 18,
    fontWeight: '600',
  },
});
