import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, ArrowRight } from 'lucide-react';

interface SiteGuardProps {
  children: React.ReactNode;
}

const SiteGuard: React.FC<SiteGuardProps> = ({ children }) => {
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  const SITE_PASSWORD = import.meta.env.VITE_SITE_PASSWORD || "054790";

  useEffect(() => {
    const unlocked = localStorage.getItem('site_unlocked');
    if (unlocked === 'true') {
      setIsUnlocked(true);
    }
    setLoading(false);
  }, []);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === SITE_PASSWORD) {
      localStorage.setItem('site_unlocked', 'true');
      setIsUnlocked(true);
    } else {
      alert("비밀번호가 일치하지 않습니다. (입장 코드를 다시 확인해 주세요)");
      setPassword('');
    }
  };

  if (loading) return null;

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-brand-50 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Decor */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-200/50 rounded-full blur-3xl animate-pulse" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-200/50 rounded-full blur-3xl animate-pulse delay-700" />

      <div className="w-full max-w-lg bg-white/80 backdrop-blur-2xl rounded-[3rem] shadow-2xl shadow-brand-200/50 border-4 border-white overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-700">
        {/* Header Section */}
        <div className="p-10 bg-brand-600 text-center text-white relative">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
          
          <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl backdrop-blur-md animate-bounce-slow">
            <Lock className="w-10 h-10 text-white fill-white/20" />
          </div>
          
          <h2 className="text-3xl font-black tracking-tight leading-tight mb-2">
            스마트 교무실
          </h2>
          <p className="text-brand-100 font-bold tracking-widest text-xs uppercase opacity-80">
            Protected Entry Gate
          </p>
        </div>

        {/* Content Section */}
        <div className="p-12 text-center">
          <div className="mb-10 space-y-3">
            <div className="flex items-center justify-center gap-2 text-brand-600 font-black">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-sm tracking-tight">구성원 인증이 필요합니다</span>
            </div>
            <p className="text-slate-500 font-bold leading-relaxed text-sm">
              선생님들만 알 수 있는 **입장 코드**를 입력해 주세요.<br/>
              최초 1회만 인증하면 편리하게 계속 이용하실 수 있습니다.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-6">
            <div className="relative group">
              <input
                autoFocus
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="코드를 입력하세요 (6자리)"
                className="w-full px-8 py-5 bg-slate-100 border-2 border-transparent rounded-2xl text-center text-2xl font-black tracking-[0.5em] focus:outline-none focus:border-brand-500 focus:bg-white transition-all shadow-inner placeholder:text-slate-300 placeholder:tracking-normal group-hover:bg-slate-200/50"
              />
            </div>

            <button
              type="submit"
              className="w-full py-5 bg-brand-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-brand-200 hover:bg-brand-700 hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-3 group"
            >
              스마트 교무실 입장하기
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col items-center gap-2">
            <span className="text-[10px] font-black text-slate-300 tracking-[0.2em] uppercase">Security Powered by Antigravity</span>
          </div>
        </div>
      </div>
      
      {/* Footer Branding */}
      <p className="mt-8 text-slate-400 font-bold text-xs">
        © 2026 울릉도 스마트 교무실 시스템
      </p>
    </div>
  );
};

export default SiteGuard;
