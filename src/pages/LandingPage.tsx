import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';

const LandingPage: React.FC = () => {
  const { user, signInWithGoogle } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-brand-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-brand-100">
        <div className="bg-brand-600 p-8 text-center text-white">
          <CalendarDays className="w-16 h-16 mx-auto mb-4 opacity-90" />
          <h1 className="text-2xl font-bold mb-2">지능형 시간표 교체 시스템</h1>
          <p className="text-brand-100 text-sm">학교 학사 일정 및 스마트한 상호 공강 매칭</p>
        </div>
        <div className="p-8 text-center">
          <p className="text-slate-600 mb-8 font-medium">
            원활한 시간표 교체와 자동 알림을 위해<br />
            <strong className="text-slate-800">로그인 후 이용해주세요.</strong>
          </p>
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
            구글 계정으로 로그인하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
