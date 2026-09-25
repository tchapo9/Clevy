import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, Alert, PermissionsAndroid,
} from 'react-native';
import { RTCView } from 'react-native-webrtc';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import peerService from '../services/peer';

const CallScreen = ({ route, navigation }: any) => {
  const { callType = 'video', targetUserId, incoming = false } = route.params || {};
  const [status, setStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [duration, setDuration] = useState(0);
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [muted, setMuted] = useState(false);
  const [videoOn, setVideoOn] = useState(callType === 'video');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<any>(null);

  const cleanup = () => {
    streamRef.current?.getTracks?.().forEach((t: any) => t.stop());
    streamRef.current = null;
    peerService.endCall();
  };

  const fail = (message: string) => {
    cleanup();
    Alert.alert('Appel', message, [{ text: 'OK', onPress: () => navigation.goBack() }]);
  };

  const askPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    const needed = [PermissionsAndroid.PERMISSIONS.CAMERA, PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
    const already = await PermissionsAndroid.check(needed[0]) && await PermissionsAndroid.check(needed[1]);
    if (already) return true;
    const res = await PermissionsAndroid.requestMultiple(needed);
    return needed.every((p) => res[p] === PermissionsAndroid.RESULTS.GRANTED);
  };

  const init = async () => {
    try {
      const ok = await askPermissions();
      if (!ok) {
        fail("Autorisations caméra/micro refusees");
        return;
      }

      const stream = await peerService.getLocalStream(callType === 'video', true);
      streamRef.current = stream;
      setLocalStream(stream);

      if (incoming) {
        const call = peerService.takeIncomingCall();
        if (!call) {
          fail("Appel deja termine");
          return;
        }
        const remote = await peerService.answerCall(call, stream);
        setRemoteStream(remote);
        setStatus('connected');
        return;
      }

      if (!targetUserId) {
        fail("Destinataire inconnu");
        return;
      }

      const remote = await peerService.callUser(targetUserId, stream, callType);
      setRemoteStream(remote);
      setStatus('connected');
    } catch (e: any) {
      fail(e?.message || "Appel impossible");
    }
  };

  useEffect(() => {
    init();
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === 'connected') {
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  const endCall = () => {
    cleanup();
    navigation.goBack();
  };

  const toggleMute = () => {
    const track = localStream?.getAudioTracks?.()[0];
    if (track) track.enabled = muted;
    setMuted(!muted);
  };

  const toggleVideo = () => {
    const track = localStream?.getVideoTracks?.()[0];
    if (track) track.enabled = !videoOn;
    setVideoOn(!videoOn);
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <View style={styles.remote}>
        {remoteStream ? (
          <RTCView streamURL={remoteStream.toURL()} style={styles.video} objectFit="cover" />
        ) : (
          <View style={styles.waiting}>
            <Icon name={status === 'ended' ? 'phone-hangup' : 'phone'} size={60} color="#e94560" />
            <Text style={styles.waitingText}>
              {status === 'connecting'
                ? (incoming ? 'Reception de l\'appel...' : 'Appel en cours...')
                : 'Appel termine'}
            </Text>
            {status === 'connected' && <Text style={styles.timer}>{fmt(duration)}</Text>}
          </View>
        )}
      </View>

      {videoOn && localStream && (
        <View style={styles.pip}>
          <RTCView streamURL={localStream.toURL()} style={styles.video} objectFit="cover" mirror />
        </View>
      )}

      <View style={styles.controls}>
        <TouchableOpacity style={[styles.ctrl, muted && styles.ctrlActive]} onPress={toggleMute}>
          <Icon name={muted ? 'microphone-off' : 'microphone'} size={26} color="#fff" />
        </TouchableOpacity>
        {callType === 'video' && (
          <TouchableOpacity style={[styles.ctrl, !videoOn && styles.ctrlActive]} onPress={toggleVideo}>
            <Icon name={videoOn ? 'video' : 'video-off'} size={26} color="#fff" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.endBtn} onPress={endCall}>
          <Icon name="phone-hangup" size={30} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  remote: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
  video: { width: '100%', height: '100%' },
  waiting: { alignItems: 'center' },
  waitingText: { color: '#fff', fontSize: 18, marginTop: 15, paddingHorizontal: 30, textAlign: 'center' },
  timer: { color: '#888', fontSize: 14, marginTop: 8 },
  pip: { position: 'absolute', top: Platform.OS === 'ios' ? 55 : 35, right: 15, width: 110, height: 150, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: '#fff' },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 20, paddingVertical: 35, paddingBottom: Platform.OS === 'ios' ? 55 : 35, backgroundColor: 'rgba(0,0,0,0.8)' },
  ctrl: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  ctrlActive: { backgroundColor: '#e94560' },
  endBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#dc3545', justifyContent: 'center', alignItems: 'center' },
});

export default CallScreen;
