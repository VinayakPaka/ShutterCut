import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator, Alert, TextInput, ScrollView, Platform } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../constants/theme';
import OverlayItem from '../components/OverlayItem';
import axios from 'axios';

// Backend URL
// For Physical Devices: Use your computer's IP address (find it with: ipconfig on Windows, ifconfig on Mac/Linux)
// For Android Emulator: Use 10.0.2.2
// For iOS Simulator: Use localhost
// IMPORTANT: Change this to your computer's IP when using a physical device
const API_URL = 'http://192.168.29.117:8000'; // Change this to your computer's IP address

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
            // Main Video
            formData.append('video', {
                uri: videoUri,
                name: 'video.mp4',
                type: 'video/mp4',
            });

            // Overlay Assets (images and videos)
            const assetOverlays = overlays.filter(o => o.type === 'image' || o.type === 'video');
            assetOverlays.forEach((ov) => {
                formData.append('assets', {
                    uri: ov.uri,
                    name: ov.content,
                    type: ov.type === 'video' ? 'video/mp4' : 'image/png'
                });
            });

            // Metadata
            // Clean metadata for backend (remove uri, select props)
            const metadata = overlays.map(({ id, type, content, x, y, start, end, color, fontSize, width, height }) => ({
                id, type, content, x, y, start, end, color, fontSize, width, height
            }));
            formData.append('metadata', JSON.stringify(metadata));

            const response = await axios.post(`${API_URL}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 300000, // 5 minute timeout for large uploads
            });

            const { job_id } = response.data;
            setJobId(job_id);
            setUploading(false);
            setProcessing(true);
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
        <LinearGradient colors={[theme.colors.background, '#1a1a2e']} style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.logo}>ShutterCut</Text>
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
                    <TouchableOpacity style={[styles.btn, styles.primaryBtn]} onPress={() => Alert.alert("Download", "Feature coming soon (or copy URL)")}>
                        <Text style={styles.btnText}>Download</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[styles.btn, styles.primaryBtn, (uploading || processing || !videoUri) && styles.disabledBtn]}
                        onPress={handleSubmit}
                        disabled={uploading || processing || !videoUri}
                    >
                        {uploading ? <ActivityIndicator color="#fff" /> :
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
                    <ScrollView style={styles.inspector}>
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
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 50,
    },
    header: {
        paddingHorizontal: theme.spacing.l,
        marginBottom: theme.spacing.m,
    },
    logo: {
        fontFamily: theme.typography.fontFamilyBold,
        fontSize: 28,
        color: theme.colors.text,
    },
    previewContainer: {
        width: '100%',
        height: height * 0.5, // Half screen
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
    },
    btn: {
        backgroundColor: theme.colors.surfaceHighlight,
        paddingVertical: theme.spacing.m,
        paddingHorizontal: theme.spacing.l,
        borderRadius: theme.borderRadius.full,
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
        maxHeight: 250,
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
    }
});
