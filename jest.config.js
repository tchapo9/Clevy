module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/assistit_backend/'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-vector-icons|@react-native-async-storage|react-native-safe-area-context|react-native-screens|react-native-gesture-handler|socket.io-client|engine.io-client|engine.io|ws|axios)/)',
  ],
};
