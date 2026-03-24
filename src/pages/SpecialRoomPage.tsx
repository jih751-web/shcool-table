import React, { useState, useEffect, memo } from 'react';
import { collection, query, onSnapshot, setDoc, deleteDoc, doc, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { SpecialRoom, RoomBooking } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import { ArrowLeft, MonitorPlay, ChevronLeft, ChevronRight, Check, Loader2, Settings, X } from 'lucide-react';
import { startOfWeek, addWeeks, subWeeks, format, addDays } from 'date-fns';
import RoomManagementModal from '../components/RoomManagementModal';
import ConfirmModal from '../components/ConfirmModal';

const days = ['월', '화', '수', '목', '금'];
const periods = [1, 2, 3, 4, 5, 6, 7];

// --- 1. 개별 셀 컴포넌트 (독립적 상태 관리 & 메모이제이션) ---
interface BookingCellProps {
  roomId: string;
  roomName: string;
  date: string;
  period: number;
  globalBooking: RoomBooking | undefined;
  onRequestCancel: (roomId: string, date: string, period: number) => void;
}

const BookingCell = memo(({ roomId, roomName, date, period, globalBooking, onRequestCancel }: BookingCellProps) => {
  const { user, userData, userProfiles } = useAuth();
  const [optimisticBooking, setOptimisticBooking] = useState<RoomBooking | null | undefined>(undefined);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 개별 셀 내에서의 ConfirmModal 제거 (부모에서 통합 관리)

  useEffect(() => {
    setOptimisticBooking(undefined);
  }, [globalBooking]);

  const displayBooking = optimisticBooking !== undefined ? optimisticBooking : globalBooking;
  const isMyBooking = displayBooking?.teacherId === user?.uid;

  const handleCancelClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isProcessing) return;
    if (displayBooking?.teacherId !== user?.uid) {
      alert('이미 타인이 예약한 공간입니다.');
      return;
    }
    // 부모의 handleRequestCancel 호출
    onRequestCancel(roomId, date, period);
  };

  // handleConfirmCancel 제거 (부모에서 통합 관리)

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isProcessing) return;

    if (displayBooking) {
      handleCancelClick(e);
    } else {
      setIsProcessing(true);
      const newBooking: RoomBooking = {
        roomId,
        roomName,
        teacherId: user?.uid || '',
        teacherName: userData?.nickname || user?.displayName || user?.email?.split('@')[0] || '선생님',
        date,
        period,
        createdAt: new Date().toISOString()
      };
      setOptimisticBooking(newBooking);

      try {
        const docId = `${roomId}_${date}_${period}`;
        await setDoc(doc(db, 'reservations', docId), {
          ...newBooking,
          createdAt: serverTimestamp()
        });
      } catch (e: any) {
        alert(`예약 실패: ${e.message}`);
        setOptimisticBooking(undefined);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <td className="py-2 px-2 text-center relative p-1.5 align-top h-[90px]">
      <button 
        onClick={handleClick}
        disabled={isProcessing || (!!displayBooking && !isMyBooking)}
        className={`w-full h-full flex flex-col items-center justify-center p-2 rounded-xl transition-all border shadow-sm ${
          displayBooking ? (isMyBooking ? 'bg-brand-50 border-brand-400 hover:bg-brand-200 shadow-md transform hover:scale-[1.02]' : 'bg-slate-100 border-slate-200 cursor-not-allowed opacity-90') 
            : 'bg-white border-dashed border-slate-300 hover:border-brand-400 hover:bg-brand-50/50 text-slate-400 hover:text-brand-600'
        } ${isProcessing ? 'opacity-50 cursor-wait' : ''}`}
      >
        {isProcessing ? (
          <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
        ) : displayBooking ? (
          <>
            <span className={`font-black text-[14.5px] leading-tight break-all ${isMyBooking ? 'text-brand-900' : 'text-slate-700'}`}>
              {userProfiles[displayBooking.teacherId]?.nickname || displayBooking.teacherName}
            </span>
            {isMyBooking && (
              <span className="text-[10px] font-black text-white bg-brand-500 px-2 py-0.5 rounded shadow-sm mt-2 flex items-center gap-1 animate-in zoom-in-0 duration-300">
                <Check className="w-3 h-3"/>내 예약
              </span>
            )}
          </>
        ) : (
          <span className="text-[11px] font-black tracking-tight">+ 예약</span>
        )}
      </button>
    </td>
  );
});


