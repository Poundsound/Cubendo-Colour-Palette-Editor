import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, fontFamily: 'Inter, Arial, sans-serif', color: '#fff', background: '#1a1a1a', minHeight: '100vh' }}>
          <h2 style={{ marginTop: 0 }}>Something went wrong.</h2>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#222', padding: 12, borderRadius: 8, border: '1px solid #333' }}>
            {String(this.state.error)}
          </pre>
          <p>Check the browser console for details.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
