import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ReplacementRecord } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle2, XCircle, Loader2, ArrowRightLeft } from 'lucide-react';
import Header from '../components/Header';
import { executeRollbackTransaction } from '../utils/timetableApi';

const StatusPage: React.FC = () => {
  const { user, userData, userProfiles } = useAuth();
  const [records, setRecords] = useState<ReplacementRecord[]>([]);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [loading, setLoading] = useState(true);
  const [rollbackLoading, setRollbackLoading] = useState<string | null>(null);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'replacements'), orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);
      const data: ReplacementRecord[] = [];
      snap.forEach(doc => data.push({ id: doc.id, ...doc.data() } as ReplacementRecord));
      setRecords(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleRollback = async (record: ReplacementRecord) => {
    const isMine = record.requestorId === user?.uid || record.targetId === user?.uid;
    const isAdmin = userData?.isAdmin === true;

    if (!isMine && !isAdmin) {
      alert("본인의 교체 건만 취소할 수 있습니다.");
      return;
    }

    if (!window.confirm("이 시간표 변동 건을 취소하고 원래대로 되돌리시겠습니까?")) return;

    setRollbackLoading(record.id!);
    try {
      await executeRollbackTransaction(record.id!);
      alert('성공적으로 원상 복구되었습니다.');
      fetchRecords(); 
    } catch (error: any) {
      alert(`복구 실패: ${error.message}`);
    } finally {
      setRollbackLoading(null);
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
                               onClick={() => handleRollback(record)}
                               disabled={rollbackLoading === record.id}
                               className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all
                                 ${rollbackLoading === record.id 
                                   ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                   : 'bg-white border-2 border-slate-200 text-slate-500 hover:border-red-500 hover:text-red-600 active:scale-95 shadow-sm'
                                 }
                               `}
                             >
                                {rollbackLoading === record.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5" />
                                )}
                                취소
                             </button>
                           )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredRecords.length === 0 && (
                <div className="text-center py-12 text-slate-500 border-t border-slate-100">
                  조건에 해당하는 교체 내역이 없습니다.
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default StatusPage;
