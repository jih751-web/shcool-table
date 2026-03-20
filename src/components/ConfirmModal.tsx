import { X, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'info' | 'success';
}

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = '확인', 
  cancelText = '취소',
  type = 'info'
}: Props) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger': return <Trash2 className="w-6 h-6 text-red-500" />;
      case 'success': return <CheckCircle2 className="w-6 h-6 text-emerald-500" />;
      default: return <AlertTriangle className="w-6 h-6 text-brand-500" />;
    }
  };

  const getButtonClass = () => {
    switch (type) {
      case 'danger': return 'bg-red-500 hover:bg-red-600';
      case 'success': return 'bg-emerald-500 hover:bg-emerald-600';
      default: return 'bg-brand-600 hover:bg-brand-700';
    }
  };

  const getBgClass = () => {
    switch (type) {
      case 'danger': return 'bg-red-50';
      case 'success': return 'bg-emerald-50';
      default: return 'bg-brand-50';
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}></div>
      
      <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl shrink-0 ${getBgClass()}`}>
              {getIcon()}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black text-slate-800 mb-2 leading-tight">{title}</h3>
              <p className="text-slate-500 font-medium leading-relaxed">{message}</p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 bg-slate-50 flex gap-3 justify-end border-t border-slate-100">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-white border border-slate-200 transition-all active:scale-95"
          >
            {cancelText}
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-8 py-2.5 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 ${getButtonClass()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
