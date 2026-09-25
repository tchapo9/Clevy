// Installe navigator.mediaDevices + les globaux RTCPeerConnection/MediaStream...
// Sans registerGlobals(), PeerJS ne voit aucun RTCPeerConnection global et
// aborte avec "browser-incompatible".
import { registerGlobals } from 'react-native-webrtc';
import { PEER_CONFIG } from '../config/api';

try {
  registerGlobals();
} catch (e) {
  console.warn('[Peer] registerGlobals impossible:', e);
}

const PEER_ID_PREFIX = 'assistit_';

class PeerService {
  private peer: any = null;
  private currentCall: any = null;
  private pendingIncoming: any = null;
  private userId: number | null = null;
  private creating: Promise<void> | null = null;
  private attempt = 0;

  // Handler global (AppNavigator) : alerte l'utilisateur d'un appel entrant
  public onIncomingCall: ((call: any) => void) | null = null;

  // Créé le Peer au login pour pouvoir RECEVOIR des appels
  initialize(userId: number): Promise<string> {
    this.userId = userId;
    return this.ensurePeer().then(() => `${PEER_ID_PREFIX}${userId}`);
  }

  private ensurePeer(): Promise<void> {
    if (this.peer && !this.peer.destroyed) return Promise.resolve();
    if (this.creating) return this.creating;

    const created: Promise<void> = new Promise<void>((resolve) => {
      try {
        // Import dynamique : evite les erreurs au chargement du bundle
        const PeerConstructor = require('peerjs').default;
        const peer = new PeerConstructor(`${PEER_ID_PREFIX}${this.userId}`, {
          host: PEER_CONFIG.host,
          port: PEER_CONFIG.port,
          path: PEER_CONFIG.path,
          secure: false,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
            ],
          },
        });
        this.peer = peer;

        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          resolve();
        };

        peer.on('open', (id: string) => {
          console.log('[Peer] ouvert:', id);
          this.attempt = 0;
          done();
        });

        peer.on('call', (call: any) => {
          console.log('[Peer] appel entrant de', call.peer);
          this.pendingIncoming = call;
          call.on('close', () => {
            if (this.pendingIncoming === call) this.pendingIncoming = null;
          });
          if (this.onIncomingCall) this.onIncomingCall(call);
        });

        peer.on('error', (err: any) => {
          const type = err?.type || 'unknown';
          console.warn('[Peer] erreur:', type, err?.message || '');
          // Identifiant deja pris (ancienne session pas encore purgee) : on retente
          if (type === 'unavailable-id' && this.attempt < 3) {
            this.attempt += 1;
            this.creating = null;
            try { peer.destroy(); } catch { /* noop */ }
            if (this.peer === peer) this.peer = null;
            setTimeout(() => {
              this.ensurePeer().then(done, done);
            }, 1500 * this.attempt);
            return;
          }
          done();
        });

        // Ne jamais bloquer l'app : on resout au bout de 8s
        setTimeout(done, 8000);
      } catch (e) {
        console.warn('[Peer] creation impossible:', e);
        resolve();
      }
    }).finally(() => {
      this.creating = null;
    });

    this.creating = created;
    return created;
  }

  // L'appel en attente (cote receveur)
  takeIncomingCall(): any {
    const call = this.pendingIncoming;
    this.pendingIncoming = null;
    return call;
  }

  rejectIncomingCall(): any {
    const call = this.takeIncomingCall();
    try {
      call?.close();
    } catch { /* noop */ }
    return call;
  }

  async callUser(targetUserId: number, stream: any, callType = 'video'): Promise<any> {
    await this.ensurePeer();
    if (!this.peer || this.peer.destroyed) throw new Error('Service d\'appel indisponible');

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (err?: Error, remote?: any) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.peer?.off?.('error', onError);
        if (err) reject(err);
        else resolve(remote);
      };

      const onError = (err: any) => {
        const type = err?.type || '';
        if (type === 'peer-unavailable') {
          finish(new Error('Le correspondant n\'est pas en ligne'));
        } else if (type === 'network' || type === 'server-error' || type === 'socket-error') {
          finish(new Error('Connexion perdue'));
        }
      };

      const timer = setTimeout(() => finish(new Error('Pas de réponse')), 25000);
      this.peer.on('error', onError);

      let call: any;
      try {
        call = this.peer.call(`${PEER_ID_PREFIX}${targetUserId}`, stream, {
          metadata: { callType },
        });
      } catch (e: any) {
        finish(new Error(e?.message || 'Echec de l\'appel'));
        return;
      }

      if (!call) {
        finish(new Error('Echec de l\'appel'));
        return;
      }

      this.currentCall = call;
      call.on('stream', (remote: any) => finish(undefined, remote));
      call.on('close', () => finish(new Error('Appel termine')));
      call.on('error', (e: any) => finish(new Error(e?.message || 'Erreur de liaison')));
    });
  }

  async answerCall(call: any, stream: any): Promise<any> {
    call.answer(stream);
    this.currentCall = call;
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (err?: Error, remote?: any) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) reject(err);
        else resolve(remote);
      };
      const timer = setTimeout(() => finish(new Error('Pas de flux distant')), 25000);
      call.on('stream', (remote: any) => finish(undefined, remote));
      call.on('close', () => finish(new Error('Appel termine')));
      call.on('error', (e: any) => finish(new Error(e?.message || 'Erreur de liaison')));
    });
  }

  endCall() {
    try {
      if (this.currentCall && typeof this.currentCall.close === 'function') {
        this.currentCall.close();
      }
    } catch { /* noop */ }
    this.currentCall = null;
  }

  async getLocalStream(video = true, audio = true) {
    const mediaDevices = (globalThis as any).navigator?.mediaDevices;
    if (!mediaDevices?.getUserMedia) {
      throw new Error('Media non disponible sur cet appareil');
    }
    return mediaDevices.getUserMedia({
      audio,
      video: video ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    });
  }

  async getScreenStream() {
    const mediaDevices = (globalThis as any).navigator?.mediaDevices;
    if (!mediaDevices?.getDisplayMedia) {
      throw new Error('Partage d\'ecran non disponible');
    }
    return mediaDevices.getDisplayMedia({ video: true, audio: true });
  }

  destroy() {
    try {
      this.endCall();
      this.rejectIncomingCall();
      if (this.peer && typeof this.peer.destroy === 'function') {
        this.peer.destroy();
      }
    } catch { /* noop */ }
    this.peer = null;
    this.creating = null;
    this.userId = null;
    this.attempt = 0;
  }
}

const peerService = new PeerService();
export default peerService;
