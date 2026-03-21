import { useState, useEffect, useMemo } from 'react';
import { X, ArrowRightLeft, Search, CheckCircle2, RotateCcw, Users, CalendarDays, UserPlus } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { Timetable, Override, ClassSlot } from '../types';
import { executeSwapTransaction, executeMakeupTransaction } from '../utils/timetableApi';
import { addDays, format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sourceSlot: { date: string; dayOfWeek: string; period: number; subject: string; gradeClass: string } | null;
  myTimetable: Timetable | null;
  initialMode?: 'SWAP' | 'MAKEUP';
}

interface GlobalSlot {
  teacherId: string;
  teacherName: string;
  date: string;       // YYYY-MM-DD
  dayOfWeek: string;  // 월~금
  period: number;     // 1~7
  subject: string;
  gradeClass: string;
}

import { useAuth } from '../contexts/AuthContext';

export default function SmartReplacementModal({ isOpen, onClose, sourceSlot, myTimetable, initialMode }: Props) {
  const { userProfiles } = useAuth();
  const [teachers, setTeachers] = useState<Timetable[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  
  const [selectedGlobalSlot, setSelectedGlobalSlot] = useState<GlobalSlot | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mode, setMode] = useState<'SWAP' | 'MAKEUP'>('SWAP');

  // 1. 기초 시간표 및 오버라이드 한 번에 패치 (+14일 범위)
  useEffect(() => {
    if (isOpen && sourceSlot) {
      setLoading(true);
      const fetchData = async () => {
        try {
          // A. 기초 시간표 가져오기
          const ttSnap = await getDocs(collection(db, 'timetables'));
          const tList: Timetable[] = [];
          ttSnap.forEach(doc => {
             const data = doc.data() as Timetable;
             if (myTimetable && doc.id !== myTimetable.id) {
               tList.push({ ...data, id: doc.id });
             }
          });
          tList.sort((a, b) => a.teacherName.localeCompare(b.teacherName));
          setTeachers(tList);

          // B. 오버라이드 데이터 가져오기 (오늘 기준 이후의 모든 오버라이드)
          const todayStr = format(new Date(), 'yyyy-MM-dd');
          const ovQuery = query(collection(db, 'overrides'), where('date', '>=', todayStr));
          const ovSnap = await getDocs(ovQuery);
          const oList: Override[] = [];
          ovSnap.forEach(doc => {
            oList.push({ id: doc.id, ...doc.data() } as Override);
          });
          setOverrides(oList);

        } catch (error) {
          console.error("Failed to fetch data", error);
        } finally {
          setLoading(false);
        }
      };
      
      fetchData();
      setSelectedGlobalSlot(null);
      setSearchQuery('');
      setMode(initialMode || 'SWAP');
    }
  }, [isOpen, sourceSlot, myTimetable, initialMode]);

  // 헬퍼: 특정 교사, 특정 날짜, 특정 요일의 7교시 스케줄 병합 반환
  const getDailySchedule = (tId: string, searchDate: string, searchDayOfWeek: string, tData: Timetable | null): ClassSlot[] => {
    const ov = overrides.find(o => o.teacherId === tId && o.date === searchDate);
    if (ov) return ov.slots;

    if (tData) {
      if (searchDayOfWeek === '토' || searchDayOfWeek === '일') {
         return [1,2,3,4,5,6,7].map(p => ({ period: p, subject: '', gradeClass: '' }));
      }
      const baseDay = tData.schedule.find(d => d.dayOfWeek === searchDayOfWeek);
      if (baseDay) return baseDay.slots;
    }

    return [1,2,3,4,5,6,7].map(p => ({ period: p, subject: '', gradeClass: '' }));
  };

  /**
   * 보강(Makeup) 가능 목록 스캔: 
   * '해당 날짜/교시'에 상대방 교사가 수업이 없는가(공강인가)?
   */
  const makeupAvailableSlots = useMemo(() => {
    if (!sourceSlot || !myTimetable || teachers.length === 0) return [];
    
    const validSlots: GlobalSlot[] = [];
    const targetDateStr = sourceSlot.date;
    const targetDayOfWeek = sourceSlot.dayOfWeek;

    teachers.forEach(target => {
      const tarDaySlots = getDailySchedule(target.id!, targetDateStr, targetDayOfWeek, target);
      const tarSlot = tarDaySlots.find(s => s.period === sourceSlot.period);

      // 상대방의 해당 교시가 '공강'인 경우에만 보강 가능 대상으로 리스트업
      if (!tarSlot || !tarSlot.subject) {
        validSlots.push({
          teacherId: target.id!,
          teacherName: target.teacherName,
          date: targetDateStr,
          dayOfWeek: targetDayOfWeek,
          period: sourceSlot.period,
          subject: '(보강 가능)', 
          gradeClass: '해당 교시 공강'
        });
      }
    });

    return validSlots;
  }, [sourceSlot, myTimetable, teachers, overrides]);

  /**
   * 교체(Swap) 14일 전수 스캔 (기착 공강 매칭)
   */
  const swapAvailableSlots = useMemo(() => {
    if (!sourceSlot || !myTimetable || teachers.length === 0) return [];
    
    const validSlots: GlobalSlot[] = [];
    const reqBaseDateStr = sourceSlot.date;
    const reqBaseDateObj = new Date(reqBaseDateStr);

    const mySourceDaySlots = getDailySchedule(myTimetable.id!, reqBaseDateStr, sourceSlot.dayOfWeek, myTimetable);
    const mySourceSlotData = mySourceDaySlots.find(s => s.period === sourceSlot.period);
    if (!mySourceSlotData || !mySourceSlotData.subject) return [];

    const dateRange = Array.from({length: 15}, (_, i) => {
      const d = addDays(reqBaseDateObj, i);
      const str = format(d, 'yyyy-MM-dd');
      const dow = format(d, 'E', { locale: ko });
      return { dateStr: str, dayOfWeek: dow };
    }).filter(d => d.dayOfWeek !== '토' && d.dayOfWeek !== '일');

    teachers.forEach(target => {
      const tarSourceDaySlots = getDailySchedule(target.id!, reqBaseDateStr, sourceSlot.dayOfWeek, target);
      const tarSourceSlotData = tarSourceDaySlots.find(s => s.period === sourceSlot.period);
      if (tarSourceSlotData && tarSourceSlotData.subject) return; 

      dateRange.forEach(targetDateObj => {
        const tarTargetDaySlots = getDailySchedule(target.id!, targetDateObj.dateStr, targetDateObj.dayOfWeek, target);
        const myTargetDaySlots = getDailySchedule(myTimetable.id!, targetDateObj.dateStr, targetDateObj.dayOfWeek, myTimetable);

        [1, 2, 3, 4, 5, 6, 7].forEach(p => {
          const tarTargSlotData = tarTargetDaySlots.find(s => s.period === p);
          const myTargSlotData = myTargetDaySlots.find(s => s.period === p);
          if ((tarTargSlotData && tarTargSlotData.subject) && (!myTargSlotData || !myTargSlotData.subject)) {
             if (targetDateObj.dateStr === sourceSlot.date && p === sourceSlot.period) return;
             validSlots.push({
               teacherId: target.id!,
               teacherName: target.teacherName,
               date: targetDateObj.dateStr,
               dayOfWeek: targetDateObj.dayOfWeek,
               period: p,
               subject: tarTargSlotData.subject,
               gradeClass: tarTargSlotData.gradeClass
             });
          }
        });
      });
    });

    validSlots.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.period - b.period;
    });

    return validSlots;
  }, [sourceSlot, myTimetable, teachers, overrides]);

  const currentAvailableSlots = mode === 'SWAP' ? swapAvailableSlots : makeupAvailableSlots;

  const filteredSlots = useMemo(() => {
    if (!searchQuery) return currentAvailableSlots;
    return currentAvailableSlots.filter(s => 
      s.teacherName.includes(searchQuery) || 
      s.subject.includes(searchQuery) ||
      s.date.includes(searchQuery)
    );
  }, [currentAvailableSlots, searchQuery]);

  const handleConfirm = async () => {
    if (!myTimetable || !sourceSlot || !selectedGlobalSlot) return;

    setProcessing(true);
    try {
      if (mode === 'SWAP') {
        await executeSwapTransaction(
          myTimetable.id!,
          selectedGlobalSlot.teacherId,
          sourceSlot.date,
          sourceSlot.dayOfWeek,
          sourceSlot.period,
          selectedGlobalSlot.date,
          selectedGlobalSlot.dayOfWeek,
          selectedGlobalSlot.period
        );
        alert('성공적으로 변동(Override) 교체가 완료되었습니다.');
      } else {
        await executeMakeupTransaction(
          myTimetable.id!,
          selectedGlobalSlot.teacherId,
          sourceSlot.date,
          sourceSlot.dayOfWeek,
          sourceSlot.period
        );
        alert('성공적으로 보강(Makeup) 처리가 완료되었습니다.');
      }
      onClose();
    } catch (error: any) {
      alert(`처리 실패: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen || !sourceSlot) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-brand-600 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-white">
            <CalendarDays className="w-5 h-5" />
            <h2 className="text-xl font-bold">시간표 변경 요청</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50 flex flex-col gap-6">
          
          {/* Mode Switch Tab */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner w-fit">
            <button 
              onClick={() => { setMode('SWAP'); setSelectedGlobalSlot(null); }}
              className={`flex items-center gap-2 px-6 py-2.5 text-[15px] font-black rounded-xl transition-all duration-200 ${mode === 'SWAP' ? 'bg-white text-brand-700 shadow-lg border border-brand-200 ring-2 ring-brand-500/10' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <ArrowRightLeft className="w-4 h-4" /> 14일 스마트 교체
            </button>
            <button 
              onClick={() => { setMode('MAKEUP'); setSelectedGlobalSlot(null); }}
              className={`flex items-center gap-2 px-6 py-2.5 text-[15px] font-black rounded-xl transition-all duration-200 ${mode === 'MAKEUP' ? 'bg-white text-orange-600 shadow-lg border border-orange-200 ring-2 ring-orange-500/10' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <UserPlus className="w-4 h-4" /> 보강 요청 (단방향)
            </button>
          </div>

          {/* Source Info (Banner) */}
          <div className={`bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
            <div className={`absolute top-0 left-0 w-2 h-full ${mode === 'SWAP' ? 'bg-brand-500' : 'bg-orange-500'}`}></div>
            <div className="pl-4">
               <p className="text-sm font-bold text-slate-500 mb-1">나의 원본 수업</p>
               <h3 className="text-xl font-black text-slate-800 tracking-tight flex flex-wrap items-center gap-x-2 gap-y-1">
                 <span className={`${mode === 'SWAP' ? 'text-brand-600 bg-brand-50' : 'text-orange-600 bg-orange-50'} px-2 py-0.5 rounded-md text-lg`}>
                    {sourceSlot.date} ({sourceSlot.dayOfWeek}) {sourceSlot.period}교시
                 </span>
                 <ArrowRightLeft className="w-4 h-4 text-slate-300 mx-1 hidden sm:block" /> 
                 {sourceSlot.subject} <span className="text-sm text-slate-400 font-bold ml-1">({sourceSlot.gradeClass})</span>
               </h3>
            </div>
          </div>

          {/* Results Area */}
          <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                   <div className={`w-2 h-2 rounded-full animate-pulse ${mode === 'SWAP' ? 'bg-emerald-500' : 'bg-orange-500'}`}></div>
                   <h3 className="font-bold text-slate-800">
                     {mode === 'SWAP' ? '14일 내 교차 공강 일치 목록' : '해당 교시에 수업이 없는 교사 목록'}
                     <span className={mode === 'SWAP' ? 'text-brand-600' : 'text-orange-600'}> ({currentAvailableSlots.length}건 발견)</span>
                   </h3>
                </div>
                
                {!loading && currentAvailableSlots.length > 0 && (
                   <div className="relative w-full md:w-64">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                     <input 
                        type="text"
                        placeholder="교사명 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                     />
                   </div>
                )}
             </div>

             {loading ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 text-slate-500 shadow-sm">
                   <RotateCcw className="w-8 h-8 animate-spin text-brand-500 mb-3" /> 
                   <p className="font-bold">데이터를 스캔 중입니다...</p>
                </div>
             ) : currentAvailableSlots.length === 0 ? (
                <div className="bg-slate-100 text-slate-500 p-8 rounded-2xl border border-slate-200 text-center flex flex-col items-center justify-center shadow-inner">
                   <X className="w-10 h-10 text-slate-300 mb-2" />
                   <p className="font-bold text-lg mb-1">{mode === 'SWAP' ? '상호 공강 일치 내역이 0건입니다.' : '보강 가능한 교사가 없습니다.'}</p>
                   {mode === 'SWAP' && <p className="text-sm border-t border-slate-200 pt-3 mt-3 w-3/4">선생님이 요구하신 원본 수업의 해당 시간에 쉬는 교사가 아예 없거나, 빈 틈새가 완벽히 매칭되지 않았습니다.</p>}
                </div>
             ) : filteredSlots.length === 0 ? (
                <div className="bg-white text-slate-500 p-8 rounded-2xl border border-slate-200 text-center">
                   <p className="font-bold">검색 결과가 없습니다.</p>
                </div>
             ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto pr-2 custom-scrollbar min-h-[300px] max-h-[500px]">
                   {filteredSlots.map((slot, idx) => {
                     const isSelected = selectedGlobalSlot?.teacherId === slot.teacherId && 
                                         selectedGlobalSlot?.date === slot.date && 
                                         selectedGlobalSlot?.period === slot.period;
                     
                     const dObj = new Date(slot.date);
                     const dStrDesc = format(dObj, 'M월 d일') + ` (${slot.dayOfWeek})`;

                     return (
                       <div 
                         key={idx}
                         onClick={() => setSelectedGlobalSlot(slot)}
                         className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between min-h-[140px] relative overflow-hidden ${
                           isSelected 
                             ? (mode === 'SWAP' ? 'border-brand-500 bg-brand-50 shadow-md' : 'border-orange-500 bg-orange-50 shadow-md') 
                             : 'border-slate-200 bg-white hover:border-brand-300 hover:shadow-sm'
                         } transform ${isSelected ? 'scale-[1.02]' : 'scale-100'}`}
                       >
                          {isSelected && <div className={`absolute top-0 right-0 w-8 h-8 ${mode === 'SWAP' ? 'bg-brand-500' : 'bg-orange-500'} rounded-bl-2xl flex items-center justify-center text-white`}><CheckCircle2 className="w-4 h-4" /></div>}
                          <div>
                             <div className="flex items-center gap-2 mb-2">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isSelected ? (mode === 'SWAP' ? 'bg-brand-600' : 'bg-orange-600') : 'bg-slate-800'} text-white`}>
                                   {mode === 'SWAP' ? `D-${Math.max(0, Math.floor((new Date(slot.date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)))}` : '보강'}
                                </span>
                                <span className="text-xs font-bold text-slate-500 tracking-tight">
                                   {dStrDesc} {slot.period}교시
                                </span>
                             </div>
                             <p className={`font-black tracking-tight text-xl leading-tight mt-1 ${isSelected ? (mode === 'SWAP' ? 'text-brand-900' : 'text-orange-900') : 'text-slate-800'}`}>
                               {slot.subject}
                             </p>
                             <p className={`text-sm font-bold mt-1 ${isSelected ? (mode === 'SWAP' ? 'text-brand-700' : 'text-orange-700') : 'text-slate-500'}`}>
                               {slot.gradeClass}
                             </p>
                          </div>
                          <div className={`mt-3 pt-3 border-t text-sm font-bold flex items-center justify-between ${isSelected ? (mode === 'SWAP' ? 'border-brand-200 text-brand-800' : 'border-orange-200 text-orange-800') : 'border-slate-100 text-slate-600'}`}>
                             <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px]"><Users className="w-3 h-3 text-slate-500" /></div>
                                {userProfiles[slot.teacherId]?.nickname || slot.teacherName} 선생님
                             </div>
                          </div>
                       </div>
                     );
                   })}
                </div>
             )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0 rounded-b-3xl">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
          >
            취소
          </button>
          <button 
            onClick={handleConfirm}
            disabled={!selectedGlobalSlot || processing}
            className={`px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-md
              ${selectedGlobalSlot && !processing 
                ? (mode === 'SWAP' ? 'bg-brand-600 hover:bg-brand-700 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white') 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
            `}
          >
            {processing ? (
              <><RotateCcw className="w-5 h-5 animate-spin" /> DB 기록중...</>
            ) : mode === 'SWAP' ? (
              <><CheckCircle2 className="w-5 h-5" /> 이 수업으로 교환하기</>
            ) : (
              <><UserPlus className="w-5 h-5" /> 보강 요청 확정</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
