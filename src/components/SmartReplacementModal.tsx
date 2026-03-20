import React, { useState, useEffect, useMemo } from 'react';
import { X, ArrowRightLeft, Search, CheckCircle2, RotateCcw, Users, CalendarDays } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { Timetable, Override, ClassSlot } from '../types';
import { executeSwapTransaction } from '../utils/timetableApi';
import { addDays, format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sourceSlot: { date: string; dayOfWeek: string; period: number; subject: string; gradeClass: string } | null;
  myTimetable: Timetable | null;
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

export default function SmartReplacementModal({ isOpen, onClose, sourceSlot, myTimetable }: Props) {
  const [teachers, setTeachers] = useState<Timetable[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  
  const [selectedGlobalSlot, setSelectedGlobalSlot] = useState<GlobalSlot | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
               tList.push({ id: doc.id, ...data });
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
    }
  }, [isOpen, sourceSlot, myTimetable]);

  // 헬퍼: 특정 교사, 특정 날짜, 특정 요일의 7교시 스케줄 병합 반환
  const getDailySchedule = (tId: string, searchDate: string, searchDayOfWeek: string, tData: Timetable | null): ClassSlot[] => {
    // 1. 해당 날짜 오버라이드 확인
    const ov = overrides.find(o => o.teacherId === tId && o.date === searchDate);
    if (ov) return ov.slots;

    // 2. 오버라이드 없으면 기초 시간표 요일 환산
    if (tData) {
      if (searchDayOfWeek === '토' || searchDayOfWeek === '일') {
         return [1,2,3,4,5,6,7].map(p => ({ period: p, subject: '', gradeClass: '' }));
      }
      const baseDay = tData.schedule.find(d => d.dayOfWeek === searchDayOfWeek);
      if (baseDay) return baseDay.slots;
    }

    return [1,2,3,4,5,6,7].map(p => ({ period: p, subject: '', gradeClass: '' }));
  };

  // 2. 14일 전수 스캔 (상호 공강 필터링)
  const globalAvailableSlots = useMemo(() => {
    if (!sourceSlot || !myTimetable || teachers.length === 0) return [];
    
    const validSlots: GlobalSlot[] = [];

    // source date string & JS Date
    const reqBaseDateStr = sourceSlot.date;
    const reqBaseDateObj = new Date(reqBaseDateStr);

    // 나(요청자)의 Source Date 시간표 확인
    const mySourceDaySlots = getDailySchedule(myTimetable.id!, reqBaseDateStr, sourceSlot.dayOfWeek, myTimetable);
    const mySourceSlotData = mySourceDaySlots.find(s => s.period === sourceSlot.period);
    // 만약 이미 내 원본 수업이 공강 처리되어 있다면 교체 불가
    if (!mySourceSlotData || !mySourceSlotData.subject) return [];

    // 향후 14일 리스트 생성
    const dateRange = Array.from({length: 15}, (_, i) => {
      const d = addDays(reqBaseDateObj, i);
      const str = format(d, 'yyyy-MM-dd');
      const dow = format(d, 'E', { locale: ko });
      return { dateStr: str, dayOfWeek: dow };
    }).filter(d => d.dayOfWeek !== '토' && d.dayOfWeek !== '일'); // 주말 제외

    // 모든 선생님 순회
    teachers.forEach(target => {
      // -------------------------------------------------------------
      // 조건 1: 상대방 선생님은 나의 원본 수업 시간(Date A, Period A)에 공강인가?
      // -------------------------------------------------------------
      const tarSourceDaySlots = getDailySchedule(target.id!, reqBaseDateStr, sourceSlot.dayOfWeek, target);
      const tarSourceSlotData = tarSourceDaySlots.find(s => s.period === sourceSlot.period);
      
      // 상대가 해당 시간에 이미 수업이 있다면 아예 이 상대와는 교체 불가!
      if (tarSourceSlotData && tarSourceSlotData.subject) return; 

      // -------------------------------------------------------------
      // 조건 2: 상대방 선생님의 미래 수업들(Date B, Period B) 중에, 
      // 나(요청자)가 공강인 시간이 있는지 전수 스캔
      // -------------------------------------------------------------
      dateRange.forEach(targetDateObj => {
        // 상대방 타겟 데이 스케줄
        const tarTargetDaySlots = getDailySchedule(target.id!, targetDateObj.dateStr, targetDateObj.dayOfWeek, target);
        // 나의 타겟 데이 스케줄
        const myTargetDaySlots = getDailySchedule(myTimetable.id!, targetDateObj.dateStr, targetDateObj.dayOfWeek, myTimetable);

        [1, 2, 3, 4, 5, 6, 7].forEach(p => {
          const tarTargSlotData = tarTargetDaySlots.find(s => s.period === p);
          const myTargSlotData = myTargetDaySlots.find(s => s.period === p);

          // 상대방은 해당 슬롯에 수업이 존재하고 && 나는 그 슬롯에 비어있어야 함(공강)
          if ((tarTargSlotData && tarTargSlotData.subject) && (!myTargSlotData || !myTargSlotData.subject)) {
             
             // 추가 조건: source -> source 매핑 방지 (자기 자신과 교환하는 로직 제외)
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

    // 날짜 오름차순, 교시 오름차순으로 정렬
    validSlots.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.period - b.period;
    });

    return validSlots;
  }, [sourceSlot, myTimetable, teachers, overrides]);

  const filteredSlots = useMemo(() => {
    if (!searchQuery) return globalAvailableSlots;
    return globalAvailableSlots.filter(s => 
      s.teacherName.includes(searchQuery) || 
      s.subject.includes(searchQuery) ||
      s.date.includes(searchQuery)
    );
  }, [globalAvailableSlots, searchQuery]);

  const handleConfirm = async () => {
    if (!myTimetable || !sourceSlot || !selectedGlobalSlot) return;

    setProcessing(true);
    try {
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
      onClose();
    } catch (error: any) {
      alert(`교체 실패: ${error.message}`);
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
            <h2 className="text-xl font-bold">향후 14일 스마트 자동 매칭 (전체 교사 대상)</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50 flex flex-col gap-6">
          
          {/* Source Info (Banner) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="absolute top-0 left-0 w-2 h-full bg-brand-500"></div>
            <div className="pl-4">
               <p className="text-sm font-bold text-slate-500 mb-1">변경할 나의 수업 (원본)</p>
               <h3 className="text-xl font-black text-slate-800 tracking-tight flex flex-wrap items-center gap-x-2 gap-y-1">
                 <span className="text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md text-lg">
                    {sourceSlot.date} ({sourceSlot.dayOfWeek}) {sourceSlot.period}교시
                 </span>
                 <ArrowRightLeft className="w-4 h-4 text-slate-300 mx-1 hidden sm:block" /> 
                 {sourceSlot.subject} <span className="text-sm text-slate-400 font-bold ml-1">({sourceSlot.gradeClass})</span>
               </h3>
            </div>
            <div className="hidden sm:flex items-center justify-center w-12 h-12 rounded-full bg-brand-50 text-brand-600 shrink-0">
               <Users className="w-6 h-6" />
            </div>
          </div>

          {/* Results Area */}
          <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                   <h3 className="font-bold text-slate-800">14일 내 교차 공강 일치 목록 <span className="text-brand-600">({globalAvailableSlots.length}건 발견)</span></h3>
                </div>
                
                {!loading && globalAvailableSlots.length > 0 && (
                   <div className="relative w-full md:w-64">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                     <input 
                        type="text"
                        placeholder="교사명, 날짜 검색..."
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
                   <p className="font-bold">시스템이 14일간의 변동 시간표 내역을 머지 스캔 중입니다...</p>
                   <p className="text-sm mt-1 text-slate-400">데이터가 많을 경우 약간의 시간이 소요될 수 있습니다.</p>
                </div>
             ) : globalAvailableSlots.length === 0 ? (
                <div className="bg-slate-100 text-slate-500 p-8 rounded-2xl border border-slate-200 text-center flex flex-col items-center justify-center shadow-inner">
                   <X className="w-10 h-10 text-slate-300 mb-2" />
                   <p className="font-bold text-lg mb-1">상호 공강 일치 내역이 0건입니다.</p>
                   <p className="text-sm border-t border-slate-200 pt-3 mt-3 w-3/4">선생님이 요구하신 원본 수업의 해당 시간에 쉬는 교사가 아예 없거나, 혹시 쉬더라도 해당 교사의 향후 14일 수업 중 선생님이 쉬는 빈 틈새가 완벽히 매칭되지 않았습니다.</p>
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
                     
                     // 날짜 예쁘게 포맷팅
                     const dObj = new Date(slot.date);
                     const dStrDesc = format(dObj, 'M월 d일') + ` (${slot.dayOfWeek})`;

                     return (
                       <div 
                         key={idx}
                         onClick={() => setSelectedGlobalSlot(slot)}
                         className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between min-h-[140px] relative overflow-hidden ${
                           isSelected ? 'border-brand-500 bg-brand-50 shadow-md transform scale-[1.02]' : 'border-slate-200 bg-white hover:border-brand-300 hover:shadow-sm'
                         }`}
                       >
                          {isSelected && <div className="absolute top-0 right-0 w-8 h-8 bg-brand-500 rounded-bl-2xl flex items-center justify-center text-white"><CheckCircle2 className="w-4 h-4" /></div>}
                          <div>
                             <div className="flex items-center gap-2 mb-2">
                                <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${isSelected ? 'bg-brand-600 text-white' : 'bg-slate-800 text-white'}`}>
                                   D-{(new Date(slot.date).getTime() - new Date().getTime()) / (1000 * 3600 * 24) > 0 ? Math.floor((new Date(slot.date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : 'Day'}
                                </span>
                                <span className="text-xs font-bold text-slate-500 tracking-tight">
                                   {dStrDesc} {slot.period}교시
                                </span>
                             </div>
                             <p className={`font-black tracking-tight text-xl leading-tight mt-1 ${isSelected ? 'text-brand-900' : 'text-slate-800'}`}>
                               {slot.subject}
                             </p>
                             <p className={`text-sm font-bold mt-1 ${isSelected ? 'text-brand-700' : 'text-slate-500'}`}>
                               {slot.gradeClass}
                             </p>
                          </div>
                          <div className={`mt-3 pt-3 border-t text-sm font-bold flex items-center justify-between ${isSelected ? 'border-brand-200 text-brand-800' : 'border-slate-100 text-slate-600'}`}>
                             <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px]"><Users className="w-3 h-3 text-slate-500" /></div>
                                {slot.teacherName} 선생님
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
              ${selectedGlobalSlot && !processing ? 'bg-brand-600 hover:bg-brand-700 text-white hover:shadow-lg' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
            `}
          >
            {processing ? (
              <><RotateCcw className="w-5 h-5 animate-spin" /> DB 기록중...</>
            ) : (
              <><CheckCircle2 className="w-5 h-5" /> 이 수업으로 교환하기</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
