import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, update, remove, push } from 'firebase/database';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// Firebase config - người dùng sẽ nhập thông tin này qua Settings
// Hoặc hardcode nếu dự án cố định
const firebaseConfig = {
  apiKey: "AIzaSyAewJT84LXz0Nja9iRjAOQdi-zfJJEskxc",
  authDomain: "rung-chuong-vang-c5dd8.firebaseapp.com",
  databaseURL: "https://rung-chuong-vang-c5dd8-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "rung-chuong-vang-c5dd8",
  storageBucket: "rung-chuong-vang-c5dd8.firebasestorage.app",
  messagingSenderId: "334744109274",
  appId: "1:334744109274:web:7680f8200c931848fce5e3",
  measurementId: "G-6HY4DMN0ZM"
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
