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

    // 2. 인증 상태 변경 감지
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("Auth State Changed:", currentUser ? `Logged in: ${currentUser.email}` : "Logged out");
      setUser(currentUser);
      setIsLoggingIn(false);
      
      if (currentUser) {
        // 현재 로그인한 사용자의 상세 정보 구독
        unsubProfile = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as Teacher;
            
            // 차단된 유저 처리
            if (data.isBlocked) {
              alert("관리자에 의해 접근이 제한된 계정입니다.");
              signOut(auth);
              return;
            }
            
            setUserData(data);
          } else {
            // 신규 사용자 초기화
            const initialData: Teacher = {
              uid: currentUser.uid,
              name: currentUser.displayName || '',
              email: currentUser.email || '',
              isBlocked: false,
              isAdmin: currentUser.email === 'jih751@gmail.com' || currentUser.email === 'test@example.com' // 초기 관리자 권한 부여
            };
            
            setDoc(doc(db, 'users', currentUser.uid), initialData);
            setUserData(initialData);
          }
        });
      } else {
        setUserData(null);
        if (unsubProfile) unsubProfile();
      }
      
      setLoading(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const signInWithGoogle = async () => {
    // 팝업 차단 방지: 클릭 직후 어떠한 비동기(await)나 지연 없이 즉각 실행
    try {
      // 팝업 실행 시점에 즉시 auth 함수 호출
      const result = await signInWithPopup(auth, googleProvider);
      console.log("Sign in successful:", result.user.email);
      setIsLoggingIn(true); // 로딩 상태는 팝업 성공 이후에 표시 (이미 늦었으므로)
    } catch (error: any) {
      console.error("Google sign in failed:", error);
      setIsLoggingIn(false);
      
      if (error.code === 'auth/popup-blocked') {
        alert('브라우저의 [팝업 차단] 설정이 활성화되어 있습니다. 브라우저 상단/하단의 알림창을 눌러 [팝업 허용]을 선택해 주세요.');
      } else if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        // 사용자 취소 - 무시
      } else {
        alert(`로그인 중 문제가 발생했습니다: ${error.message}`);
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
