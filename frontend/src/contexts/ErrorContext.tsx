import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ErrorContextPayload, ErrorReport, logError } from '../utils/errorLogger';

interface ErrorContextValue {
  errors: ErrorReport[];
  reportError: (error: unknown, context?: ErrorContextPayload) => Promise<ErrorReport>;
  clearErrors: () => void;
  lastError?: ErrorReport;
}

const ErrorContext = createContext<ErrorContextValue | undefined>(undefined);

export const ErrorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [errors, setErrors] = useState<ErrorReport[]>([]);

  const reportError = useCallback(async (error: unknown, context: ErrorContextPayload = {}) => {
    const report = await logError(error, context);
    setErrors((current) => [report, ...current].slice(0, 20));
    return report;
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  useEffect(() => {
    const handleUnhandledError = (event: ErrorEvent) => {
      void reportError(event.error ?? event.message, {
        type: 'unknown',
        boundary: 'window.onerror',
        metadata: { filename: event.filename, line: event.lineno, column: event.colno },
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      void reportError(event.reason ?? 'Unhandled promise rejection', {
        type: 'unknown',
        boundary: 'unhandledrejection',
      });
    };

    window.addEventListener('error', handleUnhandledError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleUnhandledError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [reportError]);

  const value = useMemo<ErrorContextValue>(
    () => ({
      errors,
      reportError,
      clearErrors,
      lastError: errors[0],
    }),
    [clearErrors, errors, reportError]
  );

  return <ErrorContext.Provider value={value}>{children}</ErrorContext.Provider>;
};

export function useErrorContext(): ErrorContextValue {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useErrorContext must be used within an ErrorProvider');
  }
  return context;
}
