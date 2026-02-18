import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Human-readable name for the section (shown in error UI) */
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render-time errors inside a subtree so a crash in one panel
 * doesn't take down the entire renderer.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.name ?? 'unknown'}]`, error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '2rem',
            gap: '1rem',
            color: 'var(--text-secondary, #aaa)',
          }}
        >
          <span style={{ fontSize: '2rem' }}>⚠️</span>
          <h3 style={{ margin: 0, color: 'var(--text-primary, #fff)' }}>
            {this.props.name ? `${this.props.name} crashed` : 'Something went wrong'}
          </h3>
          <code
            style={{
              fontSize: '0.75rem',
              background: 'var(--bg-secondary, #2a2a2a)',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              maxWidth: '100%',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {this.state.error?.message}
          </code>
          <button className="btn" onClick={this.handleReset}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
