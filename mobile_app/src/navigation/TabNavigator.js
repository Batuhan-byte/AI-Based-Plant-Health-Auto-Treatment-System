import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import MyPlantsScreen from '../screens/MyPlantsScreen';
import CommunityScreen from '../screens/CommunityScreen';
import SearchScreen from '../screens/SearchScreen';
import MenuScreen from '../screens/MenuScreen';
import CameraScreen from '../screens/CameraScreen';

const Tab = createBottomTabNavigator();

const CustomTabBarButton = ({ children, onPress }) => (
    <TouchableOpacity
        style={styles.customTabBarButtonContainer}
        onPress={onPress}
        activeOpacity={0.8}
    >
        <View style={styles.customTabBarButton}>
            {children}
        </View>
    </TouchableOpacity>
);

export default function TabNavigator() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: false, // İsimler kapalı
                tabBarStyle: styles.tabBar,
                tabBarActiveTintColor: '#648754', // Botanik Yeşil (Aktif)
                tabBarInactiveTintColor: '#CFCFCF', // Açık Gri (Pasif)
                tabBarItemStyle: {
                    // Ekstra paddingler iptal edildi, ikonlar otomatik dikey ortalanacak
                    paddingTop: 0, 
                    paddingBottom: 0,
                    justifyContent: 'center',
                    alignItems: 'center',
                }
            }}
        >
            <Tab.Screen
                name="MyPlants"
                component={MyPlantsScreen}
                options={{
                    tabBarIcon: ({ color }) => (
                        <MaterialCommunityIcons name="home-variant" color={color} size={30} />
                    ),
                }}
            />
            <Tab.Screen
                name="Stats"
                component={CommunityScreen}
                options={{
                    tabBarIcon: ({ color }) => (
                        <MaterialCommunityIcons name="chart-bar" color={color} size={28} />
                    ),
                }}
            />
            
            {/* Merkezdeki Vurgulu Buton */}
            <Tab.Screen
                name="CenterAction"
                component={CameraScreen}
                options={{
                    tabBarIcon: () => (
                        <MaterialCommunityIcons name="sprout" color="#FFFFFF" size={34} />
                    ),
                    tabBarButton: (props) => (
                        <CustomTabBarButton {...props} />
                    )
                }}
            />

            <Tab.Screen
                name="Logs"
                component={SearchScreen}
                options={{
                    tabBarIcon: ({ color }) => (
                        <MaterialCommunityIcons name="file-document-outline" color={color} size={26} />
                    ),
                }}
            />
            <Tab.Screen
                name="Profile"
                component={MenuScreen}
                options={{
                    tabBarIcon: ({ color }) => (
                        <MaterialCommunityIcons name="account-outline" color={color} size={30} />
                    ),
                }}
            />
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        // En alt kısma tamamen yaslı / sıfır oturur
        backgroundColor: '#FFFFFF',
        height: Platform.OS === 'ios' ? 85 : 70, // Doğal yüksekliği
        borderTopWidth: 0, // Üst çizgiyi kaldır
        borderTopRightRadius: 20, // Üst köşelere hafif yumuşaklık
        borderTopLeftRadius: 20,
        // Dışarı taşan ince gölge:
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 10, 
    },
    customTabBarButtonContainer: {
        top: -25, // Ortadaki yuvarlağı dışarı/yukarı taşır
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#648754',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
    customTabBarButton: {
        width: 66,
        height: 66,
        borderRadius: 33, // Tam yuvarlak yapı
        backgroundColor: '#648754', // Botanik Yeşil arka plan
        justifyContent: 'center',
        alignItems: 'center',
    }
});
