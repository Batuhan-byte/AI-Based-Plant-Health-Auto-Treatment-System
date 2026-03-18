import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from './src/theme/colors';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

// Ekranları içeri aktar
import TabNavigator from './src/navigation/TabNavigator';
import CameraScreen from './src/screens/CameraScreen';

const Stack = createNativeStackNavigator();

function AppContent() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const colors = isDark ? Colors.dark : Colors.light;

    // React Navigation'ın arka plan sızıntılarını (beyaz köşeler vb.) önlemek için custom tema
    const MyNavigationTheme = {
        ...(isDark ? DarkTheme : DefaultTheme),
        colors: {
            ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
            background: colors.background,
        },
    };

    return (
        <NavigationContainer theme={MyNavigationTheme}>
            <StatusBar style={colors.statusBar} backgroundColor={colors.background} />
            <Stack.Navigator
                initialRouteName="MainTabs"
                screenOptions={{ headerShown: false }}
            >
                <Stack.Screen
                    name="MainTabs"
                    component={TabNavigator}
                />
                <Stack.Screen
                    name="Camera"
                    component={CameraScreen}
                    options={{ title: 'Hastalık Teşhisi', headerShown: true }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}

export default function App() {
    return (
        <ThemeProvider>
            <AppContent />
        </ThemeProvider>
    );
}
