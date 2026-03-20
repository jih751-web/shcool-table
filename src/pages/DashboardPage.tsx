import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, CalendarDays, Settings, CalendarRange, Clock, BookOpen, AlertCircle, ChevronLeft, ChevronRight, MonitorPlay, Calendar, Database, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, collection, getDocs, writeBatch, query, where } from 'firebase/firestore';
import type { Timetable, ClassSlot, Override, SchoolEvent } from '../types';
import { Link } from 'react-router-dom';
import SmartReplacementModal from '../components/SmartReplacementModal';
import { addDays, subDays, format, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';


export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [baseTimetable, setBaseTimetable] = useState<Timetable | null>(null);
  const [overrideData, setOverrideData] = useState<Override | null>(null);
  const [dailyEvents, setDailyEvents] = useState<SchoolEvent[]>([]);
  const [eventError, setEventError] = useState<string | null>(null); // 에러 상태 추가
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<SchoolEvent | null>(null);
  const [isEventDetailOpen, setIsEventDetailOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // 기준 날짜 상태 (기본값: 오늘)
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const currentDateStr = format(currentDate, 'yyyy-MM-dd');
  const dayOfWeekStr = format(currentDate, 'E', { locale: ko }); // '월', '화' ...

  // 모달 및 드롭다운 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{dayOfWeek: string, period: number, subject: string, gradeClass: string, date: string} | null>(null);

  // 1. 기초 시간표(Base) 실시간 구독
  useEffect(() => {
    if (!user) return;
    const unsubBase = onSnapshot(doc(db, 'timetables', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setBaseTimetable({ id: docSnap.id, ...docSnap.data() } as Timetable);
      } else {
        setBaseTimetable(null);
      }
    });
    return () => unsubBase();
  }, [user]);

  // 2. 선택된 날짜의 오버라이드(Override) 실시간 구독
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const overrideDocId = `${user.uid}_${currentDateStr}`;
    const unsubOverride = onSnapshot(doc(db, 'overrides', overrideDocId), (docSnap) => {
      if (docSnap.exists()) {
        setOverrideData(docSnap.data() as Override);
      } else {
        setOverrideData(null);
      }
      setLoading(false);
    });
    return () => unsubOverride();
  }, [user, currentDateStr]);

  // 3. 오늘의 학사일정 실시간 구독 (0.1초 즉시 반영)
  useEffect(() => {
    setEventError(null); // 새로운 날짜 로드 시 에러 초기화
    
    // query와 where를 사용하여 선택된 날짜('yyyy-MM-dd')와 정확히 일치하는 일정만 필터링
    const q = query(collection(db, 'events'), where('date', '==', currentDateStr));
    
    // onSnapshot 실시간 리스너 강제 적용
    const unsubEvents = onSnapshot(q, (snapshot) => {
      const evs: SchoolEvent[] = [];
      snapshot.forEach(docSnap => {
        evs.push({ id: docSnap.id, ...docSnap.data() } as SchoolEvent);
      });
      // 교시 순 정렬
      evs.sort((a, b) => a.periodStart - b.periodStart);
      
      // [방어 코드] 데이터가 완전히 동일하면 업데이트 리렌더링 차단 (무한루프 방지)
      setDailyEvents(prev => {
        if (JSON.stringify(prev) === JSON.stringify(evs)) return prev;
        return evs;
      });
    }, (error) => {
      console.error("Dashboard Events onSnapshot error:", error);
      // 색인 미생성 등의 문제 발생 시 UI에 피드백
      if (error.code === 'failed-precondition') {
        setEventError("색인을 생성 중이거나 데이터베이스 설정이 필요합니다.");
      } else {
        setEventError("일정을 불러오는 중 오류가 발생했습니다.");
      }
    });

    // 메모리 누수 방지: 언마운트 또는 날짜 변경 시 구독 해제 필수
    return () => unsubEvents();
  }, [currentDateStr]);

  // Date Navigation Handlers
  const handlePrevDay = () => setCurrentDate(prev => subDays(prev, 1));
  const handleNextDay = () => setCurrentDate(prev => addDays(prev, 1));
  const handleToday = () => setCurrentDate(new Date());

  // Merge Logic: 오버라이드가 있으면 우선, 없으면 기초 시간표 요일 데이터 사용
  const getTodaySchedule = (): ClassSlot[] => {
    if (overrideData) return overrideData.slots;
    if (baseTimetable) {
       const baseDay = baseTimetable.schedule.find(d => d.dayOfWeek === dayOfWeekStr);
       if (baseDay) return baseDay.slots;
    }
    return [];
  };

  const todaySchedule = getTodaySchedule();
  const isWeekend = dayOfWeekStr === '토' || dayOfWeekStr === '일';

  const handleCardClick = (slot: ClassSlot) => {
    if (!slot.subject) return; // 공강은 교체 불가
    setSelectedSlot({
        date: currentDateStr,
        dayOfWeek: dayOfWeekStr,
        period: slot.period,
        subject: slot.subject,
        gradeClass: slot.gradeClass || ''
    });
    setIsModalOpen(true);
  };

  const clearSampleData = async () => {
    if (!user) return;
    if (!window.confirm("정말로 본인을 제외한 모든 교사/시간표 데이터를 삭제하시겠습니까? (이 작업은 되돌릴 수 없습니다)")) return;
    
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      // 1. 모든 시간표 가져오기
      const ttSnap = await getDocs(collection(db, 'timetables'));
      ttSnap.forEach(d => {
        if (d.id !== user.uid) {
          batch.delete(d.ref);
        }
      });
      
      // 2. 모든 오버라이드 가져오기
      const ovSnap = await getDocs(collection(db, 'overrides'));
      ovSnap.forEach(d => {
        // 본인의 오버라이드는 유지할지 여부? 일단 샘플 지우는 거니 타인 것만 삭제
        if (!d.id.startsWith(user.uid)) {
          batch.delete(d.ref);
        }
      });
      
      await batch.commit();
      alert('본인 데이터를 제외한 모든 샘플 시간표가 삭제되었습니다.');
    } catch (e: any) {
      alert(`삭제 실패: ${e.message}`);
    } finally {
      setLoading(false);
      setIsSettingsOpen(false);
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1200px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-brand-600 p-2 rounded-xl text-white shadow-md">
              <CalendarDays className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">울릉중학교</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/global" className="px-3 py-1.5 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-all border border-slate-200 shadow-sm">
              <CalendarRange className="w-4 h-4" /> 기초 시간표 현황
            </Link>
            <Link to="/rooms" className="px-3 py-1.5 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-all border border-slate-200 shadow-sm">
              <MonitorPlay className="w-4 h-4" /> 특별실
            </Link>
            <Link to="/events" className="px-3 py-1.5 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-all border border-slate-200 shadow-sm">
              <Calendar className="w-4 h-4" /> 학사일정
            </Link>
            <Link to="/status" className="px-3 py-1.5 text-sm font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-all border border-slate-200 shadow-sm">
              <Clock className="w-4 h-4" /> 교체현황
            </Link>
            <div className="w-px h-5 bg-slate-200 mx-1"></div>
            
            {/* 개인 설정함 (톱니바퀴 + 드롭다운) */}
            <div className="relative">
              <div 
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className={`flex items-center gap-2 pl-2 pr-3 py-1 rounded-full border transition-all cursor-pointer group hover:bg-white shadow-sm
                  ${isSettingsOpen ? 'bg-white border-brand-500 ring-2 ring-brand-500/10' : 'bg-slate-50 border-slate-200'}
                `}
                title="개인 설정함"
              >
                <div className={`p-1.5 rounded-full shadow-inner border transition-colors
                  ${isSettingsOpen ? 'bg-brand-50 border-brand-200 text-brand-600' : 'bg-white border-slate-100 text-slate-400 group-hover:text-brand-600'}
                `}>
                  <Settings className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-slate-600 tracking-tight">{user?.email?.split('@')[0]}</span>
              </div>

              {isSettingsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsSettingsOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-4 py-2 border-b border-slate-50 mb-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">나의 설정</p>
                    </div>
                    <Link 
                      to="/mytimetable" 
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                      onClick={() => setIsSettingsOpen(false)}
                    >
                      <BookOpen className="w-4 h-4" /> 나의 시간표 설정
                    </Link>
                    
                    {/* 관리자(Admin) 전용 메뉴: 샘플 데이터 삭제 */}
                    {user?.email === 'jih751@gmail.com' && (
                        <button 
                        onClick={clearSampleData}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                        <Database className="w-4 h-4" /> 샘플 데이터 삭제 (관리자)
                        </button>
                    )}

                    <button 
                      onClick={() => { logout(); setIsSettingsOpen(false); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> 로그아웃
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 md:p-8 shrink-0 flex flex-col items-center">
        
        {/* Welcome Section */}
        <div className="w-full mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-2">
              안녕하세요, <span className="text-brand-600">{baseTimetable?.teacherName || '선생님'}</span>!
            </h2>
            <p className="text-slate-500 font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" /> 일일 시간표 내역을 탐색하고 교체할 수 있습니다.
            </p>
          </div>
        </div>

        {/* 2-Column Layout Container */}
        <div className="w-full flex flex-col lg:flex-row gap-6 items-start">
          
          {/* Left Column: Events Panel (30%) */}
          <div className="w-full lg:w-[30%] bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col sticky top-24">
            <div className="bg-brand-50 border-b border-brand-100 p-4 flex items-center justify-center gap-2">
              <Calendar className="w-5 h-5 text-brand-600" />
              <h3 className="text-lg font-black text-slate-800 tracking-tight">오늘의 학사일정</h3>
            </div>
            <div className="p-5 flex-1 bg-slate-50/30 overflow-y-auto max-h-[500px] custom-scrollbar">
              {eventError ? (
                <div className="h-full flex flex-col items-center justify-center text-rose-400 gap-3 min-h-[150px]">
                  <AlertCircle className="w-8 h-8" />
                  <p className="text-xs font-bold text-center">{eventError}</p>
                </div>
              ) : dailyEvents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 min-h-[150px]">
                  <AlertCircle className="w-8 h-8 text-slate-300" />
                  <p className="text-sm font-bold text-center">예정된 학사일정이 없습니다.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {dailyEvents.map(ev => {
                    const hasAnnouncement = !!ev?.announcement?.trim();
                    return (
                      <div 
                        key={ev.id} 
                        onClick={() => { setSelectedEventForDetail(ev); setIsEventDetailOpen(true); }}
                        className={`p-4 rounded-2xl border flex flex-col gap-1.5 shadow-sm transition-all hover:shadow-md cursor-pointer group active:scale-[0.98] ${ev.type === 'EXTERNAL' ? 'bg-rose-50 border-rose-100 hover:border-rose-300' : 'bg-white border-slate-200 hover:border-brand-300'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md tracking-tight ${ev.type === 'EXTERNAL' ? 'bg-rose-100 text-rose-700' : 'bg-brand-100 text-brand-700'}`}>
                              {ev?.periodStart}교시 - {ev?.periodEnd}교시
                            </span>
                            {hasAnnouncement && (
                              <span className="flex items-center gap-1 text-[9px] font-black bg-white text-brand-600 border border-brand-100 px-1.5 py-0.5 rounded shadow-sm">
                                📝 메모
                              </span>
                            )}
                          </div>
                          {ev?.type === 'EXTERNAL' && <span className="text-[10px] font-bold text-rose-500 bg-white px-1.5 py-0.5 rounded shadow-sm border border-rose-100">외부행사</span>}
                        </div>
                        <p className={`font-bold text-[15px] ${ev.type === 'EXTERNAL' ? 'text-rose-900' : 'text-slate-800'} group-hover:text-brand-700 transition-colors`}>{ev?.description}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Timeline View (70%) */}
          <div className="w-full lg:w-[70%] bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col relative min-h-[500px]">
           
           {/* Date Navigation Bar */}
           <div className="bg-brand-50 border-b border-brand-100 p-4 flex items-center justify-center gap-4 relative">
              <button onClick={handlePrevDay} className="p-2 bg-white rounded-full shadow-sm text-brand-600 hover:bg-brand-100 transition-colors">
                 <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="flex flex-col items-center min-w-[200px]">
                 <span className="text-[11px] font-black text-brand-600 tracking-widest uppercase mb-1">{isToday(currentDate) ? 'TODAY' : 'DATE'}</span>
                 <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                    {format(currentDate, 'yyyy년 M월 d일')} <span className={dayOfWeekStr === '토' ? 'text-blue-500' : dayOfWeekStr === '일' ? 'text-red-500' : 'text-slate-500'}>({dayOfWeekStr})</span>
                 </h3>
              </div>

              <button onClick={handleNextDay} className="p-2 bg-white rounded-full shadow-sm text-brand-600 hover:bg-brand-100 transition-colors">
                 <ChevronRight className="w-5 h-5" />
              </button>

              <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:block">
                 <button onClick={handleToday} disabled={isToday(currentDate)} className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${isToday(currentDate) ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white shadow-sm border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    오늘
                 </button>
              </div>
           </div>

           {/* Warning Banner if Override Exists */}
           {overrideData && (
              <div className="bg-yellow-50 px-6 py-2 border-b border-yellow-100 flex items-center justify-center gap-2">
                 <AlertCircle className="w-4 h-4 text-yellow-600" />
                 <span className="text-sm font-bold text-yellow-800">이 날짜에는 변경(교체)된 시간표가 적용 중입니다.</span>
              </div>
           )}

           <div className="p-6 md:p-8 flex-1 bg-slate-50/30">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 min-h-[300px]">
                   <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
                   <p className="font-bold">시간표 데이터를 동기화 중입니다...</p>
                </div>
              ) : !baseTimetable ? (
                 <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 min-h-[300px]">
                   <AlertCircle className="w-12 h-12 text-slate-300" />
                   <div className="text-center">
                     <p className="font-bold text-lg text-slate-600 mb-2">기초 시간표가 등록되지 않았습니다.</p>
                     <p className="text-sm">테스트를 위해 상단의 <strong>[초기화 세팅]</strong> 버튼을 눌러주세요.</p>
                   </div>
                </div>
              ) : isWeekend && !overrideData ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 min-h-[300px]">
                   <CalendarDays className="w-12 h-12 text-slate-300" />
                   <div className="text-center">
                     <p className="font-bold text-lg text-slate-600 mb-2">주말입니다. 예정된 수업이 없습니다.</p>
                     <p className="text-sm">화살표를 눌러 평일 시간표를 확인하시거나 '오늘' 버튼을 누르세요.</p>
                   </div>
                </div>
              ) : !todaySchedule || todaySchedule.length === 0 || todaySchedule.every(s => !s?.subject) ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 min-h-[300px]">
                   <AlertCircle className="w-12 h-12 text-slate-300" />
                   <div className="text-center">
                     <p className="font-bold text-lg text-slate-600 mb-2">오늘은 배정된 수업 내역이 없습니다.</p>
                     <p className="text-sm">모두 공강입니다.</p>
                   </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {todaySchedule?.map((slot) => {
                    const hasClass = !!slot?.subject;
                    return (
                      <div 
                        key={slot?.period}
                        onClick={() => handleCardClick(slot)}
                        className={`relative p-5 rounded-2xl border-2 transition-all flex flex-col items-start min-h-[140px]
                          ${hasClass 
                            ? 'bg-white border-slate-200 hover:border-brand-500 hover:shadow-xl cursor-pointer group' 
                            : 'bg-slate-100/50 border-transparent border-dashed hover:bg-slate-100 cursor-default'
                          }
                        `}
                      >
                         <div className="flex items-center justify-between w-full mb-4">
                            <span className={`px-3 py-1 rounded-lg text-sm font-black ${hasClass ? 'bg-brand-100 text-brand-700' : 'bg-slate-200 text-slate-500'}`}>
                               {slot?.period}교시
                            </span>
                            {hasClass && (
                              <span className="text-xs font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-100 px-2 py-1 rounded-md flex items-center gap-1">
                                자동 교체 매칭
                              </span>
                            )}
                         </div>

                         {hasClass ? (
                           <div className="flex-1 flex flex-col justify-center">
                             <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2 mb-1">
                                <BookOpen className="w-5 h-5 text-brand-500" />
                                {slot?.subject}
                             </h3>
                             <p className="text-slate-500 font-bold ml-7">{slot?.gradeClass}</p>
                           </div>
                         ) : (
                           <div className="flex-1 flex items-center justify-center w-full">
                             <p className="text-slate-400 font-bold text-lg tracking-widest">공강</p>
                           </div>
                         )}
                      </div>
                    );
                  })}
                </div>
              )}
           </div>
        </div>
        </div>
      </main>

      <SmartReplacementModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        sourceSlot={selectedSlot}
        myTimetable={baseTimetable}
      />

      {/* 학사일정 상세 보기 팝업 (Phase 9) */}
      {isEventDetailOpen && selectedEventForDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`p-6 flex justify-between items-center ${selectedEventForDetail.type === 'EXTERNAL' ? 'bg-rose-50' : 'bg-brand-50'}`}>
              <div className="flex flex-col">
                <span className={`text-[11px] font-black uppercase tracking-widest mb-1 ${selectedEventForDetail.type === 'EXTERNAL' ? 'text-rose-600' : 'text-brand-600'}`}>School Event Details</span>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">학사 일정 상세 정보</h2>
              </div>
              <button 
                onClick={() => setIsEventDetailOpen(false)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-full transition-all shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 space-y-8">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">행사 명칭</label>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${selectedEventForDetail.type === 'EXTERNAL' ? 'bg-rose-100 text-rose-600' : 'bg-brand-100 text-brand-600'}`}>
                    <Calendar className="w-5 h-5" />
                  </div>
                  <p className="text-xl font-black text-slate-800 tracking-tight">{selectedEventForDetail.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">일자</label>
                  <p className="text-sm font-black text-slate-700 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    {format(new Date(selectedEventForDetail.date), 'yyyy년 M월 d일')}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">운영 교시</label>
                  <p className="text-sm font-black text-slate-700 flex items-center gap-2">
                    <MonitorPlay className="w-4 h-4 text-slate-400" />
                    {selectedEventForDetail.periodStart}교시 ~ {selectedEventForDetail.periodEnd}교시
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                   전달사항 (메모)
                   {selectedEventForDetail.announcement?.trim() && <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" />}
                </label>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 min-h-[120px]">
                  {selectedEventForDetail.announcement?.trim() ? (
                    <p className="text-[15px] font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedEventForDetail.announcement}</p>
                  ) : (
                    <p className="text-sm font-bold text-slate-400 italic">등록된 전달사항이 없습니다.</p>
                  )}
                </div>
              </div>

              <button 
                onClick={() => setIsEventDetailOpen(false)}
                className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black shadow-lg shadow-slate-200 hover:bg-slate-900 transition-all active:scale-95"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
