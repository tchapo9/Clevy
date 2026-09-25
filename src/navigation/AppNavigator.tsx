import React, { useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import peerService from '../services/peer';

// Écrans
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import TicketDetailScreen from '../screens/TicketDetailScreen';
import ChatScreen from '../screens/ChatScreen';
import CallScreen from '../screens/CallScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NewTicketScreen from '../screens/NewTicketScreen';

import { ActivityIndicator, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const COLORS = {
  primary: '#1a1a2e',
  secondary: '#16213e',
  accent: '#e94560',
  white: '#fff',
};

const loadingStyle = {
  flex: 1,
  justifyContent: 'center' as const,
  alignItems: 'center' as const,
  backgroundColor: COLORS.primary,
};

// ===== Auth Stack =====
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
  </Stack.Navigator>
);

// ===== Home Stack =====
const HomeStack = () => (
  <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: COLORS.white }}>
    <Stack.Screen name="HomeMain" component={HomeScreen} options={{ title: 'Assist\'IT' }} />
    <Stack.Screen name="NewTicket" component={NewTicketScreen} options={{ title: 'Nouvelle demande' }} />
    <Stack.Screen name="TicketDetail" component={TicketDetailScreen} options={{ title: 'Détails' }} />
    <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
    <Stack.Screen name="Call" component={CallScreen} options={{ headerShown: false }} />
  </Stack.Navigator>
);

// ===== Tabs =====
const tabIcon = (name: string) =>
  ({ color, size }: { color: string; size: number }) => (
    <Icon name={name} size={size} color={color} />
  );

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: COLORS.accent,
      tabBarInactiveTintColor: '#666',
      tabBarStyle: { backgroundColor: COLORS.secondary, borderTopWidth: 0 },
    }}>
    <Tab.Screen name="Home" component={HomeStack} options={{ tabBarIcon: tabIcon('home') }} />
    <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'Historique', tabBarIcon: tabIcon('history') }} />
    <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil', tabBarIcon: tabIcon('account') }} />
  </Tab.Navigator>
);

// ===== Root =====
const navigationRef = createNavigationContainerRef<any>();

const AppNavigator = () => {
  const { user, loading } = useAuth();

  // Appels entrants : on demande a l'utilisateur de repondre
  useEffect(() => {
    if (!user) return;
    peerService.onIncomingCall = (call: any) => {
      const callType = call?.metadata?.callType || 'video';
      Alert.alert(
        'Appel entrant',
        callType === 'audio' ? 'Appel audio' : 'Appel video',
        [
          {
            text: 'Refuser',
            style: 'cancel',
            onPress: () => peerService.rejectIncomingCall(),
          },
          {
            text: 'Repondre',
            onPress: () => {
              if (navigationRef.isReady()) {
                navigationRef.navigate('Home', {
                  screen: 'Call',
                  params: { incoming: true, callType },
                });
              } else {
                peerService.rejectIncomingCall();
              }
            },
          },
        ],
        { cancelable: false },
      );
    };
    return () => { peerService.onIncomingCall = null; };
  }, [user]);

  if (loading) {
    return (
      <View style={loadingStyle}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {user ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default AppNavigator;
