import React, { useState, useEffect } from 'react';

function Leaderboard({ onClose }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/leaderboard');
      const data = await response.json();
      
      if (response.ok) {
        setLeaderboard(data.leaderboard || []);
      } else {
        setError(data.message || 'Erreur de chargement');
      }
    } catch (err) {
      console.error('❌ Erreur:', err);
      setError('Impossible de charger le leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const getMedal = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>🏆 Leaderboard Global</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <p style={styles.subtitle}>Classement des cristaux dorés collectés</p>

        {loading && <p style={styles.loading}>⏳ Chargement...</p>}
        
        {error && <p style={styles.error}>{error}</p>}

        {!loading && !error && (
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Rang</th>
                  <th style={styles.th}>Joueur</th>
                  <th style={styles.th}>💎 Gold</th>
                  <th style={styles.th}>Niveaux</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={styles.emptyRow}>
                      Aucun joueur pour l'instant
                    </td>
                  </tr>
                ) : (
                  leaderboard.map((player, index) => (
                    <tr key={player.username} style={index < 3 ? styles.topRow : styles.row}>
                      <td style={styles.td}>
                        <span style={styles.medal}>{getMedal(index)}</span>
                      </td>
                      <td style={styles.td}>{player.username}</td>
                      <td style={styles.tdGold}>{player.total_gold}</td>
                      <td style={styles.td}>{player.levels_completed || 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <button onClick={fetchLeaderboard} style={styles.refreshBtn}>
          🔄 Rafraîchir
        </button>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000
  },
  modal: {
    backgroundColor: '#1a1a2e',
    padding: '30px',
    borderRadius: '15px',
    width: '90%',
    maxWidth: '500px',
    maxHeight: '80vh',
    overflow: 'auto',
    border: '2px solid #ffd700'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px'
  },
  title: {
    color: '#ffd700',
    margin: 0,
    fontSize: '24px'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '24px',
    cursor: 'pointer'
  },
  subtitle: {
    color: '#aaa',
    marginBottom: '20px',
    fontSize: '14px'
  },
  loading: {
    color: '#fff',
    textAlign: 'center',
    padding: '20px'
  },
  error: {
    color: '#ff4757',
    textAlign: 'center',
    padding: '20px'
  },
  tableContainer: {
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    color: '#fff'
  },
  th: {
    padding: '12px',
    backgroundColor: '#0f0f1a',
    textAlign: 'left',
    borderBottom: '2px solid #333'
  },
  row: {
    borderBottom: '1px solid #333'
  },
  topRow: {
    borderBottom: '1px solid #333',
    backgroundColor: 'rgba(255, 215, 0, 0.1)'
  },
  td: {
    padding: '12px',
    color: '#ddd'
  },
  tdGold: {
    padding: '12px',
    color: '#ffd700',
    fontWeight: 'bold'
  },
  medal: {
    fontSize: '20px'
  },
  emptyRow: {
    padding: '20px',
    textAlign: 'center',
    color: '#666'
  },
  refreshBtn: {
    marginTop: '20px',
    padding: '10px 20px',
    backgroundColor: '#667eea',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    width: '100%'
  }
};

export default Leaderboard;
