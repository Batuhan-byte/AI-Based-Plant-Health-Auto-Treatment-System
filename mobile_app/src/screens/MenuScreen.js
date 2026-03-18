import React, { useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Platform, StatusBar } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';

export default function MenuScreen() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const colors = isDark ? Colors.dark : Colors.light;
    
    // Dinamik stiller
    const styles = useMemo(() => getDynamicStyles(colors), [colors]);

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.content}>
                <Text style={styles.text}>Profil Menü Özelliği Yakında!</Text>
            </View>
        </SafeAreaView>
    );
}

const getDynamicStyles = (colors) => StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.background, // Temaya göre dinamik zemin
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: colors.textMain, // Temaya göre dinamik metin rengi
        fontSize: 18,
        fontWeight: '600',
    },
});
