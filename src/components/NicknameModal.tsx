import React, { useState, useEffect } from 'react';
import { X, User, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function NicknameModal({ isOpen, onClose }: Props) {
  const { userData, updateNickname } = useAuth();
  const [nickname, setNickname] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && userData) {
      setNickname(userData.nickname || '');
    }
  }, [isOpen, userData]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    setIsSaving(true);
    try {
      await updateNickname(nickname.trim());
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 1500);
    } catch (error) {
      alert('닉네임 저장에 실패했습니다.');
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
            <p className="text-[10px] text-slate-400 font-bold px-1 italic">* 최대 12자까지 입력 가능합니다.</p>
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
                '닉네임 저장하기'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
