import React, { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  public resetError = () => {
    this.setState({ hasError: false, error: undefined })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="page" style={{ textAlign: 'center', padding: '2rem', maxWidth: '500px', margin: '0 auto' }}>
          <h1 style={{ color: 'var(--danger)', marginBottom: '1rem' }}>Something went wrong</h1>
          {this.props.fallback || (
            <>
              <p style={{ marginBottom: '1.5rem', opacity: 0.8 }}>
                A component crashed. This is usually a temporary issue.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={this.resetError}
                  style={{ padding: '0.75rem 1.5rem' }}
                >
                  Try again
                </button>
                <a href="/" className="btn btn-ghost" style={{ padding: '0.75rem 1.5rem' }}>
                  Go to Dashboard
                </a>
              </div>
              {import.meta.env.DEV && (
                <details style={{ marginTop: '2rem', textAlign: 'left', opacity: 0.6 }}>
                  <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>Error details (dev)</summary>
                  <pre style={{ fontSize: '0.875rem', background: 'var(--code-bg)', padding: '1rem', borderRadius: '0.5rem', overflow: 'auto' }}>
                    {this.state.error?.toString()}
                  </pre>
                </details>
              )}
            </>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
