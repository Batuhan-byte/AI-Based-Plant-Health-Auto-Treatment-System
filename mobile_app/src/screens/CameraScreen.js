import React, { useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, StatusBar, Dimensions, Image, Alert, Linking, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';

const { width: screenWidth } = Dimensions.get('window');

export default function CameraScreen({ navigation }) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const colors = isDark ? Colors.dark : Colors.light;

    const styles = useMemo(() => getDynamicStyles(colors), [colors]);

    const [permission, requestPermission] = useCameraPermissions();
    const [facing, setFacing] = useState('back');
    const [flash, setFlash] = useState('off');
    const [hasAsked, setHasAsked] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analyzeStep, setAnalyzeStep] = useState(''); // Hangi katmanda olduğunu gösterir
    const insets = useSafeAreaInsets();

    const cameraRef = useRef(null);

    // Backend API URL (Fiziksel cihaz için bilgisayarın WiFi IP adresi)
    const API_BASE = 'http://192.168.1.3:3000';

    // İzin isteme fonksiyonu - tek seferlik deneyin ardından Ayarlara Git moduna geç
    async function handlePermissionRequest() {
        if (hasAsked || (permission && !permission.canAskAgain)) {
            // Daha önce sorduk ve reddedildi, artık sistem ayarlarına yönlendir
            Alert.alert(
                "Kamera Erişimi Kapalı",
                "Kamera iznini daha önce reddetmiş görünüyorsunuz. Bitkilerinizi tanıyabilmemiz için lütfen uygulama ayarlarından kamera erişimini açın.",
                [
                    { text: "Vazgeç", style: "cancel" },
                    { text: "Ayarlara Git", onPress: () => Linking.openSettings() }
                ]
            );
        } else {
            // İlk kez soruyoruz
            setHasAsked(true);
            const result = await requestPermission();
            // Hâlâ reddedildiyse artık buton "Ayarlara Git" olacak (hasAsked = true)
        }
    }

    // İzin henüz yüklenmedi
    if (!permission) {
        return <View style={styles.safeArea} />
    }

    // İzin verilmedi - Güzel ve kullanışlı izin isteme ekranı
    if (!permission.granted) {
        const showSettingsMode = hasAsked || !permission.canAskAgain;
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.permissionContainer}>
                    {/* Geri dön butonu */}
                    <TouchableOpacity style={styles.permBackButton} onPress={() => navigation.goBack()}>
                        <MaterialCommunityIcons name="arrow-left" size={28} color={colors.textMain} />
                    </TouchableOpacity>

                    <View style={[styles.iconBox, { backgroundColor: colors.iconAnalyzeBg }]}>
                        <MaterialCommunityIcons
                            name={showSettingsMode ? "cog-outline" : "camera-lock-outline"}
                            size={54}
                            color={colors.iconAnalyzeColor}
                        />
                    </View>
                    <Text style={styles.permissionTitle}>
                        {showSettingsMode ? "Kamera İzni Kapalı" : "Kamera İzni Gerekli"}
                    </Text>
                    <Text style={styles.permissionText}>
                        {showSettingsMode
                            ? "Kamera erişimi reddedilmiş görünüyor. Bitkilerinizi yapay zeka ile analiz edebilmemiz için lütfen uygulama ayarlarından kamera iznini aktif edin."
                            : "Bitki türünüzü tanımak ve hastalıkları yapay zeka ile teşhis edebilmek için kameraya erişim iznine ihtiyaç duyuyoruz."
                        }
                    </Text>
                    <TouchableOpacity
                        style={[styles.permissionButton, { backgroundColor: colors.accent }]}
                        onPress={handlePermissionRequest}
                    >
                        <MaterialCommunityIcons
                            name={showSettingsMode ? "open-in-new" : "camera"}
                            size={20}
                            color="#FFFFFF"
                            style={{ marginRight: 8 }}
                        />
                        <Text style={styles.permissionButtonText}>
                            {showSettingsMode ? "Ayarlara Git" : "Kamerayı Aç"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    function toggleCameraFacing() {
        setFacing(current => (current === 'back' ? 'front' : 'back'));
    }

    function toggleFlash() {
        setFlash(current => (current === 'off' ? 'on' : 'off'));
    }

    // Galeriden fotoğraf seçimi
    async function pickImage() {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false, // YOLO zaten yaprağı bulacağı için crop gereksiz
            quality: 0.9,
        });

        if (!result.canceled) {
            await analyzePhoto(result.assets[0].uri);
        }
    }

    // Kamera ile fotoğraf çekimi
    async function takePicture() {
        if (cameraRef.current) {
            try {
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 0.9,
                    base64: false
                });

                await analyzePhoto(photo.uri);
            } catch (error) {
                console.error("Fotoğraf çekilirken hata:", error);
            }
        }
    }

    // Fotoğrafı backend'e gönder ve 3 katmanlı AI pipeline sonucu al
    async function analyzePhoto(uri) {
        try {
            setIsAnalyzing(true);
            setAnalyzeStep('Görüntü hazırlanıyor...');

            // Fotoğrafı kaliteli JPEG'e dönüştür (YOLO kendi crop yapacak)
            const processed = await ImageManipulator.manipulateAsync(
                uri,
                [], // Artık crop/resize yok — YOLO bunu hallediyor
                { format: ImageManipulator.SaveFormat.JPEG, compress: 0.9 }
            );

            setAnalyzeStep('Yaprak aranıyor (YOLO)...');

            const formData = new FormData();
            
            if (Platform.OS === 'web') {
                // Web'de blob'a çevirmemiz gerekiyor
                const res = await fetch(processed.uri);
                const blob = await res.blob();
                formData.append('image', blob, 'plant_photo.jpg');
            } else {
                // Mobil cihazlarda klasik yöntem
                formData.append('image', {
                    uri: processed.uri,
                    type: 'image/jpeg',
                    name: 'plant_photo.jpg'
                });
            }

            const response = await fetch(`${API_BASE}/api/diagnose`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.basarili) {
                navigation.navigate('DiagnosisResult', {
                    result: result,
                    photoUri: uri
                });
            } else {
                // Özel hata mesajları
                if (result.dusuk_confidence) {
                    Alert.alert(
                        "Emin Değilim",
                        "Bitki türü yeterince güvenilir tespit edilemedi. Lütfen yaprağı daha yakından ve net bir şekilde çekin.",
                        [{ text: "Tekrar Dene" }]
                    );
                } else {
                    Alert.alert("Hata", result.hata || "Analiz yapılamadı.");
                }
            }
        } catch (error) {
            console.error("API Hatası:", error);
            Alert.alert(
                "Bağlantı Hatası",
                "Sunucuya bağlanılamadı. Lütfen backend sunucusunun çalıştığından emin olun."
            );
        } finally {
            setIsAnalyzing(false);
            setAnalyzeStep('');
        }
    }

    return (
        <View style={styles.container}>
            {/* Kamera 100% Arka Plan */}
            <CameraView
                style={StyleSheet.absoluteFillObject}
                facing={facing}
                flash={flash}
                ref={cameraRef}
            />

            <View style={[styles.cameraSafeArea, { paddingTop: insets.top > 0 ? insets.top : (Platform.OS === 'android' ? StatusBar.currentHeight : 0) }]}>
                {/* Üst İşlem Kontrolleri */}
                <View style={styles.topControls}>
                    <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
                        <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row' }}>
                        <TouchableOpacity style={[styles.iconButton, { marginRight: 12 }]} onPress={toggleFlash}>
                            <MaterialCommunityIcons name={flash === 'on' ? 'flash' : 'flash-off'} size={24} color="#FFFFFF" />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.iconButton} onPress={toggleCameraFacing}>
                            <MaterialCommunityIcons name="camera-flip-outline" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Merkez Hedef Çerçevesi */}
                <View style={styles.focusFrameContainer} pointerEvents="none">
                    <View style={styles.focusFrameBorder} />
                </View>

                {/* Alt HUD Katmanı */}
                <View style={styles.bottomHudWrapper}>

                    {/* Yönerge */}
                    <View style={styles.instructionArea}>
                        <Text style={styles.instructionText}>
                            Bitkiyi vizör içine alın — yaprak otomatik bulunacak
                        </Text>
                    </View>

                    {/* Alt Menü */}
                    <View style={[styles.drawerContainer, {
                        backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                        paddingBottom: Math.max(insets.bottom + 10, 30)
                    }]}>
                        {/* Pipeline Bilgi Bandı */}
                        <View style={styles.pipelineInfo}>
                            <View style={styles.pipelineStep}>
                                <MaterialCommunityIcons name="image-search-outline" size={16} color={colors.accent} />
                                <Text style={[styles.pipelineStepText, { color: colors.textMuted }]}>Yaprak Bul</Text>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textMuted} />
                            <View style={styles.pipelineStep}>
                                <MaterialCommunityIcons name="leaf" size={16} color={colors.accent} />
                                <Text style={[styles.pipelineStepText, { color: colors.textMuted }]}>Türü Tanı</Text>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textMuted} />
                            <View style={styles.pipelineStep}>
                                <MaterialCommunityIcons name="medical-bag" size={16} color={'#888'} />
                                <Text style={[styles.pipelineStepText, { color: '#888' }]}>Hastalık (Yakında)</Text>
                            </View>
                        </View>

                        {/* Alt Action Row: Galeri, Deklanşör, İpuçları */}
                        <View style={styles.actionRow}>
                            {/* Galeri Tuşu */}
                            <TouchableOpacity style={styles.actionSideItem} onPress={pickImage}>
                                <View style={styles.actionSubCircle}>
                                    <MaterialCommunityIcons name="image-outline" size={24} color={isDark ? '#FFF' : '#1A1A1A'} />
                                </View>
                                <Text style={[styles.actionSubText, { color: isDark ? '#A1A1AA' : '#8E8E93' }]}>Galeri</Text>
                            </TouchableOpacity>

                            {/* Beyaz Dev Deklanşör */}
                            <TouchableOpacity
                                style={[styles.shutterOuter, { borderColor: isDark ? '#A1A1AA' : '#E5E5EA' }]}
                                onPress={takePicture}
                            >
                                <View style={[styles.shutterInner, { backgroundColor: '#FFFFFF' }]} />
                            </TouchableOpacity>

                            {/* İpuçları Tuşu */}
                            <TouchableOpacity style={styles.actionSideItem} onPress={() => Alert.alert("İpucu", "Yaprak fotoğrafını çekerken:\n\n• Bitkiye çok yaklaşmayın\n• Işığın arkadan gelmemesine dikkat edin\n• Yaprağın tam görünmesini sağlayın\n\nYapay zeka yaprağı otomatik bulup analiz edecektir.")}>
                                <View style={styles.actionSubCircle}>
                                    <MaterialCommunityIcons name="help" size={24} color={isDark ? '#FFF' : '#1A1A1A'} />
                                </View>
                                <Text style={[styles.actionSubText, { color: isDark ? '#A1A1AA' : '#8E8E93' }]}>İpuçları</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                </View>
            </View>

            {/* Analiz Loading Overlay */}
            {isAnalyzing && (
                <View style={styles.analyzingOverlay}>
                    <View style={styles.analyzingBox}>
                        <ActivityIndicator size="large" color={colors.accent} />
                        <Text style={styles.analyzingText}>AI Analizi Yapılıyor</Text>
                        <Text style={styles.analyzingSubText}>{analyzeStep || '3 katmanlı pipeline çalışıyor...'}</Text>

                        {/* Pipeline adımları göstergesi */}
                        <View style={styles.pipelineSteps}>
                            <View style={styles.stepItem}>
                                <MaterialCommunityIcons name="image-search-outline" size={18} color={colors.accent} />
                                <Text style={styles.stepText}>YOLO Yaprak Tespiti</Text>
                            </View>
                            <View style={styles.stepItem}>
                                <MaterialCommunityIcons name="leaf" size={18} color={colors.accent} />
                                <Text style={styles.stepText}>Bitki Türü Tanıma</Text>
                            </View>
                            <View style={styles.stepItem}>
                                <MaterialCommunityIcons name="clock-outline" size={18} color="#888" />
                                <Text style={[styles.stepText, { color: '#888' }]}>Hastalık Analizi (Yakında)</Text>
                            </View>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
}

const getDynamicStyles = (colors) => StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    cameraSafeArea: {
        flex: 1,
        justifyContent: 'space-between',
    },

    // Üst Kontroller
    topControls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 16,
        zIndex: 10,
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Merkezi Odak Çerçevesi
    focusFrameContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
    },
    focusFrameBorder: {
        width: screenWidth - 100,
        height: screenWidth - 60,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.7)',
        borderRadius: 24,
    },

    // Alt UI
    bottomHudWrapper: {
        width: '100%',
        justifyContent: 'flex-end',
    },
    instructionArea: {
        paddingHorizontal: 30,
        paddingBottom: 8,
    },
    instructionText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 6,
        marginBottom: 12,
    },

    // Alt Drawer
    drawerContainer: {
        width: '100%',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        paddingTop: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },

    // Pipeline Info Band
    pipelineInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
        gap: 6,
    },
    pipelineStep: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    pipelineStepText: {
        fontSize: 12,
        fontWeight: '600',
    },

    // Fotoğraf / Deklanşör
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    actionSideItem: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 80,
    },
    actionSubCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(120, 120, 128, 0.16)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
    },
    actionSubText: {
        fontSize: 12,
        fontWeight: '500',
    },
    shutterOuter: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 3,
        justifyContent: 'center',
        alignItems: 'center',
    },
    shutterInner: {
        width: 66,
        height: 66,
        borderRadius: 33,
    },

    // İzin Sayfası Stilleri
    permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    permBackButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 16 : 24,
        left: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center'
    },
    iconBox: { width: 100, height: 100, borderRadius: 34, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
    permissionTitle: { fontSize: 24, fontWeight: 'bold', color: colors.textMain, marginBottom: 12, textAlign: 'center', letterSpacing: -0.5 },
    permissionText: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 40 },
    permissionButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 36, borderRadius: 30 },
    permissionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },

    // Analiz Overlay
    analyzingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.80)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    analyzingBox: {
        backgroundColor: colors.card || '#1C1C1E',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        width: 280,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 20,
    },
    analyzingText: {
        color: colors.textMain || '#FFF',
        fontSize: 17,
        fontWeight: 'bold',
        marginTop: 16,
    },
    analyzingSubText: {
        color: colors.textMuted || '#888',
        fontSize: 13,
        marginTop: 4,
        textAlign: 'center',
    },
    pipelineSteps: {
        marginTop: 20,
        width: '100%',
        gap: 10,
    },
    stepItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    stepText: {
        color: colors.textMuted || '#AAA',
        fontSize: 13,
        fontWeight: '500',
    },

});
