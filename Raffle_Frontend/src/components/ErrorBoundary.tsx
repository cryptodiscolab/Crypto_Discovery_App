import React from 'react';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(_error: Error) {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Auto-reload on chunk loading error caused by new deployments
        const isChunkLoadFailed = error?.message?.includes('Failed to fetch dynamically imported module') ||
            error?.message?.includes('Importing a module script failed');

        if (isChunkLoadFailed) {
            console.warn('Update detected! Reloading page to fetch new chunks...');
            window.location.reload();
            return;
        }

        // Log error details to console
        console.error('🚨 ErrorBoundary caught an error:');
        console.error('Error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Component stack:', errorInfo.componentStack);

        // Try to extract the problematic value
        if (error.message && error.message.includes('Objects are not valid as a React child')) {
            console.error('🎯 This is React Error #31!');
            console.error('Check the component stack above to find which component is rendering an object');
        }

        // Report to backend system_error_logs (fire-and-forget, rate-limited)
        this.reportErrorToBackend(error, errorInfo);

        this.setState({
            error,
            errorInfo
        });
    }

    private lastReportedAt = 0;
    private reportErrorToBackend(error: Error, errorInfo: React.ErrorInfo) {
        // Rate limit: max 1 report per 30 seconds
        const now = Date.now();
        if (now - this.lastReportedAt < 30000) return;
        this.lastReportedAt = now;

        try {
            const sanitizedMessage = (error.message || 'Unknown error').slice(0, 500);
            const componentStack = (errorInfo.componentStack || '').slice(0, 300);
            fetch('/api/user-bundle', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    action: 'log-activity',
                    wallet_address: 'system',
                    signature: 'error-boundary',
                    message: 'Error Boundary Report',
                    category: 'ERROR',
                    type: 'React Error Boundary',
                    description: sanitizedMessage,
                    metadata: {
                        component_stack: componentStack,
                        url: window.location.pathname,
                        user_agent: navigator.userAgent.slice(0, 100)
                    }
                })
            }).catch(() => {}); // fire-and-forget
        } catch { /* never throw from error reporter */ }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '20px',
                    margin: '20px',
                    border: '2px solid red',
                    borderRadius: '8px',
                    backgroundColor: '#fee',
                    color: '#c00'
                }}>
                    <h2>⚠️ Something went wrong</h2>
                    <details style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
                        <summary>Click for error details</summary>
                        <p><strong>Error:</strong> {this.state.error && this.state.error.toString()}</p>
                        <p><strong>Component Stack:</strong></p>
                        <pre>{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
                    </details>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: '10px',
                            padding: '8px 16px',
                            backgroundColor: '#c00',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
