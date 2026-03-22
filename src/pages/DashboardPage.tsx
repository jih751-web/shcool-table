import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, CalendarDays, Settings, CalendarRange, Clock, BookOpen, AlertCircle, ChevronLeft, ChevronRight, MonitorPlay, Calendar, Database, X, ArrowRightLeft, UserPlus, CheckCircle2, Star, Bot, Cloud, Ticket, Sun, Bell, Menu, Users } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, collection, getDocs, writeBatch, query, where, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { Timetable, ClassSlot, Override, SchoolEvent, Todo } from '../types';

import { Link } from 'react-router-dom';
import SmartReplacementModal from '../components/SmartReplacementModal';
import { addDays, subDays, format, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import NicknameModal from '../components/NicknameModal';
import { healingQuotes } from '../data/healingQuotes';

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
    <div className="hidden lg:flex items-center gap-6 py-5 px-10 bg-white/90 backdrop-blur-md rounded-[2rem] border-2 border-indigo-100 shadow-lg animate-in fade-in slide-in-from-right-4 duration-700 flex-1 ml-6 hover:shadow-xl transition-all group overflow-hidden relative">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50/50 rounded-full blur-2xl group-hover:bg-indigo-100/50 transition-colors"></div>
      <div className="flex items-center justify-center w-10 h-10 bg-indigo-50 rounded-2xl text-xl shadow-inner group-hover:scale-110 transition-transform shrink-0 border border-indigo-100/50">
        🍀
      </div>
      <p className="text-lg md:text-xl font-bold text-indigo-900 leading-relaxed whitespace-normal break-keep relative z-10" style={{ fontFamily: "'Nanum Myeongjo', serif" }}>
        {quote}
      </p>
    </div>
  );
};

// --- Quick Buttons Component ---
const QuickButtons = () => {
  return (
    <div className="flex items-center gap-3 ml-auto animate-in fade-in slide-in-from-right-4 duration-1000">
      <a
        href="https://island.theksa.co.kr/"
        target="_blank"
        rel="noopener noreferrer"
        title="여객선 예매"
        className="flex items-center justify-center w-10 h-10 bg-white rounded-full border border-indigo-100 text-indigo-600 shadow-sm hover:bg-indigo-50 hover:shadow-md transition-all group"
      >
        <Ticket className="w-5 h-5 group-hover:scale-110 transition-transform" />
      </a>
      <a
        href="https://www.windy.com/"
        target="_blank"
        rel="noopener noreferrer"
        title="실시간 날씨"
        className="flex items-center justify-center w-10 h-10 bg-white rounded-full border border-orange-100 text-orange-500 shadow-sm hover:bg-orange-50 hover:shadow-md transition-all group"
      >
        <Sun className="w-5 h-5 group-hover:rotate-12 transition-transform" />
      </a>
      <a
        href="https://www.ulleung.go.kr/ko/page.do?mnu_uid=2058"
        target="_blank"
        rel="noopener noreferrer"
        title="울릉 알리미"
        className="flex items-center justify-center w-10 h-10 bg-white rounded-full border border-slate-100 text-slate-700 shadow-sm hover:bg-slate-50 hover:shadow-md transition-all group"
      >
        <Bell className="w-5 h-5 group-hover:animate-pulse transition-all" />
      </a>
    </div>
  );
};



