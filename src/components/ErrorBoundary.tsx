import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-brand-50 flex items-center justify-center p-6">
          <div className="bg-white max-w-sm w-full rounded-[2.5rem] shadow-2xl p-10 text-center border border-brand-100 animate-in zoom-in-95 duration-500">
            <div className="bg-rose-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-rose-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-4 tracking-tighter">문제가 발생했습니다</h2>
            <p className="text-slate-500 font-bold mb-8 leading-relaxed">
              화면을 불러오는 중 오류가 발생했습니다.<br />
              아래 버튼을 눌러 다시 시도해 주세요.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-brand-700 transition-all shadow-lg active:scale-95"
            >
              <RotateCcw className="w-5 h-5" /> 다시 시도하기
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
