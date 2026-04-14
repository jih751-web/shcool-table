import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ReplacementRecord } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle2, XCircle, Loader2, ArrowRightLeft } from 'lucide-react';
import Header from '../components/Header';
import { executeRollbackTransaction, executeAfterSchoolRollback } from '../utils/timetableApi';

const StatusPage: React.FC = () => {
  const { user, userData, userProfiles } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [loading, setLoading] = useState(true);
  const [rollbackLoading, setRollbackLoading] = useState<string | null>(null);
  
  // Custom Confirm Modal States
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [recordToRollback, setRecordToRollback] = useState<any>(null);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'replacements'), orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);
      const data: any[] = [];
      snap.forEach(doc => data.push({ id: doc.id, ...doc.data(), recordType: 'REGULAR' }));

      // Phase 14: 방과후 교체 내역 추가
      const q2 = query(collection(db, 'afterSchoolChanges'), orderBy('createdAt', 'desc'));
      const snap2 = await getDocs(q2);
      snap2.forEach(doc => {
        const d = doc.data();
        data.push({ 
          id: doc.id, 
          ...d, 
          timestamp: d.createdAt, // 필드명 통일
          sourceDate: d.date,
          sourcePeriod: d.period,
          requestorId: d.originalTeacherId,
          requestorName: d.originalTeacherName,
          targetId: d.newTeacherId,
          targetName: d.newTeacherName,
          recordType: 'AFTER_SCHOOL' 
        });
      });

      // 통합 정렬 (Firebase Timestamp 객체와 ISO 문자열 혼용 대응)
      data.sort((a, b) => {
        const getTime = (val: any) => {
          if (!val) return 0;
          if (typeof val === 'object' && val.seconds !== undefined) return val.seconds * 1000;
          if (typeof val === 'object' && val.toDate) return val.toDate().getTime();
          const d = new Date(val);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        };
        return getTime(b.timestamp) - getTime(a.timestamp);
      });

      setRecords(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const openRollbackConfirm = (record: any) => {
    const isMine = record.requestorId === user?.uid || record.targetId === user?.uid;
    const isAdmin = userData?.isAdmin === true;

    if (!isMine && !isAdmin) {
      alert("본인의 교체 건만 취소할 수 있습니다.");
      return;
    }
    
    setRecordToRollback(record);
    setIsConfirmOpen(true);
  };

  const handleRollback = async () => {
    if (!recordToRollback) return;
    const record = recordToRollback;
    
    setIsConfirmOpen(false);
    setRollbackLoading(record.id!);
    
    try {
      if (record.recordType === 'AFTER_SCHOOL') {
        await executeAfterSchoolRollback(record.id!);
      } else {
        await executeRollbackTransaction(record.id!);
      }
      
      alert('성공적으로 원상 복구되었습니다.');
      fetchRecords(); 
    } catch (error: any) {
      console.error("[DEBUG] Rollback failed:", error);
      alert(`복구 처리 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setRollbackLoading(null);
      setRecordToRollback(null);
    }
  };

  const filteredRecords = filter === 'all' 
    ? records 
    : records.filter(r => r.requestorId === user?.uid || r.targetId === user?.uid);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-brand-600 rounded-2xl shadow-sm transition-all active:scale-95">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                <ArrowRightLeft className="w-7 h-7 text-brand-600" />
                교체/보강 현황판
              </h1>
              <p className="text-slate-500 font-bold mt-1">실시간 시간표 변동 및 승인 내역</p>
            </div>
          </div>

          <div className="flex bg-slate-200/50 p-1 rounded-2xl self-start md:self-center border border-slate-100">
            <button
              onClick={() => setFilter('all')}
              className={`px-6 py-2 text-sm font-black rounded-xl transition-all ${filter === 'all' ? 'bg-white shadow-md text-brand-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              전체 현황
            </button>
            <button
              onClick={() => setFilter('mine')}
              className={`px-6 py-2 text-sm font-black rounded-xl transition-all ${filter === 'mine' ? 'bg-white shadow-md text-brand-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              내 관련 건
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Clock className="w-12 h-12 text-slate-300 mb-4" />
              <p>기록이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-600">
                    <th className="py-4 px-6 whitespace-nowrap text-center">구분</th>
                    <th className="py-4 px-6 whitespace-nowrap">변경 내역 (날짜/교시)</th>
                    <th className="py-4 px-6 whitespace-nowrap">신청 교사</th>
                    <th className="py-4 px-6 whitespace-nowrap">대상 교사</th>
                    <th className="py-4 px-6 whitespace-nowrap">처리 일시</th>
                    <th className="py-4 px-6 whitespace-nowrap text-center">상태</th>
                    <th className="py-4 px-6 whitespace-nowrap text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => {
                    const isMine = record.requestorId === user?.uid || record.targetId === user?.uid;
                    const isTarget = record.targetId === user?.uid;
                    return (
                      <tr 
                        key={record.id} 
                        className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${isMine ? 'bg-brand-50/20' : ''}`}
                      >
                        <td className="py-4 px-6 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black
                            ${record.type === 'SWAP' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}
                          `}>
                            {record.type === 'SWAP' ? '🔄 교체' : '⬆️ 보강'}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-medium text-slate-800">
                           <div className="flex flex-col gap-0.5">
                             <div className="flex items-center gap-2">
                               <span className="text-xs text-slate-400 font-bold">From:</span>
                               <span className="text-sm">{record.sourceDate} <b className="text-brand-600">{record.sourcePeriod}교시</b></span>
                             </div>
                             {record.type === 'SWAP' && (
                               <div className="flex items-center gap-2">
                                 <span className="text-xs text-slate-400 font-bold">To:</span>
                                 <span className="text-sm">{record.targetDate} <b className="text-brand-600">{record.targetPeriod}교시</b></span>
                               </div>
                             )}
                           </div>
                        </td>
                        <td className="py-4 px-6 text-slate-600">
                          {userProfiles[record.requestorId]?.nickname || record.requestorName} 선생님
                          {record.requestorId === user?.uid && <span className="ml-2 text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded font-bold">나 (발신)</span>}
                        </td>
                        <td className="py-4 px-6 text-slate-600">
                          {userProfiles[record.targetId]?.nickname || record.targetName} 선생님
                          {isTarget && <span className="ml-2 text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded font-bold">나 (수신)</span>}
                        </td>
                        <td className="py-4 px-6 text-slate-500 text-sm">
                          {new Date(record.timestamp || '').toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                            ${record.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                              record.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                              'bg-amber-100 text-amber-700'
                            }
                          `}>
                            {record.status === 'APPROVED' && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {record.status === 'REJECTED' && <XCircle className="w-3.5 h-3.5" />}
                            {record.status === 'PENDING' && <Clock className="w-3.5 h-3.5" />}
                            {record.status === 'APPROVED' ? '완료' : record.status === 'REJECTED' ? '거절됨' : '대기중'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                           {(isMine || userData?.isAdmin) && record.status === 'APPROVED' && (
                             <button 
                               onClick={() => openRollbackConfirm(record)}
                               disabled={rollbackLoading === record.id}
                               className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 float-right
                                 ${rollbackLoading === record.id 
                                   ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                   : 'bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white shadow-sm hover:shadow-md active:scale-95'
                                 }`}
                             >
                               {rollbackLoading === record.id ? (
                                 <>
                                   <Loader2 className="w-3 h-3 animate-spin" />
                                   처리 중
                                 </>
                               ) : (
                                 '취소'
                               )}
                             </button>
                           )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Custom Confirmation Modal */}
      {isConfirmOpen && recordToRollback && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 bg-rose-50 border-b border-rose-100 text-center relative overflow-hidden">
               <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-200/30 rounded-full blur-2xl"></div>
               <div className="relative z-10 w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 text-rose-500">
                 <XCircle className="w-8 h-8" />
               </div>
               <h3 className="text-xl font-black text-slate-800 tracking-tight relative z-10">변동 사항 취소</h3>
               <p className="text-xs text-rose-600 font-bold mt-1 opacity-80 relative z-10 uppercase tracking-widest">Rollback Confirmation</p>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2">
                 <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                    <span>대상 정보</span>
                    <span className="bg-white px-2 py-0.5 rounded-full shadow-xs">{recordToRollback.recordType === 'AFTER_SCHOOL' ? '교과방과후' : '교과수업'}</span>
                 </div>
                 <div className="text-sm font-bold text-slate-700">
                    {recordToRollback.sourceDate} {recordToRollback.sourcePeriod}교시 {recordToRollback.subject}
                 </div>
                 <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                    <ArrowRightLeft className="w-3 h-3" /> {recordToRollback.requestorName} → {recordToRollback.targetName}
                 </div>
              </div>

              <p className="text-sm font-bold text-slate-500 text-center px-2 leading-relaxed">
                정말로 이 변동 사항을 취소하고<br/>
                <span className="text-slate-800 font-black">원래 시간표대로 복구하시겠습니까?</span>
              </p>

              <div className="flex flex-col gap-2">
                <button 
                  onClick={handleRollback}
                  className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  취소 및 복구 실행
                </button>
                <button 
                  onClick={() => setIsConfirmOpen(false)}
                  className="w-full py-3 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  창 닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusPage;
