import React from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function MyPlantsScreen() {
    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>My Antigravtye Botanics</Text>
                    <TouchableOpacity style={styles.bellIconContainer}>
                        <MaterialCommunityIcons name="bell-ring-outline" size={26} color="#1A1A1D" />
                        <View style={styles.notificationDot} />
                    </TouchableOpacity>
                </View>

                {/* Botanist Pass Card */}
                <View style={[styles.passCard, styles.shadow]}>
                    <View style={styles.passHeader}>
                        <Text style={styles.passTitle}>Botanist Pass</Text>
                        <Text style={styles.passLogo}>VISA</Text>
                    </View>
                    
                    <Text style={styles.passName}>Alex G. Ravtye</Text>
                    
                    <View style={styles.passFooter}>
                        <Text style={styles.passFooterText}>Total Plants Managed: 42</Text>
                        <Text style={styles.passFooterText}>*4242</Text>
                    </View>
                </View>

                {/* Dots indicator */}
                <View style={styles.dotsContainer}>
                    <View style={styles.dotActive} />
                    <View style={styles.dotInactive} />
                    <View style={styles.dotInactive} />
                    <View style={styles.dotInactive} />
                </View>

                {/* 4 Action Buttons */}
                <View style={styles.actionsRow}>
                    <ActionIcon 
                        icon="watering-can" 
                        color="#B77353" 
                        bg="#EEDCCB" 
                        label={"Add Water\nCredit"} 
                    />
                    <ActionIcon 
                        icon="microscope" 
                        color="#557245" 
                        bg="#E1EAD8" 
                        label={"Analyze\nPlant"} 
                    />
                    <ActionIcon 
                        icon="flower" 
                        color="#C28669" 
                        bg="#EFCFC3" 
                        label={"Add New\nPlant"} 
                    />
                    <ActionIcon 
                        icon="snowflake" 
                        color="#4A757E" 
                        bg="#DCE9E9" 
                        label={"Pause\nCare Plan"} 
                    />
                </View>

                {/* Recent Garden Log Header */}
                <View style={styles.logHeaderContainer}>
                    <Text style={styles.logHeaderTitle}>Recent Garden Log</Text>
                    <TouchableOpacity>
                        <Text style={styles.seeAllText}>See all</Text>
                    </TouchableOpacity>
                </View>

                {/* List Items */}
                <View style={styles.logList}>
                    <LogItem 
                        icon="shovel" 
                        iconBg="#EEDCCB" 
                        iconColor="#B77353" 
                        title="Amazon Payment" 
                        subtitle="Plant Repotting" 
                        amount="$15.00" 
                    />
                    <LogItem 
                        icon="leaf" 
                        iconBg="#E1EAD8" 
                        iconColor="#557245" 
                        title="Apple Subscription" 
                        subtitle="New Monstera Acquired" 
                        amount="$75.00" 
                    />
                    <LogItem 
                        icon="sack" 
                        iconBg="#EFCFC3" 
                        iconColor="#B77353" 
                        title="Github Premium" 
                        subtitle="Fertilizer Purchase" 
                        amount="$12.00" 
                    />
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

function ActionIcon({ icon, color, bg, label }) {
    return (
        <View style={styles.actionContainer}>
            <TouchableOpacity style={[styles.actionCircle, { backgroundColor: bg }]}>
                <MaterialCommunityIcons name={icon} size={28} color={color} />
            </TouchableOpacity>
            <Text style={styles.actionLabel} numberOfLines={2}>
                {label}
            </Text>
        </View>
    );
}

function LogItem({ icon, iconBg, iconColor, title, subtitle, amount }) {
    return (
        <TouchableOpacity style={styles.logItemContainer}>
            <View style={[styles.logIconBox, { backgroundColor: iconBg }]}>
                <MaterialCommunityIcons name={icon} size={26} color={iconColor} />
            </View>
            <View style={styles.logTextContainer}>
                <Text style={styles.logTitle}>{title}</Text>
                <Text style={styles.logSubtitle}>{subtitle}</Text>
            </View>
            <Text style={styles.logAmount}>{amount}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F5F5F7', // Modern white background
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 120, // Space for floating tab bar
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 24,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1A1A1D',
        letterSpacing: -0.5,
    },
    bellIconContainer: {
        position: 'relative',
    },
    notificationDot: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#648754', // Botanical Olive Green
        borderWidth: 2,
        borderColor: '#F5F5F7',
    },
    passCard: {
        backgroundColor: '#FFFFFF', // Pure modern white tones
        borderRadius: 24,
        padding: 24,
        marginBottom: 20,
    },
    shadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 15,
        elevation: 5,
    },
    passHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    passTitle: {
        color: '#8E8E93',
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    passLogo: {
        color: '#648754', // Botanical Olive Green
        fontSize: 20,
        fontWeight: 'bold',
        fontStyle: 'italic',
    },
    passName: {
        color: '#1A1A1D',
        fontSize: 24,
        fontWeight: '700',
        letterSpacing: 0.5,
        marginBottom: 30,
    },
    passFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    passFooterText: {
        color: '#8E8E93',
        fontSize: 14,
        fontWeight: '500',
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
    },
    dotActive: {
        width: 28,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#648754', // Botanical Olive Green
        marginHorizontal: 3,
    },
    dotInactive: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#C7C7CC',
        marginHorizontal: 3,
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
        paddingHorizontal: 0,
    },
    actionContainer: {
        alignItems: 'center',
        width: '23%',
    },
    actionCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        shadowColor: '#648754', // Botanical Olive Green shadow
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 2,
    },
    actionLabel: {
        textAlign: 'center',
        fontSize: 12,
        color: '#1A1A1D',
        fontWeight: '600',
        lineHeight: 16,
    },
    logHeaderContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 16,
    },
    logHeaderTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1A1A1D',
    },
    seeAllText: {
        fontSize: 14,
        color: '#648754', // Botanical Olive Green
        fontWeight: 'bold',
    },
    logList: {
        width: '100%',
    },
    logItemContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    logIconBox: {
        width: 50,
        height: 50,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    logTextContainer: {
        flex: 1,
    },
    logTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1A1A1D',
        marginBottom: 4,
    },
    logSubtitle: {
        fontSize: 13,
        color: '#8E8E93',
        fontWeight: '500',
    },
    logAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1A1A1D',
    },
});
