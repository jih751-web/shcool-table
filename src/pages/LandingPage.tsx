import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { CalendarDays, AlertCircle, ExternalLink, X, ClipboardCheck, Copy } from 'lucide-react';

const LandingPage: React.FC = () => {
  const { user, signInWithGoogle } = useAuth();
  const [isInApp, setIsInApp] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 인앱 브라우저 감지 (카카오톡, 네이버, 인스타그램, 라인 등)
    const ua = navigator.userAgent;
    const isApp = /KAKAOTALK|NAVER|Instagram|Line|FBAN|FBAV/i.test(ua);
    setIsInApp(isApp);
  }, []);

  const handleCopyUrl = async () => {
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
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-brand-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-200/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-200/20 rounded-full blur-[100px]" />

      {/* In-App Browser Guidance Overlay */}
      {isInApp && showGuide && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl border border-rose-100 overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
            <div className="bg-rose-500 p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6" />
                <h3 className="font-black tracking-tight text-lg">외부 브라우저 권장</h3>
              </div>
              <button 
                onClick={() => setShowGuide(false)}
                className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8">
              <p className="text-slate-600 font-bold mb-6 leading-relaxed">
                현재 <span className="text-rose-600">인앱 브라우저(카카오/인스타 등)</span> 환경입니다. 구글 보안 정책상 로그인이 차단될 수 있습니다.
              </p>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-6 h-6 bg-brand-600 text-white rounded-full flex items-center justify-center text-xs font-black shrink-0">1</div>
                  <p className="text-sm font-black text-slate-700">우측 상단 또는 하단의 <span className="bg-slate-200 px-1 rounded">더보기(⋮ 또는 ...)</span> 메뉴 클릭</p>
                </div>
                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-6 h-6 bg-brand-600 text-white rounded-full flex items-center justify-center text-xs font-black shrink-0">2</div>
                  <p className="text-sm font-black text-slate-700"><span className="text-brand-600">'다른 브라우저로 열기'</span> 또는 <span className="text-brand-600">'Chrome/Safari로 열기'</span> 선택</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 mb-4">
                <button
                  onClick={handleCopyUrl}
                  className={`w-full py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 border-2 ${
                    copied 
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-600' 
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {copied ? (
                    <>복사 완료! <ClipboardCheck className="w-5 h-5" /></>
                  ) : (
                    <>현재 주소 복사하기 <Copy className="w-5 h-5" /></>
                  )}
                </button>
                <button
                  onClick={() => setShowGuide(false)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                >
                  가이드 닫고 계속하기 <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-brand-100 relative z-10 animate-in zoom-in-95 duration-500">
        <div className="bg-brand-600 p-10 text-center text-white relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
          <CalendarDays className="w-20 h-20 mx-auto mb-6 opacity-95 animate-bounce-subtle" />
          <h1 className="text-3xl font-black mb-3 tracking-tighter">울릉중학교</h1>
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
            className="w-full flex items-center justify-center gap-4 bg-white border-2 border-slate-100 text-slate-700 font-black py-4 px-6 rounded-[1.5rem] hover:bg-slate-50 hover:border-brand-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 shadow-lg group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-brand-50 opacity-0 group-hover:opacity-100 transition-opacity" />
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-7 h-7 relative z-10" />
            <span className="relative z-10 text-[17px]">구글 계정으로 시작하기</span>
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
