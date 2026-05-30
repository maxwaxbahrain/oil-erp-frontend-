import { StrictMode, Component, type ReactNode, type ErrorInfo } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/theme.css'
import App from './app/App.tsx'
import { AuthProvider } from './contexts/AuthContext'

// App version: force cache bust on deploy.
// The window-level assignment below ensures this version string
// survives esbuild minification — a bare comment would be stripped
// and the bundle's content hash wouldn't change, defeating the point.
(window as unknown as { __APP_VERSION__?: string }).__APP_VERSION__ = '2026-05-30T22:30Z-cache-bust-1';

// Root error boundary — last line of defence against render-time
// crashes (e.g. malformed API rows that previously took the whole
// dashboard to a black screen). Shows a readable error and a way
// back to a known-good route instead of an empty viewport.
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface in the console so devtools still gets the stack even
    // though React swallows it once the boundary handles it.
    console.error('Root ErrorBoundary caught:', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, color: '#EEF2FF', background: '#060f1c', minHeight: '100vh' }}>
          <h2>Something went wrong</h2>
          <pre style={{ color: '#FCA5A5', fontSize: 12 }}>{this.state.error?.message}</pre>
          <button
            onClick={() => { window.location.href = '/dashboard'; }}
            style={{ marginTop: 16, padding: '8px 16px', background: '#4F8EF7', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            Back to Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
