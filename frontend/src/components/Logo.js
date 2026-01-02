import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Circle, Rect, Path, G, Filter, FeGaussianBlur, FeMerge, FeMergeNode, FeDropShadow } from 'react-native-svg';

export default function Logo({ size = 40 }) {
    return (
        <View style={[styles.container, { width: size, height: size }]}>
            <Svg width={size} height={size} viewBox="0 0 200 200">
                <Defs>
                    <LinearGradient id="primaryGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor="#4492F1" stopOpacity="1" />
                        <Stop offset="100%" stopColor="#2B5FCC" stopOpacity="1" />
                    </LinearGradient>
                    
                    <LinearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor="#F68540" stopOpacity="1" />
                        <Stop offset="100%" stopColor="#E86A20" stopOpacity="1" />
                    </LinearGradient>
                    
                    <LinearGradient id="surfaceGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor="#2C2B2C" stopOpacity="1" />
                        <Stop offset="50%" stopColor="#191719" stopOpacity="1" />
                        <Stop offset="100%" stopColor="#2C2B2C" stopOpacity="1" />
                    </LinearGradient>
                </Defs>
                
                {/* Outer circle with gradient background */}
                <Circle cx="100" cy="100" r="95" fill="url(#surfaceGradient)" />
                
                {/* Decorative ring */}
                <Circle cx="100" cy="100" r="85" fill="none" stroke="url(#primaryGradient)" strokeWidth="2" opacity="0.3" />
                
                {/* Film frame/video icon (top portion) */}
                <G transform="translate(100, 65)">
                    {/* Film strip rectangle */}
                    <Rect x="-35" y="-20" width="70" height="40" rx="4" fill="url(#primaryGradient)" />
                    
                    {/* Film perforations (left side) */}
                    <Rect x="-32" y="-14" width="6" height="6" rx="1" fill="#191719" opacity="0.5" />
                    <Rect x="-32" y="-2" width="6" height="6" rx="1" fill="#191719" opacity="0.5" />
                    <Rect x="-32" y="10" width="6" height="6" rx="1" fill="#191719" opacity="0.5" />
                    
                    {/* Film perforations (right side) */}
                    <Rect x="26" y="-14" width="6" height="6" rx="1" fill="#191719" opacity="0.5" />
                    <Rect x="26" y="-2" width="6" height="6" rx="1" fill="#191719" opacity="0.5" />
                    <Rect x="26" y="10" width="6" height="6" rx="1" fill="#191719" opacity="0.5" />
                    
                    {/* Play button triangle in center */}
                    <Path d="M -8,0 L 8,-10 L 8,10 Z" fill="#FFFFFF" opacity="0.9" />
                </G>
                
                {/* Lightning bolt / cut symbol (bottom portion) */}
                <G transform="translate(100, 130)">
                    {/* Stylized lightning/cut bolt */}
                    <Path 
                        d="M 5,-20 L -10,-5 L -2,-5 L -8,15 L 12,-2 L 3,-2 Z" 
                        fill="url(#accentGradient)"
                        stroke="#FFFFFF" 
                        strokeWidth="0.5" 
                        strokeLinejoin="round"
                    />
                </G>
                
                {/* Accent circles for visual interest */}
                <Circle cx="40" cy="50" r="3" fill="#4492F1" opacity="0.4" />
                <Circle cx="160" cy="60" r="2" fill="#F68540" opacity="0.4" />
                <Circle cx="45" cy="150" r="2.5" fill="#4492F1" opacity="0.3" />
                <Circle cx="155" cy="145" r="2" fill="#F68540" opacity="0.3" />
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});
