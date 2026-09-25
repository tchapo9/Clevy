import React, { useState } from 'react';
import {
  Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

const RegisterScreen = ({ navigation }: any) => {
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const handleRegister = async () => {
    if (!nom || !email || !password) {
      Alert.alert('Erreur', 'Remplis tous les champs');
      return;
    }
    setLoading(true);
    const result = await register({ nom, email, mot_de_passe: password, role: 'client' });
    setLoading(false);
    if (!result.success) Alert.alert('Erreur', result.error);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Créer un compte</Text>
        <Text style={styles.subtitle}>Inscription en tant que client. Les comptes techniciens sont créés par l'administrateur.</Text>

        <TextInput style={styles.input} placeholder="Nom complet" placeholderTextColor="#666"
          value={nom} onChangeText={setNom} />
        <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#666"
          value={email} onChangeText={(t) => setEmail(t.trim().toLowerCase())} keyboardType="email-address"
          autoCapitalize="none" autoCorrect={false} textContentType="username" />
        <TextInput style={styles.input} placeholder="Mot de passe" placeholderTextColor="#666"
          value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none"
          autoCorrect={false} textContentType="newPassword" />

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>S'inscrire</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Déjà un compte ? <Text style={styles.linkBold}>Se connecter</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  content: { padding: 30, paddingTop: 50 },
  back: { color: '#e94560', fontSize: 16, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 10 },
  subtitle: { color: '#888', fontSize: 13, marginBottom: 25, lineHeight: 18 },
  input: { backgroundColor: '#16213e', borderRadius: 10, padding: 15, fontSize: 16, color: '#fff', marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  button: { backgroundColor: '#e94560', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  link: { color: '#888', textAlign: 'center', marginTop: 20, marginBottom: 30, fontSize: 14 },
  linkBold: { color: '#e94560', fontWeight: 'bold' },
});

export default RegisterScreen;
