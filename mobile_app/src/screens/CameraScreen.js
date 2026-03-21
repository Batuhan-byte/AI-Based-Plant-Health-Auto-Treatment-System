import React, { useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, StatusBar, Dimensions, Image, Alert, Linking, ActivityIndicator } from 'react-native';
import Constants from 'expo-constants';
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
    const [mode, setMode] = useState('diagnose'); // 'diagnose' | 'identify'
    const [photos, setPhotos] = useState([]); // { uri: string }[]
    const [hasAsked, setHasAsked] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const insets = useSafeAreaInsets();

    const cameraRef = useRef(null);

    // Backend API URL (Otomatik IP Tespiti)
    const hostUri = Constants.expoConfig?.hostUri;
    const ip = hostUri ? hostUri.split(':').shift() : 'localhost';
    const API_BASE = `http://${ip}:3000`;

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
            allowsEditing: true, // Crop özelliği botanik vizyonu için kritik
            quality: 0.8,
        });

        if (!result.canceled) {
            handleNewPhoto(result.assets[0].uri);
        }
    }

    // Kamera ile fotoğraf çekimi
    async function takePicture() {
        if (cameraRef.current) {
            try {
                // Maksimum limiti kontrol et, teşhis için max 2
                if (mode === 'diagnose' && photos.length >= 2) return;

                const photo = await cameraRef.current.takePictureAsync({
                    quality: 0.8,
                    base64: false
                });

                handleNewPhoto(photo.uri);
            } catch (error) {
                console.error("Fotoğraf çekilirken hata:", error);
            }
        }
    }

    // AI Modeline uygun Center Crop + 224x224 İşleme (Preprocess)
    async function preprocessImageForAI(uri) {
        try {
            // Fotoğrafın gerçek piksel boyutlarını al
            const imageSize = await new Promise((resolve, reject) => {
                Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject);
            });

            // CENTER CROP: Vizör çerçevesine uygun olarak merkezi kırp
            // Arka planın büyük bölümünü keserek domain shift sorununu azaltır
            const cropW = Math.floor(imageSize.width * 0.85);
            const cropH = Math.floor(imageSize.height * 0.85);
            const originX = Math.floor((imageSize.width - cropW) / 2);
            const originY = Math.floor((imageSize.height - cropH) / 2);

            const result = await ImageManipulator.manipulateAsync(
                uri,
                [
                    { crop: { originX, originY, width: cropW, height: cropH } },
                    { resize: { width: 224, height: 224 } }
                ],
                { format: ImageManipulator.SaveFormat.JPEG, compress: 1, base64: true }
            );

            return result;
        } catch (error) {
            // Center crop hata verirse direkt resize'a düş
            console.warn("Center crop başarısız, direkt resize:", error.message);
            try {
                return await ImageManipulator.manipulateAsync(
                    uri,
                    [{ resize: { width: 224, height: 224 } }],
                    { format: ImageManipulator.SaveFormat.JPEG, compress: 1, base64: true }
                );
            } catch (e2) {
                console.error("Görüntü işlenirken hata:", e2);
                return null;
            }
        }
    }

    // Backend API'ye fotoğraf gönder ve teşhis al
    async function runPlantAI(processedImage, originalUri) {
        try {
            setIsAnalyzing(true);

            const formData = new FormData();
            formData.append('image', {
                uri: processedImage.uri,
                type: 'image/jpeg',
                name: 'plant_photo.jpg'
            });

            const response = await fetch(`${API_BASE}/api/diagnose`, {
                method: 'POST',
                body: formData,
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const result = await response.json();

            if (result.basarili) {
                navigation.navigate('DiagnosisResult', {
                    result: result,
                    photoUri: originalUri
                });
            } else {
                Alert.alert("Hata", result.hata || "Teşhis yapılamadı.");
            }
        } catch (error) {
            console.error("API Hatası:", error);
            Alert.alert(
                "Bağlantı Hatası",
                "Sunucuya bağlanılamadı. Lütfen backend sunucusunun çalıştığından emin olun."
            );
        } finally {
            setIsAnalyzing(false);
        }
    }

    // Ortak fotoğraf işleme algoritması
    async function handleNewPhoto(uri) {
        const processed = await preprocessImageForAI(uri);
        if (!processed) return;

        if (mode === 'diagnose') {
            const newPhotos = [...photos, { uri: processed.uri }];
            setPhotos(newPhotos);
            if (newPhotos.length === 2) {
                await runPlantAI(processed, uri);
            }
        } else {
            setPhotos([{ uri: processed.uri }]);
            await runPlantAI(processed, uri);
        }
    }

    function switchMode(newMode) {
        setMode(newMode);
        setPhotos([]); // Mod değiştiğinde eski çekimleri sıfırlıyoruz.
    }

    // Silmek için fotoğraf slotuna tıklama
    function removePhoto(index) {
        const remainingPhotos = [...photos];
        remainingPhotos.splice(index, 1);
        setPhotos(remainingPhotos);
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

                {/* Merkez Hedef Çerçevesi Dotted/Dashed Layout */}
                <View style={styles.focusFrameContainer} pointerEvents="none">
                    <View style={styles.focusFrameBorder} />
                </View>

                {/* Alt HUD Katmanı (Bottom Drawer / Control Panel) */}
                <View style={styles.bottomHudWrapper}>

                    {/* Yönerge ve Fotoğraf Slotları (Teşhis kısmı için 2 Slot) */}
                    <View style={styles.instructionArea}>
                        <Text style={styles.instructionText}>
                            Yaprağı vizör merkezine ortalayın
                        </Text>

                        {mode === 'diagnose' && (
                            <View style={styles.slotRow}>
                                {/* Slot 1 */}
                                <TouchableOpacity style={styles.photoSlot} onPress={() => photos[0] && removePhoto(0)} activeOpacity={0.7}>
                                    {photos[0] ? (
                                        <Image source={{ uri: photos[0].uri }} style={styles.slotImage} />
                                    ) : (
                                        <View style={styles.slotEmpty} />
                                    )}
                                    {photos[0] && <View style={styles.slotDeleteBadge}><MaterialCommunityIcons name="close" size={12} color="#FFF" /></View>}
                                </TouchableOpacity>

                                {/* Slot 2 */}
                                <TouchableOpacity style={styles.photoSlot} onPress={() => photos[1] && removePhoto(1)} activeOpacity={0.7}>
                                    {photos[1] ? (
                                        <Image source={{ uri: photos[1].uri }} style={styles.slotImage} />
                                    ) : (
                                        <View style={styles.slotEmpty} />
                                    )}
                                    {photos[1] && <View style={styles.slotDeleteBadge}><MaterialCommunityIcons name="close" size={12} color="#FFF" /></View>}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* Siyah Kapsül Alt Menü Tab ve Tuşlar */}
                    <View style={[styles.drawerContainer, {
                        backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                        paddingBottom: Math.max(insets.bottom + 10, 30) // En alt sınır boşluğu cihazın doğal güvenlik alanına göre doldurulur
                    }]}>
                        {/* İç Sekmeler (Teşhis Koymak / Bitkiler) */}
                        <View style={styles.internalTabs}>
                            <TouchableOpacity style={styles.tabButton} onPress={() => switchMode('diagnose')}>
                                <MaterialCommunityIcons name="medical-bag" size={20} color={mode === 'diagnose' ? colors.accent : colors.navInactive} />
                                <Text style={[styles.tabText, { color: mode === 'diagnose' ? colors.accent : colors.navInactive, fontWeight: mode === 'diagnose' ? 'bold' : '600' }]}>
                                    Teşhis koymak
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.tabButton} onPress={() => switchMode('identify')}>
                                <MaterialCommunityIcons name="leaf" size={22} color={mode === 'identify' ? colors.accent : colors.navInactive} />
                                <Text style={[styles.tabText, { color: mode === 'identify' ? colors.accent : colors.navInactive, fontWeight: mode === 'identify' ? 'bold' : '600' }]}>
                                    Bitkiler
                                </Text>
                            </TouchableOpacity>
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
                                disabled={mode === 'diagnose' && photos.length >= 2}
                            >
                                <View style={[styles.shutterInner, {
                                    backgroundColor: (mode === 'diagnose' && photos.length >= 2) ? '#555' : '#FFFFFF'
                                }]} />
                            </TouchableOpacity>

                            {/* İpuçları Tuşu */}
                            <TouchableOpacity style={styles.actionSideItem} onPress={() => Alert.alert("İpucu", "Kamerayı bitkiye çok yaklaştırmayın ve ışığın arkadan gelmemesine dikkat edin.")}>
                                <View style={styles.actionSubCircle}>
                                    <MaterialCommunityIcons name="help" size={24} color={isDark ? '#FFF' : '#1A1A1A'} />
                                </View>
                                <Text style={[styles.actionSubText, { color: isDark ? '#A1A1AA' : '#8E8E93' }]}>Snap ipuçları</Text>
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
                        <Text style={styles.analyzingText}>Yaprak analiz ediliyor...</Text>
                        <Text style={styles.analyzingSubText}>Yapay zeka modeli çalışıyor</Text>
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
        flex: 1, // Absolute kuralı silindi. Bu sayede Alt menü ile üst menü arasına hapsolacak ve onlara asla dokunmayacak.
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
    },
    focusFrameBorder: {
        width: screenWidth - 100, // Daha derli toplu ve ortada
        height: screenWidth - 60, // Dev diktörtgen yerine modern kompakt dikdörtgen
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.7)',
        borderRadius: 24,
    },

    // Alt UI (Drawer & Text)
    bottomHudWrapper: {
        width: '100%',
        justifyContent: 'flex-end',
    },
    instructionArea: {
        paddingHorizontal: 30,
        paddingBottom: 8, // Ekranın alttaki siyah (drawer) paneline en yakın şekilde kilitlendi
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
    slotRow: {
        flexDirection: 'row',
        gap: 16, // Eğer gap eskide problem atarsa marginRight ile revize edilebilir ama yeni RN sürümde çalışır
        marginLeft: 4,
    },
    photoSlot: {
        width: 60,
        height: 60,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative'
    },
    slotEmpty: {
        width: '100%',
        height: '100%',
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.2)', // Boş kare izi
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    slotImage: {
        width: '100%',
        height: '100%',
        borderRadius: 14,
    },
    slotDeleteBadge: {
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: '#FF3B30',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#000'
    },

    // Alt Siyah / Tema Çekmecesi Kart Yapısı
    drawerContainer: {
        width: '100%',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        paddingTop: 16, // Üst menüyle (2 küçük kare kutu) kaynaşmak için daraltıldı
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    internalTabs: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        paddingHorizontal: 30,
        marginBottom: 30,
    },
    tabButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 24,
    },
    tabText: {
        fontSize: 16,
        marginLeft: 6,
    },

    // Fotoğraf / Deklanşör Düğmesi Dizilimi
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
        backgroundColor: 'rgba(120, 120, 128, 0.16)', // Tasarım dilindeki soft gri arkaplan
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
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    analyzingBox: {
        backgroundColor: colors.card || '#1C1C1E',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        width: 220,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 20,
    },
    analyzingText: {
        color: colors.textMain || '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 16,
    },
    analyzingSubText: {
        color: colors.textMuted || '#888',
        fontSize: 13,
        marginTop: 4,
    },

});
