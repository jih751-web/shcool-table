import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
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
  isLoggingIn: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<Teacher | null>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, Teacher>>({});
  const [loading, setLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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

    // 3. 리다이렉트 결과 처리 (모바일용)
    getRedirectResult(auth)
      .then(() => {
        setIsLoggingIn(false);
      })
      .catch((error) => {
        setIsLoggingIn(false);
        if (error.code !== 'auth/redirect-cancelled-by-user') {
          console.error("Redirect login result error:", error);
        }
      });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const signInWithGoogle = async () => {
    if (isLoggingIn) return;
    
    try {
      setIsLoggingIn(true);
      // 모바일 기기 또는 인앱 브라우저 판별 (더 넓은 범위의 모바일 UA 체크)
      const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isInApp = /KAKAOTALK|NAVER|Instagram|Line|FBAN|FBAV/i.test(navigator.userAgent);

      if (isMobile || isInApp) {
        // 모바일은 무조건 리다이렉트 방식 (팝업 차단 및 403 에러 방지용)
        console.log("Forcing Redirect Login for Mobile/In-App environment");
        await signInWithRedirect(auth, googleProvider);
      } else {
        await signInWithPopup(auth, googleProvider);
        setIsLoggingIn(false);
      }
    } catch (error: any) {
      setIsLoggingIn(false);
      console.error("Google sign in failed:", error);
      
      if (error.code === 'auth/popup-blocked') {
        alert('구글 로그인 팝업이 차단되었습니다. 브라우저 설정에서 팝업 차단을 해제하거나 리다이렉트 방식을 사용해 주세요.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        // 사용자가 팝업을 닫음 - 알림 불필요
      } else {
        alert(`구글 로그인 창을 여는 중 문제가 발생했습니다: ${error.message}\n브라우저의 팝업 차단 설정을 확인해 주세요.`);
      }
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
    <AuthContext.Provider value={{ user, userData, userProfiles, loading, signInWithGoogle, logout, updateNickname, isLoggingIn }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
