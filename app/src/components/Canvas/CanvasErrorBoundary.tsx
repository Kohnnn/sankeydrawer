'use client';

import React from 'react';

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class CanvasErrorBoundary extends React.Component<
    { children: React.ReactNode },
    ErrorBoundaryState
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Canvas Error:', error, errorInfo);

        // Clear potentially corrupted state
        try {
            // Only clear diagram state, preserve other app settings
            const stateKeys = Object.keys(localStorage);
            stateKeys.forEach(key => {
                if (key.includes('diagram') || key.includes('sankey')) {
                    localStorage.removeItem(key);
                }
            });
        } catch (e) {
            console.error('Failed to clear localStorage:', e);
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center h-screen bg-gray-50">
                    <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
                        <svg
                            className="mx-auto h-12 w-12 text-red-600 mb-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                        <h2 className="text-2xl font-bold text-red-600 mb-4">
                            Canvas Error
                        </h2>
                        <p className="text-gray-700 mb-2">
                            The canvas encountered an error. Your data has been preserved.
                        </p>
                        {this.state.error && (
                            <p className="text-sm text-gray-500 mb-4 font-mono">
                                {this.state.error.message}
                            </p>
                        )}
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                            Reload Application
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
