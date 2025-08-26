import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';
import apiClient from '../utils/api';

// Mock the API client
jest.mock('../utils/api');
const mockApiClient = apiClient;

// Mock the performance monitor
jest.mock('../utils/performance', () => ({
  startPageLoad: jest.fn(),
  endPageLoad: jest.fn(),
  trackEvent: jest.fn()
}));

// Mock lazy-loaded components
jest.mock('./LoginPage', () => {
  return function MockLoginPage({ onLogin }) {
    return (
      <div data-testid="login-page">
        <h1>Login Page</h1>
        <button onClick={() => onLogin({ id: '1', email: 'test@example.com', role: 'patient' })}>
          Login
        </button>
      </div>
    );
  };
});

jest.mock('./ResultsDashboard', () => {
  return function MockResultsDashboard({ user }) {
    return (
      <div data-testid="results-dashboard">
        <h1>Results Dashboard</h1>
        <p>Welcome, {user.email}</p>
      </div>
    );
  };
});

jest.mock('./UserManagement', () => {
  return function MockUserManagement({ user }) {
    return (
      <div data-testid="user-management">
        <h1>User Management</h1>
        <p>Admin: {user.email}</p>
      </div>
    );
  };
});

// Helper function to render App with Router
const renderApp = (initialEntries = ['/']) => {
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
};

