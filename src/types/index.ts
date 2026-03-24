export interface Teacher {
  uid: string;
  name: string;
  email: string;
  nickname?: string;
  isBlocked?: boolean;
  isAdmin?: boolean;
}

export interface ClassSlot {
  period: number; // 교시 (1~8 등)
  subject: string; // 과목명
  gradeClass: string; // 학년/반 (예: 1-1)
}

export interface DaySchedule {
  dayOfWeek: string; // "월", "화", "수", "목", "금"
  slots: ClassSlot[];
}

export interface Timetable {
  id: string; // 데이터베이스 식별자 (교사의 uid와 동일하게 관리)
  teacherName: string;
  email: string;
  schedule: DaySchedule[];
}

export interface SchoolEvent {
  id?: string;
  date: string; // YYYY-MM-DD (기존 단일 날짜, 호환성 유지)
  startDate?: string; // Phase 12 신규: 시작일 (YYYY-MM-DD)
  endDate?: string;   // Phase 12 신규: 종료일 (YYYY-MM-DD)
  isAllDay?: boolean; // Phase 12 신규: 하루 종일 여부
  periodStart: number;
  periodEnd: number;
  description: string;
  announcement?: string; // Phase 9: 추가 전달사항 (상세 메모)
  type: 'EXTERNAL' | 'CURRICULUM';
}

export interface SpecialRoom {
  id: string;
  name: string;
}

export interface RoomBooking {
  id?: string;
  roomId: string;
  roomName: string;
  teacherId: string;
  teacherName: string;
  date: string;
  period: number;
  createdAt: string;
}

export interface ReplacementRecord {
  id?: string;
  type: 'SWAP' | 'MAKEUP';
  requestorId: string;
  requestorName: string;
  targetId: string;
  targetName: string;
  sourceDate: string; // YYYY-MM-DD
  sourcePeriod: number;
  targetDate?: string; // YYYY-MM-DD (보강의 경우 소스 일자와 동일하므로 생략 가능하나 기록용)
  targetPeriod?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  timestamp: string; // ISO string
}

export interface AppNotification {
  id?: string;
  targetUserId: string;
  message: string;
  timestamp: string; // ISO string
  isRead: boolean;
  type: 'REPLACEMENT_REQUEST' | 'REPLACEMENT_APPROVED';
}

// Phase 6 신규: 일일 변동 시간표 (특정 날짜의 기초 시간표를 덮어씀)
export interface Override {
  id?: string; // 문서 ID: 보통 teacherId_YYYY-MM-DD 형태
  teacherId: string;
  teacherName: string; // 조회를 편하게 하기 위함
  date: string; // YYYY-MM-DD
  slots: ClassSlot[]; // 해당 날짜의 전체(1~7교시) 스케줄
}

// Phase 13 신규: 개별 시간표 변동 기록 (실시간 연동용)
export interface TimetableOverride {
  id?: string; // `${date}_${period}_${originalTeacherId}`
  date: string;
  period: number;
  originalTeacherId: string;
  newTeacherId: string;
  newTeacherName: string;
  subject: string;
  gradeClass: string;
  type: 'SWAP' | 'MAKEUP';
  createdAt: any;
}

export interface Todo {
  id?: string;
  userId: string;
  text: string;
  date: string; // YYYY-MM-DD
  isCompleted: boolean;
  isStarred: boolean;
  timestamp: any;
}
