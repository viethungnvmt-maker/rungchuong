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

const authReady = new Promise<string>((resolve, reject) => {
  let settled = false;
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (!user || settled) return;
    currentUserId = user.uid;
    settled = true;
    unsubscribe();
    resolve(user.uid);
  });

  signInAnonymously(auth).catch((error: any) => {
    console.error('[Firebase] Auth error:', error);

    if (settled) return;
    settled = true;
    unsubscribe();

    const code = error?.code || '';
    const message =
      code === 'auth/admin-restricted-operation' || code === 'auth/operation-not-allowed'
        ? 'Firebase Anonymous Authentication chưa được bật cho project mới. Hãy vào Authentication > Sign-in method > Anonymous rồi bật Enable.'
        : `Không thể đăng nhập ẩn danh vào Firebase${code ? ` (${code})` : ''}.`;

    reject(new Error(message));
  });
});

export function getCurrentUserId(): string {
  return currentUserId || '';
}

export async function waitForAuth(): Promise<string> {
  return authReady;
}

export { database, auth, ref, set, get, onValue, update, remove, push };
