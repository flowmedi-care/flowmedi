"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, componentStack: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Erro capturado:", error, errorInfo);
    console.error("[ErrorBoundary] Mensagem:", error?.message);
    console.error("[ErrorBoundary] Stack do componente:", errorInfo.componentStack);
    this.setState({ componentStack: errorInfo.componentStack ?? null });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const err = this.state.error;
      const componentStack = this.state.componentStack;

      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg max-w-2xl">
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Algo deu errado (inspeção)
          </h2>
          <p className="text-sm text-red-600 mb-2 font-mono break-all">
            {err?.message || "Ocorreu um erro inesperado"}
          </p>
          {err?.stack && (
            <pre className="text-xs bg-red-100 p-3 rounded overflow-auto max-h-32 mb-2 whitespace-pre-wrap break-all">
              {err.stack}
            </pre>
          )}
          {componentStack && (
            <pre className="text-xs bg-amber-100 p-3 rounded overflow-auto max-h-32 mb-4 whitespace-pre-wrap break-all">
              {componentStack}
            </pre>
          )}
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Recarregar página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
