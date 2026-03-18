import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Ekranları içeri aktar
import TabNavigator from './src/navigation/TabNavigator';
import CameraScreen from './src/screens/CameraScreen';

const Stack = createNativeStackNavigator();

export default function App() {
    return (
        <NavigationContainer>
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
