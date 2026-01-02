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

    const [videoMeta, setVideoMeta] = useState({ width: 0, height: 0, duration: 0 });
    const [playbackStatus, setPlaybackStatus] = useState({});

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
        setVideoMeta({ width: 0, height: 0, duration: 0 });
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
            const asset = result.assets[0];
            setVideoUri(asset.uri);
            setOverlays([]);
            setJobId(null);
            setDownloadUrl(null);

            // Immediately set known metadata from asset if available
            // This prevents the "metadata not loaded" error if onLoad doesn't fire quickly enough
            // or if the onLoad event is missed.
            if (asset.width && asset.height) {
                console.log("Video Asset Metadata:", { width: asset.width, height: asset.height, duration: asset.duration });
                setVideoMeta({
                    width: asset.width,
                    height: asset.height,
                    // duration from picker is usually in milliseconds, but check platform specifics
                    // we'll default to 0 and let onLoad refine it if needed, or use a safe default
                    duration: asset.duration ? asset.duration / 1000 : 0
                });
            }
        }
    };

    const addTextOverlay = () => {
        if (!videoUri) return;
        const newOverlay = {
            id: Date.now().toString(),
            type: 'text',
            content: 'Hello World',
            x: width / 2 - 50, // Center roughly
            y: (height * 0.45) / 2 - 20,
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
            const overlayId = Date.now().toString();
            // Generate unique filename to ensure backend mapping works correctly
            const uniqueFileName = `image_${overlayId}.png`;

            const newOverlay = {
                id: overlayId,
                type: 'image',
                content: uniqueFileName,
                uri: asset.uri, // For local preview
                x: width / 2 - 50,
                y: (height * 0.45) / 2 - 50,
                start: 0,
                end: 5,
                width: 100,
                height: 100
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
            const overlayId = Date.now().toString();
            // Generate unique filename
            const uniqueFileName = `video_${overlayId}.mp4`;

            const newOverlay = {
                id: overlayId,
                type: 'video',
                content: uniqueFileName,
                uri: asset.uri, // For local preview
                x: width / 2 - 75,
                y: (height * 0.45) / 2 - 75,
                start: 0,
                end: 5,
                width: 150,
                height: 150
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
        if (!videoMeta.width || !videoMeta.height) {
            Alert.alert("Error", "Video metadata not loaded yet. Please wait a moment.");
            return;
        }

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

            // --- Coordinate Transformation Logic ---
            // We need to map screen coordinates to video resolution coordinates
            const containerW = width;
            const containerH = height * 0.45; // Match styles.previewContainer

            // Calculate how the video is displayed inside the container (ResizeMode.CONTAIN)
            const videoRatio = videoMeta.width / videoMeta.height;
            const containerRatio = containerW / containerH;

            let displayedW, displayedH, offsetX, offsetY;

            if (videoRatio > containerRatio) {
                // Letterboxed (Horizontal black bars? No, Wait. 
                // If video is wider than container, it will touch sides and have top/bottom bars if container is taller.
                // If container is taller (containerRatio < videoRatio is FALSE)... wait.
                // Example: Container 100x100 (Ratio 1). Video 200x100 (Ratio 2).
                // Video fits width 100. Height becomes 50. Top/Bottom bars.
                // 2 > 1. Correct.
                displayedW = containerW;
                displayedH = containerW / videoRatio;
                offsetX = 0;
                offsetY = (containerH - displayedH) / 2;
            } else {
                // Pillarboxed (Vertical black bars)
                // Example: Container 100x100 (Ratio 1). Video 50x100 (Ratio 0.5).
                // Video fits height 100. Width becomes 50. Side bars.
                displayedH = containerH;
                displayedW = containerH * videoRatio;
                offsetY = 0;
                offsetX = (containerW - displayedW) / 2;
            }

            console.log("Coordinate Mapping:", {
                screen: { w: containerW, h: containerH },
                video: { w: videoMeta.width, h: videoMeta.height },
                displayed: { w: displayedW, h: displayedH, ox: offsetX, oy: offsetY }
            });

            // Metadata
            const metadata = overlays.map(ov => {
                // Calculate relative position (0.0 - 1.0) within the video content
                const relativeX = (ov.x - offsetX) / displayedW;
                const relativeY = (ov.y - offsetY) / displayedH;

                // For width/height/fontSize, we also scale relative to the displayed video size
                // Width/Height:
                let finalWidth = ov.width ? (ov.width / displayedW) * videoMeta.width : null;
                let finalHeight = ov.height ? (ov.height / displayedH) * videoMeta.height : null;

                // Ensure min size to avoid 0
                if (finalWidth) finalWidth = Math.max(1, Math.round(finalWidth));
                if (finalHeight) finalHeight = Math.max(1, Math.round(finalHeight));

                // Font Size: This is tricky. Approx by ratio of heights
                const scaleFactor = videoMeta.height / displayedH;
                const finalFontSize = ov.fontSize ? Math.round(ov.fontSize * scaleFactor) : null;

                // Position
                const finalX = Math.round(relativeX * videoMeta.width);
                const finalY = Math.round(relativeY * videoMeta.height);

                return {
                    id: ov.id,
                    type: ov.type,
                    content: ov.content,
                    x: finalX,
                    y: finalY,
                    start: ov.start,
                    end: ov.end,
                    color: ov.color,
                    fontSize: finalFontSize,
                    width: finalWidth,
                    height: finalHeight
                };
            });

            console.log("Transformed Metadata:", metadata);
            formData.append('metadata', JSON.stringify(metadata));

            console.log('Sending upload request to:', `${API_URL}/upload`);

            // Use Axios for upload
            const response = await axios.post(`${API_URL}/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        console.log('Upload progress:', percentCompleted + '%');
                        setProgress(percentCompleted);
                    }
                },
                timeout: 600000, // 10 minute timeout
            });

            console.log('Upload response:', response.data);
            const { job_id } = response.data;
            setJobId(job_id);
            setUploading(false);
            setProcessing(true);
            setProgress(0); // Reset progress for processing phase
            pollStatus(job_id);

        } catch (e) {
            console.error('Upload error details:', e.toJSON ? e.toJSON() : e);
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
                                onPlaybackStatusUpdate={status => setPlaybackStatus(() => status)}
                                onLoad={(status) => {
                                    if (status.naturalSize) {
                                        console.log("Video Loaded:", status.naturalSize);
                                        setVideoMeta({
                                            width: status.naturalSize.width,
                                            height: status.naturalSize.height,
                                            duration: status.durationMillis / 1000
                                        });
                                    }
                                }}
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
                                        isPlaying={playbackStatus.isPlaying}
                                        currentTime={playbackStatus.positionMillis !== undefined ? playbackStatus.positionMillis / 1000 : undefined}
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
