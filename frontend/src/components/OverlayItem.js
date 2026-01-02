import React, { useRef, useEffect } from 'react';
import { StyleSheet, Text, Image, View, PanResponder, Animated, TouchableOpacity } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { theme } from '../constants/theme';

export default function OverlayItem({ item, onUpdate, isSelected, onSelect, isPlaying, currentTime }) {
    const pan = useRef(new Animated.ValueXY({ x: item.x || 0, y: item.y || 0 })).current;
    const videoRef = useRef(null);

    // Sync local animated value with parent props (handle Inspector updates)
    useEffect(() => {
        pan.setOffset({ x: item.x || 0, y: item.y || 0 });
        pan.setValue({ x: 0, y: 0 });
    }, [item.x, item.y]);

    // Video Sync Logic
    const wasPlayingRef = useRef(false);

    useEffect(() => {
        if (item.type === 'video' && videoRef.current) {
            const start = item.start || 0;
            const end = item.end || 5; // Default 5s if undefined, though parent usually sets it

            // Determine visibility based on current time
            // If currentTime is undefined, we default to visible (initial state) or handle gracefully
            const isVisible = currentTime === undefined || (currentTime >= start && currentTime <= end);

            if (isVisible) {
                const relativeTime = currentTime !== undefined ? Math.max(0, currentTime - start) : 0;
                const seekTimeMillis = relativeTime * 1000;

                if (isPlaying) {
                    // If main video is playing
                    if (!wasPlayingRef.current) {
                        // We just started playing or entered the visible range
                        videoRef.current.playFromPositionAsync(seekTimeMillis);
                    }
                } else {
                    // Main video is paused
                    if (wasPlayingRef.current) {
                        // We just paused
                        videoRef.current.pauseAsync();
                    }
                    // Sync the frame so it looks correct while paused
                    // doing this strictly might be jittery, so maybe only if difference is large?
                    // For now, let's just setPosition
                    videoRef.current.setPositionAsync(seekTimeMillis);
                }
            } else {
                // Not visible
                if (wasPlayingRef.current) {
                    videoRef.current.pauseAsync();
                }
            }

            wasPlayingRef.current = isVisible && isPlaying;
        }
    }, [isPlaying, currentTime, item.start, item.end]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => {
                // Select this overlay when touched
                onSelect();
                return true;
            },
            onPanResponderMove: Animated.event(
                [null, { dx: pan.x, dy: pan.y }],
                { useNativeDriver: false }
            ),
            onPanResponderRelease: (e, gesture) => {
                // Update parent state with new position
                const newX = (item.x || 0) + gesture.dx;
                const newY = (item.y || 0) + gesture.dy;
                onUpdate(item.id, { x: newX, y: newY });
                // We don't strictly need to setOffset here because the useEffect will handle it
                // when the prop updates, but it makes the UI feel more responsive immediately
                pan.setOffset({ x: newX, y: newY });
                pan.setValue({ x: 0, y: 0 });
            },
        })
    ).current;

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
    const isVisible = currentTime === undefined || (currentTime >= (item.start || 0) && currentTime <= (item.end || 1000));

    // We handle video playback manually in useEffect, so passing shouldPlay here is less critical 
    // but good for initial state.
    // However, we want to avoid conflicts with our manual control.
    // Let's rely on useVideoPlayer or manual ref control.
    // Setting shouldPlay={false} allows us to control it via methods entirely? 
    // Actually, shouldPlay prop is declarative. Methods are imperative. Mixing them is tricky.
    // Let's stick to imperative control in useEffect and set shouldPlay to a safe default or match state.

    return (
        <Animated.View
            style={[
                styles.overlayContainer,
                { transform: pan.getTranslateTransform() },
                isSelected && styles.selected,
                !isVisible && { opacity: 0 }
            ]}
            {...panResponder.panHandlers}
        >
            {item.type === 'text' ? (
                <Text style={[styles.text, { color: item.color || 'white', fontSize: item.fontSize || 24 }]}>
                    {item.content}
                </Text>
            ) : item.type === 'image' ? (
                <Image
                    source={{ uri: item.uri }}
                    style={{
                        width: getWidth(),
                        height: getHeight(),
                        resizeMode: 'contain'
                    }}
                />
            ) : item.type === 'video' ? (
                <Video
                    ref={videoRef}
                    source={{ uri: item.uri }}
                    style={{
                        width: getWidth(),
                        height: getHeight()
                    }}
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={false} // We control playback imperatively
                    isLooping={false} // We handle loop duration manually via start/end visibility
                    isMuted={true}
                />
            ) : null}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlayContainer: {
        position: 'absolute',
        padding: 10, // Increased touch area
        minWidth: 44, // Minimum touch target
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
