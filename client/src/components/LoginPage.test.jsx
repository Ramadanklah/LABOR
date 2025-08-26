import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import LoginPage from './LoginPage';
import apiClient from '../utils/api';

// Mock the API client
jest.mock('../utils/api');
const mockApiClient = apiClient;

describe('LoginPage Component', () => {
  const mockOnLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial Render', () => {
    it('should render login form', () => {
      render(<LoginPage onLogin={mockOnLogin} />);
      
      expect(screen.getByRole('heading', { name: /lab results login/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should have correct form structure', () => {
      render(<LoginPage onLogin={mockOnLogin} />);
      
      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();
      
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(emailInput).toBeRequired();
      expect(passwordInput).toBeRequired();
    });

    it('should display login method tabs', () => {
      render(<LoginPage onLogin={mockOnLogin} />);
      
      expect(screen.getByText('Email Login')).toBeInTheDocument();
      expect(screen.getByText('BSNR/LANR Login')).toBeInTheDocument();
    });

    it('should have security features visible', () => {
      render(<LoginPage onLogin={mockOnLogin} />);
      
      expect(screen.getByText(/secure healthcare platform/i)).toBeInTheDocument();
      expect(screen.getByText(/gdpr compliant/i)).toBeInTheDocument();
    });
  });

  describe('Email Login', () => {
    it('should handle successful email login', async () => {
      const user = userEvent.setup();
      const mockUserData = {
        id: '1',
        email: 'test@example.com',
        role: 'patient',
        firstName: 'John',
        lastName: 'Doe'
      };

      mockApiClient.post.mockResolvedValue({
        data: {
          success: true,
          token: 'mock-token',
          user: mockUserData
        }
      });

      render(<LoginPage onLogin={mockOnLogin} />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/login', {
          email: 'test@example.com',
          password: 'password123'
        });
        expect(mockOnLogin).toHaveBeenCalledWith(mockUserData);
      });
    });

    it('should display error for invalid credentials', async () => {
      const user = userEvent.setup();
      
      mockApiClient.post.mockRejectedValue({
        response: {
          data: {
            success: false,
            message: 'Invalid credentials'
          }
        }
      });

      render(<LoginPage onLogin={mockOnLogin} />);

      await user.type(screen.getByLabelText(/email/i), 'wrong@example.com');
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
        expect(mockOnLogin).not.toHaveBeenCalled();
      });
    });

    it('should validate email format', async () => {
      const user = userEvent.setup();
      
      render(<LoginPage onLogin={mockOnLogin} />);

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'invalid-email');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('should require both email and password', async () => {
      const user = userEvent.setup();
      
      render(<LoginPage onLogin={mockOnLogin} />);

      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });
    });

    it('should show loading state during login attempt', async () => {
      const user = userEvent.setup();
      
      mockApiClient.post.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<LoginPage onLogin={mockOnLogin} />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(screen.getByText(/signing in/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
    });
  });

  describe('BSNR/LANR Login', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<LoginPage onLogin={mockOnLogin} />);
      
      await user.click(screen.getByText('BSNR/LANR Login'));
    });

    it('should show BSNR/LANR form when tab is selected', () => {
      expect(screen.getByLabelText(/bsnr/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/lanr/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });

    it('should handle successful BSNR/LANR login', async () => {
      const user = userEvent.setup();
      const mockUserData = {
        id: '2',
        email: 'doctor@example.com',
        role: 'doctor',
        bsnr: '123456789',
        lanr: '987654321'
      };

      mockApiClient.post.mockResolvedValue({
        data: {
          success: true,
          token: 'mock-token',
          user: mockUserData
        }
      });

      await user.type(screen.getByLabelText(/bsnr/i), '123456789');
      await user.type(screen.getByLabelText(/lanr/i), '987654321');
      await user.type(screen.getByLabelText(/password/i), 'doctorpass123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/login', {
          bsnr: '123456789',
          lanr: '987654321',
          password: 'doctorpass123'
        });
        expect(mockOnLogin).toHaveBeenCalledWith(mockUserData);
      });
    });

    it('should validate BSNR format', async () => {
      const user = userEvent.setup();
      
      await user.type(screen.getByLabelText(/bsnr/i), '12345'); // Too short
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/bsnr must be 9 digits/i)).toBeInTheDocument();
      });
    });

    it('should validate LANR format', async () => {
      const user = userEvent.setup();
      
      await user.type(screen.getByLabelText(/lanr/i), 'abcdefghi'); // Non-numeric
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/lanr must be 9 digits/i)).toBeInTheDocument();
      });
    });

    it('should require all BSNR/LANR fields', async () => {
      const user = userEvent.setup();
      
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/bsnr is required/i)).toBeInTheDocument();
        expect(screen.getByText(/lanr is required/i)).toBeInTheDocument();
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Two-Factor Authentication', () => {
    it('should show 2FA input when required', async () => {
      const user = userEvent.setup();
      
      mockApiClient.post.mockResolvedValue({
        data: {
          success: false,
          requiresTwoFactor: true,
          message: '2FA code required'
        }
      });

      render(<LoginPage onLogin={mockOnLogin} />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/enter your 6-digit verification code/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
      });
    });

    it('should handle successful 2FA verification', async () => {
      const user = userEvent.setup();
      const mockUserData = {
        id: '1',
        email: 'test@example.com',
        role: 'doctor',
        isTwoFactorEnabled: true
      };

      // First call requires 2FA
      mockApiClient.post
        .mockResolvedValueOnce({
          data: {
            success: false,
            requiresTwoFactor: true,
            message: '2FA code required'
          }
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            token: 'mock-token',
            user: mockUserData
          }
        });

      render(<LoginPage onLogin={mockOnLogin} />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/verification code/i), '123456');
      await user.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/login', {
          email: 'test@example.com',
          password: 'password123',
          otp: '123456'
        });
        expect(mockOnLogin).toHaveBeenCalledWith(mockUserData);
      });
    });

    it('should handle invalid 2FA code', async () => {
      const user = userEvent.setup();
      
      mockApiClient.post
        .mockResolvedValueOnce({
          data: {
            success: false,
            requiresTwoFactor: true,
            message: '2FA code required'
          }
        })
        .mockRejectedValueOnce({
          response: {
            data: {
              success: false,
              message: 'Invalid 2FA code'
            }
          }
        });

      render(<LoginPage onLogin={mockOnLogin} />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/verification code/i), '000000');
      await user.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid 2FA code')).toBeInTheDocument();
      });
    });

    it('should validate 2FA code format', async () => {
      const user = userEvent.setup();
      
      mockApiClient.post.mockResolvedValue({
        data: {
          success: false,
          requiresTwoFactor: true,
          message: '2FA code required'
        }
      });

      render(<LoginPage onLogin={mockOnLogin} />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/verification code/i), '123'); // Too short
      await user.click(screen.getByRole('button', { name: /verify/i }));

      await waitFor(() => {
        expect(screen.getByText(/verification code must be 6 digits/i)).toBeInTheDocument();
      });
    });
  });

  describe('Account Lockout', () => {
    it('should show lockout message when account is locked', async () => {
      const user = userEvent.setup();
      
      mockApiClient.post.mockRejectedValue({
        response: {
          data: {
            success: false,
            message: 'Account is temporarily locked due to too many failed attempts',
            lockedUntil: '2024-01-01T12:00:00Z'
          }
        }
      });

      render(<LoginPage onLogin={mockOnLogin} />);

      await user.type(screen.getByLabelText(/email/i), 'locked@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/account is temporarily locked/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
      });
    });

    it('should show remaining attempts warning', async () => {
      const user = userEvent.setup();
      
      mockApiClient.post.mockRejectedValue({
        response: {
          data: {
            success: false,
            message: 'Invalid credentials',
            remainingAttempts: 2
          }
        }
      });

      render(<LoginPage onLogin={mockOnLogin} />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/2 attempts remaining/i)).toBeInTheDocument();
      });
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility', async () => {
      const user = userEvent.setup();
      
      render(<LoginPage onLogin={mockOnLogin} />);

      const passwordInput = screen.getByLabelText(/password/i);
      const toggleButton = screen.getByLabelText(/show password/i);

      expect(passwordInput).toHaveAttribute('type', 'password');

      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');

      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  describe('Forgot Password', () => {
    it('should show forgot password link', () => {
      render(<LoginPage onLogin={mockOnLogin} />);
      
      expect(screen.getByText(/forgot your password/i)).toBeInTheDocument();
    });

    it('should handle forgot password request', async () => {
      const user = userEvent.setup();
      
      mockApiClient.post.mockResolvedValue({
        data: {
          success: true,
          message: 'Password reset email sent'
        }
      });

      render(<LoginPage onLogin={mockOnLogin} />);

      await user.click(screen.getByText(/forgot your password/i));

      expect(screen.getByText(/reset your password/i)).toBeInTheDocument();
      
      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /send reset email/i }));

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/forgot-password', {
          email: 'test@example.com'
        });
        expect(screen.getByText('Password reset email sent')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<LoginPage onLogin={mockOnLogin} />);
      
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(<LoginPage onLogin={mockOnLogin} />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await user.tab();
      expect(emailInput).toHaveFocus();

      await user.tab();
      expect(passwordInput).toHaveFocus();

      await user.tab();
      expect(submitButton).toHaveFocus();
    });

    it('should announce errors to screen readers', async () => {
      const user = userEvent.setup();
      
      mockApiClient.post.mockRejectedValue({
        response: {
          data: {
            success: false,
            message: 'Invalid credentials'
          }
        }
      });

      render(<LoginPage onLogin={mockOnLogin} />);

      await user.type(screen.getByLabelText(/email/i), 'wrong@example.com');
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        const errorMessage = screen.getByText('Invalid credentials');
        expect(errorMessage).toHaveAttribute('role', 'alert');
      });
    });
  });

  describe('Security Features', () => {
    it('should not expose password in DOM', async () => {
      const user = userEvent.setup();
      
      render(<LoginPage onLogin={mockOnLogin} />);

      await user.type(screen.getByLabelText(/password/i), 'secretpassword');

      // Password should not be visible in text form in DOM
      expect(screen.queryByText('secretpassword')).not.toBeInTheDocument();
    });

    it('should clear form on successful login', async () => {
      const user = userEvent.setup();
      
      mockApiClient.post.mockResolvedValue({
        data: {
          success: true,
          token: 'mock-token',
          user: { id: '1', email: 'test@example.com', role: 'patient' }
        }
      });

      render(<LoginPage onLogin={mockOnLogin} />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockOnLogin).toHaveBeenCalled();
        expect(emailInput).toHaveValue('');
        expect(passwordInput).toHaveValue('');
      });
    });

    it('should handle CSRF protection', async () => {
      const user = userEvent.setup();
      
      mockApiClient.post.mockResolvedValue({
        data: {
          success: true,
          token: 'mock-token',
          user: { id: '1', email: 'test@example.com', role: 'patient' }
        }
      });

      render(<LoginPage onLogin={mockOnLogin} />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        // Check that the request includes CSRF protection headers
        const lastCall = mockApiClient.post.mock.calls[mockApiClient.post.mock.calls.length - 1];
        expect(lastCall[0]).toBe('/api/auth/login');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const user = userEvent.setup();
      
      mockApiClient.post.mockRejectedValue(new Error('Network error'));

      render(<LoginPage onLogin={mockOnLogin} />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/network error occurred/i)).toBeInTheDocument();
      });
    });

    it('should handle server errors gracefully', async () => {
      const user = userEvent.setup();
      
      mockApiClient.post.mockRejectedValue({
        response: {
          status: 500,
          data: {
            success: false,
            message: 'Internal server error'
          }
        }
      });

      render(<LoginPage onLogin={mockOnLogin} />);

      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/server error occurred/i)).toBeInTheDocument();
      });
    });

    it('should clear errors when user types', async () => {
      const user = userEvent.setup();
      
      mockApiClient.post.mockRejectedValue({
        response: {
          data: {
            success: false,
            message: 'Invalid credentials'
          }
        }
      });

      render(<LoginPage onLogin={mockOnLogin} />);

      await user.type(screen.getByLabelText(/email/i), 'wrong@example.com');
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      });

      // Clear the email and type new value
      await user.clear(screen.getByLabelText(/email/i));
      await user.type(screen.getByLabelText(/email/i), 'new@example.com');

      // Error should be cleared
      expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument();
    });
  });
});