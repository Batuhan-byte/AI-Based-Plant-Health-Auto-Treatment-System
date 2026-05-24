import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * ActionIcon — Dashboard'daki yuvarlak hızlı aksiyon butonları.
 * Fidan Bağışı, Akıllı Sulama, Bitki Rehberi, AI Botanist gibi
 * işlevler için kullanılır.
 *
 * @param {{ icon: string, color: string, bg: string, label: string, styles: object, onPress: () => void }} props
 */
export default function ActionIcon({ icon, color, bg, label, styles, onPress }) {
    return (
        <View style={styles.actionContainer}>
            <TouchableOpacity
                style={[styles.actionCircle, { backgroundColor: bg }]}
                onPress={onPress}
                activeOpacity={0.7}
            >
                <MaterialCommunityIcons name={icon} size={28} color={color} />
            </TouchableOpacity>
            <Text style={styles.actionLabel} numberOfLines={2}>{label}</Text>
        </View>
    );
}
