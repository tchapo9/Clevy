import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOCKET_URL } from '../config/api';

class SocketService {
  private socket: Socket | null = null;
  private joinedTickets = new Set<number>();

  async connect() {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      if (this.socket?.connected) return;

      this.socket?.disconnect();
      this.socket = io(SOCKET_URL, {
        transports: ['websocket'],
        // Reconnexion automatique : sans elle, un simple coupure de transport
        // tuait le chat et les notifications jusqu'au redémarrage de l'app
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.3,
        timeout: 10000,
      });

      this.socket.on('connect', async () => {
        console.log('🔌 Socket connecté');
        const t = await AsyncStorage.getItem('token');
        if (!t) return;
        this.socket?.emit('authenticate', t);
        // Re-rejoindre les rooms des tickets suivis après chaque reconnexion
        this.joinedTickets.forEach((id) => this.socket?.emit('join-ticket', id));
      });

      this.socket.on('disconnect', (reason) => {
        console.log('🔌 Socket déconnecté:', reason);
      });

      this.socket.on('connect_error', (err) => {
        console.warn('🔌 Socket error:', err.message);
      });
    } catch (e) {
      console.warn('Socket connect error:', e);
    }
  }

  disconnect() {
    try {
      this.joinedTickets.clear();
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
      }
    } catch (e) {
      console.warn('Socket disconnect error:', e);
    }
    this.socket = null;
  }

  joinTicket(ticketId: number) {
    this.joinedTickets.add(ticketId);
    this.socket?.emit('join-ticket', ticketId);
  }

  leaveTicket(ticketId: number) {
    this.joinedTickets.delete(ticketId);
    this.socket?.emit('leave-ticket', ticketId);
  }

  sendMessage(ticketId: number, message: any) {
    this.socket?.emit('chat-message', { ticketId, message });
  }

  startTyping(ticketId: number, userId: number) {
    this.socket?.emit('typing', { ticketId, userId });
  }

  stopTyping(ticketId: number, userId: number) {
    this.socket?.emit('stop-typing', { ticketId, userId });
  }

  callUser(targetUserId: number, signal: any, callType: string) {
    this.socket?.emit('call-user', { targetUserId, signal, callType });
  }

  acceptCall(targetUserId: number, signal: any) {
    this.socket?.emit('accept-call', { targetUserId, signal });
  }

  rejectCall(targetUserId: number) {
    this.socket?.emit('reject-call', { targetUserId });
  }

  endCall(targetUserId: number) {
    this.socket?.emit('end-call', { targetUserId });
  }

  startScreenShare(ticketId: number) {
    this.socket?.emit('screen-share-start', { ticketId });
  }

  stopScreenShare(ticketId: number) {
    this.socket?.emit('screen-share-stop', { ticketId });
  }

  on(event: string, callback: Function) {
    this.socket?.on(event, callback as any);
  }

  off(event: string, callback?: Function) {
    if (callback) {
      this.socket?.off(event, callback as any);
    } else {
      this.socket?.removeAllListeners(event);
    }
  }

  getSocket() {
    return this.socket;
  }
}

const socketService = new SocketService();
export default socketService;
