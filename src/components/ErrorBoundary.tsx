import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Orca ErrorBoundary caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleReload = () => {
    try {
      window.location.reload();
    } catch {
      this.handleReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[300px] flex items-center justify-center p-6 bg-slate-950/80 text-slate-100 font-['Cairo',sans-serif]">
          <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">
                {this.props.fallbackTitle || 'حدث تنبيه غير متوقع أثناء عرض الواجهة'}
              </h3>
              <p className="text-xs text-slate-400">
                تم احتواء الخطأ البرمجي بنجاح دون إيقاف باقي خدمات المنظومة أو فقدان البيانات.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 text-right max-h-28 overflow-y-auto">
                <p className="text-[11px] font-mono text-rose-300 break-all">
                  {this.state.error.message || String(this.state.error)}
                </p>
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة المحاولة</span>
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all border border-slate-700 active:scale-95"
              >
                <Home className="w-3.5 h-3.5" />
                <span>تحديث الصفحة</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
