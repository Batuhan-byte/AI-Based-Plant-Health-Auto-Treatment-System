import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config';

const AuthContext = createContext();

const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Uygulama başlarken aktif oturumu yükle
    useEffect(() => {
        const loadSession = async () => {
            try {
                // Otomatik giriş devre dışı bırakıldı. Uygulama her açıldığında giriş ekranı gösterilecek.
                await AsyncStorage.removeItem('userSession');
            } catch (err) {
                console.log('Oturum yükleme hatası:', err);
            } finally {
                setLoading(false);
            }
        };
        loadSession();
    }, []);

    // Giriş Yap
    const login = async (email, password, rememberMe) => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json();

            if (data.basarili) {
                await AsyncStorage.setItem('userSession', JSON.stringify(data.user));
                
                if (rememberMe) {
                    await AsyncStorage.setItem('savedEmail', email);
                    await AsyncStorage.setItem('savedPassword', password);
                    await AsyncStorage.setItem('rememberMe', 'true');
                } else {
                    await AsyncStorage.removeItem('savedEmail');
                    await AsyncStorage.removeItem('savedPassword');
                    await AsyncStorage.removeItem('rememberMe');
                }
                
                setUser(data.user);
                return { basarili: true };
            } else {
                return { basarili: false, hata: data.hata || 'Giriş yapılamadı.' };
            }
        } catch (err) {
            console.log('Giriş API Hatası:', err);
            return { basarili: false, hata: 'Sunucuya bağlanılamadı. Lütfen ağınızı kontrol edin.' };
        }
    };

    // Kayıt Ol
    const register = async (name, email, password) => {
        try {
            const response = await fetch(`${API_BASE}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });
            const data = await response.json();

            if (data.basarili) {
                await AsyncStorage.setItem('userSession', JSON.stringify(data.user));
                setUser(data.user);
                return { basarili: true };
            } else {
                return { basarili: false, hata: data.hata || 'Kayıt yapılamadı.' };
            }
        } catch (err) {
            console.log('Kayıt API Hatası:', err);
            return { basarili: false, hata: 'Sunucuya bağlanılamadı. Lütfen ağınızı kontrol edin.' };
        }
    };

    // Misafir Girişi
    const guestLogin = async () => {
        try {
            // Cihaz için kayıtlı UUID var mı kontrol et, yoksa üret
            let deviceUuid = await AsyncStorage.getItem('guestDeviceUuid');
            if (!deviceUuid) {
                deviceUuid = generateUUID();
                await AsyncStorage.setItem('guestDeviceUuid', deviceUuid);
            }

            const response = await fetch(`${API_BASE}/api/auth/guest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceUuid }),
            });
            const data = await response.json();

            if (data.basarili) {
                await AsyncStorage.setItem('userSession', JSON.stringify(data.user));
                setUser(data.user);
                return { basarili: true };
            } else {
                return { basarili: false, hata: data.hata || 'Misafir oturumu açılamadı.' };
            }
        } catch (err) {
            console.log('Misafir Giriş API Hatası:', err);
            return { basarili: false, hata: 'Sunucuya bağlanılamadı. Lütfen ağınızı kontrol edin.' };
        }
    };

    // Hesabı Yükselt (Misafir -> Kayıtlı Üye)
    const upgrade = async (name, email, password) => {
        try {
            if (!user || user.user_type !== 'guest') {
                return { basarili: false, hata: 'Aktif bir misafir oturumu bulunamadı.' };
            }

            const response = await fetch(`${API_BASE}/api/auth/upgrade`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceUuid: user.uuid,
                    name,
                    email,
                    password
                }),
            });
            const data = await response.json();

            if (data.basarili) {
                await AsyncStorage.setItem('userSession', JSON.stringify(data.user));
                setUser(data.user);
                return { basarili: true };
            } else {
                return { basarili: false, hata: data.hata || 'Hesap yükseltilemedi.' };
            }
        } catch (err) {
            console.log('Yükseltme API Hatası:', err);
            return { basarili: false, hata: 'Sunucuya bağlanılamadı. Lütfen ağınızı kontrol edin.' };
        }
    };

    // Çıkış Yap
    const logout = async () => {
        try {
            await AsyncStorage.removeItem('userSession');
            setUser(null);
        } catch (err) {
            console.log('Oturum kapatma hatası:', err);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, guestLogin, upgrade, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
