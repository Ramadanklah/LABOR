import React from 'react';

// Error boundary specifically for array slice errors
class SliceErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Check if it's the specific slice error
    if (error.message && error.message.includes('slice is not a function')) {
      return { hasError: true, error };
    }
    // Re-throw other errors
    throw error;
  }

  componentDidCatch(error, errorInfo) {
    console.error('Slice Error Boundary caught error:', error, errorInfo);
    console.error('This suggests filteredResults is not an array:', this.props.data);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 m-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Data Format Error
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>There was an issue with the data format. The server response is not in the expected array format.</p>
                <details className="mt-2">
                  <summary className="cursor-pointer font-medium">Technical Details</summary>
                  <pre className="mt-1 text-xs bg-red-100 p-2 rounded overflow-auto">
                    Error: {this.state.error?.message}
                    {'\n'}Data received: {JSON.stringify(this.props.data, null, 2)}
                  </pre>
                </details>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => {
                    this.setState({ hasError: false, error: null });
                    if (this.props.onRetry) {
                      this.props.onRetry();
                    }
                  }}
                  className="bg-red-100 hover:bg-red-200 text-red-800 font-bold py-2 px-4 rounded transition-colors duration-150"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Safe wrapper for components that use array methods
const SafeResultsList = ({ data, children, onRetry }) => {
  // Additional safety check before rendering
  React.useEffect(() => {
    console.log('SafeResultsList received data:', data, 'Type:', typeof data, 'Is array:', Array.isArray(data));
  }, [data]);

  return (
    <SliceErrorBoundary data={data} onRetry={onRetry}>
      {children}
    </SliceErrorBoundary>
  );
};

export default SafeResultsList;