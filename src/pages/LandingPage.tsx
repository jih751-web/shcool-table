import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { CalendarDays, AlertCircle, ClipboardCheck, Copy } from 'lucide-react';

const LandingPage: React.FC = () => {
  const { user, signInWithGoogle, isLoggingIn } = useAuth();
  const [isKakaoIOS, setIsKakaoIOS] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    
    const ua = navigator.userAgent;
    const isKakao = /KAKAOTALK/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);

    if (isKakao) {
      if (isAndroid) {
        // 안드로이드 카카오톡: 크롬으로 자동 탈출
        try {
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.set('from_kakaotalk', 'true');
          const encodedUrl = currentUrl.href.replace(/https?:\/\//i, '');
          window.location.href = `intent://${encodedUrl}#Intent;scheme=https;package=com.android.chrome;end;`;
        } catch (e) {
          console.error('Failed to escape KakaoTalk:', e);
        }
      } else if (isIOS) {
        // iOS 카카오톡: 안내 팝업 표시
        setIsKakaoIOS(true);
      }
    }
  }, []);

  const handleCopyUrl = async () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      alert('주소 복사에 실패했습니다. 직접 주소창을 길게 눌러 복사해 주세요.');
    }
  };

  if (user) {
    return (
      <div className="min-h-screen bg-brand-50 flex flex-col items-center justify-center p-4">
        <div className="text-center animate-in fade-in zoom-in duration-500">
          <div className="w-16 h-16 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-black text-slate-800 mb-2">반갑습니다! ✨</h2>
          <p className="text-slate-500 font-bold">대시보드로 안전하게 이동 중입니다...</p>
        </div>
        <Navigate to="/dashboard" replace />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-200/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-200/20 rounded-full blur-[100px] pointer-events-none" />

      {/* iOS KakaoTalk Guidance Overlay */}
      {isKakaoIOS && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-500">
          <div className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl overflow-hidden border-4 border-rose-500 animate-in zoom-in-95 duration-700">
            <div className="bg-rose-500 p-8 text-center text-white">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 animate-bounce" />
              <h3 className="text-2xl font-black tracking-tight leading-tight">
                카카오톡에서는<br />구글 로그인이 제한됩니다!
              </h3>
            </div>
            <div className="p-10 text-center">
              <p className="text-slate-700 font-bold text-lg mb-8 leading-relaxed">
                화면 오른쪽 아래의 <span className="bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">더보기(⋮)</span> 버튼을 누르고<br />
                <span className="text-rose-600 underline underline-offset-4 decoration-2 font-black">`Safari로 열기`</span>를<br />선택해 주세요! 🚀
              </p>
              
              <button
                onClick={handleCopyUrl}
                className={`w-full py-5 rounded-3xl font-black transition-all flex items-center justify-center gap-3 border-2 mb-4 text-lg ${
                  copied 
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-600' 
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 shadow-inner'
                }`}
              >
                {copied ? (
                  <>복사 완료! <ClipboardCheck className="w-6 h-6" /></>
                ) : (
                  <>현재 주소 복사하기 <Copy className="w-6 h-6" /></>
                )}
              </button>

              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Ulleung Middle School</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-brand-100 relative z-[20] animate-in zoom-in-95 duration-500">
        <div className="bg-brand-600 p-10 text-center text-white relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
          <CalendarDays className="w-20 h-20 mx-auto mb-6 opacity-95 animate-bounce-subtle" />
          <h1 className="text-3xl font-black mb-3 tracking-tighter text-white">울릉중학교</h1>
          <p className="text-brand-100 text-sm font-bold opacity-80 uppercase tracking-widest text-[11px]">지능형 시간표 관리 시스템</p>
        </div>
        
        <div className="p-10 text-center">
          <div className="mb-10 inline-block px-4 py-1.5 bg-brand-50 rounded-full border border-brand-100">
            <span className="text-[11px] font-black text-brand-700 tracking-tight uppercase">Login Required</span>
          </div>

          <p className="text-slate-500 mb-10 font-bold text-lg leading-snug">
            원활한 시간표 교체와<br />
            스마트 공강 매칭을 위해<br />
            <span className="text-slate-900">구글 로그인이 필요합니다.</span>
          </p>

          <button
            onClick={signInWithGoogle}
            disabled={isLoggingIn}
            className={`w-full flex items-center justify-center gap-4 py-4 px-6 rounded-[1.5rem] font-black transition-all duration-300 shadow-lg group relative overflow-hidden border-2 
              ${isLoggingIn 
                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' 
                : 'bg-white border-slate-100 text-slate-700 hover:bg-slate-50 hover:border-brand-200 hover:shadow-xl hover:-translate-y-1 active:scale-95'
              }`}
            style={{ zIndex: 30 }}
          >
            {isLoggingIn ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                <span>로그인 진행 중...</span>
              </div>
            ) : (
              <>
                <div className="absolute inset-0 bg-brand-50 opacity-0 group-hover:opacity-100 transition-opacity" />
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-7 h-7 relative z-10" />
                <span className="relative z-10 text-[17px]">구글 계정으로 시작하기</span>
              </>
            )}
          </button>

          <p className="mt-8 text-[11px] font-bold text-slate-400">
            © 2026 Ulleung Middle School. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
