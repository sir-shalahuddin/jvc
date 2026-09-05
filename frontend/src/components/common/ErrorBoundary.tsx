import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--bg-app, #0e0f12)',
            color: 'var(--text-primary, #ffffff)',
            padding: '2rem',
            boxSizing: 'border-box',
          }}
        >
          <div
            className="content-card"
            style={{
              maxWidth: '540px',
              width: '100%',
              padding: '2.5rem 2rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.25rem',
              boxShadow: 'var(--shadow-lg)',
              borderRadius: 'var(--radius-lg, 14px)',
              border: '1px solid var(--border-card, #2d3139)',
              background: 'var(--bg-card, #16181d)',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: 'var(--radius-full, 9999px)',
                backgroundColor: 'var(--danger-bg, rgba(239, 68, 68, 0.15))',
                color: 'var(--danger, #ef4444)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle size={30} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <h1
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: 'var(--text-primary, #ffffff)',
                  margin: 0,
                  letterSpacing: '-0.01em',
                }}
              >
                {this.props.fallbackTitle || 'Something went wrong'}
              </h1>
              <p
                style={{
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary, #9ca3af)',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {this.props.fallbackMessage ||
                  'The retrospective board encountered an unexpected render issue. Don’t worry, your cards and session data are safely stored.'}
              </p>
            </div>

            {this.state.error && (
              <div
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'var(--bg-subtle, #1e2128)',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md, 10px)',
                  border: '1px solid var(--border-subtle, #282c35)',
                  overflowX: 'auto',
                  maxHeight: '120px',
                }}
              >
                <code
                  style={{
                    fontSize: '0.78rem',
                    fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--danger, #f87171)',
                    wordBreak: 'break-word',
                  }}
                >
                  {this.state.error.toString()}
                </code>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                flexWrap: 'wrap',
                justifyContent: 'center',
                marginTop: '0.5rem',
              }}
            >
              <button
                type="button"
                onClick={this.handleReload}
                className="btn btn-primary"
                style={{ gap: '0.5rem', padding: '0.65rem 1.25rem' }}
              >
                <RefreshCw size={16} />
                <span>Reload Page</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="btn btn-secondary"
                style={{ gap: '0.5rem', padding: '0.65rem 1.25rem' }}
              >
                <Home size={16} />
                <span>Back to Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
