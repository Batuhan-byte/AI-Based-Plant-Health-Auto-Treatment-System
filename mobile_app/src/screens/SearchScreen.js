import React, { useMemo, useState, useCallback } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    SafeAreaView, 
    Platform, 
    StatusBar, 
    FlatList, 
    Image, 
    TouchableOpacity, 
    ActivityIndicator, 
    Alert, 
    Modal, 
    ScrollView 
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { API_BASE } from '../config';

export default function SearchScreen() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const colors = isDark ? Colors.dark : Colors.light;

    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [zoomVisible, setZoomVisible] = useState(false);

    // Dinamik stiller
    const styles = useMemo(() => getDynamicStyles(colors), [colors]);

    // Geçmiş verilerini çek
    const fetchHistory = useCallback(async (showLoadingIndicator = true) => {
        if (showLoadingIndicator) setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/history`);
            const data = await response.json();
            if (data.basarili) {
                setHistory(data.gecmis || []);
            } else {
                console.warn('Geçmiş yüklenemedi:', data.hata);
            }
        } catch (error) {
            console.error('Geçmiş API hatası:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // Her sayfa odaklandığında (Logs sekmesine tıklandığında) verileri yenile (Gelişmiş UX)
    useFocusEffect(
        useCallback(() => {
            fetchHistory(true);
        }, [fetchHistory])
    );

    // Pull-to-refresh tetikleyicisi
    const handleRefresh = () => {
        setRefreshing(true);
        fetchHistory(false);
    };

    // Kayıt silme işlemi
    const handleDelete = (id) => {
        Alert.alert(
            "Kaydı Sil",
            "Bu teşhis kaydını ve ilişkili fotoğrafı kalıcı olarak silmek istediğinizden emin misiniz?",
            [
                { text: "Vazgeç", style: "cancel" },
                { 
                    text: "Evet, Sil", 
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const response = await fetch(`${API_BASE}/api/history/${id}`, {
                                method: 'DELETE'
                            });
                            const data = await response.json();
                            if (data.basarili) {
                                setModalVisible(false);
                                setSelectedItem(null);
                                // Listeyi lokal olarak güncelle
                                setHistory(prev => prev.filter(item => item.id !== id));
                                Alert.alert("Başarılı", "Teşhis kaydı başarıyla silindi.");
                            } else {
                                Alert.alert("Hata", "Kayıt silinemedi: " + data.hata);
                            }
                        } catch (error) {
                            Alert.alert("Hata", "Sunucu bağlantı hatası oluştu.");
                        }
                    }
                }
            ]
        );
    };

    // Tarih formatlama
    const formatDate = (isoString) => {
        if (!isoString) return '—';
        const date = new Date(isoString);
        return date.toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Her bir geçmiş kartı render fonksiyonu
    const renderHistoryItem = ({ item }) => {
        const isHealthy = item.hastalik_durum === 'saglikli' || (item.hastalik_durum === 'tespit_edildi' && item.hastalik_adi === 'Healthy');
        const statusColor = isHealthy ? '#34C759' : '#FF3B30';
        const statusBg = isHealthy ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 59, 48, 0.1)';
        const statusText = isHealthy ? 'Sağlıklı' : (item.hastalik_adi_tr || 'Hastalık Teşhisi');

        const imageUri = `${API_BASE}/uploads/${item.resim_yolu}`;

        return (
            <TouchableOpacity 
                style={styles.card} 
                onPress={() => {
                    setSelectedItem(item);
                    setModalVisible(true);
                }}
                activeOpacity={0.8}
            >
                {/* Sol Yaprak Fotoğrafı */}
                <Image source={{ uri: imageUri }} style={styles.cardImage} />

                {/* Orta Metin Alanı */}
                <View style={styles.cardInfo}>
                    <Text style={styles.cardPlantName}>{item.bitki_adi_tr || item.bitki_adi}</Text>
                    
                    <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                    </View>
                    
                    <Text style={styles.cardDate}>{formatDate(item.tarih)}</Text>
                </View>

                {/* Sağ Oranlar & Silme Butonu */}
                <View style={styles.cardRight}>
                    <Text style={styles.accuracyText}>
                        %{parseFloat(item.hastalik_guven || item.bitki_guven || 0).toFixed(1)}
                    </Text>
                    <TouchableOpacity 
                        style={styles.deleteButton} 
                        onPress={() => handleDelete(item.id)}
                    >
                        <MaterialCommunityIcons name="trash-can-outline" size={24} color="#FF3B30" />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
            
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Teşhis Geçmişi</Text>
                <Text style={styles.headerSubtitle}>Kayıtlı Analizlerim</Text>
            </View>

            {/* İçerik */}
            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={styles.loadingText}>Analiz geçmişi yükleniyor...</Text>
                </View>
            ) : history.length === 0 ? (
                <View style={styles.centerContainer}>
                    <View style={styles.emptyIconCircle}>
                        <MaterialCommunityIcons name="clipboard-text-outline" size={48} color={colors.accent} />
                    </View>
                    <Text style={styles.emptyText}>Henüz Kayıtlı Teşhis Yok</Text>
                    <Text style={styles.emptySubText}>Bitki yapraklarını taratarak sonuçları otomatik olarak buraya kaydedebilirsiniz.</Text>
                </View>
            ) : (
                <FlatList
                    data={history}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderHistoryItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                />
            )}

            {/* DETAY MODALI */}
            {selectedItem && (
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={modalVisible}
                    onRequestClose={() => setModalVisible(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            
                            {/* Bottom Sheet Drag Handle */}
                            <View style={styles.dragHandle} />

                            {/* Modal Header */}
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Teşhis Detayı</Text>
                                <View style={styles.modalHeaderActions}>
                                    {/* Çöp Kutusu Silme Butonu */}
                                    <TouchableOpacity 
                                        style={[styles.deleteModalButton, { marginRight: 16 }]} 
                                        onPress={() => handleDelete(selectedItem.id)}
                                        activeOpacity={0.7}
                                    >
                                        <MaterialCommunityIcons name="trash-can-outline" size={22} color="#FF3B30" />
                                    </TouchableOpacity>
                                    
                                    {/* Kapat Butonu */}
                                    <TouchableOpacity 
                                        style={styles.closeButton} 
                                        onPress={() => setModalVisible(false)}
                                        activeOpacity={0.7}
                                    >
                                        <MaterialCommunityIcons name="close" size={20} color={colors.textMain} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
                                
                                {/* Kırpılmış Yaprak Fotoğrafı (Kapsüllenmiş Kart) */}
                                <TouchableOpacity 
                                    style={styles.modalImageContainer}
                                    onPress={() => setZoomVisible(true)}
                                    activeOpacity={0.9}
                                >
                                    <Image 
                                        source={{ uri: `${API_BASE}/uploads/${selectedItem.resim_yolu}` }} 
                                        style={styles.modalImage} 
                                    />
                                    {/* Görsel Üzerindeki Akıllı Yüzen Kart */}
                                    <View style={styles.imageFloatingBadge}>
                                        <MaterialCommunityIcons name="leaf" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                                        <Text style={styles.imageFloatingBadgeText}>
                                            {selectedItem.bitki_adi_tr || selectedItem.bitki_adi}
                                        </Text>
                                    </View>
                                    
                                    {/* Büyütme İkonu */}
                                    <View style={styles.zoomIconBadge}>
                                        <MaterialCommunityIcons name="magnify-plus-outline" size={18} color="#FFFFFF" />
                                    </View>
                                </TouchableOpacity>

                                {/* Teşhis Özeti */}
                                <View style={styles.sectionCard}>
                                    <View style={styles.sectionHeaderRow}>
                                        <MaterialCommunityIcons name="information-outline" size={20} color={colors.accent} style={{ marginRight: 8 }} />
                                        <Text style={styles.sectionTitle}>Bitki Bilgisi</Text>
                                    </View>
                                    
                                    <View style={styles.detailRow}>
                                        <View style={styles.rowLabelGroup}>
                                            <MaterialCommunityIcons name="leaf-maple" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
                                            <Text style={styles.detailLabel}>Bitki Türü</Text>
                                        </View>
                                        <Text style={styles.detailValue}>{selectedItem.bitki_adi_tr || selectedItem.bitki_adi}</Text>
                                    </View>
                                    
                                    <View style={styles.detailRow}>
                                        <View style={styles.rowLabelGroup}>
                                            <MaterialCommunityIcons name="shield-check-outline" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
                                            <Text style={styles.detailLabel}>Analiz Güvenilirliği</Text>
                                        </View>
                                        <Text style={styles.detailValue}>%{parseFloat(selectedItem.bitki_guven).toFixed(1)}</Text>
                                    </View>
                                </View>

                                {/* Hastalık Durumu */}
                                <View style={styles.sectionCard}>
                                    <View style={styles.sectionHeaderRow}>
                                        <MaterialCommunityIcons 
                                            name="heart-pulse" 
                                            size={20} 
                                            color={selectedItem.hastalik_durum === 'saglikli' || selectedItem.hastalik_adi === 'Healthy' ? '#34C759' : '#FF3B30'} 
                                            style={{ marginRight: 8 }} 
                                        />
                                        <Text style={styles.sectionTitle}>Hastalık Durumu</Text>
                                    </View>
                                    
                                    <View style={styles.detailRow}>
                                        <View style={styles.rowLabelGroup}>
                                            <MaterialCommunityIcons name="alert-decagram-outline" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
                                            <Text style={styles.detailLabel}>Durum</Text>
                                        </View>
                                        <Text style={[
                                            styles.detailValue, 
                                            { color: selectedItem.hastalik_durum === 'saglikli' || selectedItem.hastalik_adi === 'Healthy' ? '#34C759' : '#FF3B30' }
                                        ]}>
                                            {selectedItem.hastalik_durum === 'saglikli' || selectedItem.hastalik_adi === 'Healthy' 
                                                ? 'Sağlıklı Bitki' 
                                                : (selectedItem.hastalik_adi_tr || 'Hastalık Tespit Edildi')}
                                        </Text>
                                    </View>
                                    
                                    {selectedItem.hastalik_durum === 'tespit_edildi' && selectedItem.hastalik_adi !== 'Healthy' && (
                                        <View style={styles.detailRow}>
                                            <View style={styles.rowLabelGroup}>
                                                <MaterialCommunityIcons name="target" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
                                                <Text style={styles.detailLabel}>Teşhis Kesinliği</Text>
                                            </View>
                                            <Text style={styles.detailValue}>%{parseFloat(selectedItem.hastalik_guven).toFixed(1)}</Text>
                                        </View>
                                    )}
                                    
                                    <View style={styles.detailRow}>
                                        <View style={styles.rowLabelGroup}>
                                            <MaterialCommunityIcons name="calendar-clock" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
                                            <Text style={styles.detailLabel}>Analiz Tarihi</Text>
                                        </View>
                                        <Text style={styles.detailValue}>{formatDate(selectedItem.tarih)}</Text>
                                    </View>
                                </View>

                                {/* Tedavi Önerisi */}
                                <View style={[styles.sectionCard, styles.treatmentCard]}>
                                    <View style={styles.treatmentTitleRow}>
                                        <MaterialCommunityIcons name="shield-star" size={24} color="#FFFFFF" style={{ marginRight: 8 }} />
                                        <Text style={styles.treatmentTitle}>Otonom Tedavi Önerisi</Text>
                                    </View>
                                    <Text style={styles.treatmentText}>{selectedItem.tedavi_onerisi}</Text>
                                </View>

                            </ScrollView>
                        </View>

                        {/* BÜYÜTÜLMÜŞ RESİM MODALI (100% Ekranı Kaplayan Zoom Overlay) */}
                        {zoomVisible && (
                            <View style={styles.zoomOverlayAbsolute}>
                                <TouchableOpacity style={styles.zoomCloseButton} onPress={() => setZoomVisible(false)}>
                                    <MaterialCommunityIcons name="close" size={28} color="#FFFFFF" />
                                </TouchableOpacity>
                                <Image 
                                    source={{ uri: `${API_BASE}/uploads/${selectedItem.resim_yolu}` }} 
                                    style={styles.zoomImage} 
                                    resizeMode="contain"
                                />
                            </View>
                        )}
                    </View>
                </Modal>
            )}
        </SafeAreaView>
    );
}

const getDynamicStyles = (colors) => StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.navInactive + '20',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: colors.textMain,
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 14,
        color: colors.textMuted,
        marginTop: 2,
    },
    listContent: {
        padding: 20,
        paddingBottom: 40,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    loadingText: {
        marginTop: 12,
        color: colors.textMuted,
        fontSize: 15,
        fontWeight: '500',
    },
    emptyIconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.accent + '15',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.textMain,
        marginBottom: 8,
        textAlign: 'center',
    },
    emptySubText: {
        fontSize: 14,
        color: colors.textMuted,
        textAlign: 'center',
        lineHeight: 20,
    },
    card: {
        flexDirection: 'row',
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 12,
        alignItems: 'center',
        marginBottom: 14,
        shadowColor: colors.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: colors.background === '#121212' ? 0.3 : 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    cardImage: {
        width: 70,
        height: 70,
        borderRadius: 14,
        backgroundColor: colors.background,
    },
    cardInfo: {
        flex: 1,
        marginLeft: 16,
        justifyContent: 'center',
    },
    cardPlantName: {
        fontSize: 17,
        fontWeight: 'bold',
        color: colors.textMain,
        marginBottom: 4,
    },
    statusBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        marginBottom: 6,
    },
    statusText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    cardDate: {
        fontSize: 11,
        color: colors.textMuted,
    },
    cardRight: {
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: 70,
        paddingVertical: 2,
    },
    accuracyText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: colors.accent,
    },
    deleteButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 59, 48, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Modal Stilleri
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.card,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        height: '85%',
        paddingTop: 16,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.navInactive + '20',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.textMain,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalScroll: {
        padding: 24,
        paddingBottom: 50,
    },
    dragHandle: {
        width: 48,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: colors.navInactive + '45',
        alignSelf: 'center',
        marginTop: 8,
        marginBottom: 2,
    },
    modalImageContainer: {
        position: 'relative',
        width: '100%',
        height: 300,
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: 20,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.navInactive + '15',
    },
    modalImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    imageFloatingBadge: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
    },
    imageFloatingBadgeText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: 'bold',
    },
    zoomIconBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalHeaderActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    deleteModalButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 59, 48, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    zoomOverlayAbsolute: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.98)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
    },
    zoomCloseButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        right: 24,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10010,
    },
    zoomImage: {
        width: '100%',
        height: '80%',
    },
    sectionCard: {
        backgroundColor: colors.card,
        borderRadius: 24,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.navInactive + '15',
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.navInactive + '15',
        paddingBottom: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.textMain,
        letterSpacing: -0.2,
    },
    rowLabelGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.navInactive + '08',
    },
    detailLabel: {
        fontSize: 14,
        color: colors.textMuted,
        fontWeight: '500',
    },
    detailValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.textMain,
    },
    treatmentCard: {
        backgroundColor: colors.accent,
        padding: 20,
        borderRadius: 24,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 4,
    },
    treatmentTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    treatmentTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    treatmentText: {
        fontSize: 14,
        color: '#F4FBF4',
        lineHeight: 22,
        fontWeight: '500',
    },
});
