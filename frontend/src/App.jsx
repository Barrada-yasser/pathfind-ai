import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import GameCanvas from './components/GameCanvas';
import './App.css';

function App() {
  const [user, setUser] = useState(null);

  // Vérifier si un utilisateur est déjà connecté (localStorage)
  useEffect(() => {
    const savedUser = localStorage.getItem('pathmind_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('pathmind_user');
      }
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('pathmind_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('pathmind_user');
  };

  return (
    <div className="App">
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : (
        <GameCanvas user={user} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;