import React from 'react';
import { Ticket, Sun, Bell } from 'lucide-react';

const QuickButtons: React.FC = () => {
  return (
    <div className="flex items-center gap-3 ml-auto">
      <a
        href="https://island.theksa.co.kr/"
        target="_blank"
        rel="noopener noreferrer"
        title="여객선 예매"
        className="flex items-center justify-center w-10 h-10 bg-white rounded-full border border-indigo-100 text-indigo-600 shadow-sm hover:bg-indigo-50 hover:shadow-md transition-all group"
      >
        <Ticket className="w-5 h-5 group-hover:scale-110 transition-transform" />
      </a>
      <a
        href="https://www.windy.com/"
        target="_blank"
        rel="noopener noreferrer"
        title="실시간 날씨"
        className="flex items-center justify-center w-10 h-10 bg-white rounded-full border border-orange-100 text-orange-500 shadow-sm hover:bg-orange-50 hover:shadow-md transition-all group"
      >
        <Sun className="w-5 h-5 group-hover:rotate-12 transition-transform" />
      </a>
      <a
        href="https://band.us/@kstpohang"
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.preventDefault();
          window.open('https://band.us/@kstpohang', '_blank');
        }}
        title="여객선 운항 정보 (KST포항)"
        className="flex items-center justify-center w-10 h-10 bg-white rounded-full border border-slate-100 text-slate-700 shadow-sm hover:bg-slate-50 hover:shadow-md transition-all group"
      >
        <Bell className="w-5 h-5 group-hover:animate-pulse transition-all" />
      </a>
    </div>
  );
};

export default QuickButtons;
