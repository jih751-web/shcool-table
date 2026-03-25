import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Clock, AlertCircle, ChevronLeft, ChevronRight, MonitorPlay, Calendar, X, ArrowRightLeft, UserPlus, CheckCircle2, Star, Bot, BookOpen, CalendarDays, Share, Megaphone, Edit2, ChevronDown, ChevronUp } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, collection, query, where, addDoc, serverTimestamp, updateDoc, setDoc } from 'firebase/firestore';
import type { Timetable, ClassSlot, Override, SchoolEvent, Todo, TimetableOverride } from '../types';

import SmartReplacementModal from '../components/SmartReplacementModal';
import { addDays, subDays, format, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import FortuneWidget from '../components/FortuneWidget';
import NicknameModal from '../components/NicknameModal';
import { healingQuotes } from '../data/healingQuotes';

import Header from '../components/Header';
import QuickButtons from '../components/QuickButtons';
import SharedToolsWidget from '../components/SharedToolsWidget';

// --- Healing Quote Widget (Wide Banner Style) ---
const HealingQuoteWidget = () => {
  const [quote, setQuote] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const randomIndex = Math.floor(Math.random() * healingQuotes.length);
    setQuote(randomIndex >= 0 ? healingQuotes[randomIndex] : "");
  }, []);

  if (!isMounted || !quote) return null;

  return (
    <div className="flex flex-col lg:flex-row items-center justify-between gap-4 md:gap-6 py-4 md:py-6 px-6 md:px-10 bg-white/95 backdrop-blur-md rounded-[2.5rem] border-2 border-indigo-100/50 shadow-xl animate-in fade-in slide-in-from-right-4 duration-700 w-full lg:flex-1 lg:ml-6 hover:shadow-2xl transition-all group overflow-hidden relative min-h-[5rem]">
      <div className="absolute -right-4 -top-4 w-32 h-32 bg-indigo-50/50 rounded-full blur-3xl group-hover:bg-indigo-100/50 transition-colors"></div>
      
      <div className="flex items-center gap-4 md:gap-6 flex-1 min-w-0">
        <div className="flex items-center justify-center w-12 h-12 bg-indigo-50 rounded-2xl text-2xl shadow-inner group-hover:scale-110 transition-transform shrink-0 border border-indigo-100/50 relative z-10">
          🍀
        </div>
        <p 
          className="text-indigo-900 whitespace-normal break-keep relative z-10 flex-1 min-w-0" 
          style={{ 
            fontFamily: "'Jua', sans-serif",
            fontSize: 'clamp(1.1rem, 3.5vw, 1.6rem)',
            lineHeight: '1.4',
            textShadow: '1px 1px 2px rgba(255, 255, 255, 0.8), 0px 0px 8px rgba(79, 70, 229, 0.1)'
          }}
        >
          {quote}
        </p>
      </div>

      <div className="relative z-10 shrink-0">
        <QuickButtons />
      </div>
    </div>
  );
};




