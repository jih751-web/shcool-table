import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, addDays, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  Users, 
  Plus, 
  Calendar, 
  Clock, 
  ArrowRightLeft, 
  Trash2, 
  X, 
  AlertCircle, 
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  UserPlus
} from 'lucide-react';
import Header from '../components/Header';
import type { AfterSchoolClass, AfterSchoolChange } from '../types';

const AfterSchoolPage: React.FC = () => {
  const { user, userData, userProfiles } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [classes, setClasses] = useState<AfterSchoolClass[]>([]);
  const [changes, setChanges] = useState<AfterSchoolChange[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<AfterSchoolClass | null>(null);
  
  // Form States
  const [newClass, setNewClass] = useState({
    period: 8,
    subject: '',
    gradeClass: ''
  });
  const [swapTargetTeacherId, setSwapTargetTeacherId] = useState('');
  const [swapType, setSwapType] = useState<'SWAP' | 'MAKEUP'>('SWAP');
  const [isProcessing, setIsProcessing] = useState(false);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  // Fetch Classes for Selected Date
  useEffect(() => {
    if (!user || !userData) return;

    let q;
    if (userData.isAdmin) {
      // 관리자는 모든 수업 조회 가능
      q = query(collection(db, 'afterSchoolClasses'), where('date', '==', dateStr));
    } else {
      // 일반 교사는 오직 본인의 수업만 조회 가능 (UID 기반 완벽 필터링)
      q = query(
        collection(db, 'afterSchoolClasses'), 
        where('date', '==', dateStr), 
        where('teacherId', '==', user.uid)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: AfterSchoolClass[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as AfterSchoolClass;
        // 쿼리 레벨 필터링이 있더라도 한 번 더 검증 (Defense-in-depth)
        if (userData.isAdmin || data.teacherId === user.uid) {
          items.push({ id: docSnap.id, ...data });
        }
      });
      items.sort((a, b) => a.period - b.period);
      setClasses(items);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [dateStr, user, userData]);

  // Fetch Changes for Selected Date
  useEffect(() => {
    if (!user || !userData) return;

    const q = query(collection(db, 'afterSchoolChanges'), where('date', '==', dateStr));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: AfterSchoolChange[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as AfterSchoolChange;
        
        // 관리자가 아니면 본인이 포함된 변경 내역(원래 담당 또는 새로운 담당)만 표시
        if (!userData.isAdmin) {
           if (data.originalTeacherId === user.uid || data.newTeacherId === user.uid) {
             items.push({ id: docSnap.id, ...data });
           }
        } else {
           items.push({ id: docSnap.id, ...data });
        }
      });
      setChanges(items);
    });
    return () => unsubscribe();
  }, [dateStr, user, userData]);

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData) return;
    setIsProcessing(true);
    try {
      await addDoc(collection(db, 'afterSchoolClasses'), {
        date: dateStr,
        period: newClass.period,
        subject: newClass.subject,
        gradeClass: newClass.gradeClass,
        teacherId: user.uid,
        teacherName: userData.nickname || userData.name || '선생님',
        createdAt: serverTimestamp()
      });
      setIsAddModalOpen(false);
      setNewClass({ period: 8, subject: '', gradeClass: '' });
    } catch (err) {
      console.error(err);
      alert('등록 실패');
    }
    setIsProcessing(false);
  };

  const handleDeleteClass = async (id: string) => {
    const cls = classes.find(c => c.id === id);
    if (!cls) return;

    // 본인 수업이거나 관리자여야만 삭제 가능
    if (cls.teacherId !== user?.uid && !userData?.isAdmin) {
      alert('본인의 수업만 삭제할 수 있습니다.');
      return;
    }

    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'afterSchoolClasses', id));
      alert('삭제되었습니다.');
    } catch (err) {
      console.error(err);
      alert('삭제 실패');
    }
  };

  const handleSwapRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !swapTargetTeacherId || !user) return;
    
    setIsProcessing(true);
    try {
      // 1. 중복 검증 (교체 대상 교사가 해당 날짜/교시에 이미 수업이 있는지 체크)
      const q = query(
        collection(db, 'afterSchoolClasses'), 
        where('date', '==', dateStr),
        where('period', '==', selectedClass.period),
        where('teacherId', '==', swapTargetTeacherId)
      );
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        alert('해당 교사는 이미 해당 교시에 수업이 있습니다.');
        setIsProcessing(false);
        return;
      }

      const targetTeacher = Object.values(userProfiles).find(p => p.uid === swapTargetTeacherId);

      // 2. 교체 기록 생성
      await addDoc(collection(db, 'afterSchoolChanges'), {
        date: dateStr,
        period: selectedClass.period,
        originalTeacherId: user.uid,
        originalTeacherName: userData?.nickname || userData?.name || '선생님',
        newTeacherId: swapTargetTeacherId,
        newTeacherName: targetTeacher?.nickname || targetTeacher?.name || '선생님',
        subject: selectedClass.subject,
        gradeClass: selectedClass.gradeClass,
        type: swapType,
        status: 'APPROVED', // 즉시 승인 (방과후는 복잡한 승인 절차 생략)
        createdAt: serverTimestamp()
      });

      // 3. 실제 수업 데이터 업데이트
      await updateDoc(doc(db, 'afterSchoolClasses', selectedClass.id!), {
        teacherId: swapTargetTeacherId,
        teacherName: targetTeacher?.nickname || targetTeacher?.name || '선생님'
      });

      alert('교체가 완료되었습니다.');
      setIsSwapModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('교체 실패');
    }
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />
      <main className="flex-1 max-w-[1200px] w-full mx-auto p-4 md:p-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <Users className="w-8 h-8 text-brand-600" />
              교과방과후 관리
            </h2>
            <p className="text-slate-500 font-bold mt-1">8, 9교시 방과후 수업을 등록하고 교체할 수 있습니다.</p>
          </div>

          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="px-6 py-3 bg-brand-600 text-white rounded-2xl font-black shadow-lg shadow-brand-200 hover:bg-brand-700 transition-all flex items-center gap-2 active:scale-95"
          >
            <Plus className="w-5 h-5" /> 수업 등록
          </button>
        </div>

        {/* Date Selector */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 mb-8 flex flex-col items-center gap-4">
          <div className="flex items-center gap-6">
            <button onClick={() => setSelectedDate(prev => subDays(prev, 1))} className="p-3 bg-slate-100 rounded-2xl text-slate-400 hover:bg-brand-50 hover:text-brand-600 transition-all cursor-pointer">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="text-center">
              <p className="text-[10px] font-black text-brand-600 tracking-[0.2em] uppercase mb-1">SELECTED DATE</p>
              <h3 className="text-2xl font-black text-slate-800">
                {format(selectedDate, 'M월 d일')} ({format(selectedDate, 'E', { locale: ko })})
              </h3>
            </div>
            <button onClick={() => setSelectedDate(prev => addDays(prev, 1))} className="p-3 bg-slate-100 rounded-2xl text-slate-400 hover:bg-brand-50 hover:text-brand-600 transition-all cursor-pointer">
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Class List */}
          <div className="flex flex-col gap-4">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 px-2">
              <Calendar className="w-5 h-5 text-brand-500" />
              오늘의 수업 목록
            </h3>
            {loading ? (
              <div className="bg-white rounded-3xl p-12 border border-slate-200 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
                <p className="text-slate-400 font-bold">불러오는 중...</p>
              </div>
            ) : classes.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 border border-slate-200 flex flex-col items-center gap-3 text-center">
                <AlertCircle className="w-12 h-12 text-slate-200" />
                <p className="text-slate-400 font-bold">등록된 방과후 수업이 없습니다.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {classes.map(cls => (
                  <div key={cls.id} className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-brand-50 rounded-xl flex flex-col items-center justify-center text-brand-700">
                        <span className="text-xs font-black leading-none">{cls.period}</span>
                        <span className="text-[10px] font-bold uppercase">교시</span>
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-slate-800 tracking-tight">{cls.subject}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{cls.gradeClass}</span>
                          <span className="text-xs font-bold text-brand-600">{cls.teacherName} 선생님</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {cls.teacherId === user?.uid && (
                        <>
                          <button 
                            onClick={() => { setSelectedClass(cls); setIsSwapModalOpen(true); }}
                            className="p-2.5 bg-brand-50 text-brand-600 rounded-xl hover:bg-brand-600 hover:text-white transition-all active:scale-95 shadow-sm"
                            title="수업 교체"
                          >
                            <ArrowRightLeft className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteClass(cls.id!)}
                            className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-all active:scale-95 shadow-sm"
                            title="삭제"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Change History for today */}
          <div className="flex flex-col gap-4">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 px-2">
              <Clock className="w-5 h-5 text-orange-500" />
              오늘의 변경 내역
            </h3>
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              {changes.length === 0 ? (
                <div className="p-12 flex flex-col items-center gap-3 text-center">
                  <CheckCircle2 className="w-12 h-12 text-slate-100" />
                  <p className="text-slate-400 font-bold">아직 변경 내역이 없습니다.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {changes.map(chg => (
                    <div key={chg.id} className="p-5 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md uppercase tracking-tight">
                          {chg.type === 'SWAP' ? '교체됨' : '보강됨'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">{chg.period}교시 / {chg.gradeClass}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-bold text-slate-700 truncate">{chg.originalTeacherName}</p>
                        <ArrowRightLeft className="w-4 h-4 text-slate-300" />
                        <p className="text-sm font-black text-brand-600 truncate">{chg.newTeacherName}</p>
                      </div>
                      <p className="text-[11px] font-bold text-slate-400">{chg.subject}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Add Class Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden animate-in zoom-in-95">
            <div className="p-8 bg-brand-50 border-b border-brand-100 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">방과후 수업 등록</h3>
                <p className="text-brand-600 font-bold text-xs mt-1">{dateStr}</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 text-slate-400 hover:bg-white rounded-full"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleAddClass} className="p-8 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase ml-1">교시 선택</label>
                <div className="flex gap-2">
                  {[8, 9].map(p => (
                    <button 
                      key={p} type="button"
                      onClick={() => setNewClass({...newClass, period: p})}
                      className={`flex-1 py-3 rounded-2xl font-black transition-all border-2
                        ${newClass.period === p ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-400 border-slate-100 hover:border-brand-200'}
                      `}
                    >
                      {p}교시
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase ml-1">과목명</label>
                <input 
                  required type="text" value={newClass.subject}
                  onChange={(e) => setNewClass({...newClass, subject: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-brand-500 transition-all"
                  placeholder="예: 기초 수학"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase ml-1">학년/반</label>
                <input 
                  required type="text" value={newClass.gradeClass}
                  onChange={(e) => setNewClass({...newClass, gradeClass: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-brand-500 transition-all"
                  placeholder="예: 2-3"
                />
              </div>
              <button 
                type="submit" disabled={isProcessing}
                className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black shadow-lg shadow-brand-100 hover:bg-brand-700 transition-all mt-4"
              >
                {isProcessing ? '처리 중...' : '등록하기'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Swap Modal */}
      {isSwapModalOpen && selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden animate-in zoom-in-95">
            <div className="p-8 bg-orange-50 border-b border-orange-100 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">수업 교체 신청</h3>
                <p className="text-orange-600 font-bold text-xs mt-1">{selectedClass.period}교시 {selectedClass.subject}</p>
              </div>
              <button onClick={() => setIsSwapModalOpen(false)} className="p-2 text-slate-400 hover:bg-white rounded-full"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSwapRequest} className="p-8 space-y-6">
               <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase ml-1">교체 방식</label>
                <div className="flex gap-2">
                  {(['SWAP', 'MAKEUP'] as const).map(t => (
                    <button 
                      key={t} type="button"
                      onClick={() => setSwapType(t)}
                      className={`flex-1 py-3 rounded-2xl font-black transition-all border-2 flex items-center justify-center gap-2
                        ${swapType === t ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-400 border-slate-100 hover:border-orange-200'}
                      `}
                    >
                      {t === 'SWAP' ? <ArrowRightLeft className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                      {t === 'SWAP' ? '교체' : '보강'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase ml-1">대상 교사 선택</label>
                <select 
                  required
                  value={swapTargetTeacherId}
                  onChange={(e) => setSwapTargetTeacherId(e.target.value)}
                  className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-orange-500 transition-all appearance-none"
                >
                  <option value="">선생님을 선택해 주세요</option>
                  {Object.values(userProfiles)
                    .filter(p => p.uid !== user?.uid)
                    .map(p => (
                      <option key={p.uid} value={p.uid}>{p.nickname || p.name} 선생님</option>
                    ))
                  }
                </select>
              </div>

              <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                <p className="text-[11px] text-orange-700 font-bold leading-relaxed flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  대상 교사가 해당 교시({selectedClass.period}교시)에 이미 수업이 배정되어 있는 경우 교체가 불가능합니다.
                </p>
              </div>

              <button 
                type="submit" disabled={isProcessing || !swapTargetTeacherId}
                className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black shadow-lg shadow-orange-100 hover:bg-orange-600 transition-all mt-4 disabled:opacity-50"
              >
                {isProcessing ? '처리 중...' : '신청하기'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const Loader2 = ({ className }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default AfterSchoolPage;
