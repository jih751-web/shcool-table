import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ReplacementRecord } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle2, XCircle } from 'lucide-react';

const StatusPage: React.FC = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<ReplacementRecord[]>([]);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'replacements'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const data: ReplacementRecord[] = [];
        snap.forEach(doc => data.push({ id: doc.id, ...doc.data() } as ReplacementRecord));
        setRecords(data);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchRecords();
  }, []);

  const filteredRecords = filter === 'all' 
    ? records 
    : records.filter(r => r.requestorId === user?.uid || r.targetId === user?.uid);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-slate-800">교체 현황판</h1>
          </div>
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filter === 'all' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              전체 현황
            </button>
            <button
              onClick={() => setFilter('mine')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filter === 'mine' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              내 관련 건
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Clock className="w-12 h-12 text-slate-300 mb-4" />
              <p>교체 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-600">
                    <th className="py-4 px-6 whitespace-nowrap">교체 일자 및 교시</th>
                    <th className="py-4 px-6 whitespace-nowrap">신청 교사</th>
                    <th className="py-4 px-6 whitespace-nowrap">대상 교사</th>
                    <th className="py-4 px-6 whitespace-nowrap">신청일시</th>
                    <th className="py-4 px-6 whitespace-nowrap text-right">상태</th>
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
                        <td className="py-4 px-6 font-medium text-slate-800">
                          {record.date} <span className="text-brand-600 ml-1">{record.period}교시</span>
                        </td>
                        <td className="py-4 px-6 text-slate-600">
                          {record.requestorName} 선생님
                          {record.requestorId === user?.uid && <span className="ml-2 text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded font-bold">나 (발신)</span>}
                        </td>
                        <td className="py-4 px-6 text-slate-600">
                          {record.targetName} 선생님
                          {isTarget && <span className="ml-2 text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded font-bold">나 (수신)</span>}
                        </td>
                        <td className="py-4 px-6 text-slate-500 text-sm">
                          {new Date(record.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
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
                            {record.status === 'APPROVED' ? '승인됨' : record.status === 'REJECTED' ? '거절됨' : '대기중'}
                          </span>
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