export default function DashboardPage() {
  const { user, userData } = useAuth();
  const [baseTimetable, setBaseTimetable] = useState<Timetable | null>(null);
  const [overrideData, setOverrideData] = useState<Override | null>(null);
  const [timetableOverrides, setTimetableOverrides] = useState<TimetableOverride[]>([]);
  const [dailyEvents, setDailyEvents] = useState<SchoolEvent[]>([]);
  const [eventError, setEventError] = useState<string | null>(null); // 에러 상태 추가

  const [selectedEventForDetail, setSelectedEventForDetail] = useState<SchoolEvent | null>(null);
  const [isEventDetailOpen, setIsEventDetailOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // 급식 상태
  const [mealData, setMealData] = useState<{ type: string; items: string[] }[]>([]);
  const [isMealLoading, setIsMealLoading] = useState(false);
  const [mealError, setMealError] = useState<string | null>(null);
  
  // 기준 날짜 상태 (기본값: 오늘)
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const currentDateStr = format(currentDate, 'yyyy-MM-dd');
  const dayOfWeekStr = format(currentDate, 'E', { locale: ko }); // '월', '화' ...

  // 모달 및 드롭다운 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChoiceOpen, setIsChoiceOpen] = useState(false);
  const [initialMode, setInitialMode] = useState<'SWAP' | 'MAKEUP'>('SWAP');
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{dayOfWeek: string, period: number, subject: string, gradeClass: string, date: string} | null>(null);

  // Todo 상태
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todoInput, setTodoInput] = useState('');
  const [dashNotice, setDashNotice] = useState<string>('');
  const [isNoticeLoading, setIsNoticeLoading] = useState(true);
  const [isNoticeEditModalOpen, setIsNoticeEditModalOpen] = useState(false);
  const [noticeEditInput, setNoticeEditInput] = useState('');
  const [isNoticeSaving, setIsNoticeSaving] = useState(false);
  const [isNoticeExpanded, setIsNoticeExpanded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  // PWA Install Prompt State (초안전 모드 관리)
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // 1. PWA 설치 및 환경 체크 (Ultra-Safe Wrapper)
    try {
      if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
        // 2. 카카오톡 탈출 후 초기화 (강제 1회 새로고침)
        const params = new URLSearchParams(window.location.search);
        const isFromKakao = params.get('from_kakaotalk') === 'true';
        const alreadyReloaded = sessionStorage.getItem('ulleung_reloaded_from_kakao') === 'true';

        if (isFromKakao && !alreadyReloaded) {
          try {
            sessionStorage.setItem('ulleung_reloaded_from_kakao', 'true');
            params.delete('from_kakaotalk');
            const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
            window.history.replaceState({}, '', newUrl);
            window.location.reload();
          } catch (storageErr) {
            console.warn('Storage access denied, skipping reload sync:', storageErr);
          }
        }

        return () => {
        };
      }
    } catch (err) {
      console.error('PWA Initialization safely failed:', err);
    }
  }, []);



  // [성능 최적화] PDF Base64 캐싱 (메모리 내)

  // 1. 기초 시간표(Base) 실시간 구독
  useEffect(() => {
    if (!user) return;
    const unsubBase = onSnapshot(doc(db, 'timetables', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setBaseTimetable({ id: docSnap.id, ...docSnap.data() } as Timetable);
      } else {
        setBaseTimetable(null);
      }
    }, (error) => {
      console.error("Base timetable error:", error);
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
    }, (error) => {
      console.error("Override error:", error);
      setLoading(false);
    });
    return () => unsubOverride();
  }, [user, currentDateStr]);

  // 2.5 전역 실시간 변동(TimetableOverride) 구독 (Phase 13)
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'timetable_overrides'),
      where('date', '==', currentDateStr)
    );
    const unsubGlobalOverrides = onSnapshot(q, (snapshot) => {
      const ovs: TimetableOverride[] = [];
      snapshot.forEach(docSnap => {
        ovs.push({ id: docSnap.id, ...docSnap.data() } as TimetableOverride);
      });
      setTimetableOverrides(ovs);
    }, (error) => {
      console.error("Global overrides error:", error);
    });
    return () => unsubGlobalOverrides();
  }, [user, currentDateStr]);

  // 3. 오늘의 학사일정 실시간 구독 (신규: 기간 설정 지원)
  useEffect(() => {
    setEventError(null);
    
    // 범위 쿼리를 위해 모든 일정을 가져와 클라이언트에서 필터링 (데이터 양이 적으므로 효율적)
    const q = query(collection(db, 'events'));
    
    const unsubEvents = onSnapshot(q, (snapshot) => {
      const evs: SchoolEvent[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as SchoolEvent;
        const id = docSnap.id;
        
        // 기간 체크 로직: 시작일 <= 오늘 <= 종료일
        const isEventToday = (data.startDate && data.endDate)
          ? (currentDateStr >= data.startDate && currentDateStr <= data.endDate)
          : (data.date === currentDateStr);

        if (isEventToday) {
          evs.push({ ...data, id });
        }
      });
      // 교시 순 정렬
      evs.sort((a, b) => a.periodStart - b.periodStart);
      
      setDailyEvents(prev => {
        if (JSON.stringify(prev) === JSON.stringify(evs)) return prev;
        return evs;
      });
    }, (error) => {
      console.error("Dashboard Events onSnapshot error:", error);
      setEventError("일정을 불러오는 중 오류가 발생했습니다.");
    });

    return () => unsubEvents();
  }, [currentDateStr]);

  // 4. NEIS 급식 데이터 가져오기
  useEffect(() => {
    const fetchMealData = async () => {
      setIsMealLoading(true);
      setMealError(null);
      setMealData([]);
      try {
        const dateParam = currentDateStr.replace(/-/g, '');
        // 경상북도교육청(R10), 울릉중학교(8981025)
        const response = await fetch(`https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&ATPT_OFCDC_SC_CODE=R10&SD_SCHUL_CODE=8981025&MLSV_YMD=${dateParam}`);
        const data = await response.json();
        
        if (data.mealServiceDietInfo && data.mealServiceDietInfo[1].row) {
          const meals = data.mealServiceDietInfo[1].row
            .filter((rowItem: any) => rowItem.MMEAL_SC_NM.includes('중식') || rowItem.MMEAL_SC_NM.includes('석식'))
            .map((rowItem: any) => {
              const rawMeal = rowItem.DDISH_NM;
              // 알레르기 번호 제거, 정규식으로 <br/> 처리
              const parsed = rawMeal
                .replace(/[0-9.]/g, '') // 숫자 및 마침표 제거
                .replace(/\(\)/g, '')   // 빈 괄호 제거
                .replace(/\s+/g, ' ')   // 다중 공백 단일 공백으로
                .split(/<br\s*\/?>/i)   // 줄바꿈 기준으로 배열화
                .map((item: string) => item.trim())
                .filter((item: string) => item.length > 0);
                
              return {
                type: rowItem.MMEAL_SC_NM,
                items: parsed
              };
            });

          if (meals.length > 0) {
            setMealData(meals);
          } else {
            setMealError('예정된 중식/석식이 없습니다.');
          }
        } else {
          // 급식이 없는 날
          setMealError('예정된 중식/석식이 없습니다.');
        }
      } catch (err) {
        setMealError('급식 정보를 불러오는데 실패했습니다.');
      } finally {
        setIsMealLoading(false);
      }
    };

    fetchMealData();
  }, [currentDateStr]);

  // 오늘의 한 줄 공지 실시간 구독
  useEffect(() => {
    const noticeRef = doc(db, 'settings', 'dashboard_notice');
    const unsubscribe = onSnapshot(noticeRef, (docSnap) => {
      if (docSnap.exists()) {
        setDashNotice(docSnap.data().text || '');
      } else {
        setDashNotice('오늘의 공지사항이 없습니다.');
      }
      setIsNoticeLoading(false);
    }, (err) => {
      console.error("Notice onSnapshot error:", err);
      setIsNoticeLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleEditNotice = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setNoticeEditInput(dashNotice === '오늘의 공지사항이 없습니다.' ? '' : dashNotice);
    setIsNoticeEditModalOpen(true);
  };

  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    let text = noticeEditInput.trim();
    if (text.length > 100) {
      alert("공지사항은 최대 100자까지만 입력할 수 있습니다. (현재 " + text.length + "자)");
      text = text.substring(0, 100);
    }
    
    setIsNoticeSaving(true);
    const finalNotice = text || '오늘의 공지사항이 없습니다.';
    
    try {
      await updateDoc(doc(db, 'settings', 'dashboard_notice'), {
        text: finalNotice,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid
      }).catch(async (err) => {
        if (err.code === 'not-found') {
          await setDoc(doc(db, 'settings', 'dashboard_notice'), {
            text: finalNotice,
            updatedAt: serverTimestamp(),
            updatedBy: user?.uid
          });
        } else {
          throw err;
        }
      });
      setIsNoticeEditModalOpen(false);
    } catch (err: any) {
      alert("공지 저장 실패: " + err.message);
    } finally {
      setIsNoticeSaving(false);
    }
  };

  // 5. 할 일 목록(Todo) 실시간 구독
  useEffect(() => {
    if (!user) return;

    // 조건: 내 할 일 AND 완료되지 않음
    // 인덱스 에러 방지를 위해 쿼리를 단순화하고 클라이언트에서 필터링함 (date/isStarred/orderBy)
    const q = query(
      collection(db, 'todos'),
      where('userId', '==', user.uid),
      where('isCompleted', '==', false)
    );

    const unsubTodos = onSnapshot(q, (snapshot) => {
      const items: Todo[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Todo;
        // 클라이언트 사이드 필터링: (날짜가 같거나 OR 별표가 쳐져 있거나)
        if (data.date === currentDateStr || data.isStarred) {
          items.push({ id: docSnap.id, ...data });
        }
      });
      // 기간 내 최신순 정렬 (timestamp 기준)
      items.sort((a, b) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return timeB - timeA;
      });
      setTodos(items);
    }, (error) => {
      console.error("Todo error:", error);
    });

    return () => unsubTodos();
  }, [user, currentDateStr]);

  // Todo Handlers
  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !todoInput.trim()) return;

    try {
      await addDoc(collection(db, 'todos'), {
        userId: user.uid,
        text: todoInput.trim(),
        date: currentDateStr,
        isCompleted: false,
        isStarred: false,
        timestamp: serverTimestamp()
      });
      setTodoInput('');
    } catch (e) {
      console.error("Add todo error:", e);
    }
  };

  const toggleTodoStar = async (todo: Todo) => {
    if (!todo.id) return;
    try {
      await updateDoc(doc(db, 'todos', todo.id), {
        isStarred: !todo.isStarred
      });
    } catch (e) {
      console.error("Toggle star error:", e);
    }
  };

  const toggleTodoComplete = async (todo: Todo) => {
    if (!todo.id) return;
    try {
      // 즉시 사라지기 전 상태 반영 (UI 피드백)
      await updateDoc(doc(db, 'todos', todo.id), {
        isCompleted: true
      });
    } catch (e) {
      console.error("Complete todo error:", e);
    }
  };

  // Date Navigation Handlers
  const handlePrevDay = () => setCurrentDate(prev => subDays(prev, 1));
  const handleNextDay = () => setCurrentDate(prev => addDays(prev, 1));
  const handleToday = () => setCurrentDate(new Date());

  // Merge Logic: 오버라이드(기존/신규) 병합 로직
  const getTodaySchedule = (): ClassSlot[] => {
    // 1. 기초 시간표에서 오늘의 요일 데이터 가져오기
    let currentSlots: ClassSlot[] = [];
    if (baseTimetable) {
      const baseDay = baseTimetable.schedule.find(d => d.dayOfWeek === dayOfWeekStr);
      if (baseDay) {
        currentSlots = JSON.parse(JSON.stringify(baseDay.slots));
      }
    }

    // 2. 기초적인 변동 데이터(Override)가 있다면 1차 적용 (기존 로직 유지)
    if (overrideData) {
      currentSlots = JSON.parse(JSON.stringify(overrideData.slots));
    }

    // 3. 신규 실시간 변동 내역(timetable_overrides) 병합 (3대 원칙 1번: 쌍방향 반영)
    if (timetableOverrides.length > 0 && user) {
      timetableOverrides.forEach(ov => {
        // A. 내가 원래 들어가야 할 수업이 다른 교사로 바뀌었거나 사라진 경우 (공강 처리)
        if (ov.originalTeacherId === user.uid) {
          const slot = currentSlots.find(s => s.period === ov.period);
          if (slot) {
            slot.subject = '';
            slot.gradeClass = '';
          }
        }
        // B. 내가 다른 사람의 수업을 대신 들어가거나(MAKEUP), 내 수업이 이 시간으로 교체되어 들어온 경우(SWAP)
        if (ov.newTeacherId === user.uid) {
          const slot = currentSlots.find(s => s.period === ov.period);
          if (slot) {
            slot.subject = ov.subject;
            slot.gradeClass = ov.gradeClass;
            const tag = ov.type === 'MAKEUP' ? ' (보강)' : ' (대강)';
            if (!slot.subject.includes(tag)) {
               slot.subject += tag;
            }
          }
        }
      });
    }

    return currentSlots;
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
    setIsChoiceOpen(true);
  };

  const openSmartModal = (mode: 'SWAP' | 'MAKEUP') => {
    setInitialMode(mode);
    setIsChoiceOpen(false);
    setIsModalOpen(true);
  };


  // Safety Wrapper: 브라우저 환경이 준비되기 전에는 아무것도 렌더링하지 않음
  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 md:p-8 shrink-0 flex flex-col items-center">
        
        {/* Welcome Section */}
        <div className="w-full mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4 flex-wrap">
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">
                안녕하세요, <span className="text-brand-600">{userData?.nickname || baseTimetable?.teacherName || '선생님'}</span>!
              </h2>
              
              {/* Shortcut Badges Group (2x2 Grid) */}
              <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-left-4 duration-500">
                <a 
                  href="https://gbe.eduptl.kr" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center px-2 py-0.5 rounded-lg bg-slate-800 text-white text-[10px] font-black hover:bg-slate-700 transition-colors shadow-sm whitespace-nowrap" 
                  title="업무포털 바로가기"
                >
                  업무
                </a>
                <a 
                  href="https://www.gbe.kr/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center justify-center px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black hover:bg-emerald-500 transition-colors shadow-sm whitespace-nowrap" 
                  title="경북교육청 바로가기"
                >
                  경북
                </a>
                <a 
                  href="https://school.gyo6.net/ulms" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center justify-center px-2 py-0.5 rounded-lg bg-orange-500 text-white text-[10px] font-black hover:bg-orange-400 transition-colors shadow-sm whitespace-nowrap" 
                  title="학교 홈페이지 바로가기"
                >
                  울중
                </a>
                <a 
                  href="https://www.neti.go.kr/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center justify-center px-2 py-0.5 rounded-lg bg-purple-600 text-white text-[10px] font-black hover:bg-purple-500 transition-colors shadow-sm whitespace-nowrap" 
                  title="중앙교육연수원 바로가기"
                >
                  연수
                </a>
              </div>

              {/* Healing Quote Widget (Now in Header Area) */}
              <HealingQuoteWidget />

            </div>
            <p className="text-slate-500 font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" /> 일일 시간표 내역을 탐색하고 교체할 수 있습니다.
            </p>
          </div>
        </div>

        {/* 3-Column Layout Container */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Column 1: Events & Meal Panel */}
          <div className="w-full flex flex-col gap-6 sticky lg:top-24">
            {/* Events Panel */}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
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
                      return (
                        <div 
                          key={ev.id} 
                          onClick={() => { setSelectedEventForDetail(ev); setIsEventDetailOpen(true); }}
                          className={`p-4 rounded-2xl border flex flex-col gap-1.5 shadow-sm transition-all hover:shadow-md cursor-pointer group active:scale-[0.98] ${ev.type === 'EXTERNAL' ? 'bg-rose-50 border-rose-100 hover:bg-rose-100' : 'bg-white border-slate-200 hover:border-brand-300'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md tracking-tight ${ev.type === 'EXTERNAL' ? 'bg-rose-100 text-rose-700' : 'bg-brand-100 text-brand-700'}`}>
                                {ev.isAllDay ? '하루 종일' : `${ev.periodStart}교시 - ${ev.periodEnd}교시`}
                              </span>
                              {ev.startDate && ev.endDate && ev.startDate !== ev.endDate && (
                                <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded shadow-xs border border-slate-200">
                                  {ev.startDate.slice(5)} ~ {ev.endDate.slice(5)}
                                </span>
                              )}
                            </div>
                            {ev?.type === 'EXTERNAL' && <span className="text-[10px] font-bold text-rose-500 bg-white px-1.5 py-0.5 rounded shadow-sm border border-rose-100 italic">OFF</span>}
                          </div>
                          <p className={`font-bold text-[15px] ${ev.type === 'EXTERNAL' ? 'text-rose-900' : 'text-slate-800'} group-hover:text-brand-700 transition-colors`}>{ev?.description}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Meal Panel */}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col min-h-[300px] max-h-[400px]">
              <div className="bg-brand-50 border-b border-brand-100 p-4 flex items-center justify-center gap-2 shrink-0">
                <span className="text-xl">🍱</span>
                <h3 className="text-lg font-black text-slate-800 tracking-tight">오늘의 급식</h3>
              </div>
              <div 
                className="p-5 flex-1 bg-slate-50/30 overflow-y-auto"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <style>
                  {`
                    .overflow-y-auto::-webkit-scrollbar {
                      display: none;
                    }
                  `}
                </style>
                {isMealLoading ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 min-h-[150px]">
                    <span className="font-bold animate-pulse text-brand-600">급식 정보를 불러오는 중...</span>
                  </div>
                ) : mealError ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 min-h-[150px]">
                    <AlertCircle className="w-8 h-8 text-slate-300" />
                    <p className="text-sm font-bold text-center">{mealError}</p>
                  </div>
                ) : mealData.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {mealData.map((meal, idx) => (
                      <div key={idx} className="flex flex-col gap-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <span className="text-brand-600 font-black text-sm text-center">[{meal.type}]</span>
                        <div className="flex flex-col gap-1">
                          {meal.items.map((item, itemIdx) => (
                            <p key={itemIdx} className="text-slate-800 font-bold text-center text-[15px]">{item}</p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* 오늘의 운세 Widget */}
            <div className="flex-1 min-h-[300px]">
              <FortuneWidget />
            </div>
          </div>

          {/* Column 2: Timeline & To-Do List */}
          <div className="w-full flex flex-col gap-6">
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col relative min-h-[500px]">
            
            {/* 오늘의 한 줄 공지 (Whiteboard) - 포스트잇 스타일 (아코디언 접기/펼치기 지원) */}
            <div 
              className={`bg-yellow-50/80 border-l-4 border-yellow-400 shrink-0 group transition-all hover:bg-yellow-100/80 shadow-sm mb-6 flex flex-col relative ${isNoticeExpanded ? 'min-h-[110px] h-auto p-5' : 'min-h-[60px] h-[60px] p-0 justify-center'}`}
            >
              {/* Header / Clickable Area to Toggle */}
              <div 
                onClick={() => setIsNoticeExpanded(!isNoticeExpanded)}
                className={`flex items-center justify-between cursor-pointer select-none w-full h-full ${!isNoticeExpanded ? 'px-6' : 'px-1'}`}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                  <div className={`p-2 bg-yellow-200/50 rounded-xl shrink-0 ${!isNoticeExpanded ? 'self-center' : 'self-start'}`}>
                    <Megaphone className="w-5 h-5 text-yellow-700 animate-bounce-slow" />
                  </div>
                  
                  {!isNoticeExpanded && (
                    isNoticeLoading ? (
                      <div className="w-24 h-4 bg-yellow-200/50 animate-pulse rounded-lg flex-1"></div>
                    ) : (
                      <p className="text-[15.5px] font-black text-slate-800 truncate flex-1 pointer-events-none">
                        {dashNotice}
                      </p>
                    )
                  )}
                  {isNoticeExpanded && (
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black text-yellow-700 uppercase tracking-widest leading-none">
                        Today's Whiteboard
                      </span>
                      <span className="text-[10px] font-bold text-yellow-600/60 mt-0.5">상단 영역을 누르면 다시 접힙니다</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={handleEditNotice}
                    className="p-2 hover:bg-yellow-200/50 rounded-xl text-yellow-700 transition-all opacity-30 group-hover:opacity-100"
                    title="공지 수정"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <div className="p-2 text-yellow-700/50 group-hover:text-yellow-700">
                    {isNoticeExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </div>
              
              {/* Expanded Content Area */}
              {isNoticeExpanded && (
                <div className="mt-4 px-1 border-t border-yellow-200/50 pt-4 animate-in slide-in-from-top-2 duration-300">
                  <p className="text-[15.5px] font-black text-slate-800 tracking-tight leading-relaxed break-all whitespace-pre-wrap">
                    {dashNotice}
                  </p>
                </div>
              )}
            </div>
            {/* Date Navigation Bar */}
            <div className="bg-brand-50 border-b border-brand-100 p-4 pb-3 flex flex-col items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-brand-600 tracking-widest uppercase">{isToday(currentDate) ? 'TODAY' : 'DATE'}</span>
                <button 
                  onClick={handleToday} 
                  disabled={isToday(currentDate)} 
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-all ${isToday(currentDate) ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white shadow-sm border border-slate-200 text-brand-600 hover:bg-brand-50'}`}
                >
                  오늘
                </button>
              </div>
              
              <div className="flex items-center justify-center gap-6 w-full">
                <button onClick={handlePrevDay} className="p-2 bg-white rounded-full shadow-sm text-brand-600 hover:bg-brand-100 transition-colors shrink-0">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight text-center min-w-[140px]">
                  {format(currentDate, 'M월 d일')} <span className={dayOfWeekStr === '토' ? 'text-blue-500' : dayOfWeekStr === '일' ? 'text-red-500' : 'text-slate-500'}>({dayOfWeekStr})</span>
                </h3>

                <button onClick={handleNextDay} className="p-2 bg-white rounded-full shadow-sm text-brand-600 hover:bg-brand-100 transition-colors shrink-0">
                  <ChevronRight className="w-5 h-5" />
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

            <div className="p-4 md:p-5 flex-1 bg-slate-50/30">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
                  {todaySchedule?.map((slot) => {
                    const hasClass = !!slot?.subject;
                    return (
                      <div 
                        key={slot?.period}
                        onClick={() => handleCardClick(slot)}
                        className={`relative py-2 px-3 rounded-xl border-2 transition-all flex items-center justify-between gap-3
                          ${hasClass 
                            ? (slot.subject.includes('(보강)') || slot.subject.includes('(대강)')
                                ? 'bg-yellow-50 border-yellow-200 hover:border-brand-500 hover:shadow-lg cursor-pointer group'
                                : 'bg-white border-slate-200 hover:border-brand-500 hover:shadow-lg cursor-pointer group')
                            : 'bg-slate-100/50 border-transparent border-dashed hover:bg-slate-100 cursor-default'
                          }
                        `}
                      >
                         <div className="flex items-center gap-3 shrink-0">
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-black ${hasClass ? 'bg-brand-100 text-brand-700' : 'bg-slate-200 text-slate-500'}`}>
                               {slot?.period}교시
                            </span>
                         </div>

                         {hasClass ? (
                           <div className="flex-1 flex items-center justify-between min-w-0">
                             <h3 className={`text-base font-black tracking-tight flex items-center gap-1.5 truncate ${slot.subject.includes('(보강)') || slot.subject.includes('(대강)') ? 'text-brand-700' : 'text-slate-800'}`}>
                                <BookOpen className="w-4 h-4 text-brand-500 shrink-0" />
                                 {slot.subject.includes('(보강)') ? (
                                   <div className="flex flex-col">
                                     <span className="flex items-center gap-1">
                                       {slot.subject.replace(' (보강)', '')}
                                       <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded-md shadow-sm ml-1 font-black">보강</span>
                                     </span>
                                     <span className="text-[10px] text-slate-400 font-bold mt-0.5">담당: {userData?.nickname || user?.displayName}</span>
                                   </div>
                                 ) : slot.subject.includes('(대강)') ? (
                                   <div className="flex flex-col">
                                     <span className="flex items-center gap-1">
                                       {slot.subject.replace(' (대강)', '')}
                                       <span className="text-[10px] bg-brand-600 text-white px-1.5 py-0.5 rounded-md shadow-sm ml-1 font-black">대강</span>
                                     </span>
                                     <span className="text-[10px] text-slate-400 font-bold mt-0.5">담당: {userData?.nickname || user?.displayName}</span>
                                   </div>
                                 ) : (
                                   slot.subject
                                 )}
                             </h3>
                             <p className="text-slate-500 font-bold text-xs truncate ml-2">{slot.gradeClass}</p>
                           </div>
                         ) : (
                           <div className="flex-1 flex items-center justify-center">
                             <p className="text-slate-400 font-bold text-xs tracking-widest uppercase">Free</p>
                           </div>
                         )}

                         {hasClass && (
                            <div className="hidden group-hover:flex items-center gap-1 text-[9px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded shadow-sm shrink-0">
                               교체 매칭
                            </div>
                         )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          
          <SharedToolsWidget />
        </div>

          {/* Column 3: Assistant Panel */}
          <div className="flex flex-col gap-6 sticky lg:top-24">
            {/* To-Do List (나만의 업무 수첩) - 높이 확장 (500px) */}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col h-[500px]">
               <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
                 <div className="flex items-center gap-2">
                   <CheckCircle2 className="w-5 h-5 text-brand-600" />
                   <h3 className="text-sm font-black text-slate-800 tracking-tight">나만의 업무 수첩 (To-Do)</h3>
                 </div>
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                   {todos.length} ITEMS
                 </span>
               </div>

               <div className="p-4 flex-1 overflow-hidden flex flex-col gap-4 bg-slate-50/30">
                 <form onSubmit={handleAddTodo} className="relative">
                   <input 
                     type="text"
                     value={todoInput}
                     onChange={(e) => setTodoInput(e.target.value)}
                     placeholder="새로운 할 일을 입력하고 엔터를 누르세요..."
                     className="w-full pl-4 pr-12 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:border-brand-500 transition-all placeholder:text-slate-300 shadow-sm"
                   />
                   <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-brand-600 hover:bg-brand-50 rounded-xl transition-colors">
                     <UserPlus className="w-5 h-5" />
                   </button>
                 </form>
                 <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 custom-scrollbar-hide">
                   {todos.map((todo) => (
                     <div key={todo.id} className="group flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl hover:border-brand-200 hover:shadow-md transition-all">
                       <button onClick={() => toggleTodoComplete(todo)} className="w-6 h-6 rounded-full border-2 border-slate-200 flex items-center justify-center hover:border-brand-500 hover:bg-brand-50 transition-all shrink-0">
                         <div className="w-3 h-3 rounded-full bg-transparent group-hover:bg-brand-200 transition-colors" />
                       </button>
                       <div className="flex-1 min-w-0">
                         <p className="text-[14px] font-bold text-slate-700 truncate">{todo.text}</p>
                       </div>
                       <button onClick={() => toggleTodoStar(todo)} className={`p-2 rounded-xl transition-all ${todo.isStarred ? 'text-amber-500 bg-amber-50 shadow-inner' : 'text-slate-200 hover:text-amber-400 hover:bg-slate-50'}`}>
                         <Star className={`w-4 h-4 ${todo.isStarred ? 'fill-amber-500' : ''}`} />
                       </button>
                     </div>
                   ))}
                 </div>
               </div>
            </div>

            {/* 울릉이 (지능형 업무 비서) - 높이 축소 (350px) */}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col h-[350px] group/card transition-all hover:shadow-2xl">
              {/* Card Header (Sea Theme) */}
              {/* Card Header (Sea Theme) - 패딩 축소 */}
              <div className="bg-gradient-to-br from-blue-600 to-sky-400 p-6 flex flex-col items-center justify-center text-center gap-3 shrink-0 relative overflow-hidden">
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                <div className="relative z-10 p-3 bg-white/20 backdrop-blur-md text-white rounded-2xl shadow-xl border border-white/30 animate-bounce-slow">
                  <Bot className="w-8 h-8" />
                </div>
                <div className="relative z-10">
                  <h3 className="text-xl font-black text-white tracking-tight drop-shadow-md">
                    지능형 업무 비서 <span className="text-yellow-200">울릉이</span>
                  </h3>
                  <p className="text-blue-50 text-[10px] font-bold mt-1 opacity-90 uppercase tracking-[0.2em]">Powered by NotebookLM</p>
                </div>
              </div>

              {/* Main Action Area - 중앙 정렬 및 간격 최적화 */}
              <div className="flex-1 p-6 flex flex-col items-center justify-center gap-6 bg-slate-50/30">
                 <div className="text-center space-y-2">
                   <p className="text-slate-500 font-bold text-[13px] leading-tight break-keep whitespace-normal">
                     학교 규정, 학술 자료, 복무 지침 등<br/>
                     궁금한 모든 것을 울릉이에게 물어보세요!
                   </p>
                   <p className="text-brand-600/70 font-black text-[11px] leading-tight mt-2 opacity-80">
                     ※ 울릉이에게 한 개별 질문은 그 누구도 알 수 없습니다.
                   </p>
                 </div>

                {/* NotebookLM Button */}
                <a 
                  href="https://notebooklm.google.com/notebook/265c1fe6-51ce-4b03-8db1-5f9fce66c78f"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full relative group"
                >
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-sky-500 rounded-2xl blur opacity-25 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
                  <button className="relative w-full bg-gradient-to-r from-blue-700 to-sky-500 hover:from-blue-800 hover:to-sky-600 text-white font-black py-4 px-6 rounded-2xl shadow-lg transition-all transform group-hover:-translate-y-1 active:translate-y-0.5 flex items-center justify-center gap-3">
                    <span className="text-sm tracking-tighter">울릉이에게 질문하기</span>
                    <ArrowRightLeft className="w-5 h-5 rotate-45" />
                  </button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <SmartReplacementModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        sourceSlot={selectedSlot}
        myTimetable={baseTimetable}
        initialMode={initialMode}
      />

      <NicknameModal 
        isOpen={isNicknameModalOpen}
        onClose={() => setIsNicknameModalOpen(false)}
      />

      {/* 시간표 클릭 시 교체/보강 선택 팝업 */}
      {isChoiceOpen && selectedSlot && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-brand-50 border-b border-brand-100 text-center">
              <p className="text-[11px] font-black text-brand-600 uppercase tracking-widest mb-1">Schedule Action</p>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">어떤 작업을 원하시나요?</h3>
              <p className="text-xs text-slate-500 font-bold mt-1">({selectedSlot.date} {selectedSlot.period}교시 {selectedSlot.subject})</p>
            </div>
            
            <div className="p-4 flex flex-col gap-3">
              <button 
                onClick={() => openSmartModal('SWAP')}
                className="w-full p-4 flex items-center gap-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-brand-500 hover:bg-brand-50 transition-all group"
              >
                <div className="p-3 bg-brand-100 text-brand-600 rounded-xl group-hover:bg-brand-600 group-hover:text-white transition-colors">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="font-black text-slate-800 group-hover:text-brand-700">14일 스마트 교체</p>
                  <p className="text-[11px] text-slate-400 font-bold">서로 공강 시간을 맞교환합니다.</p>
                </div>
              </button>

              <button 
                onClick={() => openSmartModal('MAKEUP')}
                className="w-full p-4 flex items-center gap-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-orange-500 hover:bg-orange-50 transition-all group"
              >
                <div className="p-3 bg-orange-100 text-orange-600 rounded-xl group-hover:bg-orange-600 group-hover:text-white transition-colors">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="font-black text-slate-800 group-hover:text-orange-700">보강 요청 (Makeup)</p>
                  <p className="text-[11px] text-slate-400 font-bold">비어있는 다른 교사에게 수업을 위탁합니다.</p>
                </div>
              </button>

              <button 
                onClick={() => setIsChoiceOpen(false)}
                className="w-full py-3 mt-2 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 학사일정 상세 보기 팝업 */}
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

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">일정 기간</label>
                  <p className="text-sm font-black text-slate-700 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-brand-400" />
                    {selectedEventForDetail.startDate && selectedEventForDetail.endDate && selectedEventForDetail.startDate !== selectedEventForDetail.endDate 
                      ? `${selectedEventForDetail.startDate} ~ ${selectedEventForDetail.endDate}`
                      : selectedEventForDetail.date}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">운영 시간</label>
                  <p className="text-sm font-black text-slate-700 flex items-center gap-2">
                    <MonitorPlay className="w-4 h-4 text-brand-400" />
                    {selectedEventForDetail.isAllDay ? '하루 종일 (1~9교시)' : `${selectedEventForDetail.periodStart}교시 ~ ${selectedEventForDetail.periodEnd}교시`}
                  </p>
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
      {/* iOS PWA 설치 안내 모달 */}
      {showIOSModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm border-4 border-brand-500 overflow-hidden animate-in zoom-in-95 duration-500">
            <div className="p-8 bg-brand-500 text-center text-white">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Share className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-black tracking-tight leading-tight">
                아이폰 앱 설치 방법
              </h3>
            </div>
            
            <div className="p-10 text-center space-y-8">
              <div className="space-y-4">
                <div className="flex items-start gap-4 text-left">
                  <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-black text-xs shrink-0 mt-1">1</div>
                  <p className="text-slate-700 font-bold leading-relaxed">
                    브라우저 하단의 <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-flex items-center gap-1"><Share className="w-3.5 h-3.5" />공유</span> 버튼을 누릅니다.
                  </p>
                </div>
                <div className="flex items-start gap-4 text-left">
                  <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-black text-xs shrink-0 mt-1">2</div>
                  <p className="text-slate-700 font-bold leading-relaxed">
                    메뉴를 아래로 내려 <span className="text-brand-600 font-black">'홈 화면에 추가'</span>를 선택해 주세요! 🚀
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setShowIOSModal(false)}
                className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black shadow-lg shadow-slate-200 hover:bg-slate-900 transition-all active:scale-95"
              >
                확인했습니다
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 오늘의 한 줄 공지 편집 모달 (Textarea) */}
      {isNoticeEditModalOpen && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setIsNoticeEditModalOpen(false)}
        >
          <div 
            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg border-4 border-yellow-400 overflow-hidden animate-in zoom-in-95 duration-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 bg-yellow-400 text-center text-slate-900 border-b border-yellow-500/20">
              <div className="w-12 h-12 bg-white/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Megaphone className="w-6 h-6 text-slate-900" />
              </div>
              <h3 className="text-xl font-black tracking-tight leading-tight">
                오늘의 한 줄 공지 (화이트보드)
              </h3>
              <p className="text-[11px] font-bold text-slate-800/60 uppercase tracking-widest mt-1">
                EVERYONE CAN EDIT
              </p>
            </div>
            
            <form onSubmit={handleSaveNotice} className="p-8 space-y-6 bg-yellow-50/30">
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">공지 내용 (최대 100자)</label>
                  <span className={`text-[11px] font-black ${noticeEditInput.length > 100 ? 'text-rose-500' : 'text-slate-400'}`}>
                    {noticeEditInput.length} / 100
                  </span>
                </div>
                <textarea
                  autoFocus
                  value={noticeEditInput}
                  onChange={(e) => setNoticeEditInput(e.target.value)}
                  placeholder="모든 선생님과 공유할 공지사항을 입력해 주세요..."
                  rows={4}
                  className="w-full p-5 bg-white border-2 border-yellow-100 rounded-2xl text-[15px] font-bold focus:outline-none focus:border-yellow-400 transition-all placeholder:text-slate-300 shadow-inner resize-none min-h-[140px]"
                />
                <p className="text-[10px] text-slate-400 font-bold px-1 italic">
                  ※ 줄바꿈(Enter)이 가능하며, 저장 시 모든 선생님의 화면에 즉시 반영됩니다.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsNoticeEditModalOpen(false); }}
                  className="flex-1 py-4 bg-white border-2 border-slate-100 text-slate-400 rounded-2xl font-black hover:bg-slate-50 transition-all active:scale-95"
                >
                  취소
                </button>
                <button 
                  type="submit"
                  disabled={isNoticeSaving}
                  className={`flex-1 py-4 rounded-2xl font-black shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
                    isNoticeSaving 
                      ? 'bg-slate-100 text-slate-300 cursor-not-allowed' 
                      : 'bg-yellow-400 text-slate-900 shadow-yellow-100 hover:bg-yellow-500'
                  }`}
                >
                  {isNoticeSaving ? (
                    <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                  ) : (
                    '공지 올리기 📢'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
