import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, StatusBar } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';

export default function CameraScreen() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const colors = isDark ? Colors.dark : Colors.light;
    
    // Dinamik stiller
    const styles = useMemo(() => getDynamicStyles(colors), [colors]);

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.cameraPlaceholder}>
                    <Text style={styles.placeholderText}>📸 Kamera Vizörü Burada Olacak</Text>
                    <Text style={styles.subText}>(Expo Camera Entegrasyonu Yapılacak)</Text>
                </View>

                <View style={[styles.controls, { backgroundColor: colors.background }]}>
                    <TouchableOpacity
                        style={[styles.captureButton, { backgroundColor: colors.card, borderColor: colors.accent }]}
                        onPress={() => alert('Fotoğraf Çekildi! AI Analizi Başlıyor...')}
                    >
                        <View style={[styles.captureInner, { backgroundColor: colors.accent }]} />
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
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
    },
    cameraPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        // Kamera vizörü her iki temada da vizör hissiyatı vermesi için antrasit
        backgroundColor: '#1A1A1A', 
    },
    placeholderText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    subText: {
        color: '#A1A1AA',
        fontSize: 14,
    },
    controls: {
        height: 140,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 20,
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 4,
        borderWidth: 2,
    },
    captureInner: {
        width: 66,
        height: 66,
        borderRadius: 33,
    },
});
