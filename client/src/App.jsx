import React, { useState, useEffect, Suspense, ErrorBoundary } from 'react';
import LoginPage from './components/LoginPage.jsx';
import ResultsDashboard from './components/ResultsDashboard.jsx';
import apiClient from './utils/api.js';
import performanceMonitor from './utils/performance.js';
import './App.css';

// Error Boundary Component
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error:', error, errorInfo);
    // In production, send error to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Send to error tracking service (e.g., Sentry)
      console.error('Production error:', { error, errorInfo });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Application Error
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>Something went wrong. Please refresh the page or contact support.</p>
                    {process.env.NODE_ENV === 'development' && (
                      <details className="mt-2">
                        <summary className="cursor-pointer">Error Details</summary>
                        <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto">
                          {this.state.error?.toString()}
                        </pre>
                      </details>
                    )}
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        this.setState({ hasError: false, error: null });
                        window.location.reload();
                      }}
                      className="bg-red-100 hover:bg-red-200 text-red-800 font-bold py-2 px-4 rounded transition-colors duration-150"
                    >
                      Reload Application
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Loading Component
const LoadingSpinner = () => (
  <div className="min-h-screen bg-gray-100 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
      <p className="mt-4 text-gray-600 text-lg">Loading application...</p>
    </div>
  </div>
);

function App() {
  const [token, setToken] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [appError, setAppError] = useState(null);

  // Initialize application
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check for existing auth token
        const savedToken = localStorage.getItem('authToken');
        if (savedToken) {
          try {
            // Validate token by making a test request
            await apiClient.get('/health');
            setToken(savedToken);
            setIsLoggedIn(true);
          } catch (error) {
            // Token is invalid, remove it
            localStorage.removeItem('authToken');
            console.warn('Invalid token removed');
          }
        }

        // Initialize performance monitoring
        if (process.env.NODE_ENV === 'production') {
          console.log('🚀 Performance monitoring initialized');
        }

      } catch (error) {
        console.error('App initialization error:', error);
        setAppError('Failed to initialize application');
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  // Handle successful login
  const handleLoginSuccess = (authToken) => {
    setToken(authToken);
    setIsLoggedIn(true);
    localStorage.setItem('authToken', authToken);
    
    // Clear any cached data on new login
    apiClient.clearCache();
    
    // Track login event
    performanceMonitor.recordMetric('user_login', Date.now());
  };

  // Handle logout
  const handleLogout = () => {
    setToken(null);
    setIsLoggedIn(false);
    localStorage.removeItem('authToken');
    
    // Clear cached data
    apiClient.clearCache();
    
    // Track logout event
    performanceMonitor.recordMetric('user_logout', Date.now());
  };

  // Handle app errors
  const handleAppError = (error) => {
    console.error('App error:', error);
    setAppError(error.message || 'An unexpected error occurred');
  };

  // Clear app error
  const clearAppError = () => {
    setAppError(null);
  };

  // Show loading screen during initialization
  if (isLoading) {
    return (
      <AppErrorBoundary>
        <LoadingSpinner />
      </AppErrorBoundary>
    );
  }

  // Show app error
  if (appError) {
    return (
      <AppErrorBoundary>
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Application Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{appError}</p>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={clearAppError}
                      className="bg-red-100 hover:bg-red-200 text-red-800 font-bold py-2 px-4 rounded mr-2 transition-colors duration-150"
                    >
                      Retry
                    </button>
                    <button
                      onClick={() => window.location.reload()}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded transition-colors duration-150"
                    >
                      Reload Page
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppErrorBoundary>
    );
  }

  return (
    <AppErrorBoundary>
      <div className="App">
        <Suspense fallback={<LoadingSpinner />}>
          {isLoggedIn ? (
            <ResultsDashboard 
              token={token} 
              onLogout={handleLogout}
              onError={handleAppError}
            />
          ) : (
            <LoginPage 
              onLoginSuccess={handleLoginSuccess}
              onError={handleAppError}
            />
          )}
        </Suspense>
      </div>
    </AppErrorBoundary>
  );
}

export default App;
