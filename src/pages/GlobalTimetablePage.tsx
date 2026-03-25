import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CalendarRange, ChevronLeft, ChevronRight, Loader2, ArrowLeft, Plus } from 'lucide-react';
import Header from '../components/Header';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import type { Timetable, ClassSlot, TimetableOverride } from '../types';
import { executeSwapTransaction } from '../utils/timetableApi';
import { startOfWeek, addWeeks, subWeeks, format, addDays } from 'date-fns';
import { Link } from 'react-router-dom';

const DAYS = ['월', '화', '수', '목', '금'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

const GlobalTimetablePage: React.FC = () => {
  const { user, userProfiles } = useAuth();
  const [allTimetables, setAllTimetables] = useState<Timetable[]>([]);
  const [timetableOverrides, setTimetableOverrides] = useState<TimetableOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // 교체 선택 상태
  const [selection, setSelection] = useState<{
    teacherId: string;
    dayOfWeek: string;
    period: number;
    subject: string;
  } | null>(null);

  const weekStartsOn = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDisplay = `${format(weekStartsOn, 'yyyy년 M월 d일')} 주간`;

  const handlePrevWeek = () => setCurrentDate(prev => subWeeks(prev, 1));
  const handleNextWeek = () => setCurrentDate(prev => addWeeks(prev, 1));

  useEffect(() => {
    setLoading(true);
    const unsubscribeTimetables = onSnapshot(collection(db, 'timetables'), (snapshot) => {
      const lists: Timetable[] = [];
      snapshot.forEach(doc => lists.push({ id: doc.id, ...doc.data() } as Timetable));
      // teacherName 기준으로 정렬 (번호 부여를 위해)
      lists.sort((a, b) => a.teacherName.localeCompare(b.teacherName));
      setAllTimetables(lists);
      setLoading(false);
    });

    return () => unsubscribeTimetables();
  }, []);

  // 2. 주간 변동 내역(timetable_overrides) 실시간 구독 (Phase 13)
  useEffect(() => {
    const weekEndDate = format(addDays(weekStartsOn, 5), 'yyyy-MM-dd');
    const weekStartDate = format(weekStartsOn, 'yyyy-MM-dd');

    const q = query(
      collection(db, 'timetable_overrides'),
      where('date', '>=', weekStartDate),
      where('date', '<=', weekEndDate)
    );

    const unsubscribeOverrides = onSnapshot(q, (snapshot) => {
      const ovs: TimetableOverride[] = [];
      snapshot.forEach(docSnap => {
        ovs.push({ id: docSnap.id, ...docSnap.data() } as TimetableOverride);
      });
      setTimetableOverrides(ovs);
    });

    return () => unsubscribeOverrides();
  }, [currentDate]);

  const handleCellClick = async (timetable: Timetable, day: string, period: number, slot?: ClassSlot) => {
    if (processing) return;

    // 1. 첫 번째 선택 (내 수업이어야 함)
    if (!selection) {
      if (timetable.id === user?.uid) {
        if (!slot?.subject) {
          alert('원본 수업이 있는 셀을 선택해주세요.');
          return;
        }
        setSelection({
          teacherId: timetable.id,
          dayOfWeek: day,
          period,
          subject: slot.subject
        });
      } else {
        alert('먼저 본인의 수업 중 하나를 선택해주세요.');
      }
      return;
    }

    // 2. 선택 취소
    if (timetable.id === selection.teacherId && day === selection.dayOfWeek && period === selection.period) {
      setSelection(null);
      return;
    }

    // 3. 두 번째 선택
    if (timetable.id === selection.teacherId) {
       alert('자신의 수업끼리는 교체할 수 없습니다.');
       setSelection(null);
       return;
    }

    if (!slot?.subject) {
      alert('상대방의 수업이 있는 셀을 선택해주세요.');
      setSelection(null);
      return;
    }

    const confirmMsg = `[내 수업] ${selection.dayOfWeek}(${selection.period}) ${selection.subject}\n[상대 수업] ${day}(${period}) ${slot.subject}\n\n위 두 수업을 상호 공강 조건에 맞춰 교체하시겠습니까?`;
    
    if (window.confirm(confirmMsg)) {
      setProcessing(true);
      try {
        const sourceDate = format(addDays(weekStartsOn, DAYS.indexOf(selection.dayOfWeek)), 'yyyy-MM-dd');
        const targetDate = format(addDays(weekStartsOn, DAYS.indexOf(day)), 'yyyy-MM-dd');

        await executeSwapTransaction(
          selection.teacherId,
          timetable.id,
          sourceDate,
          selection.dayOfWeek,
          selection.period,
          targetDate,
          day,
          period
        );
        alert('성공적으로 교체되었습니다.');
      } catch (error: any) {
        alert(`교체 실패: ${error.message}`);
      } finally {
        setProcessing(false);
        setSelection(null);
      }
    } else {
      setSelection(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-[1800px] w-full mx-auto p-2 md:p-4 overflow-hidden flex flex-col">
        <div className="w-full mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-brand-600 rounded-2xl shadow-sm transition-all active:scale-95" title="메인 대시보드로 돌아가기">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <CalendarRange className="w-6 h-6 text-brand-600" />
                전체 시간표 현황
              </h1>
              <p className="text-slate-500 font-bold text-xs mt-0.5">교사별 주간 시간표 통합 보기</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/mytimetable"
              className="px-4 py-2 text-sm font-black text-white bg-brand-600 hover:bg-brand-700 rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> 시간표 추가
            </Link>

            <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
            <button 
              onClick={handlePrevWeek}
              className="p-2 hover:bg-slate-50 text-slate-400 hover:text-brand-600 rounded-xl transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-4 text-sm font-black text-slate-700 whitespace-nowrap">
              {weekDisplay}
            </span>
            <button 
              onClick={handleNextWeek}
              className="p-2 hover:bg-slate-50 text-slate-400 hover:text-brand-600 rounded-xl transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-300 shadow-sm flex flex-col h-full flex-1">
          {/* Header Controls */}
          <div className="p-2 border-b border-slate-300 flex items-center justify-between bg-slate-50 shrink-0">
            <div className="flex items-center gap-2">
              <button onClick={handlePrevWeek} className="p-1 border border-slate-300 bg-white hover:bg-slate-100 rounded text-slate-600"><ChevronLeft className="w-4 h-4" /></button>
              <h2 className="text-sm font-bold text-slate-800 px-2 min-w-[120px] text-center">{weekDisplay}</h2>
              <button onClick={handleNextWeek} className="p-1 border border-slate-300 bg-white hover:bg-slate-100 rounded text-slate-600"><ChevronRight className="w-4 h-4" /></button>
            </div>
            
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
               <div className="flex items-center gap-1">
                 <div className="w-3 h-3 border-2 border-blue-500 bg-blue-50"></div> 원본
               </div>
               <div className="flex items-center gap-1">
                 <div className="w-3 h-3 hover:bg-blue-50/50 border border-transparent"></div> 교체대상
               </div>
            </div>
          </div>

          {/* Grid Container */}
          <div className="flex-1 overflow-auto custom-scrollbar bg-slate-200 w-full relative">
            <table className="border-collapse text-[11px] min-w-max bg-white m-0 border-separate border-spacing-0" style={{ tableLayout: 'auto' }}>
              <thead className="sticky top-0 z-30 font-bold text-slate-800">
                {/* 1 Row: Dates */}
                <tr>
                  <th colSpan={2} className="w-[120px] border border-slate-300 bg-slate-100 sticky left-0 top-0 z-50"></th>
                  {DAYS.map((day, idx) => {
                    const dateObj = addDays(weekStartsOn, idx);
                    const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
                    return (
                      <th key={`date-${day}`} colSpan={7} className="border border-slate-300 bg-slate-50 p-1 text-center text-sm sticky top-0 z-30">
                        {dateStr}
                      </th>
                    );
                  })}
                </tr>
                {/* 2 Row: Days */}
                <tr>
                  <th className="w-[40px] border border-slate-300 bg-slate-100 p-1 text-center sticky left-0 top-[29px] z-50">번호</th>
                  <th className="w-[80px] border border-slate-300 bg-slate-100 p-1 text-center sticky left-[40px] top-[29px] z-50">교사</th>
                  {DAYS.map(day => (
                    <th key={`day-${day}`} colSpan={7} className="border border-slate-300 bg-slate-100 p-1 text-center sticky top-[29px] z-30">
                      {day}
                    </th>
                  ))}
                </tr>
                {/* 3 Row: Periods */}
                <tr>
                  <th className="border border-slate-300 bg-slate-100 sticky left-0 top-[56px] z-50 h-5 shadow-[1px_0_0_0_#cbd5e1]"></th>
                  <th className="border border-slate-300 bg-slate-100 sticky left-[40px] top-[56px] z-50 h-5 shadow-[1px_0_0_0_#cbd5e1]"></th>
                  {DAYS.map(day => (
                    PERIODS.map(period => (
                      <th key={`period-${day}-${period}`} className="min-w-[45px] border border-slate-300 bg-white text-center font-normal sticky top-[56px] z-30">
                        {period}
                      </th>
                    ))
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={37} className="py-20 text-center bg-white border border-slate-300">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                        <span className="text-sm font-semibold text-slate-500">데이터를 불러오는 중...</span>
                      </div>
                    </td>
                  </tr>
                ) : allTimetables.length === 0 ? (
                  <tr>
                    <td colSpan={37} className="py-20 text-center text-slate-400 font-bold bg-white border border-slate-300">데이터가 없습니다.</td>
                  </tr>
                ) : (
                  allTimetables.map((t, index) => {
                    const isMe = t.id === user?.uid;
                    return (
                      <tr key={t.id} className="hover:bg-blue-50/30">
                        {/* Number */}
                        {/* Number */}
                        <td className="border border-slate-300 text-center font-medium text-slate-600 bg-white sticky left-0 z-20 shadow-[1px_0_0_0_#cbd5e1]">
                          {index + 1}
                        </td>
                        {/* Teacher Name */}
                        <td className={`border border-slate-300 text-center font-bold px-1 sticky left-[40px] z-20 shadow-[1px_0_0_0_#cbd5e1] ${isMe ? 'bg-blue-50 text-blue-700' : 'bg-white text-slate-800'}`}>
                          {userProfiles[t.id]?.nickname || t.teacherName}
                        </td>
                        {/* Slots */}
                        {DAYS.map((day) => {
                          const daySched = t.schedule.find(s => s.dayOfWeek === day);
                          return PERIODS.map((period) => {
                            const slot = daySched?.slots.find(s => s.period === period);
                            const isSelected = selection?.teacherId === t.id && selection?.dayOfWeek === day && selection?.period === period;
                            let cellBg = 'bg-white';
                            
                            // 실시간 변동 내역 병합 (3대 원칙 2, 3번: 전체 현황 연동 및 복구)
                            let displaySlot = slot ? { ...slot } : { period, subject: '', gradeClass: '' };
                            const dateOfCell = format(addDays(weekStartsOn, DAYS.indexOf(day)), 'yyyy-MM-dd');
                            
                            const cellOverrides = timetableOverrides.filter(ov => ov.date === dateOfCell && ov.period === period);
                            
                            // A. 이 교사의 원래 수업이 나갔거나 바뀐 경우 (원상 복구 시 ov가 삭제되므로 자연스럽게 복구됨)
                            const myOutOv = cellOverrides.find(ov => ov.originalTeacherId === t.id);
                            if (myOutOv) {
                               displaySlot.subject = '';
                               displaySlot.gradeClass = '';
                            }
                            
                            // B. 이 교사가 다른 수업을 들어온 연우 (또는 자신의 수업이 이 시간으로 교체된 경우)
                            const myInOv = cellOverrides.find(ov => ov.newTeacherId === t.id);
                            if (myInOv) {
                               displaySlot.subject = myInOv.subject + (myInOv.type === 'MAKEUP' ? ' (보강)' : ' (대강)');
                               displaySlot.gradeClass = myInOv.gradeClass;
                            }

                            const hasMergedClass = !!displaySlot.subject;
                            const isOverridden = !!myInOv || !!myOutOv;

                            if (isSelected) {
                              cellBg = 'bg-blue-100 outline outline-2 outline-blue-500 z-10';
                            } else if (isOverridden) {
                              cellBg = 'bg-yellow-50 outline outline-1 outline-yellow-400/30 z-10 hover:bg-yellow-100/50 cursor-pointer';
                            } else if (selection) {
                                if (!isMe && hasMergedClass) cellBg = 'bg-white hover:bg-slate-100 cursor-pointer';
                                if (isMe && hasMergedClass) cellBg = 'bg-slate-50/50 cursor-pointer'; 
                            } else if (isMe && hasMergedClass) {
                                cellBg = 'bg-blue-50/50 hover:bg-blue-100 cursor-pointer';
                            } else if (!isMe && hasMergedClass) {
                                cellBg = 'bg-white hover:bg-slate-50 cursor-pointer';
                            }

                            return (
                              <td 
                                key={`${t.id}-${day}-${period}`}
                                onClick={() => handleCellClick(t, day, period, slot)}
                                className={`border border-slate-300 p-0 text-center relative font-sans ${cellBg}`}
                                style={{ height: '42px', verticalAlign: 'middle', userSelect: 'none' }}
                              >
                                {hasMergedClass ? (
                                  <div className="flex flex-col items-center justify-center w-full h-full px-0.5 leading-[1.2]">
                                      <div className={`font-bold text-[11px] truncate w-full ${isSelected ? 'text-blue-800' : (displaySlot.subject.includes('(보강)') ? 'text-orange-600' : displaySlot.subject.includes('(대강)') ? 'text-brand-600' : (displaySlot.subject === '역사' || displaySlot.subject === '도덕' || displaySlot.subject === '체육' ? 'text-blue-600' : displaySlot.subject === '과학' || displaySlot.subject === '기술가정' ? 'text-red-600' : 'text-slate-800'))}`}>
                                        {displaySlot.subject.replace(' (보강)', '').replace(' (대강)', '')}
                                        {displaySlot.subject.includes('(보강)') && <span className="block text-[8px] leading-tight text-white bg-orange-500 rounded mt-0.5 px-1 font-black">보강:{userProfiles[t.id]?.nickname || t.teacherName}</span>}
                                        {displaySlot.subject.includes('(대강)') && <span className="block text-[8px] leading-tight text-white bg-brand-600 rounded mt-0.5 px-1 font-black">대강:{userProfiles[t.id]?.nickname || t.teacherName}</span>}
                                      </div>
                                    <div className="text-[10px] font-medium text-slate-600 truncate w-full mt-[1px]">
                                      {displaySlot.gradeClass}
                                    </div>
                                  </div>
                                ) : isOverridden ? (
                                   <div className="text-[9px] font-bold text-slate-400 italic">변경됨</div>
                                ) : null}
                              </td>
                            );
                          })
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Transaction Overlay */}
      {processing && (
        <div className="fixed inset-0 bg-slate-900/20 z-[100] flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl shadow-xl border border-slate-200 flex items-center gap-4">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            <span className="font-bold text-slate-800">교체 트랜잭션 진행 중...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalTimetablePage;