// --- 2. 메인 페이지 컴포넌트 ---
const SpecialRoomPage: React.FC = () => {
  const [rooms, setRooms] = useState<SpecialRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [bookingsMap, setBookingsMap] = useState<Record<string, RoomBooking>>({});
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isManageMode, setIsManageMode] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<{
    isOpen: boolean;
    roomId: string;
    date: string;
    period: number;
  }>({
    isOpen: false,
    roomId: '',
    date: '',
    period: 0
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const weekStartsOn = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekStartsOnStr = format(weekStartsOn, 'yyyy-MM-dd'); // 원시 타입 의존성 생성
  const weekDisplay = `${format(weekStartsOn, 'yyyy.MM.dd')} 주간`;

  // 1. 방 목록 실시간 구독
  useEffect(() => {
    try {
      const qRooms = query(collection(db, 'specialRooms'));
      const unsubRooms = onSnapshot(qRooms, (snap) => {
        const data: SpecialRoom[] = [];
        snap.forEach(d => data.push({ id: d.id, ...d.data() } as SpecialRoom));
        
        // [방어 코드] 데이터가 실제로 다를 때만 업데이트하여 무한 루프 방지
        setRooms(prev => {
          if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
          return data;
        });

        if (data.length > 0 && (!selectedRoom || !data.find(r => r.id === selectedRoom))) {
          setSelectedRoom(data[0].id);
        }
        setIsLoading(false);
      }, (err) => {
        console.error("Firestore SpecialRooms error:", err);
        setError("데이터를 불러오는 중 문제가 발생했습니다.");
        setIsLoading(false);
      });
      return () => unsubRooms();
    } catch (e: any) {
      setError("시스템 초기화 중 오류가 발생했습니다.");
      setIsLoading(false);
    }
  }, [selectedRoom]);

  // 2. 예약 데이터 실시간 구독 (roomId 필터링 필수)
  useEffect(() => {
    // 탭 전환 시 즉시 비움 (원시 데이터 변경 시점)
    setBookingsMap({});
    
    if (!selectedRoom) return;

    const startDateStr = weekStartsOnStr;
    const endDateStr = format(addDays(weekStartsOn, 4), 'yyyy-MM-dd');

    const q = query(
      collection(db, 'reservations'),
      where('roomId', '==', selectedRoom),
      where('date', '>=', startDateStr),
      where('date', '<=', endDateStr)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMap: Record<string, RoomBooking> = {};
      snapshot.forEach(docSnap => {
        const b = { id: docSnap.id, ...docSnap.data() } as RoomBooking;
        if (b.roomId === selectedRoom) {
          newMap[`${b.date}_${b.period}`] = b;
        }
      });

      // [방어 코드] 예약 데이터가 동일하면 업데이트 건너뛰기
      setBookingsMap(prev => {
        if (JSON.stringify(prev) === JSON.stringify(newMap)) return prev;
        return newMap;
      });
    }, (err) => {
       console.error("SpecialRoom Reservations onSnapshot error:", err);
       // 인덱스 생성 대기 중 등 에러 발생 시 무한 루프 방지를 위해 상태 업데이트 최소화
    });

    return () => unsubscribe();
  }, [selectedRoom, weekStartsOnStr]); // Date 객체 대신 문자열 의존성 사용

  const handleRequestCancel = (roomId: string, date: string, period: number) => {
    setConfirmCancel({
      isOpen: true,
      roomId,
      date,
      period
    });
  };

  const handleConfirmCancel = async () => {
    const { roomId, date, period } = confirmCancel;
    try {
      const docId = `${roomId}_${date}_${period}`;
      await deleteDoc(doc(db, 'reservations', docId));
    } catch (e: any) {
      alert(`취소 실패: ${e.message}`);
    } finally {
      setConfirmCancel(prev => ({ ...prev, isOpen: false }));
    }
  };

  const selectedRoomName = rooms.find(r => r.id === selectedRoom)?.name || '';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-brand-600 mx-auto" />
          <p className="text-slate-500 font-bold">특별실 데이터를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-red-100 text-center max-w-sm">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-800 mb-2">{error}</h2>
          <p className="text-slate-500 mb-6 text-sm">페이지를 새로고침하거나 관리자에게 문의하세요.</p>
          <button onClick={() => window.location.reload()} className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all">
            다시 시도
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header />
      
      <main className="max-w-6xl mx-auto w-full py-8 px-4 sm:px-6 lg:px-8 space-y-6">
        
        {/* Page Title Area */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-brand-600 rounded-2xl shadow-sm transition-all active:scale-95">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
                <MonitorPlay className="w-6 h-6 text-brand-600" />
                특별실 예약 관리
              </h1>
              <p className="text-slate-500 font-bold mt-1">공동 사용 공간 실시간 예약 현황</p>
            </div>
          </div>
          <button 
            onClick={() => setIsManageMode(true)}
            className="flex items-center gap-2.5 px-5 py-2.5 bg-white text-slate-700 border-2 border-slate-200 rounded-2xl font-black text-sm shadow-sm hover:border-brand-500 hover:text-brand-600 hover:bg-brand-50/30 transition-all active:scale-95 group"
          >
            <Settings className="w-4 h-4 text-slate-400 group-hover:text-brand-500 transition-colors" />
            특별실 관리
          </button>
        </div>

        {/* Main Grid View */}
        <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200 flex flex-col md:flex-row gap-6 justify-between items-center transition-all">
          <div className="flex flex-wrap bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner gap-1">
            {rooms.length === 0 && <span className="text-xs text-slate-400 p-2 font-bold tracking-tight">등록된 특별실이 없습니다.</span>}
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(room.id)}
                className={`px-6 py-2.5 text-[15px] font-black rounded-xl transition-all duration-200 ${selectedRoom === room.id ? 'bg-white text-brand-700 shadow-lg border border-brand-200 ring-2 ring-brand-500/10' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}
              >
                {room.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
            <button onClick={() => setCurrentDate(prev => subWeeks(prev, 1))} className="p-2 rounded-xl hover:bg-brand-50 text-slate-400 hover:text-brand-600 transition-all active:scale-95">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-black text-slate-800 min-w-[150px] text-center tracking-tight">
              {weekDisplay}
            </h2>
            <button onClick={() => setCurrentDate(prev => addWeeks(prev, 1))} className="p-2 rounded-xl hover:bg-brand-50 text-slate-400 hover:text-brand-600 transition-all active:scale-95">
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="w-full overflow-x-auto pb-6 custom-scrollbar rounded-3xl">
          <table className="w-full min-w-[900px] border-collapse bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200 table-fixed">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 shadow-sm">
                <th className="py-5 px-4 text-slate-500 font-black w-[80px] text-center border-r border-slate-200 text-xs uppercase tracking-widest bg-slate-50/80">교시</th>
                {days.map((day, idx) => {
                  const dateObj = addDays(weekStartsOn, idx);
                  return (
                    <th key={day} className="py-4 px-4 text-slate-800 font-bold text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-[16px] font-black">{day}</span>
                        <span className="text-[10px] font-bold text-brand-500 mt-1 uppercase tracking-tighter opacity-70">
                          {format(dateObj, 'M.d')}
                        </span>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {periods.map(period => (
                <tr key={period} className="hover:bg-slate-50/30 transition-colors group">
                  <td className="py-6 px-2 text-center font-black text-slate-400 border-r border-slate-100 bg-slate-50/20 group-hover:text-brand-600 transition-colors">
                    {period}<span className="text-[10px] ml-0.5">교시</span>
                  </td>
                  {days.map((_, idx) => {
                    const targetDate = format(addDays(weekStartsOn, idx), 'yyyy-MM-dd');
                    const key = `${targetDate}_${period}`;
                    return (
                      <BookingCell 
                        key={key}
                        roomId={selectedRoom}
                        roomName={selectedRoomName}
                        date={targetDate}
                        period={period}
                        globalBooking={bookingsMap[key]}
                        onRequestCancel={handleRequestCancel}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <RoomManagementModal 
        isOpen={isManageMode}
        onClose={() => setIsManageMode(false)}
        rooms={rooms}
      />

      <ConfirmModal 
        isOpen={confirmCancel.isOpen}
        onClose={() => setConfirmCancel(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmCancel}
        type="danger"
        title="예약 취소"
        message={`${confirmCancel.date} (${confirmCancel.period}교시) 예약을 취소하시겠습니까?`}
        confirmText="예약 취소"
      />
    </div>
  );
};

export default SpecialRoomPage;


