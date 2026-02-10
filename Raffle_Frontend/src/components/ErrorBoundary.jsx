import React from 'react';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
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

        this.setState({
            error,
            errorInfo
        });
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
