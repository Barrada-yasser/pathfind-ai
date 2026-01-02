import React, { useState } from 'react';

function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs');
      setLoading(false);
      return;
    }

    try {
      const endpoint = isRegister ? '/api/register' : '/api/login';
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
    });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ Connexion réussie:', data);
        onLogin(data.user);
      } else {
        setError(data.message || 'Erreur de connexion');
      }
    } catch (err) {
      console.error('❌ Erreur:', err);
      setError('Impossible de se connecter au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🎮 PathMind</h1>
        <p style={styles.subtitle}>
          {isRegister ? 'Créer un compte' : 'Connexion'}
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Nom d'utilisateur</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
              placeholder="Entrez votre pseudo"
              disabled={loading}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="Entrez votre mot de passe"
              disabled={loading}
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button 
            type="submit" 
            style={styles.button}
            disabled={loading}
          >
            {loading ? '⏳ Chargement...' : (isRegister ? '📝 S\'inscrire' : '🚀 Se connecter')}
          </button>
        </form>

        <p style={styles.switchText}>
          {isRegister ? 'Déjà un compte ?' : 'Pas encore de compte ?'}
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            style={styles.switchButton}
          >
            {isRegister ? 'Se connecter' : 'S\'inscrire'}
          </button>
        </p>
      </div>

      <div style={styles.features}>
        <h3>🎯 Objectif du jeu</h3>
        <ul style={styles.featureList}>
          <li>💎 Collectez tous les cristaux bleus (obligatoires)</li>
          <li>🏆 Récupérez les cristaux dorés pour le leaderboard</li>
          <li>⚠️ Évitez les cristaux rouges (-3 secondes)</li>
          <li>🚪 Atteignez la porte dorée avant la fin du temps !</li>
        </ul>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0f0f1a',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    fontFamily: 'Arial, sans-serif'
  },
  card: {
    backgroundColor: '#1a1a2e',
    padding: '40px',
    borderRadius: '15px',
    boxShadow: '0 10px 40px rgba(102, 126, 234, 0.3)',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center'
  },
  title: {
    color: '#fff',
    fontSize: '36px',
    marginBottom: '10px'
  },
  subtitle: {
    color: '#aaa',
    fontSize: '18px',
    marginBottom: '30px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  inputGroup: {
    textAlign: 'left'
  },
  label: {
    color: '#ddd',
    fontSize: '14px',
    marginBottom: '5px',
    display: 'block'
  },
  input: {
    width: '100%',
    padding: '12px 15px',
    fontSize: '16px',
    backgroundColor: '#0f0f1a',
    border: '2px solid #333',
    borderRadius: '8px',
    color: '#fff',
    outline: 'none',
    transition: 'border-color 0.3s',
    boxSizing: 'border-box'
  },
  button: {
    padding: '15px',
    fontSize: '18px',
    backgroundColor: '#667eea',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'transform 0.2s, background-color 0.3s',
    marginTop: '10px'
  },
  error: {
    color: '#ff4757',
    fontSize: '14px',
    margin: '0'
  },
  switchText: {
    color: '#aaa',
    marginTop: '20px',
    fontSize: '14px'
  },
  switchButton: {
    background: 'none',
    border: 'none',
    color: '#667eea',
    cursor: 'pointer',
    marginLeft: '5px',
    fontSize: '14px',
    textDecoration: 'underline'
  },
  features: {
    marginTop: '30px',
    color: '#fff',
    textAlign: 'left',
    maxWidth: '400px'
  },
  featureList: {
    color: '#aaa',
    lineHeight: '2',
    paddingLeft: '20px'
  }
};

export default Login;
