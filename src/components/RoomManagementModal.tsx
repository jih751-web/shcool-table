import React, { useState } from 'react';
import { X, Plus, Trash2, MonitorPlay, AlertCircle, Loader2 } from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { SpecialRoom } from '../types';
import ConfirmModal from './ConfirmModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  rooms: SpecialRoom[];
}

export default function RoomManagementModal({ isOpen, onClose, rooms }: Props) {
  const [newRoomName, setNewRoomName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  // 확인 모달 관련 상태
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim() || isAdding) return;

    if (rooms.find(r => r.name === newRoomName.trim())) {
      alert('이미 등록된 특별실입니다.');
      return;
    }

    setIsAdding(true);
    try {
      await addDoc(collection(db, 'specialRooms'), { 
        name: newRoomName.trim(), 
        createdAt: serverTimestamp() 
      });
      setNewRoomName('');
    } catch (e: any) {
      alert(`추가 실패: ${e.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    setIsDeleting(roomId);
    try {
      await deleteDoc(doc(db, 'specialRooms', roomId));
    } catch (e: any) {
      alert(`삭제 실패: ${e.message}`);
    } finally {
      setIsDeleting(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}></div>
        
        <div className="relative bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="bg-slate-800 px-8 py-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 text-white">
              <div className="p-2 bg-slate-700 rounded-xl">
                <MonitorPlay className="w-6 h-6 text-brand-400" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight">특별실 목록 설정</h2>
                <p className="text-xs font-bold text-slate-400 mt-0.5">학교 내 특별실을 추가하거나 삭제할 수 있습니다.</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-all text-slate-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-8 overflow-y-auto flex-1 bg-slate-50 flex flex-col gap-8 custom-scrollbar">
            
            {/* Add Section */}
            <form onSubmit={handleAddRoom} className="space-y-3">
              <label className="text-sm font-black text-slate-500 ml-1">신규 특별실 등록</label>
              <div className="flex gap-2">
                <input 
                  autoFocus
                  type="text"
                  placeholder="예: 컴퓨터실, 과학실, 음악실..."
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="flex-1 px-5 py-3.5 bg-white border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 font-bold text-slate-700 transition-all"
                />
                <button 
                  type="submit"
                  disabled={!newRoomName.trim() || isAdding}
                  className="px-6 bg-brand-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-brand-600/20 hover:bg-brand-700 disabled:opacity-50 disabled:bg-slate-300 disabled:shadow-none transition-all flex items-center gap-2 active:scale-95"
                >
                  {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  등록
                </button>
              </div>
            </form>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-black text-slate-500">현재 등록된 특별실 ({rooms.length})</h3>
              </div>
              
              {rooms.length === 0 ? (
                <div className="py-12 bg-white rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                  <AlertCircle className="w-10 h-10 mb-3 opacity-20" />
                  <p className="font-bold">등록된 특별실이 없습니다.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {rooms.map(room => (
                    <div 
                      key={room.id} 
                      className={`flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 group hover:border-brand-400 hover:shadow-md transition-all ${isDeleting === room.id ? 'opacity-50 grayscale' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-brand-400"></div>
                        <span className="font-black text-slate-700">{room.name}</span>
                      </div>
                      <button 
                        disabled={!!isDeleting}
                        onClick={() => setConfirmDelete({ id: room.id, name: room.name })}
                        className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                        title="방 삭제"
                      >
                        {isDeleting === room.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer Warning */}
          <div className="p-5 px-8 bg-amber-50 border-t border-amber-100 flex items-start gap-3 shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold text-amber-700 leading-normal">
              특별실을 삭제하면 해당 특별실의 모든 과거 및 미래 예약 내역이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없으니 주의하여 진행해 주세요.
            </p>
          </div>
        </div>
      </div>

      <ConfirmModal 
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDeleteRoom(confirmDelete.id)}
        type="danger"
        title="특별실 삭제 확인"
        message={`'${confirmDelete?.name}'을(를) 정말 삭제하시겠습니까? 관련 예약 내역이 모두 사라집니다.`}
        confirmText="영구 삭제"
      />
    </>
  );
}
