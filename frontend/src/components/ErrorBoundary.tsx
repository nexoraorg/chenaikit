import React from 'react';
import ErrorFallback from './ErrorFallback';
import { ErrorContextPayload, ErrorReport, logError } from '../utils/errorLogger';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  name?: string;
  fallbackTitle?: string;
  fallbackMessage?: string;
  compact?: boolean;
  onError?: (error: Error, report: ErrorReport) => void;
  resetKeys?: Array<string | number | boolean | null | undefined>;
}

interface ErrorBoundaryState {
  error?: Error;
  report?: ErrorReport;
  resetCount: number;
}

function keysChanged(
  previous: ErrorBoundaryProps['resetKeys'],
  next: ErrorBoundaryProps['resetKeys']
): boolean {
  if (!previous || !next || previous.length !== next.length) return false;
  return previous.some((key, index) => key !== next[index]);
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { resetCount: 0 };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const context: ErrorContextPayload = {
      type: 'rendering',
      boundary: this.props.name ?? 'ErrorBoundary',
      componentStack: errorInfo.componentStack ?? undefined,
    };

    void logError(error, context).then((report) => {
      this.setState({ report });
      this.props.onError?.(error, report);
    });
  }

  componentDidUpdate(previousProps: ErrorBoundaryProps): void {
    if (this.state.error && keysChanged(previousProps.resetKeys, this.props.resetKeys)) {
      this.reset();
    }
  }

  reset = (): void => {
    this.setState((state) => ({
      error: undefined,
      report: undefined,
      resetCount: state.resetCount + 1,
    }));
  };

  reload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          report={this.state.report}
          title={this.props.fallbackTitle}
          message={this.props.fallbackMessage}
          boundaryName={this.props.name}
          onRetry={this.reset}
          onReset={this.reload}
          compact={this.props.compact}
        />
      );
    }

    return <React.Fragment key={this.state.resetCount}>{this.props.children}</React.Fragment>;
  }
}

export default ErrorBoundary;
