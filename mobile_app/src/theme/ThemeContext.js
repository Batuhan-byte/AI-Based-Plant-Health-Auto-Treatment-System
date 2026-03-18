import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme, LayoutAnimation, Platform, UIManager } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    const systemColorScheme = useColorScheme();
    const [theme, setTheme] = useState(systemColorScheme || 'light');

    useEffect(() => {
        if (systemColorScheme) {
            setTheme(systemColorScheme);
        }
    }, [systemColorScheme]);

    const toggleTheme = () => {
        // En profesyonel, sıfır-lag native GPU Crossfade animasyonu
        const customAnimation = {
            duration: 400, // 400ms yumuşakça akışkan geçiş
            create: {
                type: LayoutAnimation.Types.easeInEaseOut,
                property: LayoutAnimation.Properties.opacity,
            },
            update: {
                type: LayoutAnimation.Types.easeInEaseOut,
                property: LayoutAnimation.Properties.opacity, // Sadece saydamlık üzerinden renklerin birbirine karışmasını sağlar
            },
            delete: {
                type: LayoutAnimation.Types.easeInEaseOut,
                property: LayoutAnimation.Properties.opacity,
            },
        };

        LayoutAnimation.configureNext(customAnimation);
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
