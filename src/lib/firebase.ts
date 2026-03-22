import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCDkHxmTpuBZnofBw-AlXoNPHdYaqyMr6U",
  authDomain: "school-timetable-52253.firebaseapp.com",
  projectId: "school-timetable-52253",
  storageBucket: "school-timetable-52253.firebasestorage.app",
  messagingSenderId: "155228291196",
  appId: "1:155228291196:web:972584e8b620b9b89989f9",
  measurementId: "G-F0NXHWFD3L"
};

// 싱글톤 패턴으로 초기화 (HMR 등으로 인한 중복 초기화 방지)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// 명시적으로 세션 유지 설정 (모바일 무한 로그인 루프 방지)
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Firebase persistence error:", err);
});

export const googleProvider = new GoogleAuthProvider();
