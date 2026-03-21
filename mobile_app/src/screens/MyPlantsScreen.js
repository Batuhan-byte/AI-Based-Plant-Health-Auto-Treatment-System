import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, StyleSheet, Platform, StatusBar, Dimensions, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import * as Location from 'expo-location';
import { Video, ResizeMode } from 'expo-av';

const { width: screenWidth } = Dimensions.get('window');

// Tam ekran genişliği ve pagingEnabled aralığı hesabı (Gelişmiş UX trick)
const CARD_WIDTH = screenWidth - 40;
const GAP = 16; // Kartlar arası görünür boşluk
const SCROLL_WIDTH = CARD_WIDTH + GAP; // Paging motorunun sekeceği tam atlama mesafesi

const WEATHER_VIDEOS = {
    clear: require('../../assets/videos/sunny.mp4'),
    cloudy: require('../../assets/videos/cloudy.mp4'),
    rain: require('../../assets/videos/rain.mp4'),
    snow: require('../../assets/videos/snow.mp4'),
    fog: require('../../assets/videos/fog.mp4'),
    storm: require('../../assets/videos/storm.mp4'),
    default: require('../../assets/videos/default.mp4'),
};

export default function MyPlantsScreen() {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';
    const colors = isDark ? Colors.dark : Colors.light;
    const styles = useMemo(() => getDynamicStyles(colors), [colors]);

    const [activeCardIndex, setActiveCardIndex] = useState(0);
    const [city, setCity] = useState('Konum Aranıyor...');
    const [weather, setWeather] = useState(null);

    // Konum ve Hava Durumu Alma
    useEffect(() => {
        (async () => {
            try {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    setCity('Konum İzni Yok');
                    return;
                }

                let location = await Location.getCurrentPositionAsync({});
                const { latitude, longitude } = location.coords;

                let geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
                if (geocode && geocode.length > 0) {
                    const loc = geocode[0];
                    const il = loc.region || loc.adminArea || loc.city || '';
                    const ilce = loc.subregion || loc.district || loc.name || '';

                    if (il && ilce && il !== ilce) {
                        setCity(`${il}, ${ilce}`);
                    } else {
                        setCity(il || ilce || 'Konum Bulunamadı');
                    }
                }

                const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
                const data = await response.json();

                if (data.current_weather) {
                    let code = data.current_weather.weathercode;
                    let iconName = 'weather-sunny';
                    let bgVideo = WEATHER_VIDEOS.clear;
                    let desc = 'Güneşli';

                    if (code > 0 && code <= 3) { iconName = 'weather-partly-cloudy'; bgVideo = WEATHER_VIDEOS.cloudy; desc = 'Parçalı Bulutlu'; }
                    if (code >= 45 && code <= 48) { iconName = 'weather-fog'; bgVideo = WEATHER_VIDEOS.fog; desc = 'Sisli'; }
                    if (code >= 51 && code <= 67) { iconName = 'weather-rainy'; bgVideo = WEATHER_VIDEOS.rain; desc = 'Yağmurlu'; }
                    if (code >= 71 && code <= 77) { iconName = 'weather-snowy'; bgVideo = WEATHER_VIDEOS.snow; desc = 'Karlı'; }
                    if (code >= 80 && code <= 82) { iconName = 'weather-pouring'; bgVideo = WEATHER_VIDEOS.rain; desc = 'Sağanak Yağış'; }
                    if (code >= 95) { iconName = 'weather-lightning'; bgVideo = WEATHER_VIDEOS.storm; desc = 'Fırtınalı'; }

                    setWeather({
                        temp: Math.round(data.current_weather.temperature),
                        icon: iconName,
                        videoUrl: bgVideo,
                        description: desc
                    });
                }
            } catch (error) {
                setCity('Bağlantı Kurulamadı');
                console.log(error);
            }
        })();
    }, []);

    const handleScroll = (event) => {
        const scrollPosition = event.nativeEvent.contentOffset.x;
        // Scroll_Width üzerinden sayfa hesaplama kartları pürüzsüz kitler
        const index = Math.round(scrollPosition / SCROLL_WIDTH);
        setActiveCardIndex(index);
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                <View style={[styles.paddedSection, styles.header]}>
                    <Text style={styles.headerTitle}>My Antigravity Botanics</Text>
                    <View style={styles.headerIconsRow}>
                        <TouchableOpacity style={styles.themeToggleContainer} onPress={toggleTheme}>
                            <MaterialCommunityIcons
                                name={isDark ? "weather-night" : "weather-sunny"}
                                size={28}
                                color={colors.textMain}
                            />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.bellIconContainer}>
                            <MaterialCommunityIcons name="bell-ring-outline" size={26} color={colors.textMain} />
                            <View style={styles.notificationDot} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* GALERİ CAROUSEL (Düzeltilen Gap + Kilitli Kaydırma) */}
                <View style={styles.carouselContainer}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        pagingEnabled={true}
                        decelerationRate="fast"
                        style={{ width: SCROLL_WIDTH, alignSelf: 'center' }} // SCROLL_WIDTH boşluğu da hesaba katar
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                    >
                        {/* KART 1: Hava Durumu */}
                        <View style={[styles.card, { marginHorizontal: GAP / 2 }]}>
                            {weather && (
                                <>
                                    <Video
                                        source={weather.videoUrl}
                                        style={styles.weatherBgVideo}
                                        resizeMode={ResizeMode.COVER}
                                        shouldPlay
                                        isLooping
                                        isMuted
                                    />
                                    <View style={styles.weatherOverlay} />
                                </>
                            )}

                            <View style={[styles.cardHeader, { zIndex: 2 }]}>
                                <Text style={[styles.cardHeaderTitle, weather && styles.weatherTextWhite]}>
                                    CANLI HAVA DURUMU
                                </Text>
                                <MaterialCommunityIcons name="map-marker-outline" size={22} color={weather ? '#FFF' : colors.accent} />
                            </View>

                            <Text style={[styles.cardMainText, weather && styles.weatherTextWhite, { zIndex: 2 }]} numberOfLines={1} adjustsFontSizeToFit>
                                {city}
                            </Text>

                            <View style={[styles.cardFooter, { zIndex: 2 }]}>
                                {weather ? (
                                    <View style={styles.weatherDataContainer}>
                                        <View style={styles.weatherDataRow}>
                                            <MaterialCommunityIcons name={weather.icon} size={42} color="#FFF" style={{ marginRight: 10 }} />
                                            <Text style={[styles.weatherTempText, styles.weatherTextWhite]}>{weather.temp}°C</Text>
                                        </View>
                                        <Text style={styles.weatherDescText}>{weather.description}</Text>
                                    </View>
                                ) : (
                                    <View style={styles.weatherDataRow}>
                                        <MaterialCommunityIcons name="cloud-search-outline" size={28} color={colors.textMuted} style={{ marginRight: 8 }} />
                                        <Text style={styles.weatherLoadingText}>Yükleniyor...</Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* KART 2: Boş Placeholder */}
                        <View style={[styles.card, { marginHorizontal: GAP / 2 }]}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardHeaderTitle}>KART 2</Text>
                            </View>
                            <Text style={styles.cardMainText}>Yakında Eklenecek</Text>
                            <View style={styles.cardFooter}>
                                <Text style={styles.cardFooterMuted}>Ayrılmış Alan</Text>
                            </View>
                        </View>

                        {/* KART 3: Boş Placeholder */}
                        <View style={[styles.card, { marginHorizontal: GAP / 2 }]}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardHeaderTitle}>KART 3</Text>
                            </View>
                            <Text style={styles.cardMainText}>Yakında Eklenecek</Text>
                            <View style={styles.cardFooter}>
                                <Text style={styles.cardFooterMuted}>Ayrılmış Alan</Text>
                            </View>
                        </View>

                    </ScrollView>
                </View>

                {/* Pagination */}
                <View style={styles.dotsContainer}>
                    {[0, 1, 2].map((i) => (
                        <View key={i} style={activeCardIndex === i ? styles.dotActive : styles.dotInactive} />
                    ))}
                </View>

                <View style={styles.paddedSection}>
                    <View style={styles.actionsRow}>
                        <ActionIcon icon="watering-can" color={colors.iconWaterColor} bg={colors.iconWaterBg} label={"Add Water\nCredit"} styles={styles} />
                        <ActionIcon icon="microscope" color={colors.iconAnalyzeColor} bg={colors.iconAnalyzeBg} label={"Analyze\nPlant"} styles={styles} />
                        <ActionIcon icon="flower" color={colors.iconNewColor} bg={colors.iconNewBg} label={"Add New\nPlant"} styles={styles} />
                        <ActionIcon icon="snowflake" color={colors.iconPauseColor} bg={colors.iconPauseBg} label={"Pause\nCare Plan"} styles={styles} />
                    </View>

                    <View style={styles.logHeaderContainer}>
                        <Text style={styles.logHeaderTitle}>Kayıtlı Bitkilerim</Text>
                        <TouchableOpacity>
                            <Text style={styles.seeAllText}>Tümünü Gör</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.logList}>
                        <PlantItem 
                            name="Bonsai (Ficus)" 
                            status="1 bitki (1 bakıma ihtiyaç duyuyor)" 
                            imageUrl="https://images.unsplash.com/photo-1599598425947-33001c3e6df1?q=80&w=400&auto=format&fit=crop"
                            needs={['water', 'fertilizer']}
                            styles={styles}
                            colors={colors}
                        />
                        <PlantItem 
                            name="Monstera Deliciosa" 
                            status="Sağlıklı (Bakım gerekmiyor)" 
                            imageUrl="https://images.unsplash.com/photo-1614594975525-e45190c55d0b?q=80&w=400&auto=format&fit=crop"
                            needs={[]}
                            styles={styles}
                            colors={colors}
                        />
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

