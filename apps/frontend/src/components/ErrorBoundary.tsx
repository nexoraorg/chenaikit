import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback; receives the caught error and a retry callback. */
  fallback?: (error: Error, retry: () => void) => ReactNode;
  /** Called once per caught error — hook up crash reporting here. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render errors anywhere below it in the tree and shows a fallback
 * instead of letting the whole app unmount to a blank page.
 *
 * Error boundaries only catch errors thrown while rendering, in lifecycle
 * methods, and in constructors of the tree below them — not in event
 * handlers, async code, or errors thrown by the boundary itself. See
 * https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Always log locally so the failure is visible in the console / server
    // logs, independent of whatever the fallback UI shows.
    console.error("[ErrorBoundary] caught a render error:", error, info.componentStack);
    this.props.onError?.(error, info);
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback(error, this.retry);
    }

    return (
      <div className="error-boundary" role="alert">
        <p className="error-boundary-title">Something went wrong.</p>
        <p className="error-boundary-desc">
          {import.meta.env.PROD
            ? "This part of the page hit an unexpected error. Try again, or reload the page."
            : error.message}
        </p>
        <div className="error-boundary-actions">
          <button className="btn primary" onClick={this.retry}>
            Try again
          </button>
          <button
            className="btn ghost"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
