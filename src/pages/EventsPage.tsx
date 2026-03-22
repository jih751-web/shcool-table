import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { SchoolEvent } from '../types';
import { Calendar, Trash2, ArrowLeft, ChevronLeft, ChevronRight, X, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import ConfirmModal from '../components/ConfirmModal';

const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];

const EventsPage: React.FC = () => {
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newEvent, setNewEvent] = useState<Partial<SchoolEvent>>({
    periodStart: 1,
    periodEnd: 7,
    description: '',
    announcement: '',
    type: 'EXTERNAL',
    isAllDay: false,
    endDate: ''
  });

  // 삭제 확인 모달 상태
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'events'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const evData: SchoolEvent[] = [];
      snapshot.forEach(docSnap => {
        evData.push({ id: docSnap.id, ...docSnap.data() } as SchoolEvent);
      });
      setEvents(evData);
    });
    return () => unsubscribe();
  }, []);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !newEvent.description) return;
    
    const startDateStr = format(selectedDate, 'yyyy-MM-dd');
    const endDateStr = newEvent.endDate || startDateStr;

    try {
      await addDoc(collection(db, 'events'), {
        ...newEvent,
        date: startDateStr, // 호환성 유지
        startDate: startDateStr,
        endDate: endDateStr,
        periodStart: newEvent.isAllDay ? 1 : (newEvent.periodStart || 1),
        periodEnd: newEvent.isAllDay ? 9 : (newEvent.periodEnd || 7)
      });
      setNewEvent({ ...newEvent, description: '', announcement: '', endDate: '', isAllDay: false });
      setSelectedDate(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = (id: string) => {
    if (!id) return;
    setDeletingId(id);
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;

    try {
      await deleteDoc(doc(db, 'events', deletingId));
    } catch (err) {
      console.error("Delete Error:", err);
      alert("삭제 중 문제가 발생했습니다. (권한 문제 혹은 네트워크 오류)");
    } finally {
      setDeletingId(null);
      setIsConfirmOpen(false);
    }
  };

  const openDateModal = (day: Date) => {
    setSelectedDate(day);
    setNewEvent(prev => ({ ...prev, periodStart: 1, periodEnd: 7, description: '', announcement: '', type: 'EXTERNAL' }));
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const selectedDayEvents = events.filter(e => {
    if (e.startDate && e.endDate) {
      return selectedDateStr >= e.startDate && selectedDateStr <= e.endDate;
    }
    return e.date === selectedDateStr;
  }).sort((a, b) => a.periodStart - b.periodStart);
  
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="p-2 -ml-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
              <Calendar className="text-brand-600" />
              월간 학사 일정
            </h1>
          </div>
          
          <div className="flex items-center gap-4 bg-white px-4 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => setCurrentMonth(prev => subMonths(prev, 1))} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 transition-colors">
              <ChevronLeft className="w-5 h-5"/>
            </button>
            <h2 className="text-lg font-bold w-24 text-center tracking-tight text-slate-800">
              {format(currentMonth, 'yyyy. MM')}
            </h2>
            <button onClick={() => setCurrentMonth(prev => addMonths(prev, 1))} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 transition-colors">
              <ChevronRight className="w-5 h-5"/>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
            {daysOfWeek.map((day, i) => (
              <div key={day} className={`py-4 text-center text-sm font-bold tracking-tight ${i === 0 ? 'text-rose-500' : i === 6 ? 'text-blue-600' : 'text-slate-600'}`}>
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-fr bg-slate-200 gap-px">
            {calendarDays.map((day, i) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const dayEvents = events.filter(e => {
                if (e.startDate && e.endDate) {
                  return dayStr >= e.startDate && dayStr <= e.endDate;
                }
                return e.date === dayStr;
              }).sort((a,b) => a.periodStart - b.periodStart);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());

              return (
                <div 
                  key={day.toISOString()}
                  onClick={() => openDateModal(day)}
                  className={`min-h-[140px] bg-white p-2.5 transition-colors cursor-pointer hover:bg-brand-50/40 relative group ${!isCurrentMonth ? 'text-slate-400 bg-slate-50/50' : 'text-slate-700'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span 
                      className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-brand-600 text-white shadow-sm' : 
                        i % 7 === 0 ? (!isCurrentMonth ? 'text-rose-300' : 'text-rose-500') : 
                        i % 7 === 6 ? (!isCurrentMonth ? 'text-blue-400' : 'text-blue-600') : ''
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayEvents.length > 0 && <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shadow-sm">{dayEvents.length}개</span>}
                  </div>
                  
                  <div className="space-y-1.5">
                    {dayEvents.map(e => (
                      <div key={e.id} className={`text-[11px] px-2 py-1 rounded truncate border font-bold shadow-sm ${
                        e.type === 'EXTERNAL' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-indigo-50 border-indigo-100 text-indigo-700'
                      }`} title={e.description}>
                        {e.periodStart}-{e.periodEnd}교시 {e.description}
                      </div>
                    ))}
                  </div>
                  
                  {/* Hover indicator */}
                  <div className="absolute inset-0 bg-brand-900/0 group-hover:bg-brand-900/5 transition-colors pointer-events-none flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 text-[11px] font-bold text-brand-700 bg-white/90 px-2 py-1 rounded-md shadow-md translate-y-2 group-hover:translate-y-0 transition-all">
                      <Plus className="w-3 h-3 inline mr-1" />일정 등록
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedDate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden transform transition-all">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-brand-50">
              <h2 className="text-xl font-bold text-brand-900 tracking-tight">
                {format(selectedDate, 'yyyy년 M월 d일')} <span className="text-brand-600 text-base font-medium">({daysOfWeek[selectedDate.getDay()]}요일) 일정</span>
              </h2>
              <button onClick={() => setSelectedDate(null)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2 px-1">
                <Calendar className="w-4 h-4 text-brand-600"/>
                등록된 일정 현황 ({selectedDayEvents.length}건)
              </h3>
              
              <div className="space-y-3 mb-8">
                {selectedDayEvents.map(ev => (
                  <div key={ev.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl bg-white shadow-sm hover:shadow transition-shadow">
                    <div className="flex flex-col gap-1.5">
                      <span className={`text-[10px] w-fit font-bold px-2 py-0.5 rounded-md tracking-tight ${ev.type === 'EXTERNAL' ? 'bg-rose-100 border border-rose-200 text-rose-700' : 'bg-indigo-100 border border-indigo-200 text-indigo-700'}`}>
                        {ev.type === 'EXTERNAL' ? '외부 행사' : '교과 연계'}
                      </span>
                      <p className="font-black text-slate-800 text-[16px]">{ev.description}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-400">
                          {ev.startDate && ev.endDate && ev.startDate !== ev.endDate 
                            ? `${ev.startDate.slice(5)} ~ ${ev.endDate.slice(5)}` 
                            : ev.date.slice(5)}
                        </p>
                        <p className="text-xs font-bold text-brand-600">
                          {ev.isAllDay ? '하루 종일' : `${ev.periodStart}교시 ~ ${ev.periodEnd}교시`}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => handleDelete(ev.id!)} className="p-2.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                {selectedDayEvents.length === 0 && (
                  <div className="p-6 bg-slate-50 text-center text-slate-400 rounded-xl border border-dashed border-slate-300 text-sm">
                    등록된 학사 일정이 없습니다.<br/>아래에서 새 일정을 추가해주세요.
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 pt-6 mt-4">
                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2 px-1">
                  <Plus className="w-4 h-4 text-brand-600 text-[15px]"/>
                  새로운 일정 추가
                </h3>
                <form onSubmit={handleAddEvent} className="grid grid-cols-2 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">행사 분류 유형</label>
                    <select 
                      value={newEvent.type}
                      onChange={e => setNewEvent({ ...newEvent, type: e.target.value as 'EXTERNAL' | 'CURRICULUM' })}
                      className="w-full border-slate-300 rounded-lg p-2.5 border text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-brand-500 outline-none transition-shadow bg-white shadow-sm"
                    >
                      <option value="EXTERNAL">외부 행사 (기존 수업 완전 숨김)</option>
                      <option value="CURRICULUM">교과 연계 행사 (기존 수업 유지 + 뱃지 표시)</option>
                    </select>
                  </div>
                   <div className="col-span-2 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">시작일</label>
                      <input 
                        type="date" 
                        value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
                        readOnly
                        className="w-full border-slate-300 rounded-lg p-2.5 border text-sm font-semibold text-slate-400 bg-slate-100 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1.5">종료일</label>
                      <input 
                        type="date" 
                        min={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
                        value={newEvent.endDate || (selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '')}
                        onChange={e => setNewEvent({ ...newEvent, endDate: e.target.value })}
                        className="w-full border-slate-300 rounded-lg p-2.5 border text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-brand-500 outline-none transition-shadow bg-white shadow-sm" 
                      />
                    </div>
                  </div>

                  <div className="col-span-2 flex items-center gap-2 px-1 py-1">
                    <input 
                      type="checkbox" 
                      id="isAllDay"
                      checked={newEvent.isAllDay}
                      onChange={e => setNewEvent({ ...newEvent, isAllDay: e.target.checked })}
                      className="w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-brand-500"
                    />
                    <label htmlFor="isAllDay" className="text-sm font-bold text-slate-700 cursor-pointer">하루 종일 진행되는 행사입니다.</label>
                  </div>

                  {!newEvent.isAllDay && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">시작 교시</label>
                        <input type="number" min="1" max="9" value={newEvent.periodStart} onChange={e => setNewEvent({...newEvent, periodStart: Number(e.target.value)})} required className="w-full border-slate-300 rounded-lg p-2.5 border font-semibold text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none transition-shadow shadow-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1.5">종료 교시</label>
                        <input type="number" min="1" max="9" value={newEvent.periodEnd} onChange={e => setNewEvent({...newEvent, periodEnd: Number(e.target.value)})} required className="w-full border-slate-300 rounded-lg p-2.5 border font-semibold text-slate-800 focus:ring-2 focus:ring-brand-500 outline-none transition-shadow shadow-sm" />
                      </div>
                    </>
                  )}
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">행사명</label>
                    <input type="text" value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} required className="w-full border-slate-300 rounded-lg p-3 border text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-brand-500 outline-none transition-shadow shadow-sm" placeholder="예: 현장체험학습, 성교육 특강" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">전달사항 (선택)</label>
                    <textarea 
                      value={newEvent.announcement} 
                      onChange={e => setNewEvent({...newEvent, announcement: e.target.value})} 
                      rows={4}
                      className="w-full border-slate-300 rounded-lg p-3 border text-sm font-semibold text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-brand-500 outline-none transition-shadow shadow-sm" 
                      placeholder="상세 내용을 입력하세요 (줄바꿈 가능)"
                    />
                  </div>
                  <div className="col-span-2 mt-3">
                    <button type="submit" disabled={!newEvent.description} className="w-full bg-brand-600 text-white px-4 py-3.5 rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-sm focus:ring-4 focus:ring-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-[15px]">
                      이 날짜에 바로 일정 등록하기
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="일정 삭제 확인"
        message="정말로 이 학사일정 정보를 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다."
        confirmText="삭제하기"
        type="danger"
      />
    </div>
  );
};

export default EventsPage;
