import React from 'react';
import type { DaySchedule, SchoolEvent } from '../types';
import { getDay, addDays } from 'date-fns';

interface TimetableProps {
  schedule: DaySchedule[];
  events?: SchoolEvent[];
  weekStartsOn?: Date;
  onSlotClick?: (dayOfWeek: string, period: number, subject: string) => void;
}

const dayMap: Record<string, number> = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };

const TimetableComponent: React.FC<TimetableProps> = ({ schedule, events = [], weekStartsOn, onSlotClick }) => {
  const periods = [1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
      <table className="w-full min-w-[700px] border-collapse bg-white rounded-lg shadow-sm overflow-hidden text-sm md:text-base">
        <thead>
          <tr className="bg-brand-50 border-b border-brand-100">
            <th className="py-3 px-4 text-brand-900 font-semibold w-[80px] text-center border-r border-brand-100">교시</th>
            {schedule.map(day => {
              const dayIndex = dayMap[day.dayOfWeek];
              const dateObj = weekStartsOn ? addDays(weekStartsOn, dayIndex - 1) : null;
              return (
                <th key={day.dayOfWeek} className="py-2.5 px-2 text-brand-900 font-semibold text-center w-[18%]">
                  <div className="flex flex-col items-center">
                    <span>{day.dayOfWeek}</span>
                    {dateObj && <span className="text-[11px] font-medium text-brand-500 mt-[1px]">{dateObj.getMonth() + 1}.{dateObj.getDate()}</span>}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {periods.map(period => (
            <tr key={`period-${period}`} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td className="py-3 px-2 text-center font-medium text-slate-500 border-r border-slate-100 bg-slate-50/50">
                {period}교시
              </td>
              {schedule.map(day => {
                const dayIndex = dayMap[day.dayOfWeek];
                const slot = day.slots.find(s => s.period === period);
                const hasEvent = events.find(e => {
                  const eventParts = e.date.split('-');
                  const eventDate = new Date(Number(eventParts[0]), Number(eventParts[1]) - 1, Number(eventParts[2]));
                  const isSameDay = getDay(eventDate) === dayIndex;
                  return isSameDay && period >= e.periodStart && period <= e.periodEnd;
                });

                if (hasEvent && hasEvent.type === 'EXTERNAL') {
                  return (
                    <td key={`${day.dayOfWeek}-${period}`} className="py-2 px-1 text-center font-medium relative group">
                      <div className="h-[76px] flex flex-col items-center justify-center px-1 py-2 rounded-lg bg-indigo-50 border border-indigo-200 shadow-sm m-1 transition-all">
                        <span className="font-bold text-indigo-800 text-[13px] leading-tight break-keep">{hasEvent.description}</span>
                        <span className="text-[11px] text-indigo-600 mt-1.5 font-semibold bg-indigo-100/80 px-1.5 py-0.5 rounded shadow-sm">행사 연동됨</span>
                      </div>
                    </td>
                  );
                }

                const isEmpty = !slot || !slot.subject;
                return (
                  <td key={`${day.dayOfWeek}-${period}`} className="py-2 px-1 text-center relative group p-1">
                    {isEmpty ? (
                      <div className={`h-[76px] flex flex-col items-center justify-center rounded-lg border m-1 ${hasEvent ? 'bg-amber-50 border-amber-200' : 'border-transparent text-slate-300'}`}>
                        {hasEvent ? (
                          <>
                            <span className="text-slate-400">-</span>
                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shadow-sm mt-1">{hasEvent.description}</span>
                          </>
                        ) : '-'}
                      </div>
                    ) : (
                      <div 
                        onClick={() => {
                          if (!hasEvent && onSlotClick) onSlotClick(day.dayOfWeek, period, slot.subject);
                        }}
                        className={`h-[76px] flex flex-col items-center justify-center p-2 rounded-lg m-1 shadow-sm transition-all relative overflow-hidden ${hasEvent ? 'bg-amber-50 border border-amber-200' : 'bg-brand-50 border border-brand-100 hover:bg-brand-100 cursor-pointer hover:shadow-md hover:ring-2 hover:ring-brand-400/30'}`}
                      >
                        <span className={`font-bold text-[15px] ${hasEvent ? 'text-amber-900' : 'text-brand-900'}`}>{slot.subject}</span>
                        <span className={`text-[11px] font-medium mt-1 px-1.5 py-0.5 rounded shadow-sm ${hasEvent ? 'text-amber-700 bg-white/70' : 'text-brand-600 bg-white/70'}`}>{slot.gradeClass}</span>
                        {hasEvent && (
                          <div className="absolute top-0 right-0 left-0 bg-amber-400/90 text-[10px] font-bold text-white px-1 py-0.5 text-center truncate pointer-events-none">
                            {hasEvent.description}
                          </div>
                        )}
                        {!hasEvent && (
                           <div className="absolute inset-0 bg-brand-900/0 hover:bg-brand-900/5 transition-colors pointer-events-none flex items-center justify-center">
                             <span className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-brand-600 bg-white/90 px-2 py-1 rounded shadow-sm translate-y-2 group-hover:translate-y-0 transition-all">교체 신청</span>
                           </div>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TimetableComponent;
