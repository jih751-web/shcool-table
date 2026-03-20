import { db } from '../lib/firebase';
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore';
import type { Timetable, Override, DaySchedule, ClassSlot } from '../types';
import { format } from 'date-fns';

const DAYS = ['월', '화', '수', '목', '금'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

function createEmptySchedule(): DaySchedule[] {
  return DAYS.map(day => ({
    dayOfWeek: day,
    slots: PERIODS.map(p => ({ period: p, subject: '', gradeClass: '' }))
  }));
}

export const seedPhase6Data = async (currentUid: string, currentEmail: string) => {
  const batch = writeBatch(db);

  // 1. 기존 데이터 삭제 (timetables, overrides)
  const ttSnap = await getDocs(collection(db, 'timetables'));
  ttSnap.forEach(d => batch.delete(d.ref));

  const ovSnap = await getDocs(collection(db, 'overrides'));
  ovSnap.forEach(d => batch.delete(d.ref));

  // 2. 가상 교사 목록 세팅 (현재 로그인한 유저 포함)
  const teachers = [
    { id: currentUid, name: '김선생 (나)', email: currentEmail, subject: '수학' },
    { id: 'teacher_sub_1', name: '오선생', email: 'o@school.com', subject: '정보' },
    { id: 'teacher_sub_2', name: '박선생', email: 'park@school.com', subject: '국어' }
  ];

  // 각 교사의 기초 시간표 생성
  teachers.forEach((t, idx) => {
    const schedule = createEmptySchedule();

    // 월, 수, 금 오전에 과목 배정
    ['월', '수', '금'].forEach(day => {
      const daySched = schedule.find(s => s.dayOfWeek === day);
      if (daySched) {
        daySched.slots[0] = { period: 1, subject: t.subject, gradeClass: `1-${idx+1}` }; // 1교시
        daySched.slots[1] = { period: 2, subject: t.subject, gradeClass: `1-${idx+1}` }; // 2교시
      }
    });

    // 화, 목 오후에 과목 배정
    ['화', '목'].forEach(day => {
      const daySched = schedule.find(s => s.dayOfWeek === day);
      if (daySched) {
        daySched.slots[4] = { period: 5, subject: t.subject, gradeClass: `2-${idx+1}` }; // 5교시
        daySched.slots[5] = { period: 6, subject: t.subject, gradeClass: `2-${idx+1}` }; // 6교시
      }
    });

    const ttRef = doc(db, 'timetables', t.id);
    batch.set(ttRef, {
      teacherName: t.name,
      email: t.email,
      schedule
    } as Timetable);
  });

  // 3. 변동 시간표(Overrides) 샘플 생성
  // 오늘 날짜에 오선생님의 1,2교시를 비우고 3,4교시에 수학(김선생 교체? 아니면 그냥 다른 과목) 넣기.
  // 이번 테스트의 목적은 '원본 요일 시간표와 무관하게 override 데이터가 우선 렌더링되는가'
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const overrideRef = doc(db, 'overrides', `teacher_sub_1_${todayStr}`);
  
  const overrideSlots: ClassSlot[] = [
    { period: 1, subject: '', gradeClass: '' }, // 원래 1교시 정보 수업인데 공강으로 바뀜
    { period: 2, subject: '', gradeClass: '' },
    { period: 3, subject: '미술(특강)', gradeClass: '1-1' }, // 새로 생긴 스케줄
    { period: 4, subject: '미술(특강)', gradeClass: '1-1' },
    { period: 5, subject: '', gradeClass: '' },
    { period: 6, subject: '', gradeClass: '' },
    { period: 7, subject: '', gradeClass: '' },
  ];

  batch.set(overrideRef, {
    teacherId: 'teacher_sub_1',
    teacherName: '오선생',
    date: todayStr,
    slots: overrideSlots
  } as Override);

  // Execute batch
  await batch.commit();
  console.log('Phase 6 Seed 데이터 주입 완료');
};
