import React, { useState } from 'react';
import LoginPage from './components/LoginPage.jsx';
import ResultsDashboard from './components/ResultsDashboard.jsx';
import './App.css';

function App() {
  const [token, setToken] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleLoginSuccess = (authToken) => {
    setToken(authToken);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setToken(null);
    setIsLoggedIn(false);
  };

  return (
    <div className="App">
      {isLoggedIn ? (
        <ResultsDashboard token={token} onLogout={handleLogout} />
      ) : (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}

export default App;
