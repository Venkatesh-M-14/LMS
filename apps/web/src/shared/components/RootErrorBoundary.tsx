import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Last line of defence. Sits OUTSIDE every provider, so it must not rely on
 * MUI theme, i18n, or the store — any of those could be the thing that broke.
 */
export class RootErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled application error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: '12px',
          fontFamily: 'system-ui, sans-serif',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Something went wrong</h1>
        <p style={{ margin: 0, color: '#666' }}>
          An unexpected error occurred in the application. Reloading usually fixes it.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: '8px 20px',
            fontSize: '1rem',
            cursor: 'pointer',
            borderRadius: '8px',
            border: '1px solid #3f51b5',
            background: '#3f51b5',
            color: '#fff',
          }}
        >
          Reload page
        </button>
      </div>
    );
  }
}
