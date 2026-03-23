import { db } from '../lib/firebase';
import { collection, getDocs, writeBatch } from 'firebase/firestore';

/**
 * Firestore의 샘플/더미 데이터를 일괄 삭제합니다.
 * timetables, overrides 컬렉션의 모든 문서를 삭제합니다.
 */
export const clearSampleData = async (): Promise<void> => {
  const batch = writeBatch(db);

  // timetables 컬렉션 전체 삭제
  const ttSnap = await getDocs(collection(db, 'timetables'));
  ttSnap.forEach(d => batch.delete(d.ref));

  // overrides 컬렉션 전체 삭제
  const ovSnap = await getDocs(collection(db, 'overrides'));
  ovSnap.forEach(d => batch.delete(d.ref));

  await batch.commit();
  console.log('샘플 데이터 삭제 완료');
};
