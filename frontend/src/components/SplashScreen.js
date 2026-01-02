import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Logo from './Logo';
import { theme } from '../constants/theme';

export default function SplashScreen() {
    const fadeAnim = React.useRef(new Animated.Value(0)).current;
    const scaleAnim = React.useRef(new Animated.Value(0.3)).current;

    React.useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 20,
                friction: 7,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <LinearGradient 
            colors={[theme.colors.background, '#1a1a2e']} 
            style={styles.container}
        >
            <Animated.View 
                style={[
                    styles.content,
                    {
                        opacity: fadeAnim,
                        transform: [{ scale: scaleAnim }]
                    }
                ]}
            >
                <Logo size={120} />
                <Text style={styles.title}>ShutterCut</Text>
                <Text style={styles.tagline}>Professional video editing in your pocket</Text>
            </Animated.View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        gap: theme.spacing.l,
    },
    title: {
        fontFamily: theme.typography.fontFamilyBold,
        fontSize: 42,
        color: theme.colors.text,
        marginTop: theme.spacing.l,
    },
    tagline: {
        fontFamily: theme.typography.fontFamily,
        fontSize: 16,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        paddingHorizontal: theme.spacing.xl,
    },
});
