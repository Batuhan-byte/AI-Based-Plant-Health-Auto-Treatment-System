import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function CameraScreen({ navigation }) {
    return (
        <View style={styles.container}>
            <View style={styles.cameraPlaceholder}>
                <Text style={styles.placeholderText}>📸 Kamera Vizörü Buraya Gelecek</Text>
                <Text style={styles.subText}>(Expo Camera Entegrasyonu Yapılacak)</Text>
            </View>

            <View style={styles.controls}>
                <TouchableOpacity
                    style={styles.captureButton}
                    onPress={() => alert('Fotoğraf Çekildi! AI Analizi Başlıyor...')}
                >
                    <View style={styles.captureInner} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    cameraPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
    },
    placeholderText: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    subText: {
        color: '#AAA',
        fontSize: 14,
    },
    controls: {
        height: 120,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 20,
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 5,
    },
    captureInner: {
        width: 66,
        height: 66,
        borderRadius: 33,
        backgroundColor: '#FFF',
        borderWidth: 2,
        borderColor: '#000',
    },
});
