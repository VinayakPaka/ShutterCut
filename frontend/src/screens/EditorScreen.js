import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, Alert, TextInput, ScrollView, Platform, KeyboardAvoidingView, Linking } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../constants/theme';
import OverlayItem from '../components/OverlayItem';
import axios from 'axios';

// Backend URL Configuration
// For web development: use localhost or the same host
// For Physical Devices: Use your computer's IP address (find it with: ipconfig on Windows, ifconfig on Mac/Linux)
// For Android Emulator: Use 10.0.2.2
// For iOS Simulator: Use localhost
const getApiUrl = () => {
    if (Platform.OS === 'web') {
        // For web, use localhost or current host
        // Check if we're on localhost or a different host
        if (typeof window !== 'undefined' && window.location) {
            const hostname = window.location.hostname;
            // If on localhost, use localhost for backend too
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                return 'http://localhost:8000';
            }
            // Otherwise use the same host (useful for deployed apps)
            return `http://${hostname}:8000`;
        }
        return 'http://localhost:8000';
    }
    // For native apps, use IP address
    return 'http://192.168.29.117:8000';
};

const API_URL = getApiUrl();

const { width, height } = Dimensions.get('window');

export default function EditorScreen() {
    const [videoUri, setVideoUri] = useState(null);
    const [overlays, setOverlays] = useState([]);
    const [selectedOverlayId, setSelectedOverlayId] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [jobId, setJobId] = useState(null);
    const [downloadUrl, setDownloadUrl] = useState(null);
    const [progress, setProgress] = useState(0);

    const videoRef = useRef(null);

    const resetEditor = () => {
        setVideoUri(null);
        setOverlays([]);
        setSelectedOverlayId(null);
        setUploading(false);
        setProcessing(false);
        setJobId(null);
        setDownloadUrl(null);
        setProgress(0);
    };

    const confirmNewProject = () => {
        if (videoUri && !downloadUrl) {
            Alert.alert(
                "New Project",
                "Discard current project and start a new one?",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Discard & New", style: "destructive", onPress: resetEditor }
                ]
            );
        } else {
            resetEditor();
        }
    };

    const pickVideo = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['videos'],
            allowsEditing: false, // We want the raw video
            quality: 1,
        });

        if (!result.canceled) {
            setVideoUri(result.assets[0].uri);
            setOverlays([]);
            setJobId(null);
            setDownloadUrl(null);
        }
    };

    const addTextOverlay = () => {
        if (!videoUri) return;
        const newOverlay = {
            id: Date.now().toString(),
            type: 'text',
            content: 'Hello World',
            x: 50,
            y: 50,
            start: 0,
            end: 5,
            color: '#FFFFFF',
            fontSize: 24,
        };
        setOverlays([...overlays, newOverlay]);
        setSelectedOverlayId(newOverlay.id);
    };

    const addImageOverlay = async () => {
        if (!videoUri) return;
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 1,
        });

        if (!result.canceled) {
            const asset = result.assets[0];
            const newOverlay = {
                id: Date.now().toString(),
                type: 'image',
                content: asset.fileName || 'image.png', // Backend needs filename to map
                uri: asset.uri, // For local preview
                x: 50,
                y: 50,
                start: 0,
                end: 5,
            };
            setOverlays([...overlays, newOverlay]);
            setSelectedOverlayId(newOverlay.id);
        }
    };

    const addVideoOverlay = async () => {
        if (!videoUri) return;
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['videos'],
            allowsEditing: false,
            quality: 1,
        });

        if (!result.canceled) {
            const asset = result.assets[0];
            const newOverlay = {
                id: Date.now().toString(),
                type: 'video',
                content: asset.fileName || 'video.mp4', // Backend needs filename to map
                uri: asset.uri, // For local preview
                x: 50,
                y: 50,
                start: 0,
                end: 5,
            };
            setOverlays([...overlays, newOverlay]);
            setSelectedOverlayId(newOverlay.id);
        }
    };

    const updateOverlay = (id, updates) => {
        setOverlays((prev) =>
            prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
        );
    };

    const handleSubmit = async () => {
        if (!videoUri) return;
        setUploading(true);
        setProgress(0);

        try {
            const formData = new FormData();

            // Handle video file - different approach for web vs native
            if (Platform.OS === 'web') {
                // For web: Need to fetch the blob from the URI
                console.log('Fetching video blob from:', videoUri);
                const videoResponse = await fetch(videoUri);
                const videoBlob = await videoResponse.blob();
                formData.append('video', videoBlob, 'video.mp4');
                console.log('Video blob size:', videoBlob.size);
            } else {
                // For native (iOS/Android)
                formData.append('video', {
                    uri: videoUri,
                    name: 'video.mp4',
                    type: 'video/mp4',
                });
            }

            // Overlay Assets (images and videos)
            const assetOverlays = overlays.filter(o => o.type === 'image' || o.type === 'video');
            for (const ov of assetOverlays) {
                if (Platform.OS === 'web') {
                    // For web: Need to fetch the blob from the URI
                    const assetResponse = await fetch(ov.uri);
                    const assetBlob = await assetResponse.blob();
                    formData.append('assets', assetBlob, ov.content);
                } else {
                    formData.append('assets', {
                        uri: ov.uri,
                        name: ov.content,
                        type: ov.type === 'video' ? 'video/mp4' : 'image/png'
                    });
                }
            }

            // Metadata
            // Clean metadata for backend (remove uri, select props)
            const metadata = overlays.map(({ id, type, content, x, y, start, end, color, fontSize, width, height }) => ({
                id, type, content, x, y, start, end, color, fontSize, width, height
            }));
            formData.append('metadata', JSON.stringify(metadata));

            console.log('Sending upload request to:', `${API_URL}/upload`);

            // Use XMLHttpRequest for better progress tracking on web
            const response = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        const uploadPercent = Math.round((event.loaded * 100) / event.total);
                        console.log('Upload progress:', uploadPercent + '%');
                        setProgress(uploadPercent);
                    } else {
                        // If total is not available, show indeterminate progress
                        setProgress(prev => Math.min(prev + 1, 95));
                    }
                });

                xhr.addEventListener('load', () => {
                    console.log('Upload complete, status:', xhr.status);
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            resolve(JSON.parse(xhr.responseText));
                        } catch (e) {
                            reject(new Error('Invalid JSON response'));
                        }
                    } else {
                        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
                    }
                });

                xhr.addEventListener('error', () => {
                    console.error('XHR error');
                    reject(new Error('Network error during upload'));
                });

                xhr.addEventListener('timeout', () => {
                    reject(new Error('Upload timed out'));
                });

                xhr.open('POST', `${API_URL}/upload`);
                xhr.timeout = 600000; // 10 minute timeout
                xhr.send(formData);
            });

            console.log('Upload response:', response);
            const { job_id } = response;
            setJobId(job_id);
            setUploading(false);
            setProcessing(true);
            setProgress(0); // Reset progress for processing phase
            pollStatus(job_id);

        } catch (e) {
            console.error('Upload error:', e);
            const errorMsg = e.response?.data?.detail || e.message || "Could not upload video. Please check your connection.";
            Alert.alert("Upload Failed", errorMsg);
            setUploading(false);
            setProgress(0);
        }
    };

    const pollStatus = async (id) => {
        let pollCount = 0;
        const maxPolls = 300; // 10 minutes max (300 * 2 seconds)

        const interval = setInterval(async () => {
            pollCount++;

            // Timeout after max polls
            if (pollCount > maxPolls) {
                clearInterval(interval);
                setProcessing(false);
                setProgress(0);
                Alert.alert("Timeout", "Video processing is taking too long. Please try again.");
                return;
            }

            try {
                const res = await axios.get(`${API_URL}/status/${id}`);
                const { status, progress: prog, error } = res.data;

                // Update progress if available
                if (prog !== undefined) {
                    setProgress(prog);
                }

                if (status === 'completed') {
                    clearInterval(interval);
                    setProcessing(false);
                    setProgress(100);
                    setDownloadUrl(`${API_URL}/result/${id}`);
                    Alert.alert("Success", "Video rendering complete! Tap Download to save.");
                } else if (status === 'failed') {
                    clearInterval(interval);
                    setProcessing(false);
                    setProgress(0);
                    const errorMsg = error || "Video rendering failed. Please try again.";
                    Alert.alert("Failed", errorMsg);
                }
            } catch (e) {
                console.log('Poll error (ignoring):', e.message);
            }
        }, 2000);
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            <LinearGradient colors={[theme.colors.background, '#1a1a2e']} style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.logo}>ShutterCut</Text>
                    {videoUri && (
                        <TouchableOpacity onPress={confirmNewProject} style={styles.newBtn}>
                            <Text style={styles.newBtnText}>+ New Project</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Video Preview Area */}
                <View style={styles.previewContainer}>
                    {videoUri ? (
                        <View style={styles.videoWrapper}>
                            <Video
                                ref={videoRef}
                                style={styles.video}
                                source={{ uri: videoUri }}
                                useNativeControls
                                resizeMode={ResizeMode.CONTAIN}
                                isLooping
                            />
                            {/* Overlays Layer */}
                            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                                {overlays.map((ov) => (
                                    <OverlayItem
                                        key={ov.id}
                                        item={ov}
                                        isSelected={selectedOverlayId === ov.id}
                                        onUpdate={(id, pos) => updateOverlay(id, pos)}
                                        onSelect={() => setSelectedOverlayId(ov.id)}
                                    />
                                ))}
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.placeholder} onPress={pickVideo}>
                            <Text style={styles.placeholderText}>+ Tap to Select Video</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Controls */}
                <View style={styles.controls}>
                    <TouchableOpacity style={styles.btn} onPress={addTextOverlay}>
                        <Text style={styles.btnText}>+ Text</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btn} onPress={addImageOverlay}>
                        <Text style={styles.btnText}>+ Image</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btn} onPress={addVideoOverlay}>
                        <Text style={styles.btnText}>+ Video</Text>
                    </TouchableOpacity>

                    <View style={{ flex: 1 }} />

                    {downloadUrl ? (
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity style={styles.btn} onPress={resetEditor}>
                                <Text style={styles.btnText}>New Video</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btn, styles.primaryBtn]} onPress={() => {
                                if (downloadUrl) {
                                    Linking.openURL(downloadUrl).catch(err => {
                                        console.error("Couldn't load page", err);
                                        Alert.alert("Error", "Could not open download link.");
                                    });
                                }
                            }}>
                                <Text style={styles.btnText}>Download</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={[styles.btn, styles.primaryBtn, (uploading || processing || !videoUri) && styles.disabledBtn]}
                            onPress={handleSubmit}
                            disabled={uploading || processing || !videoUri}
                        >
                            {uploading ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <ActivityIndicator color="#fff" size="small" />
                                    <Text style={styles.btnText}>Uploading {progress}%</Text>
                                </View>
                            ) :
                                processing ? <Text style={styles.btnText}>Processing {progress}%</Text> :
                                    <Text style={styles.btnText}>Export</Text>}
                        </TouchableOpacity>
                    )}
                </View>

                {/* Selected Overlay Inspector */}
                {selectedOverlayId && (() => {
                    const selectedOverlay = overlays.find(o => o.id === selectedOverlayId);
                    if (!selectedOverlay) return null;

                    return (
                        <ScrollView
                            style={styles.inspector}
                            contentContainerStyle={styles.inspectorContent}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={true}
                        >
                            <View style={styles.inspectorHeader}>
                                <Text style={styles.inspectorTitle}>Edit {selectedOverlay.type.toUpperCase()}</Text>
                                <TouchableOpacity onPress={() => {
                                    setOverlays(overlays.filter(o => o.id !== selectedOverlayId));
                                    setSelectedOverlayId(null);
                                }}>
                                    <Text style={styles.deleteBtn}>🗑️ Delete</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Text Content Editor */}
                            {selectedOverlay.type === 'text' && (
                                <View style={styles.section}>
                                    <Text style={styles.label}>Text Content:</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={selectedOverlay.content}
                                        onChangeText={(text) => updateOverlay(selectedOverlayId, { content: text })}
                                        placeholder="Enter text"
                                        placeholderTextColor="#666"
                                    />

                                    <Text style={styles.label}>Font Size: {selectedOverlay.fontSize || 24}</Text>
                                    <View style={styles.slider}>
                                        <TouchableOpacity onPress={() => updateOverlay(selectedOverlayId, { fontSize: Math.max(12, (selectedOverlay.fontSize || 24) - 2) })}>
                                            <Text style={styles.sliderBtn}>-</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => updateOverlay(selectedOverlayId, { fontSize: Math.min(72, (selectedOverlay.fontSize || 24) + 2) })}>
                                            <Text style={styles.sliderBtn}>+</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={styles.label}>Color:</Text>
                                    <View style={styles.colorPicker}>
                                        {['#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'].map(color => (
                                            <TouchableOpacity
                                                key={color}
                                                style={[styles.colorBox, { backgroundColor: color }, selectedOverlay.color === color && styles.selectedColor]}
                                                onPress={() => updateOverlay(selectedOverlayId, { color })}
                                            />
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Size Controls for Images and Videos */}
                            {(selectedOverlay.type === 'image' || selectedOverlay.type === 'video') && (
                                <View style={styles.section}>
                                    <Text style={styles.label}>Size: {selectedOverlay.width || (selectedOverlay.type === 'image' ? 100 : 150)}x{selectedOverlay.height || (selectedOverlay.type === 'image' ? 100 : 150)}</Text>
                                    <View style={styles.slider}>
                                        <TouchableOpacity onPress={() => {
                                            const currentWidth = selectedOverlay.width || (selectedOverlay.type === 'image' ? 100 : 150);
                                            const currentHeight = selectedOverlay.height || (selectedOverlay.type === 'image' ? 100 : 150);
                                            updateOverlay(selectedOverlayId, {
                                                width: Math.max(50, currentWidth - 10),
                                                height: Math.max(50, currentHeight - 10)
                                            });
                                        }}>
                                            <Text style={styles.sliderBtn}>Smaller</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => {
                                            const currentWidth = selectedOverlay.width || (selectedOverlay.type === 'image' ? 100 : 150);
                                            const currentHeight = selectedOverlay.height || (selectedOverlay.type === 'image' ? 100 : 150);
                                            updateOverlay(selectedOverlayId, {
                                                width: Math.min(400, currentWidth + 10),
                                                height: Math.min(400, currentHeight + 10)
                                            });
                                        }}>
                                            <Text style={styles.sliderBtn}>Larger</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {/* Timing Controls */}
                            <View style={styles.section}>
                                <Text style={styles.label}>Start Time: {selectedOverlay.start}s</Text>
                                <View style={styles.slider}>
                                    <TouchableOpacity onPress={() => updateOverlay(selectedOverlayId, { start: Math.max(0, selectedOverlay.start - 0.5) })}>
                                        <Text style={styles.sliderBtn}>-0.5s</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => updateOverlay(selectedOverlayId, { start: selectedOverlay.start + 0.5 })}>
                                        <Text style={styles.sliderBtn}>+0.5s</Text>
                                    </TouchableOpacity>
                                </View>

                                <Text style={styles.label}>End Time: {selectedOverlay.end}s</Text>
                                <View style={styles.slider}>
                                    <TouchableOpacity onPress={() => updateOverlay(selectedOverlayId, { end: Math.max(selectedOverlay.start + 0.5, selectedOverlay.end - 0.5) })}>
                                        <Text style={styles.sliderBtn}>-0.5s</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => updateOverlay(selectedOverlayId, { end: selectedOverlay.end + 0.5 })}>
                                        <Text style={styles.sliderBtn}>+0.5s</Text>
                                    </TouchableOpacity>
                                </View>

                                <Text style={styles.hint}>Duration: {(selectedOverlay.end - selectedOverlay.start).toFixed(1)}s</Text>
                            </View>
                        </ScrollView>
                    );
                })()}

            </LinearGradient>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: Platform.OS === 'ios' ? 50 : 30,
    },
    header: {
        paddingHorizontal: theme.spacing.l,
        marginBottom: theme.spacing.m,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    logo: {
        fontFamily: theme.typography.fontFamilyBold,
        fontSize: 28,
        color: theme.colors.text,
    },
    previewContainer: {
        width: '100%',
        height: height * 0.45, // Slightly reduced for better space management
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    videoWrapper: {
        width: '100%',
        height: '100%',
    },
    video: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        padding: theme.spacing.xl,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.l,
    },
    placeholderText: {
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
    },
    controls: {
        flexDirection: 'row',
        padding: theme.spacing.l,
        alignItems: 'center',
        gap: theme.spacing.m,
        flexWrap: 'wrap',
        paddingBottom: Platform.OS === 'ios' ? 20 : theme.spacing.l,
    },
    btn: {
        backgroundColor: theme.colors.surfaceHighlight,
        paddingVertical: theme.spacing.m,
        paddingHorizontal: theme.spacing.l,
        borderRadius: theme.borderRadius.full,
        minHeight: 44, // iOS minimum touch target
        justifyContent: 'center',
        alignItems: 'center',
    },
    primaryBtn: {
        backgroundColor: theme.colors.primary,
    },
    disabledBtn: {
        opacity: 0.5,
    },
    btnText: {
        color: 'white',
        fontFamily: theme.typography.fontFamilyBold,
    },
    inspector: {
        padding: theme.spacing.l,
        backgroundColor: theme.colors.surface,
        margin: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        maxHeight: 300,
    },
    inspectorContent: {
        paddingBottom: theme.spacing.xl,
    },
    inspectorHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.m,
    },
    inspectorTitle: {
        color: 'white',
        fontFamily: theme.typography.fontFamilyBold,
        fontSize: 16,
    },
    deleteBtn: {
        color: '#FF4444',
        fontSize: 14,
        fontFamily: theme.typography.fontFamily,
    },
    section: {
        marginBottom: theme.spacing.m,
    },
    label: {
        color: theme.colors.textSecondary,
        fontFamily: theme.typography.fontFamily,
        fontSize: 12,
        marginBottom: 4,
    },
    textInput: {
        backgroundColor: theme.colors.surfaceHighlight,
        color: 'white',
        padding: theme.spacing.m,
        borderRadius: theme.borderRadius.m,
        fontFamily: theme.typography.fontFamily,
        marginBottom: theme.spacing.m,
    },
    slider: {
        flexDirection: 'row',
        gap: theme.spacing.m,
        marginBottom: theme.spacing.m,
    },
    sliderBtn: {
        backgroundColor: theme.colors.surfaceHighlight,
        color: 'white',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: theme.borderRadius.m,
        fontFamily: theme.typography.fontFamily,
    },
    colorPicker: {
        flexDirection: 'row',
        gap: theme.spacing.s,
        marginTop: 4,
    },
    colorBox: {
        width: 40,
        height: 40,
        borderRadius: theme.borderRadius.m,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    selectedColor: {
        borderColor: '#00FF00',
        borderWidth: 3,
    },
    hint: {
        color: theme.colors.textSecondary,
        fontSize: 11,
        fontStyle: 'italic',
        marginTop: 4,
    },
    newBtn: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: theme.borderRadius.full,
    },
    newBtnText: {
        color: theme.colors.primary,
        fontFamily: theme.typography.fontFamilyBold,
        fontSize: 14,
    }
});