export default function DashboardPage() {
  const { user, userData, logout } = useAuth();
  const [baseTimetable, setBaseTimetable] = useState<Timetable | null>(null);
  const [overrideData, setOverrideData] = useState<Override | null>(null);
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{dayOfWeek: string, period: number, subject: string, gradeClass: string, date: string} | null>(null);

  // Todo 상태
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todoInput, setTodoInput] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  // 카카오톡 탈출 후 초기화 (강제 1회 새로고침)
  useEffect(() => {
    setIsMounted(true);
    
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const isFromKakao = params.get('from_kakaotalk') === 'true';
      const alreadyReloaded = sessionStorage.getItem('ulleung_reloaded_from_kakao') === 'true';

      if (isFromKakao && !alreadyReloaded) {
        // 파라미터 제거 후 세션 표시하고 새로고침
        sessionStorage.setItem('ulleung_reloaded_from_kakao', 'true');
        params.delete('from_kakaotalk');
        const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
        window.history.replaceState({}, '', newUrl);
        window.location.reload();
      }
    }
  }, []);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // 드롭다운 외부 클릭 감지 (모바일 대응)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    
    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isSettingsOpen]);

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
        const isToday = (data.startDate && data.endDate)
          ? (currentDateStr >= data.startDate && currentDateStr <= data.endDate)
          : (data.date === currentDateStr);

        if (isToday) {
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
    setIsChoiceOpen(true);
  };

  const openSmartModal = (mode: 'SWAP' | 'MAKEUP') => {
    setInitialMode(mode);
    setIsChoiceOpen(false);
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


  // Safety Wrapper: 브라우저 환경이 준비되기 전에는 아무것도 렌더링하지 않음
  if (!isMounted) return null;

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

          <div className="flex items-center gap-2">
            {isMounted && user?.email === 'jih751@gmail.com' ? (
              // 1. 최고 관리자(Admin) 전용: 톱니바퀴 드롭다운
                <div className="relative" ref={settingsRef}>
                  <button 
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className={`p-2.5 rounded-2xl border transition-all shadow-sm active:scale-95
                      ${isSettingsOpen ? 'bg-brand-50 border-brand-200 text-brand-600 ring-4 ring-brand-500/10' : 'bg-white border-slate-200 text-slate-400 hover:text-brand-600 hover:border-brand-200'}
                    `}
                    title="관리자 설정"
                  >
                    {isMounted ? (
                      <Settings className={`w-5 h-5 ${isSettingsOpen ? 'rotate-90' : ''} transition-transform duration-300`} />
                    ) : (
                      <span className="text-xl">⚙️</span>
                    )}
                  </button>

                  {isSettingsOpen && (
                    <>
                      <div className="absolute right-0 mt-3 w-56 bg-white rounded-[2rem] shadow-2xl border border-slate-100 py-3 z-50 animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-5 py-2 border-b border-slate-50 mb-2">
                          <p className="text-[10px] font-black text-brand-600 uppercase tracking-[0.2em]">Master Admin</p>
                          <p className="text-xs font-bold text-slate-400 truncate">{user?.email}</p>
                        </div>
                        
                        <Link 
                          to="/admin/users" 
                          className="flex items-center gap-3 px-5 py-3 text-sm font-black text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-all group"
                          onClick={() => setIsSettingsOpen(false)}
                        >
                          <Users className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition-colors" /> 사용자 관리
                        </Link>

                        <button 
                          onClick={() => { setIsNicknameModalOpen(true); setIsSettingsOpen(false); }}
                          className="w-full flex items-center gap-3 px-5 py-3 text-sm font-black text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-all group"
                        >
                          <UserPlus className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition-colors" /> 나의 닉네임 설정
                        </button>

                        <Link 
                          to="/mytimetable" 
                          className="flex items-center gap-3 px-5 py-3 text-sm font-black text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-all group"
                          onClick={() => setIsSettingsOpen(false)}
                        >
                          <BookOpen className="w-4 h-4 text-slate-400 group-hover:text-brand-600 transition-colors" /> 기초 시간표 설정
                        </Link>
                        
                        <button 
                          onClick={clearSampleData}
                          className="w-full flex items-center gap-3 px-5 py-3 text-sm font-black text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-all group border-t border-slate-50 mt-2"
                        >
                          <Database className="w-4 h-4 opacity-50" /> 샘플 데이터 삭제
                        </button>

                        <button 
                          onClick={() => { logout(); setIsSettingsOpen(false); }}
                          className="w-full flex items-center gap-3 px-5 py-3 text-sm font-black text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-all group"
                        >
                          <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> 로그아웃
                        </button>
                      </div>
                    </>
                  )}
                </div>
            ) : (
              // 2. 일반 사용자: 단순 로그아웃 버튼 (톱니바퀴 숨김)
              <button 
                onClick={() => logout()}
                className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-brand-600 hover:border-brand-200 transition-all shadow-sm active:scale-95 group"
                title="로그아웃"
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

        {/* Mobile Menu Overlay */}
        {isMenuOpen && (
          <div className="lg:hidden fixed inset-0 top-16 z-50 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white border-b border-slate-200 p-6 flex flex-col gap-4 animate-in slide-in-from-top-4 duration-300 shadow-2xl">
              <Link to="/global" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl font-bold text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-all border border-slate-100">
                <CalendarRange className="w-5 h-5" /> 시간표 현황
              </Link>
              <Link to="/rooms" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl font-bold text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-all border border-slate-100">
                <MonitorPlay className="w-5 h-5" /> 특별실
              </Link>
              <Link to="/events" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl font-bold text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-all border border-slate-100">
                <Calendar className="w-5 h-5" /> 학사일정
              </Link>
              <Link to="/status" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl font-bold text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-all border border-slate-100">
                <Clock className="w-5 h-5" /> 교체현황
              </Link>
              <a 
                href="https://drive.google.com/drive/folders/1MasUNhkb4PhagYWGwpQlZzHod5xQa0fw?usp=sharing" 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl font-bold text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-all border border-slate-100"
              >
                <Cloud className="w-5 h-5" /> 규정 자료실
              </a>
            </div>
          </div>
        )}
      </header>

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
                  href="https://getis.gyo6.net/" 
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
                  href="https://school.gyo6.net/ulleungm" 
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

              {/* Quick Navigation Buttons */}
              <QuickButtons />
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
          </div>

          {/* Column 2: Timeline & To-Do List */}
          <div className="w-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col relative min-h-[500px]">
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
                            ? 'bg-white border-slate-200 hover:border-brand-500 hover:shadow-lg cursor-pointer group' 
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
                             <h3 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-1.5 truncate">
                                <BookOpen className="w-4 h-4 text-brand-500 shrink-0" />
                                {slot?.subject}
                             </h3>
                             <p className="text-slate-500 font-bold text-xs truncate ml-2">{slot?.gradeClass}</p>
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

          {/* Column 3: Assistant Panel */}
          <div className="flex flex-col gap-6 sticky lg:top-24">
            {/* To-Do List (Moved from Column 2) */}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col h-[300px]">
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

            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col h-[480px] group/card transition-all hover:shadow-2xl">
              {/* Card Header (Sea Theme) */}
              <div className="bg-gradient-to-br from-blue-600 to-sky-400 p-8 flex flex-col items-center justify-center text-center gap-4 shrink-0 relative overflow-hidden">
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                <div className="relative z-10 p-4 bg-white/20 backdrop-blur-md text-white rounded-2xl shadow-xl border border-white/30 animate-bounce-slow">
                  <Bot className="w-10 h-10" />
                </div>
                <div className="relative z-10">
                  <h3 className="text-2xl font-black text-white tracking-tight drop-shadow-md">
                    지능형 업무 비서 <span className="text-yellow-200">울릉이</span>
                  </h3>
                  <p className="text-blue-50 text-xs font-bold mt-1 opacity-90 uppercase tracking-[0.2em]">Powered by NotebookLM</p>
                </div>
              </div>

              {/* Main Action Area */}
              <div className="flex-1 p-8 flex flex-col items-center justify-between bg-slate-50/30">
                <div className="text-center space-y-3">
                  <p className="text-slate-500 font-bold text-sm leading-relaxed">
                    학교 규정, 학술 자료, 복무 지침 등<br/>
                    궁금한 모든 것을 울릉이에게 물어보세요!
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
                  <button className="relative w-full bg-gradient-to-r from-blue-700 to-sky-500 hover:from-blue-800 hover:to-sky-600 text-white font-black py-5 px-6 rounded-2xl shadow-lg transition-all transform group-hover:-translate-y-1 active:translate-y-0.5 flex items-center justify-center gap-3">
                    <span className="text-base tracking-tighter">울릉이에게 무엇이든 물어보세요!</span>
                    <ArrowRightLeft className="w-5 h-5 rotate-45" />
                  </button>
                </a>

                {/* Safety Disclosure */}
                <div className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm">
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed text-center">
                    ※ 울릉이는 구글 NotebookLM을 기반으로 작동합니다.<br/>
                    선생님들의 개별 질문 내용은 관리자도 볼 수 없으며<br/>
                    안전하게 보호되니 안심하고 이용해 주세요.
                  </p>
                </div>
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
    </div>
  );
}
