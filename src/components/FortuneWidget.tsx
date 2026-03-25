import { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fortunes } from '../data/fortunes';
import { Coins, Heart, HandIcon, Lightbulb, Sparkles, Lock } from 'lucide-react';
import { format } from 'date-fns';

type FortuneCategory = 'money' | 'love' | 'health' | 'advice';

const categoryMeta = {
  money: { icon: Coins, label: '금전운', color: 'bg-amber-500', lightColor: 'bg-amber-50', textColor: 'text-amber-600' },
  love: { icon: Heart, label: '애정운', color: 'bg-rose-500', lightColor: 'bg-rose-50', textColor: 'text-rose-600' },
  health: { icon: HandIcon, label: '건강운', color: 'bg-emerald-500', lightColor: 'bg-emerald-50', textColor: 'text-emerald-600' },
  advice: { icon: Lightbulb, label: '조언', color: 'bg-indigo-500', lightColor: 'bg-indigo-50', textColor: 'text-indigo-600' }
};

export default function FortuneWidget() {
  const { userData } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<FortuneCategory>('money');

  const todayStr = format(new Date(), 'yyyyMMdd');
  const birthDate = userData?.birthDate;

  // 결정론적 해시 함수 (생일 + 오늘 날짜)
  const fortuneResult = useMemo(() => {
    if (!birthDate || birthDate.length !== 8) return null;

    const seed = birthDate + todayStr;
    
    const getIndex = (offset: number, length: number, prime: number) => {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs((hash * prime) + offset) % length;
    };

    return {
      money: fortunes.money[getIndex(100, fortunes.money.length, 3)],
      love: fortunes.love[getIndex(200, fortunes.love.length, 7)],
      health: fortunes.health[getIndex(300, fortunes.health.length, 13)],
      advice: fortunes.advice[getIndex(400, fortunes.advice.length, 17)]
    };
  }, [birthDate, todayStr]);

  if (!birthDate) {
    return (
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 flex flex-col items-center justify-center text-center h-full min-h-[220px] group transition-all hover:shadow-2xl">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <Lock className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-lg font-black text-slate-800 mb-2 tracking-tight">잠겨있는 오늘의 운세</h3>
        <p className="text-sm text-slate-500 font-bold leading-relaxed mb-4">
          우측 상단 톱니바퀴에서<br/>
          <span className="text-brand-600">생년월일</span>을 입력해 주세요! 🍀
        </p>
      </div>
    );
  }

  const currentFortune = fortuneResult ? fortuneResult[selectedCategory] : '';
  const meta = categoryMeta[selectedCategory];

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-200 flex flex-col h-full overflow-hidden group transition-all hover:shadow-2xl">
      {/* Header */}
      <div className="p-5 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-brand-50 rounded-xl">
            <Sparkles className="w-5 h-5 text-brand-600 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800 tracking-tight">오늘의 운세</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{format(new Date(), 'yyyy.MM.dd')}</p>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-5 flex flex-col">
        {/* Fortune Display */}
        <div className={`flex-1 ${meta.lightColor} rounded-2xl p-5 border border-transparent transition-all duration-300 mb-5 relative overflow-hidden group/fortune`}>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <meta.icon className={`w-4 h-4 ${meta.textColor}`} />
              <span className={`text-[12px] font-black ${meta.textColor}`}>{meta.label}</span>
            </div>
            <p className="text-slate-700 font-bold text-[14.5px] leading-[1.6] break-keep whitespace-normal animate-in fade-in slide-in-from-bottom-2 duration-500">
              {currentFortune}
            </p>
          </div>
          {/* Decorative Background Icon */}
          <meta.icon className={`absolute -right-4 -bottom-4 w-24 h-24 ${meta.textColor} opacity-10 rotate-12 group-hover/fortune:scale-110 transition-transform`} />
        </div>

        {/* Category Tabs */}
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(categoryMeta) as FortuneCategory[]).map((cat) => {
            const m = categoryMeta[cat];
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl transition-all border shadow-sm active:scale-95 ${
                  isSelected 
                    ? `${m.color} text-white border-transparent shadow-md ring-4 ring-${cat === 'money' ? 'amber' : cat === 'love' ? 'rose' : cat === 'health' ? 'emerald' : 'indigo'}-500/10` 
                    : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:text-slate-600'
                }`}
              >
                <m.icon className={`w-5 h-5 mb-1 ${isSelected ? 'animate-in zoom-in-75' : ''}`} />
                <span className="text-[10px] font-black whitespace-nowrap">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
