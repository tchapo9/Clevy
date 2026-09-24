/* eslint-env jest */

// AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);

// Vector Icons
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

// WebRTC (module natif non disponible en test)
jest.mock('react-native-webrtc', () => ({
  RTCView: 'RTCView',
  mediaDevices: {
    getUserMedia: jest.fn(() => Promise.reject(new Error('non disponible'))),
    getDisplayMedia: jest.fn(() => Promise.reject(new Error('non disponible'))),
  },
}));

// Navigation (évitent le rendu natif complexe en test)
jest.mock('react-native-screens', () => {
  const RealComponent = jest.requireActual('react-native-screens');
  return {
    ...RealComponent,
    enableScreens: jest.fn(),
  };
});

// Éviter les appels réseau réels pendant les tests
jest.mock('./src/services/socket', () => ({
  __esModule: true,
  default: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    getSocket: jest.fn(() => null),
  },
}));

jest.mock('./src/services/peer', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(() => Promise.resolve('ok')),
    destroy: jest.fn(),
    endCall: jest.fn(),
  },
}));
