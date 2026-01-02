import React, { useRef, useEffect, useMemo } from 'react';
import { StyleSheet, Text, Image, View, PanResponder, Animated } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { theme } from '../constants/theme';

export default function OverlayItem({ item, onUpdate, isSelected, onSelect, isPlaying, currentTime }) {
    const pan = useRef(new Animated.ValueXY({ x: item.x || 0, y: item.y || 0 })).current;
    const videoRef = useRef(null);
    const wasPlayingRef = useRef(false);

    // Sync local animated value with parent props (handle Inspector updates)
    useEffect(() => {
        pan.setOffset({ x: item.x || 0, y: item.y || 0 });
        pan.setValue({ x: 0, y: 0 });
    }, [item.x, item.y]);

    // Video Sync Logic - ONLY runs for video type overlays
    useEffect(() => {
        // Skip this effect entirely for non-video overlays
        if (item.type !== 'video' || !videoRef.current) {
            return;
        }

        const start = item.start || 0;
        const end = item.end || 5;

        // Determine visibility based on current time
        const isInTimeRange = currentTime === undefined || (currentTime >= start && currentTime <= end);

        if (isInTimeRange) {
            const relativeTime = currentTime !== undefined ? Math.max(0, currentTime - start) : 0;
            const seekTimeMillis = relativeTime * 1000;

            if (isPlaying) {
                if (!wasPlayingRef.current) {
                    videoRef.current.playFromPositionAsync(seekTimeMillis).catch(() => { });
                }
            } else {
                if (wasPlayingRef.current) {
                    videoRef.current.pauseAsync().catch(() => { });
                }
                videoRef.current.setPositionAsync(seekTimeMillis).catch(() => { });
            }
        } else {
            if (wasPlayingRef.current) {
                videoRef.current.pauseAsync().catch(() => { });
            }
        }

        wasPlayingRef.current = isInTimeRange && isPlaying;
    }, [item.type, isPlaying, currentTime, item.start, item.end]);

    // Memoize PanResponder to prevent recreation on every render
    const panResponder = useMemo(() =>
        PanResponder.create({
            onStartShouldSetPanResponder: () => {
                onSelect();
                return true;
            },
            onPanResponderMove: Animated.event(
                [null, { dx: pan.x, dy: pan.y }],
                { useNativeDriver: false }
            ),
            onPanResponderRelease: (e, gesture) => {
                const newX = (item.x || 0) + gesture.dx;
                const newY = (item.y || 0) + gesture.dy;
                onUpdate(item.id, { x: newX, y: newY });
                pan.setOffset({ x: newX, y: newY });
                pan.setValue({ x: 0, y: 0 });
            },
        }),
        [item.id, item.x, item.y, onSelect, onUpdate, pan]
    );

    // Get dimensions based on overlay type
    const getWidth = () => {
        if (item.width) return item.width;
        return item.type === 'image' ? 100 : item.type === 'video' ? 150 : 'auto';
    };

    const getHeight = () => {
        if (item.height) return item.height;
        return item.type === 'image' ? 100 : item.type === 'video' ? 150 : 'auto';
    };

    // Calculate visibility based on current time for the container
    // If currentTime is undefined (video not started/loaded), show overlay for editing
    const start = item.start || 0;
    const end = item.end || 1000; // Large default so it shows during editing
    const isVisible = currentTime === undefined || (currentTime >= start && currentTime <= end);

    // Memoize source for video/image to prevent reloads
    const mediaSource = useMemo(() => ({ uri: item.uri }), [item.uri]);

    return (
        <Animated.View
            style={[
                styles.overlayContainer,
                { transform: pan.getTranslateTransform() },
                isSelected && styles.selected,
                // Use opacity for visibility toggle - this is more performant than conditional rendering
                { opacity: isVisible ? 1 : 0 }
            ]}
            pointerEvents={isVisible ? 'auto' : 'none'}
            {...panResponder.panHandlers}
        >
            {item.type === 'text' ? (
                <Text style={[styles.text, { color: item.color || 'white', fontSize: item.fontSize || 24 }]}>
                    {item.content}
                </Text>
            ) : item.type === 'image' ? (
                <Image
                    source={mediaSource}
                    style={{
                        width: getWidth(),
                        height: getHeight(),
                    }}
                    resizeMode="contain"
                />
            ) : item.type === 'video' ? (
                <Video
                    ref={videoRef}
                    source={mediaSource}
                    style={{
                        width: getWidth(),
                        height: getHeight()
                    }}
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={false}
                    isLooping={false}
                    isMuted={true}
                />
            ) : null}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlayContainer: {
        position: 'absolute',
        padding: 10,
        minWidth: 44,
        minHeight: 44,
    },
    selected: {
        borderColor: theme.colors.activeBorder,
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    text: {
        fontFamily: theme.typography.fontFamilyBold,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
    }
});
