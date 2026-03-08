import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Image } from 'react-native';

export default function HomeScreen({ navigation }) {
    return (
        <SafeAreaView style={styles.container}>
            {/* Header Area */}
            <View style={styles.header}>
                <Text style={styles.title}>Bitki Sağlığı</Text>
                <Text style={styles.subtitle}>Otonom Teşhis ve Tedavi Sistemi</Text>
            </View>

            {/* Main Content */}
            <View style={styles.content}>
                <View style={styles.infoCard}>
                    <Text style={styles.infoText}>
                        Tarlanızdaki bitkilerde hastalık şüphesi mi var?
                        Hemen bir fotoğraf çekin, yapay zeka saniyeler içinde teşhis edip tedavi önersin.
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => navigation.navigate('Camera')}
                >
                    <Text style={styles.buttonText}>📷 Teşhis İçin Fotoğraf Çek</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => navigation.navigate('History')}
                >
                    <Text style={styles.secondaryButtonText}>📋 Önceki Analizlerim</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7FFF7', // Açık yeşil / doğa temalı arka plan
    },
    header: {
        padding: 24,
        backgroundColor: '#2E8B57', // Deniz yeşili
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#E0F8E0',
    },
    content: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
    },
    infoCard: {
        backgroundColor: '#FFFFFF',
        padding: 20,
        borderRadius: 16,
        marginBottom: 40,
        borderWidth: 1,
        borderColor: '#E8F5E9',
        elevation: 2,
    },
    infoText: {
        fontSize: 16,
        lineHeight: 24,
        color: '#424242',
        textAlign: 'center',
    },
    primaryButton: {
        backgroundColor: '#4CAF50',
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 16,
        elevation: 3,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    secondaryButton: {
        backgroundColor: '#FFFFFF',
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#4CAF50',
    },
    secondaryButtonText: {
        color: '#4CAF50',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
