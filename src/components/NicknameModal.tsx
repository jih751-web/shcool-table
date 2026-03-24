import React, { useState, useEffect } from 'react';
import { X, User, CheckCircle2, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function NicknameModal({ isOpen, onClose }: Props) {
  const { userData, updateProfile } = useAuth();
  const [nickname, setNickname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && userData) {
      setNickname(userData.nickname || '');
      setBirthDate(userData.birthDate || '');
    }
  }, [isOpen, userData]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    // 생년월일 형식 체크 (선택 사항이지만 입력 시 8자리 숫자 권장)
    if (birthDate && !/^\d{8}$/.test(birthDate)) {
      alert('생년월일은 YYYYMMDD 형식(8자리 숫자)으로 입력해 주세요.');
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({ 
        nickname: nickname.trim(), 
        birthDate: birthDate.trim() 
      });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 1500);
    } catch (error) {
      alert('설정 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 bg-brand-50 border-b border-brand-100 flex justify-between items-center text-center">
          <div className="flex-1">
             <p className="text-[11px] font-black text-brand-600 uppercase tracking-widest mb-1">Account Settings</p>
             <h3 className="text-xl font-black text-slate-800 tracking-tight">닉네임 설정</h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-full transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">활동 이름 (닉네임)</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                </div>
                <input 
                  type="text" 
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="사용할 닉네임을 입력하세요"
                  className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all"
                  maxLength={12}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">생년월일 (운세용)</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                </div>
                <input 
                  type="text" 
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="예: 19850515"
                  className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all"
                  maxLength={8}
                />
              </div>
              <p className="text-[10px] text-slate-400 font-bold px-1 italic">* YYYYMMDD 형식으로 8자리 숫자를 입력해 주세요.</p>
            </div>
          </div>

          <div className="pt-2">
            <button 
              type="submit" 
              disabled={isSaving || !nickname.trim() || showSuccess}
              className={`w-full py-4 rounded-2xl font-black text-white shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2
                ${showSuccess 
                  ? 'bg-emerald-500 shadow-emerald-200' 
                  : 'bg-brand-600 shadow-brand-200 hover:bg-brand-700 hover:shadow-xl'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {isSaving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  저장 중...
                </>
              ) : showSuccess ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  저장 완료
                </>
              ) : (
                '설정 저장하기'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