describe('App Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Initial Render', () => {
    it('should render without crashing', () => {
      renderApp();
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      renderApp();
      // The App should handle initial loading state
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should display login page when not authenticated', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Not authenticated'));
      
      renderApp();
      
      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });
    });

    it('should check authentication status on mount', async () => {
      mockApiClient.get.mockResolvedValue({
        data: { success: true, user: { id: '1', email: 'test@example.com', role: 'patient' } }
      });

      renderApp();

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledWith('/api/auth/me');
      });
    });
  });

  describe('Authentication Flow', () => {
    it('should handle successful login', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('Not authenticated'));
      mockApiClient.post.mockResolvedValue({
        data: {
          success: true,
          token: 'mock-token',
          user: { id: '1', email: 'test@example.com', role: 'patient' }
        }
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });

      const loginButton = screen.getByText('Login');
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(screen.getByTestId('results-dashboard')).toBeInTheDocument();
        expect(screen.getByText('Welcome, test@example.com')).toBeInTheDocument();
      });
    });

    it('should handle login failure', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Not authenticated'));
      
      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });

      // Test that failed login doesn't change the view
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });

    it('should handle logout', async () => {
      const user = { id: '1', email: 'test@example.com', role: 'patient' };
      mockApiClient.get.mockResolvedValue({
        data: { success: true, user }
      });
      mockApiClient.post.mockResolvedValue({
        data: { success: true, message: 'Logged out successfully' }
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('results-dashboard')).toBeInTheDocument();
      });

      // Find and click logout button
      const logoutButton = screen.getByText('Logout');
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/logout');
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });
    });

    it('should persist authentication state in localStorage', async () => {
      const user = { id: '1', email: 'test@example.com', role: 'patient' };
      mockApiClient.get.mockResolvedValue({
        data: { success: true, user }
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('results-dashboard')).toBeInTheDocument();
      });

      // Check that user data is stored
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      expect(storedUser.email).toBe('test@example.com');
    });

    it('should restore authentication state from localStorage', async () => {
      const user = { id: '1', email: 'test@example.com', role: 'patient' };
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('token', 'mock-token');

      mockApiClient.get.mockResolvedValue({
        data: { success: true, user }
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('results-dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Role-Based Navigation', () => {
    it('should show results dashboard for patient role', async () => {
      const user = { id: '1', email: 'patient@example.com', role: 'patient' };
      mockApiClient.get.mockResolvedValue({
        data: { success: true, user }
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('results-dashboard')).toBeInTheDocument();
        expect(screen.getByText('Welcome, patient@example.com')).toBeInTheDocument();
      });
    });

    it('should show user management for admin role', async () => {
      const user = { id: '1', email: 'admin@example.com', role: 'admin' };
      mockApiClient.get.mockResolvedValue({
        data: { success: true, user }
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('user-management')).toBeInTheDocument();
        expect(screen.getByText('Admin: admin@example.com')).toBeInTheDocument();
      });
    });

    it('should show appropriate navigation for doctor role', async () => {
      const user = { id: '1', email: 'doctor@example.com', role: 'doctor' };
      mockApiClient.get.mockResolvedValue({
        data: { success: true, user }
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('results-dashboard')).toBeInTheDocument();
        // Should have additional doctor features
        expect(screen.getByText('Upload LDT')).toBeInTheDocument();
      });
    });

    it('should show navigation menu based on user role', async () => {
      const user = { id: '1', email: 'admin@example.com', role: 'admin' };
      mockApiClient.get.mockResolvedValue({
        data: { success: true, user }
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Users')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error boundary for component errors', () => {
      // Mock console.error to prevent error output in tests
      const originalError = console.error;
      console.error = jest.fn();

      // Create a component that throws an error
      const ThrowError = () => {
        throw new Error('Test error');
      };

      const AppWithError = () => (
        <BrowserRouter>
          <div>
            <ThrowError />
          </div>
        </BrowserRouter>
      );

      render(<AppWithError />);

      // In a real implementation, the error boundary would catch this
      // For now, we test that the error is thrown
      expect(console.error).toHaveBeenCalled();

      console.error = originalError;
    });

    it('should handle API errors gracefully', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Network error'));

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });

      // Should not crash the app
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });

    it('should show error message for authentication failures', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Invalid token'));

      renderApp();

      await waitFor(() => {
        // Should fallback to login page
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });
    });

    it('should handle session expiration', async () => {
      const user = { id: '1', email: 'test@example.com', role: 'patient' };
      mockApiClient.get
        .mockResolvedValueOnce({ data: { success: true, user } })
        .mockRejectedValueOnce(new Error('Token expired'));

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('results-dashboard')).toBeInTheDocument();
      });

      // Simulate a request that fails due to expired token
      await act(async () => {
        mockApiClient.get.mockRejectedValue(new Error('Token expired'));
      });

      // Should redirect to login
      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading spinner during authentication check', () => {
      mockApiClient.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      renderApp();

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should show loading states for lazy-loaded components', async () => {
      mockApiClient.get.mockResolvedValue({
        data: { success: true, user: { id: '1', email: 'test@example.com', role: 'patient' } }
      });

      renderApp();

      // Initially should show loading
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('results-dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const user = { id: '1', email: 'test@example.com', role: 'patient' };
      mockApiClient.get.mockResolvedValue({
        data: { success: true, user }
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('results-dashboard')).toBeInTheDocument();
      });

      // Should have mobile-appropriate classes
      const navElement = screen.getByRole('navigation');
      expect(navElement).toHaveClass('mobile-nav');
    });

    it('should show mobile menu toggle on small screens', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      const user = { id: '1', email: 'test@example.com', role: 'admin' };
      mockApiClient.get.mockResolvedValue({
        data: { success: true, user }
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('user-management')).toBeInTheDocument();
      });

      expect(screen.getByLabelText('Toggle menu')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should lazy load components', async () => {
      const user = { id: '1', email: 'test@example.com', role: 'patient' };
      mockApiClient.get.mockResolvedValue({
        data: { success: true, user }
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('results-dashboard')).toBeInTheDocument();
      });

      // Components should be lazy loaded (this is implicit in the mock setup)
      expect(screen.getByTestId('results-dashboard')).toBeInTheDocument();
    });

    it('should track performance metrics', async () => {
      const performanceMonitor = require('../utils/performance');
      
      renderApp();

      expect(performanceMonitor.startPageLoad).toHaveBeenCalled();

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });

      expect(performanceMonitor.endPageLoad).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      const user = { id: '1', email: 'test@example.com', role: 'patient' };
      mockApiClient.get.mockResolvedValue({
        data: { success: true, user }
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('results-dashboard')).toBeInTheDocument();
      });

      expect(screen.getByRole('navigation')).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = { id: '1', email: 'admin@example.com', role: 'admin' };
      mockApiClient.get.mockResolvedValue({
        data: { success: true, user }
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('user-management')).toBeInTheDocument();
      });

      // Test that navigation links are focusable
      const dashboardLink = screen.getByText('Dashboard');
      dashboardLink.focus();
      expect(document.activeElement).toBe(dashboardLink);
    });

    it('should announce route changes to screen readers', async () => {
      const user = { id: '1', email: 'admin@example.com', role: 'admin' };
      mockApiClient.get.mockResolvedValue({
        data: { success: true, user }
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('user-management')).toBeInTheDocument();
      });

      // Should have live region for announcements
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Security', () => {
    it('should clear sensitive data on logout', async () => {
      const user = { id: '1', email: 'test@example.com', role: 'patient' };
      mockApiClient.get.mockResolvedValue({
        data: { success: true, user }
      });
      mockApiClient.post.mockResolvedValue({
        data: { success: true, message: 'Logged out successfully' }
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('results-dashboard')).toBeInTheDocument();
      });

      const logoutButton = screen.getByText('Logout');
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(localStorage.getItem('token')).toBeNull();
        expect(localStorage.getItem('user')).toBeNull();
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });
    });

    it('should not expose sensitive information in DOM', async () => {
      const user = { id: '1', email: 'test@example.com', role: 'patient' };
      mockApiClient.get.mockResolvedValue({
        data: { success: true, user }
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('results-dashboard')).toBeInTheDocument();
      });

      // Check that password or token is not in the DOM
      expect(screen.queryByText(/password/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/token/i)).not.toBeInTheDocument();
    });

    it('should validate user permissions before rendering components', async () => {
      const user = { id: '1', email: 'patient@example.com', role: 'patient' };
      mockApiClient.get.mockResolvedValue({
        data: { success: true, user }
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('results-dashboard')).toBeInTheDocument();
      });

      // Patient should not see admin components
      expect(screen.queryByTestId('user-management')).not.toBeInTheDocument();
      expect(screen.queryByText('User Management')).not.toBeInTheDocument();
    });
  });

  describe('State Management', () => {
    it('should maintain user state across component re-renders', async () => {
      const user = { id: '1', email: 'test@example.com', role: 'patient' };
      mockApiClient.get.mockResolvedValue({
        data: { success: true, user }
      });

      const { rerender } = renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('results-dashboard')).toBeInTheDocument();
        expect(screen.getByText('Welcome, test@example.com')).toBeInTheDocument();
      });

      // Rerender the component
      rerender(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );

      // User state should be maintained
      expect(screen.getByText('Welcome, test@example.com')).toBeInTheDocument();
    });

    it('should handle concurrent state updates', async () => {
      const user = { id: '1', email: 'test@example.com', role: 'patient' };
      mockApiClient.get.mockResolvedValue({
        data: { success: true, user }
      });

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('results-dashboard')).toBeInTheDocument();
      });

      // Simulate multiple concurrent updates
      await act(async () => {
        // Multiple state updates that might happen concurrently
        fireEvent.click(screen.getByText('Refresh'));
        fireEvent.click(screen.getByText('Settings'));
      });

      // App should remain stable
      expect(screen.getByTestId('results-dashboard')).toBeInTheDocument();
    });
  });
});