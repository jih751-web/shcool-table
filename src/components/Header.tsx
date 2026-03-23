import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  CalendarDays, 
  CalendarRange, 
  MonitorPlay, 
  Calendar, 
  Clock, 
  Cloud, 
  Settings, 
  Users, 
  LogOut, 
  X, 
  Menu,
  Trash2,
  Loader2 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { clearSampleData } from '../utils/clearSampleData';

const Header: React.FC = () => {
  const { userData, logout } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  const handleClearSampleData = async () => {
    if (!window.confirm('정말로 모든 시간표/오버라이드 샘플 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
    setIsDeleting(true);
    try {
      await clearSampleData();
      alert('샘플 데이터가 성공적으로 삭제되었습니다.');
    } catch (error: any) {
      alert(`삭제 실패: ${error.message}`);
    } finally {
      setIsDeleting(false);
      setIsSettingsOpen(false);
    }
  };

  // Settings dropdown click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) {
      // 'click'을 사용하여 드롭다운 내부 버튼의 onClick이 먼저 처리되도록 함
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('touchend', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('touchend', handleClickOutside);
    };
  }, [isSettingsOpen]);

  return (
    <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-[1200px] mx-auto px-4 h-16 flex items-center justify-between">
        <Link 
          to="/dashboard" 
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <div className="bg-brand-600 p-2 rounded-xl text-white shadow-md">
            <CalendarDays className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">울릉중학교</h1>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-2">
          <Link to="/global" className="px-3 py-1.5 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-all border border-slate-200 shadow-sm whitespace-nowrap">
            <CalendarRange className="w-4 h-4" /> 시간표 현황
          </Link>
          <Link to="/rooms" className="px-3 py-1.5 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-all border border-slate-200 shadow-sm whitespace-nowrap">
            <MonitorPlay className="w-4 h-4" /> 특별실
          </Link>
          <Link to="/events" className="px-3 py-1.5 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-all border border-slate-200 shadow-sm whitespace-nowrap">
            <Calendar className="w-4 h-4" /> 학사일정
          </Link>
          <Link to="/status" className="px-3 py-1.5 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-all border border-slate-200 shadow-sm whitespace-nowrap">
            <Clock className="w-4 h-4" /> 교체현황
          </Link>
          <a 
            href="https://drive.google.com/drive/folders/1MasUNhkb4PhagYWGwpQlZzHod5xQa0fw?usp=sharing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-all border border-slate-200 shadow-sm whitespace-nowrap"
          >
            <Cloud className="w-4 h-4" /> 규정 자료실
          </a>
        </div>

        <div className="flex items-center gap-4">

          <div className="flex items-center gap-2">
            {userData?.isAdmin ? (
              <div className="relative" ref={settingsRef}>
                <button 
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className={`p-2.5 rounded-2xl border transition-all shadow-sm active:scale-95
                    ${isSettingsOpen ? 'bg-brand-50 border-brand-200 text-brand-600 ring-4 ring-brand-500/10' : 'bg-white border-slate-200 text-slate-400 hover:text-brand-600 hover:border-brand-200'}
                  `}
                >
                  <Settings className={`w-5 h-5 ${isSettingsOpen ? 'rotate-90' : ''} transition-transform duration-300`} />
                </button>
                {isSettingsOpen && (
                  <div className="absolute right-0 mt-3 w-56 bg-white rounded-[2rem] shadow-2xl border border-slate-100 py-3 z-50">
                    <Link to="/admin/users" className="flex items-center gap-3 px-5 py-3 text-sm font-black text-slate-700 hover:bg-brand-50 hover:text-brand-700" onClick={() => setIsSettingsOpen(false)}>
                      <Users className="w-4 h-4" /> 사용자 관리
                    </Link>
                    <button 
                      onClick={handleClearSampleData} 
                      disabled={isDeleting}
                      className="w-full flex items-center gap-3 px-5 py-3 text-sm font-black text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-all disabled:opacity-50"
                    >
                      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      {isDeleting ? '삭제 중...' : '샘플 데이터 삭제'}
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    <button onClick={() => logout()} className="w-full flex items-center gap-3 px-5 py-3 text-sm font-black text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-all">
                      <LogOut className="w-4 h-4" /> 로그아웃
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button 
                onClick={() => logout()}
                className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-brand-600 hover:border-brand-200 transition-all shadow-sm active:scale-95 group"
              >
                <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              </button>
            )}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-16 z-50 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border-b border-slate-200 p-6 flex flex-col gap-4 shadow-2xl">
            <Link to="/global" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl font-bold text-slate-700 hover:bg-brand-50 border border-slate-100">
              <CalendarRange className="w-5 h-5" /> 시간표 현황
            </Link>
            <Link to="/rooms" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl font-bold text-slate-700 hover:bg-brand-50 border border-slate-100">
              <MonitorPlay className="w-5 h-5" /> 특별실
            </Link>
            <Link to="/events" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl font-bold text-slate-700 hover:bg-brand-50 border border-slate-100">
              <Calendar className="w-5 h-5" /> 학사일정
            </Link>
            <Link to="/status" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl font-bold text-slate-700 hover:bg-brand-50 border border-slate-100">
              <Clock className="w-5 h-5" /> 교체현황
            </Link>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center">
              <span className="text-sm font-bold text-slate-500 mr-auto">바로가기</span>
              <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                {/* DashboardPage의 HealingWidget으로 이동됨 */}
                <span className="text-[10px] text-slate-400 font-bold italic">대시보드 메인 위젯에서 확인</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
