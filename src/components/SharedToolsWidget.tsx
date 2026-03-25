import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ExternalLink, Plus, Trash2, X } from 'lucide-react';

interface SharedTool {
  id: string;
  name: string;
  url: string;
  description?: string;
  createdAt?: any;
}

export default function SharedToolsWidget() {
  const [tools, setTools] = useState<SharedTool[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<SharedTool | null>(null);
  
  // Add Tool Form States
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'shared_tools'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const toolList: SharedTool[] = [];
      snapshot.forEach((doc) => {
        toolList.push({ id: doc.id, ...doc.data() } as SharedTool);
      });
      setTools(toolList);
      setLoading(false);
    }, (error) => {
      console.error("Firestore onSnapshot error:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAddTool = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!name.trim() || !url.trim()) return;

    let formattedUrl = url.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    try {
      await addDoc(collection(db, 'shared_tools'), {
        name: name.trim(),
        url: formattedUrl,
        description: description.trim(),
        createdAt: serverTimestamp(),
      });
      setName('');
      setUrl('');
      setDescription('');
      setIsAddModalOpen(false);
    } catch (error) {
      console.error("Error adding tool: ", error);
      alert("도구 추가 실패: " + error);
    }
  };

  const handleDeleteTool = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("정말 이 도구를 삭제하시겠습니까?")) {
      try {
        await deleteDoc(doc(db, 'shared_tools', id));
        if (selectedTool?.id === id) {
          setSelectedTool(null);
        }
      } catch (error) {
        console.error("Error deleting tool: ", error);
      }
    }
  };

  const handleEnterSite = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col mt-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-brand-100 text-brand-600 rounded-xl">
            <Plus className="w-5 h-5 rotate-45" />
          </div>
          <h3 className="text-lg font-black text-slate-800 tracking-tight">🛠️ 교사 도구 공유</h3>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-black hover:bg-brand-700 transition-all shadow-md active:scale-95"
        >
          <Plus className="w-4 h-4" />
          도구 추가
        </button>
      </div>

      <div className="p-6 bg-slate-50/30">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
          </div>
        ) : tools.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <p className="font-bold">등록된 도구가 없습니다.</p>
            <p className="text-xs mt-1">첫 번째 도구를 추가해 보세요!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setSelectedTool(tool)}
                className="group relative flex flex-col items-center justify-center p-4 bg-white border-2 border-slate-100 rounded-2xl hover:border-brand-500 hover:shadow-lg transition-all"
              >
                <div className="p-3 bg-brand-50 text-brand-600 rounded-xl mb-2 group-hover:scale-110 transition-transform">
                  <ExternalLink className="w-5 h-5" />
                </div>
                <span className="text-sm font-black text-slate-700 text-center truncate w-full">
                  {tool.name}
                </span>
                
                <div
                  onClick={(e) => handleDeleteTool(e, tool.id)}
                  className="absolute -top-1 -right-1 p-1.5 bg-rose-100 text-rose-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600 hover:text-white shadow-sm z-10"
                  title="삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add Tool Modal */}
      {isAddModalOpen && (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div 
            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md border-4 border-brand-500 overflow-hidden animate-in zoom-in-95 duration-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 bg-brand-500 text-center text-white border-b border-brand-600/20">
              <div className="w-12 h-12 bg-white/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-black tracking-tight leading-tight">
                유용한 도구 추가
              </h3>
            </div>
            
            <form onSubmit={handleAddTool} className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1 px-1">도구 이름</label>
                  <input
                    type="text"
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="예: 캔바, 띵커벨, 패들렛"
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[15px] font-bold focus:outline-none focus:border-brand-500 transition-all placeholder:text-slate-200 shadow-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1 px-1">URL 링크 주소</label>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[15px] font-bold focus:outline-none focus:border-brand-500 transition-all placeholder:text-slate-200 shadow-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1 px-1">도구 설명</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="어떤 용도로 쓰는지 동료 선생님들께 알려주세요..."
                    rows={3}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[15px] font-bold focus:outline-none focus:border-brand-500 transition-all placeholder:text-slate-200 shadow-sm resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-4 bg-white border-2 border-slate-100 text-slate-400 rounded-2xl font-black hover:bg-slate-50 transition-all active:scale-95"
                >
                  취소
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-brand-600 text-white rounded-2xl font-black shadow-lg shadow-brand-100 hover:bg-brand-700 transition-all active:scale-95"
                >
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tool Detail Modal */}
      {selectedTool && (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setSelectedTool(null)}
        >
          <div 
            className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg border-4 border-brand-500 overflow-hidden animate-in zoom-in-95 duration-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8 bg-brand-50 border-b border-brand-100 text-center relative">
               <button 
                onClick={() => setSelectedTool(null)}
                className="absolute right-6 top-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-16 h-16 bg-brand-100 text-brand-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                <ExternalLink className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">{selectedTool.name}</h3>
              <p className="text-[10px] font-black text-brand-600 uppercase tracking-[0.2em] mt-2">Tool Information</p>
            </div>
            
            <div className="p-10 space-y-8">
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">도구 설명</label>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 min-h-[120px] flex items-center justify-center text-center">
                  <p className="text-[16px] font-bold text-slate-700 leading-relaxed whitespace-pre-wrap break-keep">
                    {selectedTool.description || "등록된 설명이 없습니다."}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => handleEnterSite(selectedTool.url)}
                  className="w-full py-5 bg-brand-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-brand-100 hover:bg-brand-700 transition-all transform hover:-translate-y-1 active:translate-y-0.5 flex items-center justify-center gap-3"
                >
                  <span>🚀 사이트로 입장하기</span>
                </button>
                <button 
                  onClick={() => setSelectedTool(null)}
                  className="w-full py-4 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  돌아가기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
