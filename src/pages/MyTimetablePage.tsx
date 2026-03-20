import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { Timetable, ClassSlot, DaySchedule } from '../types';
import { useNavigate } from 'react-router-dom';
import { Save, ArrowLeft, CalendarDays } from 'lucide-react';

const DAYS = ['월', '화', '수', '목', '금'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

const MyTimetablePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timetable, setTimetable] = useState<Timetable | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchTimetable = async () => {
      try {
        const docRef = doc(db, 'timetables', user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setTimetable(docSnap.data() as Timetable);
        } else {
          // 초기 데이터가 없는 경우 빈 시간표 생성
          const initialSchedule: DaySchedule[] = DAYS.map(day => ({
            dayOfWeek: day,
            slots: PERIODS.map(p => ({
              period: p,
              subject: '',
              gradeClass: ''
            }))
          }));

          setTimetable({
            id: user.uid,
            teacherName: user.displayName || '선생님',
            email: user.email || '',
            schedule: initialSchedule
          });
        }
      } catch (error) {
        console.error("Error fetching timetable:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTimetable();
  }, [user]);

  const handleInputChange = (dayIdx: number, slotIdx: number, field: keyof ClassSlot, value: string) => {
    if (!timetable) return;

    const newSchedule = [...timetable.schedule];
    newSchedule[dayIdx].slots[slotIdx] = {
      ...newSchedule[dayIdx].slots[slotIdx],
      [field]: value
    };

    setTimetable({ ...timetable, schedule: newSchedule });
  };

  const handleSave = async () => {
    if (!user || !timetable) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'timetables', user.uid), timetable);
      alert('시간표가 성공적으로 저장되었습니다.');
      navigate('/dashboard');
    } catch (error) {
      console.error("Error saving timetable:", error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-white rounded-full transition-colors text-slate-600"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <CalendarDays className="w-7 h-7 text-brand-600" />
              내 시간표 관리
            </h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg transition-all disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200 w-24">교시</th>
                  {DAYS.map(day => (
                    <th key={day} className="px-6 py-4 text-sm font-bold text-slate-800 uppercase tracking-wider">{day}요일</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {PERIODS.map((period, pIdx) => (
                  <tr key={period} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-8 text-center font-bold text-brand-700 bg-slate-50/80 border-r border-slate-200">
                      {period}
                    </td>
                    {DAYS.map((day, dIdx) => (
                      <td key={`${day}-${period}`} className="p-2 align-top">
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            placeholder="과목"
                            value={timetable?.schedule[dIdx].slots[pIdx].subject || ''}
                            onChange={(e) => handleInputChange(dIdx, pIdx, 'subject', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all outline-none bg-white font-medium"
                          />
                          <input
                            type="text"
                            placeholder="학년-반"
                            value={timetable?.schedule[dIdx].slots[pIdx].gradeClass || ''}
                            onChange={(e) => handleInputChange(dIdx, pIdx, 'gradeClass', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all outline-none bg-slate-50"
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyTimetablePage;
