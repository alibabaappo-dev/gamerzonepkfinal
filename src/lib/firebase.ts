import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported } from 'firebase/messaging';

// Aapki Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCadL0HXZ4Dgvzisnqy3WoYgfu3WRg6t6Q",
  authDomain: "zahidffweb.firebaseapp.com",
  databaseURL: "https://zahidffweb-default-rtdb.firebaseio.com",
  projectId: "zahidffweb",
  storageBucket: "zahidffweb.firebasestorage.app",
  messagingSenderId: "376801429633",
  appId: "1:376801429633:web:6bce7191f85c991e28e580"
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

/**
 * OPTIMIZED FIRESTORE SETUP
 * Isse data user ke device par save ho jata hai.
 * Dubara fetch karne par server se data nahi mangna parta (Kam Reads = Kam Kharcha).
 */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// Authentication setup
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Storage setup
export const storage = getStorage(app);

// Messaging (Push Notifications) setup
export const messaging = async () => {
  if (typeof window !== 'undefined' && await isSupported()) {
    return getMessaging(app);
  }
  return null;
};

// VAPID Key for web push notifications
export const VAPID_KEY = 'BC4gwoU_67Pas8vPEz3AhS873XPRHmHo0vt9eJCFkUYVc8LRPJejoWica-rcr0feBPPkCzMMld4SVM8eW9qSyA0';

// Device ID Generator for "One Device One Account" feature
export const getDeviceId = () => {
  if (typeof window === 'undefined') return '';
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
};

export const isFirebaseConfigured = true;
