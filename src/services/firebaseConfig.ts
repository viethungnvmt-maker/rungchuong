import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, update, remove, push } from 'firebase/database';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// Firebase config - người dùng sẽ nhập thông tin này qua Settings
// Hoặc hardcode nếu dự án cố định
const firebaseConfig = {
  apiKey: "AIzaSyCmtTwz2-nJCJsgD287ma7PfiDFxr86sd0",
  authDomain: "runchuongvang-a4045.firebaseapp.com",
  databaseURL: "https://runchuongvang-a4045-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "runchuongvang-a4045",
  storageBucket: "runchuongvang-a4045.firebasestorage.app",
  messagingSenderId: "668956986075",
  appId: "1:668956986075:web:0a2d338c9bf9b5ade5dafe"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

// Đăng nhập ẩn danh để có userId
let currentUserId: string | null = null;

const authReady = new Promise<string>((resolve) => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUserId = user.uid;
      resolve(user.uid);
    }
  });
  signInAnonymously(auth).catch((error) => {
    console.error('[Firebase] Auth error:', error);
    // Fallback: dùng random ID nếu auth fail
    currentUserId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    resolve(currentUserId);
  });
});

export function getCurrentUserId(): string {
  return currentUserId || `anon_${Date.now()}`;
}

export async function waitForAuth(): Promise<string> {
  return authReady;
}

export { database, auth, ref, set, get, onValue, update, remove, push };
