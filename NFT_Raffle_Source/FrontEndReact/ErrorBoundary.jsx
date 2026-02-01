import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 bg-red-900 text-white min-h-screen">
                    <h1 className="text-2xl font-bold mb-4">🚨 Ada yang Error Bro!</h1>
                    <p className="mb-2">Coba screenshot halaman ini dan kirim ke AI:</p>
                    <div className="bg-black p-4 rounded overflow-auto whitespace-pre-wrap font-mono text-sm border border-red-500">
                        {this.state.error && this.state.error.toString()}
                        <br />
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
