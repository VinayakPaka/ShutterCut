import React, { useRef } from 'react';
import { StyleSheet, Text, Image, View, PanResponder, Animated, TouchableOpacity } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { theme } from '../constants/theme';

export default function OverlayItem({ item, onUpdate, isSelected, onSelect }) {
    const pan = useRef(new Animated.ValueXY({ x: item.x || 0, y: item.y || 0 })).current;

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
                // Reset the animated value for next drag
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

    return (
        <Animated.View
            style={[
                styles.overlayContainer,
                { transform: pan.getTranslateTransform() },
                isSelected && styles.selected
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
                    source={{ uri: item.uri }} 
                    style={{ 
                        width: getWidth(), 
                        height: getHeight() 
                    }} 
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={false}
                    isLooping
                />
            ) : null}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlayContainer: {
        position: 'absolute',
        padding: 4,
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