function ActionIcon({ icon, color, bg, label, styles }) {
    return (
        <View style={styles.actionContainer}>
            <TouchableOpacity style={[styles.actionCircle, { backgroundColor: bg }]}>
                <MaterialCommunityIcons name={icon} size={28} color={color} />
            </TouchableOpacity>
            <Text style={styles.actionLabel} numberOfLines={2}>{label}</Text>
        </View>
    );
}

function PlantItem({ name, status, imageUrl, needs, styles, colors }) {
    return (
        <TouchableOpacity style={styles.plantItemContainer}>
            {/* Fotoğraf ve Arka plan katman hissi */}
            <View style={styles.plantImageWrapper}>
                <View style={[styles.plantImageStackBase, styles.stackLayer2]} />
                <View style={[styles.plantImageStackBase, styles.stackLayer1]} />
                <Image source={{ uri: imageUrl }} style={styles.plantImageMain} />
            </View>

            <View style={styles.plantTextContainer}>
                <View>
                    <Text style={styles.plantTitle} numberOfLines={1}>{name}</Text>
                    <Text style={styles.plantSubtitle} numberOfLines={1}>{status}</Text>
                </View>
                
                <View style={styles.plantNeedsRow}>
                    {needs.length === 0 ? (
                        <View style={[styles.needIconCircle, { borderColor: '#2ECC71', backgroundColor: 'rgba(46, 204, 113, 0.1)' }]}>
                            <MaterialCommunityIcons name="check" size={18} color="#2ECC71" />
                        </View>
                    ) : null}
                    {needs.includes('water') && (
                        <View style={[styles.needIconCircle, { borderColor: '#E74C3C', backgroundColor: 'rgba(231, 76, 60, 0.1)' }]}>
                            <MaterialCommunityIcons name="water" size={18} color="#E74C3C" />
                        </View>
                    )}
                    {needs.includes('fertilizer') && (
                        <View style={[styles.needIconCircle, { borderColor: '#1ABC9C', backgroundColor: 'rgba(26, 188, 156, 0.1)', marginLeft: 8 }]}>
                            <MaterialCommunityIcons name="flask" size={18} color="#1ABC9C" />
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}

// STYLES
const getDynamicStyles = (colors) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
    scrollContent: { paddingTop: 10, paddingBottom: 40 },
    paddedSection: { paddingHorizontal: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: colors.textMain, letterSpacing: -0.5 },
    headerIconsRow: { flexDirection: 'row', alignItems: 'center' },
    themeToggleContainer: { marginRight: 16 },
    bellIconContainer: { position: 'relative' },
    notificationDot: { position: 'absolute', top: 2, right: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent, borderWidth: 2, borderColor: colors.background },

    carouselContainer: { marginBottom: 16, alignItems: 'center' },

    card: {
        width: CARD_WIDTH,
        height: 210,
        backgroundColor: colors.card,
        borderRadius: 24,
        padding: 24,
        position: 'relative'
    },

    weatherBgVideo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: CARD_WIDTH, height: 210, borderRadius: 24 },
    weatherOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 1, borderRadius: 24 },
    weatherTextWhite: { color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    cardHeaderTitle: { color: colors.textMuted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
    cardMainText: { color: colors.textMain, fontSize: 26, fontWeight: 'bold', letterSpacing: 0.5 },
    cardFooter: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    cardFooterMuted: { color: colors.textMuted, fontSize: 14, fontWeight: '500' },
    weatherDataContainer: { flexDirection: 'column' },
    weatherDataRow: { flexDirection: 'row', alignItems: 'center' },
    weatherTempText: { fontSize: 34, fontWeight: 'bold', color: colors.textMain },
    weatherDescText: { fontSize: 16, fontWeight: '600', color: '#EBEBEB', marginTop: -4, marginLeft: 2, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
    weatherLoadingText: { fontSize: 16, fontWeight: '500', color: colors.textMuted },

    dotsContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
    dotActive: { width: 28, height: 5, borderRadius: 3, backgroundColor: colors.accent, marginHorizontal: 3 },
    dotInactive: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.navInactive, marginHorizontal: 3 },
    actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
    actionContainer: { alignItems: 'center', width: '23%' },
    actionCircle: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 8, shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 2 },
    actionLabel: { textAlign: 'center', fontSize: 12, color: colors.textMain, fontWeight: '600', lineHeight: 16 },
    logHeaderContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
    logHeaderTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textMain },
    seeAllText: { fontSize: 14, color: colors.accent, fontWeight: 'bold' },
    logList: { width: '100%' },
    plantItemContainer: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 24, padding: 16, alignItems: 'center', marginBottom: 14 },
    plantImageWrapper: { width: 80, height: 80, marginRight: 24, position: 'relative' },
    plantImageStackBase: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.navInactive, borderRadius: 16 },
    stackLayer1: { transform: [{ translateX: 6 }, { scaleY: 0.9 }], opacity: 0.35, zIndex: 2 },
    stackLayer2: { transform: [{ translateX: 12 }, { scaleY: 0.8 }], opacity: 0.15, zIndex: 1 },
    plantImageMain: { width: 80, height: 80, borderRadius: 16, zIndex: 3 },
    plantTextContainer: { flex: 1, minHeight: 80, justifyContent: 'space-between', paddingVertical: 2 },
    plantTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textMain, marginBottom: 2 },
    plantSubtitle: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
    plantNeedsRow: { flexDirection: 'row', marginTop: 10 },
    needIconCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
});
