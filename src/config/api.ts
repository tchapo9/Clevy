import { Platform } from 'react-native';

const LAN_HOST = '192.168.1.4';

const API_BASE = Platform.select({
  android: `http://${LAN_HOST}:4000`,
  ios: 'http://localhost:4000',
  default: 'http://localhost:4000',
});

const SOCKET_URL = API_BASE;

const PEER_CONFIG = Platform.select({
  // le path doit se terminer par "/" (le client peerjs append "peerjs")
  android: { host: LAN_HOST, port: 4000, path: '/peerjs/' },
  ios: { host: 'localhost', port: 4000, path: '/peerjs/' },
  default: { host: 'localhost', port: 4000, path: '/peerjs/' },
});

const MINIO_URL = Platform.select({
  android: `http://${LAN_HOST}:9000/assistit-files`,
  ios: 'http://localhost:9000/assistit-files',
  default: 'http://localhost:9000/assistit-files',
});

export { API_BASE, SOCKET_URL, PEER_CONFIG, MINIO_URL };
