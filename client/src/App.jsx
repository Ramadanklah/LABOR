import React, { useState, useEffect, Suspense, lazy } from 'react';
import apiClient from './utils/api.js';
import performanceMonitor from './utils/performance.js';
import './App.css';

// Lazy load large components for better performance
const LoginPage = lazy(() => import('./components/LoginPage.jsx'));
const ResultsDashboard = lazy(() => import('./components/ResultsDashboard.jsx'));
const UserManagement = lazy(() => import('./components/UserManagement.jsx'));

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

// Navigation Component
const Navigation = ({ currentUser, currentView, onViewChange, onLogout }) => {
  const navigation = [
    { 
      id: 'dashboard', 
      name: 'Dashboard', 
      icon: '📊', 
      allowedRoles: ['ADMIN', 'DOCTOR', 'LABTECH', 'PATIENT'] 
    },
    { 
      id: 'users', 
      name: 'User Management', 
      icon: '👥', 
      allowedRoles: ['ADMIN'] 
    }
  ];

  const filteredNavigation = navigation.filter(item => 
    item.allowedRoles.includes(currentUser.role)
  );

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Laboratory Results System
              </h1>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {filteredNavigation.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onViewChange(item.id)}
                  className={`${
                    currentView === item.id
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-150`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.name}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* User Info */}
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-indigo-700">
                    {currentUser.firstName?.charAt(0)}{currentUser.lastName?.charAt(0)}
                  </span>
                </div>
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-medium text-gray-900">
                  {currentUser.firstName} {currentUser.lastName}
                </div>
                <div className="text-xs text-gray-500 capitalize">
                  {currentUser.role?.replace('_', ' ')}
                </div>
              </div>
            </div>
            
            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150"
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile Navigation */}
      <div className="sm:hidden">
        <div className="pt-2 pb-3 space-y-1">
          {filteredNavigation.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`${
                currentView === item.id
                  ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              } block pl-3 pr-4 py-2 border-l-4 text-base font-medium w-full text-left transition-colors duration-150`}
            >
              <span className="mr-2">{item.icon}</span>
              {item.name}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};

function App() {
  const [token, setToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [appError, setAppError] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');

  // Initialize application
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check for existing auth token and user info
        const savedToken = localStorage.getItem('authToken');
        const savedUserInfo = localStorage.getItem('userInfo');
        
        if (savedToken && savedUserInfo) {
          try {
            // Validate token by fetching current user info
            const response = await apiClient.get('/auth/me');
            
            if (response.success) {
              setToken(savedToken);
              setCurrentUser(response.user);
              setIsLoggedIn(true);
            } else {
              // Token is invalid, clear storage
              localStorage.removeItem('authToken');
              localStorage.removeItem('userInfo');
              console.warn('Invalid session, please login again');
            }
          } catch (error) {
            // Token is invalid, clear storage
            localStorage.removeItem('authToken');
            localStorage.removeItem('userInfo');
            console.warn('Session expired, please login again');
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
  const handleLoginSuccess = (authToken, user) => {
    setToken(authToken);
    setCurrentUser(user);
    setIsLoggedIn(true);
    setCurrentView('dashboard'); // Default to dashboard view
    
    // Clear any cached data on new login
    apiClient.clearCache();
    
    // Track login event
    performanceMonitor.recordMetric('user_login', Date.now());
    
    console.log(`User logged in: ${user.email} (${user.role})`);
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      // Notify server of logout
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local state regardless of server response
      setToken(null);
      setCurrentUser(null);
      setIsLoggedIn(false);
      setCurrentView('dashboard');
      localStorage.removeItem('authToken');
      localStorage.removeItem('userInfo');
      
      // Clear cached data
      apiClient.clearCache();
      
      // Track logout event
      performanceMonitor.recordMetric('user_logout', Date.now());
      
      console.log('User logged out successfully');
    }
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

  // Handle view changes
  const handleViewChange = (view) => {
    setCurrentView(view);
    // Track navigation
    performanceMonitor.recordMetric('navigation', Date.now());
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

  // Render authenticated application
  if (isLoggedIn && currentUser) {
    return (
      <AppErrorBoundary>
        <div className="App min-h-screen bg-gray-100">
          <Navigation
            currentUser={currentUser}
            currentView={currentView}
            onViewChange={handleViewChange}
            onLogout={handleLogout}
          />
          
          <main className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <Suspense fallback={<LoadingSpinner />}>
                {currentView === 'dashboard' && (
                  <ResultsDashboard 
                    token={token}
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    onError={handleAppError}
                  />
                )}
                {currentView === 'users' && currentUser.role === 'admin' && (
                  <UserManagement 
                    currentUser={currentUser}
                    onError={handleAppError}
                  />
                )}
              </Suspense>
            </div>
          </main>
        </div>
      </AppErrorBoundary>
    );
  }

  // Render login page
  return (
    <AppErrorBoundary>
      <div className="App">
        <Suspense fallback={<LoadingSpinner />}>
          <LoginPage 
            onLoginSuccess={handleLoginSuccess}
            onError={handleAppError}
          />
        </Suspense>
      </div>
    </AppErrorBoundary>
  );
}

export default App;
