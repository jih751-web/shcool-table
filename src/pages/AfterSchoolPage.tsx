import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, getDocs, updateDoc, serverTimestamp, writeBatch, setDoc } from 'firebase/firestore';
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
  UserPlus,
  Edit2,
  Download,
  ClipboardCheck,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import Header from '../components/Header';
import type { AfterSchoolClass, AfterSchoolChange } from '../types';
import * as XLSX from 'xlsx';

const Loader2 = ({ className }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

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
  const [adminSelectedTeacherId, setAdminSelectedTeacherId] = useState('');
  const [swapTargetTeacherId, setSwapTargetTeacherId] = useState('');
  const [swapType, setSwapType] = useState<'SWAP' | 'MAKEUP'>('SWAP');
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStatusGridOpen, setIsStatusGridOpen] = useState(false);
  const [swapDate, setSwapDate] = useState<Date>(new Date());
  const [swapClasses, setSwapClasses] = useState<AfterSchoolClass[]>([]);
  const [swapFormStates, setSwapFormStates] = useState<Record<string, { targetId: string; reason: string }>>({});

  // Initialize adminSelectedTeacherId when user is available
  useEffect(() => {
    if (user && !adminSelectedTeacherId) {
      setAdminSelectedTeacherId(user.uid);
    }
  }, [user]);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  // Fetch ALL Classes for Selected Date (to support Status Grid)
  useEffect(() => {
    if (!user || !userData) return;

    // 현황판 구현을 위해 모든 사용자가 해당 날짜의 전체 방과후 수업을 조회할 수 있도록 함
    const q = query(
      collection(db, 'afterSchoolClasses'), 
      where('date', '==', dateStr)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: AfterSchoolClass[] = [];
      snapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() } as AfterSchoolClass);
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

  // 교체 관리용 수업 데이터 실시간 구독
  useEffect(() => {
    const swapDateStr = format(swapDate, 'yyyy-MM-dd');
    const q = query(
      collection(db, 'afterSchoolClasses'),
      where('date', '==', swapDateStr)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: AfterSchoolClass[] = [];
      snapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() } as AfterSchoolClass);
      });
      items.sort((a, b) => a.period - b.period);
      setSwapClasses(items);
    });

    return () => unsubscribe();
  }, [swapDate]);

  // Guard for null userData - Moved AFTER all Hooks
  if (!user || !userData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
      </div>
    );
  }

  // --- CSV Bulk Upload Logic ---
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userData?.isAdmin) return;

    setIsBulkUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary', codepage: 949 }); // 한글 인코딩 고려
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 }) as any[][];

        if (rows.length < 5) {
          alert('CSV 형식이 올바르지 않습니다. (데이터 부족)');
          return;
        }

        const batch = writeBatch(db);
        let count = 0;

        // 1. 날짜 파싱 (Row 2 / Index 2)
        const dateRow = rows[2];
        const periodRow = rows[3];
        
        // 날짜 파싱 헬퍼 ( "3/16(월)" -> "2026-03-16" )
        const parseDateString = (str: string) => {
          if (!str) return null;
          const match = str.match(/(\d+)\/(\d+)/);
          if (match) {
            const m = match[1].padStart(2, '0');
            const d = match[2].padStart(2, '0');
            return `2026-${m}-${d}`;
          }
          return null;
        };

        // 2. 데이터 추출 (Row 4 / Index 4 부터 2줄씩)
        for (let i = 4; i < rows.length; i += 2) {
          const teacherName = rows[i][1]; // B열 (Index 1)
          if (!teacherName) continue;

          // 교사 ID 매칭
          const profile = Object.values(userProfiles).find(p => p.nickname === teacherName || p.name === teacherName);
          const teacherId = profile?.uid || `legacy_${teacherName}`;

          // C열(Index 2)부터 순회
          for (let col = 2; col < rows[i].length; col++) {
            const subject = rows[i][col];
            const classInfo = rows[i+1]?.[col];

            if (subject && classInfo) {
              // 날짜 결정 (짝수 열은 상속, 홀수 열은 왼쪽 참조)
              const dateIdx = col % 2 === 0 ? col : col - 1;
              const dateRaw = dateRow[dateIdx];
              const dateParsed = parseDateString(String(dateRaw || ''));
              
              if (!dateParsed) continue;

              // 교시 결정 (Index 3 데이터: "1"->8, "2"->9)
              const periodRaw = String(periodRow[col] || '');
              const period = periodRaw === '1' ? 8 : periodRaw === '2' ? 9 : null;

              if (period) {
                const classId = `${dateParsed}_${period}_${teacherId}`;
                const docRef = doc(db, 'afterSchoolClasses', classId);
                
                batch.set(docRef, {
                   date: dateParsed,
                   period,
                   teacherName: teacherName,
                   teacherId,
                   subject: String(subject).trim(),
                   gradeClass: String(classInfo).trim(),
                   createdAt: serverTimestamp()
                });
                count++;
              }
            }
          }
        }

        if (count > 0) {
          await batch.commit();
          alert(`업로드 성공! 총 ${count}개의 수업이 등록되었습니다.`);
        } else {
          alert('업로드할 데이터가 없습니다.');
        }
      } catch (err: any) {
        console.error('Bulk upload error:', err);
        alert('업로드 중 오류 발생: ' + err.message);
      } finally {
        setIsBulkUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };


  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData) return;
    setIsProcessing(true);
    try {
      // 관리자인 경우 선택된 교사의 정보를 사용, 아니면 본인 정보 사용
      const targetTeacherId = userData.isAdmin ? adminSelectedTeacherId : user.uid;
      const targetTeacher = userProfiles[targetTeacherId];
      
      // 데이터 무결성을 위해 고유 ID 생성 (날짜_교시_교사ID)
      const classId = `${dateStr}_${newClass.period}_${targetTeacherId}`;
      
      await setDoc(doc(db, 'afterSchoolClasses', classId), {
        date: dateStr,
        period: newClass.period,
        subject: newClass.subject,
        gradeClass: newClass.gradeClass,
        teacherId: targetTeacherId,
        teacherName: targetTeacher?.nickname || targetTeacher?.name || '선생님',
        createdAt: serverTimestamp()
      });
      
      setIsAddModalOpen(false);
      setNewClass({ period: 8, subject: '', gradeClass: '' });
      // 관리자라도 입력 후에는 다시 본인으로 초기화하지 않고 유지 (연속 입력 편의성)
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
  };

  const handleListSwap = async (cls: AfterSchoolClass) => {
    const formData = swapFormStates[cls.id!];
    if (!formData?.targetId || !user) {
      alert('대상 교사를 선택해 주세요.');
      return;
    }

    setIsProcessing(true);
    const swapDateStr = format(swapDate, 'yyyy-MM-dd');
    try {
      // 1. 중복 검증
      const q = query(
        collection(db, 'afterSchoolClasses'),
        where('date', '==', swapDateStr),
        where('period', '==', cls.period),
        where('teacherId', '==', formData.targetId)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        alert('해당 교사는 이미 해당 교시에 수업이 있습니다.');
        setIsProcessing(false);
        return;
      }

      const targetTeacher = Object.values(userProfiles).find(p => p.uid === formData.targetId);
      
      // 2. 기록 생성
      await addDoc(collection(db, 'afterSchoolChanges'), {
        date: swapDateStr,
        period: cls.period,
        originalTeacherId: cls.teacherId,
        originalTeacherName: cls.teacherName,
        newTeacherId: formData.targetId,
        newTeacherName: targetTeacher?.nickname || targetTeacher?.name || '선생님',
        subject: cls.subject,
        gradeClass: cls.gradeClass,
        type: 'SWAP',
        reason: formData.reason || '',
        status: 'APPROVED',
        createdAt: serverTimestamp()
      });

      // 3. 업데이트
      await updateDoc(doc(db, 'afterSchoolClasses', cls.id!), {
        teacherId: formData.targetId,
        teacherName: targetTeacher?.nickname || targetTeacher?.name || '선생님'
      });

      alert('교체가 완료되었습니다.');
      // 폼 초기화
      setSwapFormStates(prev => {
        const next = { ...prev };
        delete next[cls.id!];
        return next;
      });
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

        {/* CSV Bulk Upload Tool (Admin Only) */}
        {userData?.isAdmin && (
          <div className="bg-slate-800 rounded-3xl p-6 mb-8 shadow-xl border border-slate-700 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-brand-500/20 rounded-2xl text-brand-400">
                    <Download className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white tracking-tight">방과후 수업 CSV 일괄 업로드</h4>
                    <p className="text-slate-400 text-xs font-medium">정해진 양식의 CSV 파일을 선택하여 대량으로 등록하세요.</p>
                  </div>
               </div>
               
               <div className="flex items-center gap-3 w-full md:w-auto">
                  <input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleBulkUpload}
                    ref={fileInputRef}
                    className="hidden"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isBulkUploading}
                    className={`flex-1 md:flex-none px-6 py-3 rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-lg 
                      ${isBulkUploading 
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                        : 'bg-white text-slate-900 hover:bg-slate-50 active:scale-95'}`}
                  >
                    {isBulkUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        파싱 중...
                      </>
                    ) : (
                      <>
                        <ClipboardCheck className="w-4 h-4" />
                        CSV 파일 선택 및 업로드
                      </>
                    )}
                  </button>
               </div>
            </div>
          </div>
        )}

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

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* 1. My Classes Section (Personalized Management) */}
          <div className="xl:col-span-1 flex flex-col gap-4">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 px-2">
              <Calendar className="w-5 h-5 text-brand-500" />
              내 수업 관리
            </h3>
            {loading ? (
              <div className="bg-white rounded-3xl p-12 border border-slate-200 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
                <p className="text-slate-400 font-bold">불러오는 중...</p>
              </div>
            ) : classes.filter(c => c.teacherId === user?.uid).length === 0 ? (
              <div className="bg-white rounded-3xl p-12 border border-slate-200 flex flex-col items-center gap-3 text-center">
                <AlertCircle className="w-12 h-12 text-slate-200" />
                <p className="text-slate-400 font-bold">오늘 등록된 본인의 수업이 없습니다.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {classes.filter(c => c.teacherId === user?.uid).map(cls => (
                  <div key={cls.id} className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-brand-50 rounded-xl flex flex-col items-center justify-center text-brand-700">
                        <span className="text-xs font-black leading-none">{cls.period}</span>
                        <span className="text-[10px] font-bold uppercase">교시</span>
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-slate-800 tracking-tight">{cls.subject}</h4>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{cls.gradeClass}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                       <button 
                         onClick={() => { setSelectedClass(cls); setIsSwapModalOpen(true); }}
                         className="p-2 bg-brand-50 text-brand-600 rounded-xl hover:bg-brand-600 hover:text-white transition-all active:scale-95 shadow-sm"
                       >
                         <ArrowRightLeft className="w-4.5 h-4.5" />
                       </button>
                       <button 
                         onClick={() => handleDeleteClass(cls.id!)}
                         className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-all active:scale-95 shadow-sm"
                       >
                         <Trash2 className="w-4.5 h-4.5" />
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Change History for today */}
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 px-2 mt-6">
              <Clock className="w-5 h-5 text-orange-500" />
              내 관련 변경 내역
            </h3>
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              {changes.length === 0 ? (
                <div className="p-8 flex flex-col items-center gap-3 text-center">
                  <CheckCircle2 className="w-12 h-12 text-slate-100" />
                  <p className="text-slate-400 font-bold text-sm">아직 변경 내역이 없습니다.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {changes.map(chg => (
                    <div key={chg.id} className="p-4 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded uppercase">
                          {chg.type === 'SWAP' ? '교체' : '보강'}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400">{chg.period}교시 / {chg.gradeClass}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-700 truncate">{chg.originalTeacherName}</p>
                        <ArrowRightLeft className="w-3 h-3 text-slate-300" />
                        <p className="text-xs font-black text-brand-600 truncate">{chg.newTeacherName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. Status Grid Section (All Teachers) - Toggleable */}
          <div className="xl:col-span-2 flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                방과후 수업 일람표
              </h3>
              <button 
                onClick={() => setIsStatusGridOpen(!isStatusGridOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black transition-all"
              >
                {isStatusGridOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {isStatusGridOpen ? '일람표 접기' : '현황판 열어서 보기'}
              </button>
            </div>
            
            {isStatusGridOpen && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto animate-in fade-in slide-in-from-top-2 duration-300">
                <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="py-4 px-6 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100">교사명</th>
                    <th className="py-4 px-6 text-center text-[11px] font-black text-brand-600 uppercase tracking-widest border-r border-slate-100">8교시</th>
                    <th className="py-4 px-6 text-center text-[11px] font-black text-indigo-600 uppercase tracking-widest">9교시</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.values(userProfiles)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(teacher => {
                      const class8 = classes.find(c => c.teacherId === teacher.uid && c.period === 8);
                      const class9 = classes.find(c => c.teacherId === teacher.uid && c.period === 9);
                      
                      return (
                        <tr key={teacher.uid} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-6 font-black text-slate-700 bg-slate-50/30 border-r border-slate-100">
                            <div className="flex flex-col">
                              <span>{teacher.nickname || teacher.name}</span>
                              {teacher.uid === user?.uid && <span className="text-[9px] text-brand-500 font-bold uppercase mt-0.5">Me</span>}
                            </div>
                          </td>
                          <td className="p-2 border-r border-slate-100 min-w-[140px]">
                            {class8 ? (
                              <div 
                                onClick={() => {
                                  if (userData.isAdmin || class8.teacherId === user?.uid) {
                                    setNewClass({ period: class8.period, subject: class8.subject, gradeClass: class8.gradeClass });
                                    setAdminSelectedTeacherId(class8.teacherId);
                                    setIsAddModalOpen(true);
                                  }
                                }}
                                className={`group relative border rounded-xl p-2 text-center transition-all ${userData.isAdmin || class8.teacherId === user?.uid ? 'cursor-pointer hover:shadow-md' : ''} ${class8.teacherId === user?.uid ? 'bg-brand-50 border-brand-200' : 'bg-slate-50/50 border-slate-100'}`}
                              >
                                <p className={`text-sm font-black leading-tight ${class8.teacherId === user?.uid ? 'text-brand-900' : 'text-slate-700'}`}>{class8.subject}</p>
                                <p className="text-[10px] font-bold text-slate-400 mt-1">{class8.gradeClass}</p>
                                {(userData.isAdmin || class8.teacherId === user?.uid) && (
                                   <div className="absolute inset-0 bg-white/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-xl">
                                      <Edit2 className="w-3.5 h-3.5 text-brand-600" />
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteClass(class8.id!); }}
                                        className="p-1 bg-rose-500 text-white rounded-lg shadow-sm"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                   </div>
                                )}
                              </div>
                            ) : (
                              <div 
                                onClick={() => {
                                  if (userData.isAdmin) {
                                    setNewClass({ period: 8, subject: '', gradeClass: '' });
                                    setAdminSelectedTeacherId(teacher.uid);
                                    setIsAddModalOpen(true);
                                  }
                                }}
                                className={`flex justify-center italic text-xs h-10 items-center rounded-xl border border-dashed border-transparent transition-all ${userData.isAdmin ? 'hover:border-slate-300 hover:bg-slate-50 cursor-pointer text-slate-300' : 'text-slate-200'}`}
                              >
                                {userData.isAdmin ? <Plus className="w-4 h-4" /> : '-'}
                              </div>
                            )}
                          </td>
                          <td className="p-2 min-w-[140px]">
                            {class9 ? (
                              <div 
                                onClick={() => {
                                  if (userData.isAdmin || class9.teacherId === user?.uid) {
                                    setNewClass({ period: class9.period, subject: class9.subject, gradeClass: class9.gradeClass });
                                    setAdminSelectedTeacherId(class9.teacherId);
                                    setIsAddModalOpen(true);
                                  }
                                }}
                                className={`group relative border rounded-xl p-2 text-center transition-all ${userData.isAdmin || class9.teacherId === user?.uid ? 'cursor-pointer hover:shadow-md' : ''} ${class9.teacherId === user?.uid ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50/50 border-slate-100'}`}
                              >
                                <p className={`text-sm font-black leading-tight ${class9.teacherId === user?.uid ? 'text-indigo-900' : 'text-slate-700'}`}>{class9.subject}</p>
                                <p className="text-[10px] font-bold text-slate-400 mt-1">{class9.gradeClass}</p>
                                {(userData.isAdmin || class9.teacherId === user?.uid) && (
                                   <div className="absolute inset-0 bg-white/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-xl">
                                      <Edit2 className="w-3.5 h-3.5 text-brand-600" />
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteClass(class9.id!); }}
                                        className="p-1 bg-rose-500 text-white rounded-lg shadow-sm"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                   </div>
                                )}
                              </div>
                            ) : (
                              <div 
                                onClick={() => {
                                  if (userData.isAdmin) {
                                    setNewClass({ period: 9, subject: '', gradeClass: '' });
                                    setAdminSelectedTeacherId(teacher.uid);
                                    setIsAddModalOpen(true);
                                  }
                                }}
                                className={`flex justify-center italic text-xs h-10 items-center rounded-xl border border-dashed border-transparent transition-all ${userData.isAdmin ? 'hover:border-slate-300 hover:bg-slate-50 cursor-pointer text-slate-300' : 'text-slate-200'}`}
                              >
                                {userData.isAdmin ? <Plus className="w-4 h-4" /> : '-'}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            )}

            {/* 3. After-School Swap Management Section */}
            <div className="mt-8">
               <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4 px-2">
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <ArrowRightLeft className="w-5 h-5 text-orange-500" />
                    방과후 시간표 교체 관리
                  </h3>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <input 
                      type="date" 
                      value={format(swapDate, 'yyyy-MM-dd')}
                      onChange={(e) => setSwapDate(new Date(e.target.value))}
                      className="text-xs font-bold text-slate-700 bg-transparent outline-none"
                    />
                  </div>
               </div>

               <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
                  {swapClasses.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center gap-3">
                      <AlertCircle className="w-10 h-10 text-slate-200" />
                      <p className="text-slate-400 font-bold">해당 날짜에 등록된 수업이 없습니다.</p>
                    </div>
                  ) : (
                    swapClasses.map(cls => {
                      const canEdit = userData?.isAdmin || cls.teacherId === user?.uid;
                      const currentForm = swapFormStates[cls.id!] || { targetId: '', reason: '' };

                      return (
                        <div key={cls.id} className="p-6 hover:bg-slate-50/50 transition-colors">
                           <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                              {/* Class Info */}
                              <div className="flex items-center gap-4 min-w-[250px]">
                                 <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black ${cls.period === 8 ? 'bg-brand-50 text-brand-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                    <span className="text-sm">{cls.period}</span>
                                    <span className="text-[9px] uppercase">교시</span>
                                 </div>
                                 <div>
                                    <h4 className="text-[17px] font-black text-slate-800 tracking-tight">{cls.subject}</h4>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{cls.gradeClass}</span>
                                      <span className="text-xs font-bold text-slate-400">|</span>
                                      <span className="text-xs font-black text-slate-600">{cls.teacherName} 선생님</span>
                                    </div>
                                 </div>
                              </div>

                              {/* Action Form */}
                              {canEdit ? (
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                   <select 
                                     value={currentForm.targetId}
                                     onChange={(e) => setSwapFormStates(prev => ({ ...prev, [cls.id!]: { ...currentForm, targetId: e.target.value } }))}
                                     className="px-4 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold focus:border-orange-500 outline-none transition-all appearance-none"
                                   >
                                      <option value="">교체 대상 교사 선택</option>
                                      {Object.values(userProfiles)
                                        .filter(p => p.uid !== cls.teacherId)
                                        .sort((a,b) => a.name.localeCompare(b.name))
                                        .map(p => (
                                          <option key={p.uid} value={p.uid}>{p.nickname || p.name} 선생님</option>
                                        ))
                                      }
                                   </select>
                                   <input 
                                     type="text"
                                     placeholder="교체 사유 (선택)"
                                     value={currentForm.reason}
                                     onChange={(e) => setSwapFormStates(prev => ({ ...prev, [cls.id!]: { ...currentForm, reason: e.target.value } }))}
                                     className="px-4 py-2 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-bold focus:border-orange-500 outline-none transition-all"
                                   />
                                   <button 
                                     onClick={() => handleListSwap(cls)}
                                     disabled={isProcessing || !currentForm.targetId}
                                     className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-black shadow-lg shadow-orange-100 hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-50"
                                   >
                                      {isProcessing ? '처리중' : '교체 실행'}
                                   </button>
                                </div>
                              ) : (
                                <div className="flex-1 flex justify-end">
                                   <span className="px-4 py-2 bg-slate-50 text-slate-400 rounded-xl text-xs font-bold border border-slate-100">
                                      교능 권한이 없습니다
                                   </span>
                                </div>
                              )}
                           </div>
                        </div>
                      );
                    })
                  )}
               </div>
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
              {userData.isAdmin && (
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase ml-1">담당 교사 선택</label>
                  <select 
                    required
                    value={adminSelectedTeacherId}
                    onChange={(e) => setAdminSelectedTeacherId(e.target.value)}
                    className="w-full px-5 py-3 bg-white border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-brand-500 transition-all appearance-none"
                  >
                    {Object.values(userProfiles)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(p => (
                        <option key={p.uid} value={p.uid}>{p.nickname || p.name} 선생님</option>
                      ))
                    }
                  </select>
                </div>
              )}
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


export default AfterSchoolPage;
