import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, getDocs, updateDoc, serverTimestamp, writeBatch, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, addDays } from 'date-fns';
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
  Download,
  ClipboardCheck
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
  
  // Date and Fetching States
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [weekClasses, setWeekClasses] = useState<AfterSchoolClass[]>([]);
  const [weekChanges, setWeekChanges] = useState<AfterSchoolChange[]>([]);
  
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

  // Initialize adminSelectedTeacherId when user is available
  useEffect(() => {
    if (user && !adminSelectedTeacherId) {
      setAdminSelectedTeacherId(user.uid);
    }
  }, [user, adminSelectedTeacherId]);

  // 주간 범위 계산 (Mon-Fri)
  const monday = addDays(selectedDate, -((selectedDate.getDay() + 6) % 7));
  const weekDates = [0, 1, 2, 3, 4].map(idx => format(addDays(monday, idx), 'yyyy-MM-dd'));
  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  // Fetch ALL Classes for the Current Week
  useEffect(() => {
    if (!user || !userData) return;

    const q = query(
      collection(db, 'afterSchoolClasses'), 
      where('date', 'in', weekDates)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: AfterSchoolClass[] = [];
      snapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() } as AfterSchoolClass);
      });
      setWeekClasses(items);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [JSON.stringify(weekDates), user, userData]);

  // Fetch Changes for the Weekly range
  useEffect(() => {
    if (!user || !userData) return;

    const q = query(
      collection(db, 'afterSchoolChanges'), 
      where('date', 'in', weekDates)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: AfterSchoolChange[] = [];
      snapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() } as AfterSchoolChange);
      });
      setWeekChanges(items);
    });
    return () => unsubscribe();
  }, [JSON.stringify(weekDates), user, userData]);

  // Derived states for current selected day (used in secondary sections)
  const classes = weekClasses.filter(c => c.date === dateStr);
  const changes = weekChanges.filter(c => c.date === dateStr);

  // Guard for null userData - AFTER all Hooks
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
        const workbook = XLSX.read(bstr, { type: 'binary', codepage: 949 });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 }) as any[][];

        if (rows.length < 5) {
          alert('CSV 형식이 올바르지 않습니다.');
          return;
        }

        const batch = writeBatch(db);
        let count = 0;
        const dateRow = rows[2];
        const periodRow = rows[3];
        
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

        for (let i = 4; i < rows.length; i += 2) {
          const teacherName = rows[i][1];
          if (!teacherName) continue;
          const profile = Object.values(userProfiles).find(p => p.nickname === teacherName || p.name === teacherName);
          const teacherId = profile?.uid || `legacy_${teacherName}`;

          for (let col = 2; col < rows[i].length; col++) {
            const subject = rows[i][col];
            const classInfo = rows[i+1]?.[col];
            if (subject && classInfo) {
              const dateIdx = col % 2 === 0 ? col : col - 1;
              const dateParsed = parseDateString(String(dateRow[dateIdx] || ''));
              if (!dateParsed) continue;
              const periodRaw = String(periodRow[col] || '');
              const period = periodRaw === '1' ? 8 : periodRaw === '2' ? 9 : null;
              if (period) {
                const classId = `${dateParsed}_${period}_${teacherId}`;
                batch.set(docRef(classId), {
                   date: dateParsed, period, teacherName, teacherId,
                   subject: String(subject).trim(), gradeClass: String(classInfo).trim(),
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
        }
      } catch (err: any) {
        console.error(err);
        alert('업로드 실패');
      } finally {
        setIsBulkUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const docRef = (id: string) => doc(db, 'afterSchoolClasses', id);

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData) return;
    setIsProcessing(true);
    try {
      const targetTeacherId = userData.isAdmin ? adminSelectedTeacherId : user.uid;
      const targetTeacher = userProfiles[targetTeacherId];
      const classId = `${dateStr}_${newClass.period}_${targetTeacherId}`;
      
      await setDoc(docRef(classId), {
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
    } catch (err) {
      console.error(err);
      alert('등록 실패');
    }
    setIsProcessing(false);
  };

  const handleDeleteClass = async (id: string) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(docRef(id));
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
      const q = query(
        collection(db, 'afterSchoolClasses'), 
        where('date', '==', selectedClass.date),
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
      await addDoc(collection(db, 'afterSchoolChanges'), {
        date: selectedClass.date,
        period: selectedClass.period,
        originalTeacherId: user.uid,
        originalTeacherName: userData?.nickname || userData?.name || '선생님',
        newTeacherId: swapTargetTeacherId,
        newTeacherName: targetTeacher?.nickname || targetTeacher?.name || '선생님',
        subject: selectedClass.subject,
        gradeClass: selectedClass.gradeClass,
        type: swapType,
        status: 'APPROVED',
        createdAt: serverTimestamp()
      });

      await updateDoc(docRef(selectedClass.id!), {
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
            <p className="text-slate-500 font-bold mt-1">방과후 수업 일정을 주간 단위로 확인하고 교체할 수 있습니다.</p>
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
          <div className="bg-slate-800 rounded-3xl p-6 mb-8 shadow-xl border border-slate-700">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-brand-500/20 rounded-2xl text-brand-400">
                    <Download className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white tracking-tight">CSV 일괄 업로드</h4>
                    <p className="text-slate-400 text-xs font-medium">CSV 파일을 선택하여 대량으로 수업을 등록하세요.</p>
                  </div>
               </div>
               <div className="flex items-center gap-3 w-full md:w-auto">
                  <input type="file" accept=".csv" onChange={handleBulkUpload} ref={fileInputRef} className="hidden" />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isBulkUploading}
                    className={`flex-1 md:flex-none px-6 py-3 rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-lg 
                      ${isBulkUploading ? 'bg-slate-700 text-slate-500' : 'bg-white text-slate-900 hover:bg-slate-50'}`}
                  >
                    {isBulkUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> 파싱 중...</> : <><ClipboardCheck className="w-4 h-4" /> CSV 업로드</>}
                  </button>
               </div>
            </div>
          </div>
        )}

        {/* Weekly View Toggle & Navigation */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 mb-8 flex flex-col items-center gap-4">
          <div className="flex items-center gap-8">
            <button onClick={() => setSelectedDate(prev => addDays(prev, -7))} className="p-3 bg-slate-100 rounded-2xl text-slate-400 hover:bg-brand-50 hover:text-brand-600 transition-all">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="text-center">
              <p className="text-[10px] font-black text-brand-600 tracking-[0.2em] uppercase mb-1">WEEKLY MATRIX</p>
              <h3 className="text-2xl font-black text-slate-800">
                {format(addDays(monday, 0), 'M월 d일')} ~ {format(addDays(monday, 4), 'M월 d일')}
              </h3>
            </div>
            <button onClick={() => setSelectedDate(prev => addDays(prev, 7))} className="p-3 bg-slate-100 rounded-2xl text-slate-400 hover:bg-brand-50 hover:text-brand-600 transition-all">
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* 주간 그리드 현황판 */}
        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden mb-12">
            <div className="p-8 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                  <Calendar className="w-7 h-7 text-brand-600" />
                  주간 방과후 시간표 현황
                </h3>
                <div className="flex items-center gap-2">
                   <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                   <span className="text-xs font-bold text-slate-500">교체된 수업</span>
                </div>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full border-collapse">
                  <thead>
                     <tr className="bg-white">
                        <th className="py-5 px-6 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-50 sticky left-0 bg-white z-10 w-[120px]">교사명</th>
                        {[0, 1, 2, 3, 4].map(idx => {
                          const d = addDays(monday, idx);
                          return (
                            <th key={idx} className="py-5 px-4 text-center border-r border-slate-50 min-w-[180px]">
                               <p className="text-[10px] font-black tracking-widest uppercase text-slate-400">{format(d, 'E', { locale: ko })}</p>
                               <p className="text-lg font-black text-slate-700">{format(d, 'd일')}</p>
                            </th>
                          );
                        })}
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {Object.values(userProfiles)
                       .sort((a, b) => a.name.localeCompare(b.name))
                       .map(teacher => (
                         <tr key={teacher.uid} className="hover:bg-slate-50/30 transition-colors group">
                            <td className="py-6 px-6 font-black text-slate-700 border-r border-slate-50 sticky left-0 bg-white group-hover:bg-slate-50 z-10">
                               {teacher.nickname || teacher.name}
                            </td>
                            {[0, 1, 2, 3, 4].map(idx => {
                               const dateKey = weekDates[idx];
                               const dayClasses = weekClasses.filter(c => c.teacherId === teacher.uid && c.date === dateKey);
                               return (
                                 <td key={idx} className="p-3 border-r border-slate-50 align-top">
                                    <div className="flex flex-col gap-2">
                                       {[8, 9].map(p => {
                                          const cls = dayClasses.find(c => c.period === p);
                                          const isChanged = weekChanges.some(chg => chg.date === dateKey && chg.period === p && (chg.originalTeacherId === teacher.uid || chg.newTeacherId === teacher.uid));
                                          if (!cls) return <div key={p} className="h-12 border border-dashed border-slate-100 opacity-20 rounded-xl"></div>;
                                          return (
                                            <div 
                                              key={p}
                                              onClick={() => {
                                                 if (userData.isAdmin || cls.teacherId === user.uid) {
                                                   setSelectedClass(cls);
                                                   setIsSwapModalOpen(true);
                                                 }
                                              }}
                                              className={`relative p-3 rounded-2xl border-2 transition-all cursor-pointer shadow-sm active:scale-95
                                                ${isChanged ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-brand-50 hover:border-brand-200'}`}
                                            >
                                               <div className="flex items-center justify-between mb-1">
                                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${isChanged ? 'bg-indigo-500 text-white' : 'bg-brand-100 text-brand-700'}`}>{p}교시</span>
                                                  {isChanged && <ArrowRightLeft className="w-2.5 h-2.5 text-indigo-500" />}
                                               </div>
                                               <p className="text-[12px] font-black text-slate-800 truncate">{cls.subject}</p>
                                               <p className="text-[10px] font-bold text-slate-400 mt-0.5">{cls.gradeClass}</p>
                                            </div>
                                          );
                                       })}
                                    </div>
                                 </td>
                               );
                            })}
                         </tr>
                       ))}
                  </tbody>
               </table>
            </div>
        </div>

        {/* 내 관리 섹션 (Secondary) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="space-y-4">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 px-2">
                <Calendar className="w-5 h-5 text-brand-500" />
                선택일 내 수업 관리 ({format(selectedDate, 'M/d')})
              </h3>
              {classes.filter(c => c.teacherId === user?.uid).length === 0 ? (
                <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center text-slate-400 font-bold">등록된 수업이 없습니다.</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {classes.filter(c => c.teacherId === user?.uid).map(cls => (
                    <div key={cls.id} className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between shadow-sm">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center text-brand-700 font-black">{cls.period}</div>
                          <div>
                            <h4 className="text-lg font-black text-slate-800 leading-tight">{cls.subject}</h4>
                            <p className="text-xs font-bold text-slate-400">{cls.gradeClass}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-2">
                          <button onClick={() => { setSelectedClass(cls); setIsSwapModalOpen(true); }} className="p-2 bg-brand-50 text-brand-600 rounded-xl hover:bg-brand-600 hover:text-white transition-all"><ArrowRightLeft className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteClass(cls.id!)} className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-500 hover:text-white transition-all"><Trash2 className="w-4 h-4" /></button>
                       </div>
                    </div>
                  ))}
                </div>
              )}
           </div>

           <div className="space-y-4">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 px-2">
                <Clock className="w-5 h-5 text-orange-500" />
                선택일 관련 변경 내역
              </h3>
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm min-h-[140px]">
                 {changes.length === 0 ? (
                    <div className="p-12 text-center text-slate-300 font-bold">내역이 없습니다.</div>
                 ) : (
                    <div className="divide-y divide-slate-100">
                       {changes.map(chg => (
                         <div key={chg.id} className="p-4 bg-white hover:bg-slate-50">
                            <div className="flex items-center justify-between mb-2">
                               <span className="text-[10px] font-black px-2 py-0.5 bg-orange-50 text-orange-600 rounded uppercase">{chg.type}</span>
                               <span className="text-[10px] font-bold text-slate-400">{chg.period}교시 / {chg.gradeClass}</span>
                            </div>
                            <div className="flex items-center gap-2 font-black text-xs text-slate-700">
                               <span>{chg.originalTeacherName}</span>
                               <ArrowRightLeft className="w-3 h-3 text-slate-300" />
                               <span className="text-brand-600">{chg.newTeacherName}</span>
                            </div>
                         </div>
                       ))}
                    </div>
                 )}
              </div>
           </div>
        </div>
      </main>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden animate-in zoom-in-95">
            <div className="p-8 bg-brand-50 border-b border-brand-100 flex justify-between items-center">
               <h3 className="text-2xl font-black text-slate-800">수업 등록</h3>
               <button onClick={() => setIsAddModalOpen(false)} className="p-2 text-slate-400 hover:bg-white rounded-full"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleAddClass} className="p-8 space-y-5">
               {userData.isAdmin && (
                 <div className="space-y-2">
                   <label className="text-[11px] font-black text-slate-400 uppercase ml-1">담당 교사</label>
                   <select required value={adminSelectedTeacherId} onChange={(e) => setAdminSelectedTeacherId(e.target.value)} className="w-full px-5 py-3 bg-white border-2 border-slate-100 rounded-2xl font-bold focus:border-brand-500 outline-none">
                     {Object.values(userProfiles).sort((a,b) => a.name.localeCompare(b.name)).map(p => (
                       <option key={p.uid} value={p.uid}>{p.nickname || p.name} 선생님</option>
                     ))}
                   </select>
                 </div>
               )}
               <div className="space-y-2">
                 <label className="text-[11px] font-black text-slate-400 uppercase ml-1">교시</label>
                 <div className="flex gap-2">
                   {[8, 9].map(p => (
                     <button key={p} type="button" onClick={() => setNewClass({...newClass, period: p})} className={`flex-1 py-3 rounded-2xl font-black transition-all border-2 ${newClass.period === p ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-400 border-slate-100'}`}>{p}교시</button>
                   ))}
                 </div>
               </div>
               <div className="space-y-2">
                 <label className="text-[11px] font-black text-slate-400 uppercase ml-1">과목명</label>
                 <input required type="text" value={newClass.subject} onChange={(e) => setNewClass({...newClass, subject: e.target.value})} className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-brand-500 outline-none" placeholder="예: 기초 수학" />
               </div>
               <div className="space-y-2">
                 <label className="text-[11px] font-black text-slate-400 uppercase ml-1">학년/반</label>
                 <input required type="text" value={newClass.gradeClass} onChange={(e) => setNewClass({...newClass, gradeClass: e.target.value})} className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-brand-500 outline-none" placeholder="예: 2-3" />
               </div>
               <button type="submit" disabled={isProcessing} className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black shadow-lg shadow-brand-100 hover:bg-brand-700 transition-all mt-4">{isProcessing ? '처리 중...' : '등록하기'}</button>
            </form>
          </div>
        </div>
      )}

      {/* Swap Modal */}
      {isSwapModalOpen && selectedClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden animate-in zoom-in-95">
            <div className="p-8 bg-orange-50 border-b border-orange-100 flex justify-between items-center">
               <h3 className="text-2xl font-black text-slate-800">수업 교체/보강</h3>
               <button onClick={() => setIsSwapModalOpen(false)} className="p-2 text-slate-400 hover:bg-white rounded-full"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSwapRequest} className="p-8 space-y-6">
               <div className="space-y-2">
                 <label className="text-[11px] font-black text-slate-400 uppercase ml-1">방식</label>
                 <div className="flex gap-2">
                   {(['SWAP', 'MAKEUP'] as const).map(t => (
                     <button key={t} type="button" onClick={() => setSwapType(t)} className={`flex-1 py-3 rounded-2xl font-black transition-all border-2 ${swapType === t ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-400 border-slate-100'}`}>{t === 'SWAP' ? '교체' : '보강'}</button>
                   ))}
                 </div>
               </div>
               <div className="space-y-2">
                 <label className="text-[11px] font-black text-slate-400 uppercase ml-1">대상 교사</label>
                 <select required value={swapTargetTeacherId} onChange={(e) => setSwapTargetTeacherId(e.target.value)} className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-orange-500 outline-none">
                   <option value="">교사 선택</option>
                   {Object.values(userProfiles).filter(p => p.uid !== user?.uid).map(p => (
                     <option key={p.uid} value={p.uid}>{p.nickname || p.name} 선생님</option>
                   ))}
                 </select>
               </div>
               <button type="submit" disabled={isProcessing || !swapTargetTeacherId} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black shadow-lg shadow-orange-100 hover:bg-orange-600 transition-all mt-4 disabled:opacity-50">{isProcessing ? '처리 중...' : '교체 실행'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AfterSchoolPage;
