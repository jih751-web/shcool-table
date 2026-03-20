import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { SchoolEvent } from '../types';

export const fetchWeeklyEvents = async (): Promise<SchoolEvent[]> => {
  try {
    const q = query(collection(db, 'events'));
    const snap = await getDocs(q);
    const events: SchoolEvent[] = [];
    snap.forEach(doc => events.push({ id: doc.id, ...doc.data() } as SchoolEvent));
    
    // 시연용 더미 데이터: 만약 DB에 이벤트가 하나도 없다면 가상의 일정을 반환합니다.
    if (events.length === 0) {
      const today = new Date();
      // 이틀 뒤로 설정 (수요일 혹은 목요일쯤 되도록)
      today.setDate(today.getDate() + 2); 
      const dateStr = today.toISOString().split('T')[0];
      return [
        { id: 'e1', date: dateStr, periodStart: 3, periodEnd: 4, description: '체육대회 예선', type: 'EXTERNAL' }
      ];
    }
    return events;
  } catch(e) {
    console.error(e);
    return [];
  }
};
