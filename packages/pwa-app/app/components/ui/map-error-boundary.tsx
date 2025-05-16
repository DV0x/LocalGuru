'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

class MapErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Map error:', error, errorInfo);
    // Could report to error monitoring service
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="w-full h-full flex items-center justify-center bg-gray-800 rounded-lg">
          <div className="text-center p-4">
            <h3 className="text-red-400 mb-2">Map couldn't be loaded</h3>
            <p className="text-gray-300 text-sm">Please try refreshing the page</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default MapErrorBoundary; 