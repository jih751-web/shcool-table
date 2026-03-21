import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, googleProvider, db } from '../lib/firebase';
import { doc, onSnapshot, setDoc, collection } from 'firebase/firestore';
import type { Teacher } from '../types';

interface AuthContextType {
  user: User | null;
  userData: Teacher | null;
  userProfiles: Record<string, Teacher>; // UID -> Teacher (nickname 포함)
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateNickname: (nickname: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<Teacher | null>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, Teacher>>({});
  const [loading, setLoading] = useState(true);

  // 1. 전체 사용자 프로필 실시간 구독 (닉네임 전역 반영을 위해)
  useEffect(() => {
    const unsubAllProfiles = onSnapshot(collection(db, 'users'), (snap) => {
      const profiles: Record<string, Teacher> = {};
      snap.forEach(doc => {
        profiles[doc.id] = doc.data() as Teacher;
      });
      setUserProfiles(profiles);
    });
    return () => unsubAllProfiles();
  }, []);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // 현재 로그인한 사용자의 상세 정보 구독
        unsubProfile = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setUserData(docSnap.data() as Teacher);
          } else {
            setUserData({
              uid: currentUser.uid,
              name: currentUser.displayName || '',
              email: currentUser.email || '',
            });
          }
        });
      } else {
        setUserData(null);
        if (unsubProfile) unsubProfile();
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Google sign in failed:", error);
      alert('Google 로그인에 실패했습니다. 팝업 차단을 해제하거나 네트워크 연결을 확인해주세요.');
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const updateNickname = async (nickname: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        nickname,
        uid: user.uid,
        name: user.displayName || '',
        email: user.email || ''
      }, { merge: true });
    } catch (error) {
      console.error("Update nickname failed:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, userProfiles, loading, signInWithGoogle, logout, updateNickname }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
