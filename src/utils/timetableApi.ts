import { collection, doc, getDocs, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Timetable, Override, ClassSlot } from '../types';

/**
 * 기초 시간표(Base)를 건드리지 않고, 특정 날짜의 오버라이드(Override)를 사용하여 트랜잭션 교체를 수행합니다.
 */
export const executeSwapTransaction = async (
  requesterId: string,
  targetId: string,
  sourceDate: string,     // YYYY-MM-DD
  sourceDayOfWeek: string, // '월', '화' ...
  sourcePeriod: number,
  targetDate: string,     // YYYY-MM-DD
  targetDayOfWeek: string,
  targetPeriod: number
) => {
  const reqBaseRef = doc(db, 'timetables', requesterId);
  const tarBaseRef = doc(db, 'timetables', targetId);
  
  const reqSourceOvRef = doc(db, 'overrides', `${requesterId}_${sourceDate}`);
  const reqTargetOvRef = doc(db, 'overrides', `${requesterId}_${targetDate}`);
  const tarSourceOvRef = doc(db, 'overrides', `${targetId}_${sourceDate}`);
  const tarTargetOvRef = doc(db, 'overrides', `${targetId}_${targetDate}`);

  return await runTransaction(db, async (transaction) => {
    // 1. 기초 시간표 읽기
    const reqBaseSnap = await transaction.get(reqBaseRef);
    const tarBaseSnap = await transaction.get(tarBaseRef);

    if (!reqBaseSnap.exists() || !tarBaseSnap.exists()) {
      throw new Error("기본 시간표 데이터가 존재하지 않습니다.");
    }

    const reqBaseData = reqBaseSnap.data() as Timetable;
    const tarBaseData = tarBaseSnap.data() as Timetable;

    // 2. 오버라이드 존재 유무 확인
    const reqSourceOvSnap = await transaction.get(reqSourceOvRef);
    const reqTargetOvSnap = await transaction.get(reqTargetOvRef);
    const tarSourceOvSnap = await transaction.get(tarSourceOvRef);
    const tarTargetOvSnap = await transaction.get(tarTargetOvRef);

    // 빈 7교시 스케줄 생성 헬퍼
    const createEmptySlots = (): ClassSlot[] => {
      return [1, 2, 3, 4, 5, 6, 7].map(p => ({ period: p, subject: '', gradeClass: '' }));
    };

    // 현재 기준 스케줄 반환 헬퍼 (오버라이드 존재 시 우선 반환, 없으면 기초 시간표 반환)
    const getDaySchedule = (base: Timetable, ovSnap: any, dayOfWeek: string): ClassSlot[] => {
      if (ovSnap.exists()) {
        return (ovSnap.data() as Override).slots;
      }
      const baseDay = base.schedule.find(d => d.dayOfWeek === dayOfWeek);
      return baseDay ? JSON.parse(JSON.stringify(baseDay.slots)) : createEmptySlots();
    };

    // 3. 머지된 현재 슬롯 데이터 확보
    const reqSourceSlots = getDaySchedule(reqBaseData, reqSourceOvSnap, sourceDayOfWeek);
    const tarSourceSlots = getDaySchedule(tarBaseData, tarSourceOvSnap, sourceDayOfWeek);
    
    // 만약 소스 날짜와 타겟 날짜가 동일하다면 이미 불러온 배열을 공유해야 함(레퍼런스 동일)
    const isSameDate = sourceDate === targetDate;
    const reqTargetSlots = isSameDate ? reqSourceSlots : getDaySchedule(reqBaseData, reqTargetOvSnap, targetDayOfWeek);
    const tarTargetSlots = isSameDate ? tarSourceSlots : getDaySchedule(tarBaseData, tarTargetOvSnap, targetDayOfWeek);

    // 4. 스왑 로직 수행을 위한 슬롯 찾기
    const reqSourceSlot = reqSourceSlots.find(s => s.period === sourcePeriod);
    const tarTargetSlot = tarTargetSlots.find(s => s.period === targetPeriod);

    if (!reqSourceSlot || !reqSourceSlot.subject) throw new Error("내 원본 수업이 존재하지 않거나 이미 공강입니다.");
    if (!tarTargetSlot || !tarTargetSlot.subject) throw new Error("상대방의 타겟 수업이 존재하지 않거나 이미 공강입니다.");

    // 5. 상호 공강 완벽 검증 (교차 슬롯 확인)
    const tarSourceSlot = tarSourceSlots.find(s => s.period === sourcePeriod);
    const reqTargetSlot = reqTargetSlots.find(s => s.period === targetPeriod);
    
    if (tarSourceSlot && tarSourceSlot.subject) throw new Error("상대방 교사가 해당 원본 수업 시간에 이미 일정이 있습니다.");
    if (reqTargetSlot && reqTargetSlot.subject) throw new Error("내가 대상 교체 시간에 이미 일정이 있습니다.");

    // 6. 데이터 맞교환
    const mySubject = reqSourceSlot.subject;
    const myGradeClass = reqSourceSlot.gradeClass;
    const targetSubject = tarTargetSlot.subject;
    const targetGradeClass = tarTargetSlot.gradeClass;

    reqSourceSlot.subject = '';
    reqSourceSlot.gradeClass = '';
    
    if (reqTargetSlot) {
      reqTargetSlot.subject = targetSubject;
      reqTargetSlot.gradeClass = targetGradeClass;
    }

    tarTargetSlot.subject = '';
    tarTargetSlot.gradeClass = '';
    if (tarSourceSlot) {
      tarSourceSlot.subject = mySubject;
      tarSourceSlot.gradeClass = myGradeClass;
    }

    // 7. 트랜잭션 기록 (오버라이드 덮어쓰기)
    transaction.set(reqSourceOvRef, { teacherId: requesterId, teacherName: reqBaseData.teacherName, date: sourceDate, slots: reqSourceSlots });
    if (!isSameDate) {
      transaction.set(reqTargetOvRef, { teacherId: requesterId, teacherName: reqBaseData.teacherName, date: targetDate, slots: reqTargetSlots });
    }
    
    transaction.set(tarTargetOvRef, { teacherId: targetId, teacherName: tarBaseData.teacherName, date: targetDate, slots: tarTargetSlots });
    if (!isSameDate) {
      transaction.set(tarSourceOvRef, { teacherId: targetId, teacherName: tarBaseData.teacherName, date: sourceDate, slots: tarSourceSlots });
    }

    // 8. 교체 로그 추가
    const replacementRef = doc(collection(db, 'replacements'));
    transaction.set(replacementRef, {
        requestorId: requesterId,
        requestorName: reqBaseData.teacherName,
        targetId: targetId,
        targetName: tarBaseData.teacherName,
        timestamp: new Date().toISOString(),
        sourceDate,
        sourcePeriod,
        targetDate,
        targetPeriod,
        status: 'APPROVED',
        type: 'SWAP'
    });
  });
};

export const fetchAllTeachers = async (): Promise<{uid: string, name: string}[]> => {
  try {
    const snapshot = await getDocs(collection(db, 'timetables'));
    const teachers: {uid: string, name: string}[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      teachers.push({ uid: doc.id, name: data.teacherName });
    });
    return teachers;
  } catch (e) {
    console.error(e);
    return [];
  }
};
