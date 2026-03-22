import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  copied?: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleCopyError = async () => {
    if (this.state.error) {
      const errorText = `
Error: ${this.state.error.message}
Stack: ${this.state.error.stack}
Component Stack: ${this.state.errorInfo?.componentStack}
      `.trim();
      
      try {
        await navigator.clipboard.writeText(errorText);
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      } catch (err) {
        console.error('Failed to copy error:', err);
      }
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-brand-50 flex items-center justify-center p-6 font-sans">
          <div className="bg-white max-w-sm w-full rounded-[2.5rem] shadow-2xl p-10 text-center border border-brand-100 animate-in zoom-in-95 duration-500 overflow-hidden relative">
            <div className="bg-rose-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-rose-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2 tracking-tighter">오류가 발생했습니다</h2>
            <p className="text-slate-500 font-bold mb-6 text-sm">
              화면을 불러오는 중 문제가 생겼습니다.<br />
              아래의 에러 정보를 관리자에게 알려주세요.
            </p>

            {/* Error Detail Display */}
            <div className="bg-slate-50 rounded-2xl p-4 mb-6 text-left border border-slate-100 max-h-40 overflow-y-auto custom-scrollbar">
              <p className="text-[11px] font-black text-rose-600 mb-1 uppercase tracking-widest">Error Message</p>
              <p className="text-xs font-bold text-slate-700 break-all leading-relaxed mb-3">
                {this.state.error?.message || 'Unknown Error'}
              </p>
              <p className="text-[11px] font-black text-slate-400 mb-1 uppercase tracking-widest">Stack Trace</p>
              <pre className="text-[10px] text-slate-400 font-mono leading-tight whitespace-pre-wrap break-all opacity-80">
                {this.state.error?.stack?.split('\n').slice(0, 3).join('\n')}...
              </pre>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleCopyError}
                className={`w-full py-3.5 rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 border-2 text-sm
                  ${this.state.copied 
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-600' 
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}
                `}
              >
                {this.state.copied ? '복사 완료!' : '에러 정보 복사하기'}
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full py-4 bg-brand-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-brand-700 transition-all shadow-lg active:scale-95"
              >
                <RotateCcw className="w-5 h-5" /> 다시 시도하기
              </button>
            </div>
            
            <p className="mt-6 text-[10px] font-bold text-slate-300 uppercase tracking-widest">Ulleung School Table Safe Mode</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
