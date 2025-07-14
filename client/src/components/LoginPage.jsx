import React, { useState } from 'react';

function LoginPage({ onLoginSuccess }) {
  const [bsnr, setBsnr] = useState('');
  const [lanr, setLanr] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('Logging in...');
    try {
      const response = await fetch('/api/login', { // Note: just /api/login, proxy handles the rest
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bsnr, lanr, password }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(data.message);
        // Store token, redirect user, etc.
        console.log('Token:', data.token);
        if (onLoginSuccess) {
          onLoginSuccess(data.token);
        }
      } else {
        setMessage(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setMessage('Network error or server unavailable.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">Labor Results Login</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="bsnr" className="block text-gray-700 text-sm font-bold mb-2">BSNR</label>
            <input
              type="text"
              id="bsnr"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={bsnr}
              onChange={(e) => setBsnr(e.target.value)}
              required
            />
          </div>
          <div className="mb-4">
            <label htmlFor="lanr" className="block text-gray-700 text-sm font-bold mb-2">LANR</label>
            <input
              type="text"
              id="lanr"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={lanr}
              onChange={(e) => setLanr(e.target.value)}
              required
            />
          </div>
          <div className="mb-6">
            <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">Password</label>
            <input
              type="password"
              id="password"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex items-center justify-between">
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
            >
              Login
            </button>
          </div>
          {message && <p className="text-center mt-4 text-sm">{message}</p>}
        </form>
      </div>
    </div>
  );
}

export default LoginPage;