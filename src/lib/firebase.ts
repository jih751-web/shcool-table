import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCDkHxmTpuBZnofBw-AlXoNPHdYaqyMr6U",
  authDomain: "school-timetable-52253.firebaseapp.com",
  projectId: "school-timetable-52253",
  storageBucket: "school-timetable-52253.firebasestorage.app",
  messagingSenderId: "155228291196",
  appId: "1:155228291196:web:972584e8b620b9b89989f9",
  measurementId: "G-F0NXHWFD3L"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
