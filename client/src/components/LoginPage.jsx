import React, { useState } from 'react';
import apiClient from '../utils/api.js';

function LoginPage({ onLoginSuccess, onError }) {
  const [loginMethod, setLoginMethod] = useState('email'); // 'email' or 'bsnr'
  const [email, setEmail] = useState('');
  const [bsnr, setBsnr] = useState('');
  const [lanr, setLanr] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setIsLoading(true);

    try {
      const loginData = {
        password,
        ...(loginMethod === 'email' ? { email } : { bsnr, lanr })
      };

      const response = await apiClient.post('/auth/login', loginData);
      
      if (response.success) {
        setMessage(response.message);
        // Store token and user info
        localStorage.setItem('authToken', response.token);
        localStorage.setItem('userInfo', JSON.stringify(response.user));
        
        if (onLoginSuccess) {
          onLoginSuccess(response.token, response.user);
        }
      } else {
        setMessage(response.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.message || 'Network error or server unavailable';
      setMessage(errorMessage);
      
      if (onError) {
        onError(new Error(errorMessage));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const demoUsers = [
    { label: 'Admin', email: 'admin@laborresults.de', password: 'admin123', role: 'Administrator' },
    { label: 'Doctor', email: 'doctor@laborresults.de', password: 'doctor123', role: 'Doctor' },
    { label: 'Lab Tech', email: 'lab@laborresults.de', password: 'lab123', role: 'Lab Technician' }
  ];

  const fillDemo = (user) => {
    setLoginMethod('email');
    setEmail(user.email);
    setPassword(user.password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-indigo-100">
            <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Laboratory Results System
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to access your laboratory results
          </p>
        </div>

        {/* Login Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="bg-white p-6 rounded-lg shadow-md">
            {/* Login Method Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Login Method
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="loginMethod"
                    value="email"
                    checked={loginMethod === 'email'}
                    onChange={(e) => setLoginMethod(e.target.value)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">Email</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="loginMethod"
                    value="bsnr"
                    checked={loginMethod === 'bsnr'}
                    onChange={(e) => setLoginMethod(e.target.value)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">BSNR/LANR</span>
                </label>
              </div>
            </div>

            {/* Conditional Input Fields */}
            {loginMethod === 'email' ? (
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required={loginMethod === 'email'}
                  placeholder="Enter your email address"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="bsnr" className="block text-sm font-medium text-gray-700 mb-2">
                    BSNR
                  </label>
                  <input
                    type="text"
                    id="bsnr"
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3"
                    value={bsnr}
                    onChange={(e) => setBsnr(e.target.value)}
                    required={loginMethod === 'bsnr'}
                    placeholder="BSNR"
                  />
                </div>
                <div>
                  <label htmlFor="lanr" className="block text-sm font-medium text-gray-700 mb-2">
                    LANR
                  </label>
                  <input
                    type="text"
                    id="lanr"
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3"
                    value={lanr}
                    onChange={(e) => setLanr(e.target.value)}
                    required={loginMethod === 'bsnr'}
                    placeholder="LANR"
                  />
                </div>
              </div>
            )}

            {/* Password Field */}
            <div className="mb-6">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Sign in'
              )}
            </button>

            {/* Message Display */}
            {message && (
              <div className={`mt-4 p-3 rounded-md text-sm ${
                message.includes('successful') || message.includes('Login successful')
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {message}
              </div>
            )}
          </div>
        </form>

        {/* Demo Users Section */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Demo Users (Development)</h3>
            <div className="grid grid-cols-1 gap-2">
              {demoUsers.map((user, index) => (
                <button
                  key={index}
                  onClick={() => fillDemo(user)}
                  className="text-left p-2 text-xs bg-gray-50 hover:bg-gray-100 rounded border transition-colors duration-150"
                >
                  <div className="font-medium text-gray-800">{user.label} - {user.role}</div>
                  <div className="text-gray-600">{user.email}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Click any demo user to auto-fill login credentials
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            Laboratory Results Management System
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Secure access to medical laboratory data
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;