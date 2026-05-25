import Constants from 'expo-constants';

// Backend API URL (Otomatik IP Tespiti)
// expo-constants sayesinde fiziksel cihazda (Expo Go) test yaparken IP adresi otomatik olarak tespit edilir.
const hostUri = Constants.expoConfig?.hostUri;
const ip = hostUri ? hostUri.split(':').shift() : '192.168.1.157';
export const API_BASE = `http://${ip}:3000`;
