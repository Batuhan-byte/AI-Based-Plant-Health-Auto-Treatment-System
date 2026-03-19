import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, StatusBar, Image, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';

const { width: screenWidth } = Dimensions.get('window');

export default function DiagnosisResultScreen({ route, navigation }) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const colors = isDark ? Colors.dark : Colors.light;
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => getDynamicStyles(colors, isDark), [colors, isDark]);

    // Route'dan gelen veriler
    const { result, photoUri } = route.params || {};
    const tahmin = result?.tahmin || {};
    const topSonuclar = result?.topEnSonuclar || [];
    const guvenYuzde = ((tahmin.guvenOrani || 0) * 100).toFixed(1);

    // Sağlık durumu renk ve ikon haritası
    const isHealthy = tahmin.saglikli;
    const statusColor = isHealthy ? '#34C759' : '#FF3B30';
    const statusBg = isHealthy 
        ? (isDark ? 'rgba(52, 199, 89, 0.15)' : 'rgba(52, 199, 89, 0.1)')
        : (isDark ? 'rgba(255, 59, 48, 0.15)' : 'rgba(255, 59, 48, 0.1)');
    const statusIcon = isHealthy ? 'check-circle' : 'alert-circle';
    const statusText = isHealthy ? 'Sağlıklı Bitki' : 'Hastalık Tespit Edildi';

    return (
        <View style={[styles.container, { paddingTop: insets.top > 0 ? insets.top : (Platform.OS === 'android' ? StatusBar.currentHeight : 20) }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                
                {/* Üst Bar */}
                <View style={styles.topBar}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textMain} />
                    </TouchableOpacity>
                    <Text style={styles.topTitle}>Teşhis Sonucu</Text>
                    <View style={{ width: 44 }} />
                </View>

                {/* Fotoğraf Kartı */}
                {photoUri && (
                    <View style={styles.photoCard}>
                        <Image source={{ uri: photoUri }} style={styles.photoImage} />
                    </View>
                )}

                {/* Durum Göstergesi */}
                <View style={[styles.statusBanner, { backgroundColor: statusBg, borderColor: statusColor }]}>
                    <MaterialCommunityIcons name={statusIcon} size={28} color={statusColor} />
                    <View style={styles.statusTextWrap}>
                        <Text style={[styles.statusTitle, { color: statusColor }]}>{statusText}</Text>
                        <Text style={styles.statusSub}>Güven Oranı: %{guvenYuzde}</Text>
                    </View>
                </View>

                {/* Ana Teşhis Kartı */}
                <View style={styles.mainCard}>
                    <View style={styles.cardHeader}>
                        <MaterialCommunityIcons name="leaf" size={24} color={colors.accent} />
                        <Text style={styles.cardTitle}>Bitki Bilgisi</Text>
                    </View>
                    <View style={styles.cardRow}>
                        <Text style={styles.cardLabel}>Bitki Türü</Text>
                        <Text style={styles.cardValue}>{tahmin.bitki || '-'}</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.cardRow}>
                        <Text style={styles.cardLabel}>Teşhis</Text>
                        <Text style={[styles.cardValue, !isHealthy && { color: '#FF3B30' }]}>
                            {tahmin.hastalik || '-'}
                        </Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.cardRow}>
                        <Text style={styles.cardLabel}>Model Etiketi</Text>
                        <Text style={[styles.cardValue, { fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
                            {tahmin.etiket || '-'}
                        </Text>
                    </View>
                </View>

                {/* Top 5 Olasılık */}
                {topSonuclar.length > 0 && (
                    <View style={styles.mainCard}>
                        <View style={styles.cardHeader}>
                            <MaterialCommunityIcons name="chart-bar" size={24} color={colors.accent} />
                            <Text style={styles.cardTitle}>Olasılık Dağılımı</Text>
                        </View>
                        {topSonuclar.map((item, index) => {
                            const yuzde = (item.oran * 100).toFixed(1);
                            const barWidth = Math.max(item.oran * 100, 2); // Min %2 genişlik
                            return (
                                <View key={index} style={styles.probRow}>
                                    <View style={styles.probLabelWrap}>
                                        <Text style={styles.probIndex}>#{index + 1}</Text>
                                        <View>
                                            <Text style={styles.probName} numberOfLines={1}>{item.bitki}</Text>
                                            <Text style={styles.probDisease} numberOfLines={1}>{item.hastalik}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.probBarBg}>
                                        <View style={[styles.probBarFill, { 
                                            width: `${barWidth}%`, 
                                            backgroundColor: index === 0 ? colors.accent : (isDark ? '#444' : '#D1D1D6')
                                        }]} />
                                    </View>
                                    <Text style={styles.probPercent}>%{yuzde}</Text>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Aksiyon Butonları */}
                <View style={styles.actionButtons}>
                    <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: colors.accent }]} 
                        onPress={() => navigation.goBack()}
                    >
                        <MaterialCommunityIcons name="camera-retake-outline" size={22} color="#FFF" />
                        <Text style={styles.actionBtnText}>Yeni Analiz</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={[styles.actionBtn, styles.actionBtnOutline, { borderColor: colors.accent }]} 
                        onPress={() => navigation.navigate('MainTabs')}
                    >
                        <MaterialCommunityIcons name="home-outline" size={22} color={colors.accent} />
                        <Text style={[styles.actionBtnText, { color: colors.accent }]}>Ana Sayfa</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: insets.bottom + 20 }} />
            </ScrollView>
        </View>
    );
}

const getDynamicStyles = (colors, isDark) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },

    // Üst Bar
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: isDark ? '#2C2C2E' : '#F0F0F0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    topTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.textMain,
    },

    // Fotoğraf
    photoCard: {
        width: '100%',
        height: 220,
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: 16,
    },
    photoImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },

    // Durum Göstergesi
    statusBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 16,
    },
    statusTextWrap: {
        marginLeft: 12,
    },
    statusTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    statusSub: {
        fontSize: 14,
        color: colors.textMuted,
        marginTop: 2,
    },

    // Ana Kart
    mainCard: {
        backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: colors.textMain,
        marginLeft: 10,
    },
    cardRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
    },
    cardLabel: {
        fontSize: 15,
        color: colors.textMuted,
    },
    cardValue: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textMain,
        maxWidth: '60%',
        textAlign: 'right',
    },
    divider: {
        height: 1,
        backgroundColor: isDark ? '#333' : '#F0F0F0',
    },

    // Olasılık Çubukları
    probRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    probLabelWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        width: 120,
    },
    probIndex: {
        fontSize: 12,
        fontWeight: 'bold',
        color: colors.textMuted,
        width: 24,
    },
    probName: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textMain,
    },
    probDisease: {
        fontSize: 11,
        color: colors.textMuted,
    },
    probBarBg: {
        flex: 1,
        height: 8,
        backgroundColor: isDark ? '#2C2C2E' : '#F0F0F0',
        borderRadius: 4,
        marginHorizontal: 8,
        overflow: 'hidden',
    },
    probBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    probPercent: {
        width: 48,
        fontSize: 13,
        fontWeight: 'bold',
        color: colors.textMain,
        textAlign: 'right',
    },

    // Aksiyon Butonları
    actionButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        gap: 8,
    },
    actionBtnOutline: {
        backgroundColor: 'transparent',
        borderWidth: 2,
    },
    actionBtnText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
});
