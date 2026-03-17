import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="h-[100dvh] bg-white dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-red-500 font-semibold mb-2">发生错误</p>
          <p className="text-zinc-500 text-sm mb-4">{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
