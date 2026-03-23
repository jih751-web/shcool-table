import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Teacher } from '../types';
import { Shield, UserMinus, UserCheck, Search, Users, Trash2 } from 'lucide-react';

const AdminUserPage: React.FC = () => {
  const { userData } = useAuth();
  const [users, setUsers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const userList: Teacher[] = [];
      snap.forEach(doc => {
        userList.push(doc.data() as Teacher);
      });
      setUsers(userList);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const toggleBlock = async (uid: string, currentStatus: boolean) => {
    if (uid === userData?.uid) {
      alert("자기 자신을 차단할 수 없습니다.");
      return;
    }
    
    if (!confirm(`${currentStatus ? '차단을 해제' : '차단'} 하겠습니까?`)) return;

    try {
      await updateDoc(doc(db, 'users', uid), {
        isBlocked: !currentStatus
      });
    } catch (error) {
      console.error("Error updating user status:", error);
      alert("상태 변경에 실패했습니다.");
    }
  };

  const kickUser = async (uid: string, userName: string) => {
    console.log("Kick button clicked for user:", userName, uid);

    if (uid === userData?.uid) {
      alert("자기 자신을 추방할 수 없습니다.");
      return;
    }

    // 1. 확인 팝업창 띄우기 (요청 문구로 수정)
    const proceed = window.confirm("정말 이 사용자를 추방하시겠습니까? 등록된 시간표와 예약 정보 등 모든 데이터가 영구적으로 삭제됩니다.");
    if (!proceed) return;

    try {
      const batch = writeBatch(db);

      // 2. 연쇄 삭제 로직 (Batch 사용)
      
      // (1) users 컬렉션에서 해당 사용자의 문서 삭제
      batch.delete(doc(db, 'users', uid));

      // (2) timetables 컬렉션에서 해당 사용자의 시간표 삭제 (문서 ID가 uid인 경우)
      // 존재 여부 확인 후 삭제 (batch.delete는 문서가 없어도 에러를 내지 않지만, 명시적 관리를 위해)
      batch.delete(doc(db, 'timetables', uid));

      // (3) reservations 컬렉션에서 해당 사용자가 등록한 데이터 삭제
      // reservations는 문서 ID가 uid가 아닐 수 있으므로 쿼리하여 삭제
      const reservationsRef = collection(db, 'reservations');
      const qRes = query(reservationsRef, where('userId', '==', uid));
      const queryResSnapshot = await getDocs(qRes);
      
      queryResSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // (4) 기타 관련 데이터 (예: overrides) 연쇄 삭제
      const overridesRef = collection(db, 'overrides');
      const qOvr = query(overridesRef, where('teacherId', '==', uid));
      const queryOvrSnapshot = await getDocs(qOvr);
      
      queryOvrSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // 3. 일괄 실행 (Batch Commit)
      await batch.commit();
      
      console.log(`Successfully kicked user ${userName} and cleaned up all data.`);
      alert(`${userName} 선생님이 추방되었습니다. 관련 데이터가 모두 삭제되었습니다.`);
      
      // 4. 화면 즉시 갱신 (onSnapshot으로도 갱신되지만, 즉시성을 위해 State 필터링 추가)
      setUsers(prev => prev.filter(u => u.uid !== uid));
      
    } catch (error) {
      console.error("Error during cascading delete:", error);
      alert("데이터 삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!userData?.isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Shield className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-slate-800">접근 권한이 없습니다</h2>
          <p className="text-slate-500 font-bold mt-2">관리자 계정으로 로그인해 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
              <Users className="w-8 h-8 text-brand-600" />
              사용자 관리
            </h1>
            <p className="text-slate-500 font-bold mt-1">블랙리스트 관리 및 접근 제어</p>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="이름 또는 이메일 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl w-full md:w-80 shadow-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none font-bold"
            />
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-bottom border-slate-100">
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">사용자</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">권한</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">상태</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={4} className="px-6 py-8">
                        <div className="h-4 bg-slate-100 rounded w-1/4 mb-2"></div>
                        <div className="h-3 bg-slate-50 rounded w-1/2"></div>
                      </td>
                    </tr>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center">
                      <p className="text-slate-400 font-bold">검색 결과가 없습니다.</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-white ${user.isAdmin ? 'bg-brand-600' : 'bg-slate-300'}`}>
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-black text-slate-800">{user.name}</div>
                            <div className="text-xs text-slate-400 font-bold">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        {user.isAdmin ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-brand-50 text-brand-700 border border-brand-100">
                            Admin
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-slate-400">User</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black ${
                          user.isBlocked 
                            ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}>
                          {user.isBlocked ? '차단됨' : '정상'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => toggleBlock(user.uid, !!user.isBlocked)}
                            disabled={user.uid === userData?.uid}
                            className={`p-2 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${
                              user.isBlocked
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-200'
                                : 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-200'
                            }`}
                            title={user.isBlocked ? '차단 해제' : '차단하기'}
                          >
                            {user.isBlocked ? (
                              <UserCheck className="w-5 h-5" />
                            ) : (
                              <UserMinus className="w-5 h-5" />
                            )}
                          </button>
                          
                          <button
                            onClick={() => kickUser(user.uid, user.name)}
                            disabled={user.uid === userData?.uid}
                            className="p-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 shadow-sm shadow-rose-200 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                            title="추방(삭제)하기"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUserPage;
