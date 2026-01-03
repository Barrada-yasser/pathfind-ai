import React, { useEffect, useRef, useState } from 'react';

// Configuration des URLs selon l'environnement
const getBackendUrl = () => {
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:8000';
  }
  return 'https://pathfind-ai-4.onrender.com';
};

const getWebSocketUrl = () => {
  if (window.location.hostname === 'localhost') {
    return 'ws://localhost:8000/ws/game';
  }
  return 'wss://pathfind-ai-4.onrender.com/ws/game';
};

const BACKEND_URL = getBackendUrl();
const WS_URL = getWebSocketUrl();

// Composant Leaderboard intégré
function Leaderboard({ onClose }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/leaderboard`);
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
    <div style={leaderboardStyles.overlay}>
      <div style={leaderboardStyles.modal}>
        <div style={leaderboardStyles.header}>
          <h2 style={leaderboardStyles.title}>🏆 Classement Mondial</h2>
          <button onClick={onClose} style={leaderboardStyles.closeBtn}>✕</button>
        </div>

        <p style={leaderboardStyles.subtitle}>Classement des cristaux dorés collectés</p>

        {loading && <p style={leaderboardStyles.loading}>⏳ Chargement...</p>}
        
        {error && <p style={leaderboardStyles.error}>{error}</p>}

        {!loading && !error && (
          <div style={leaderboardStyles.tableContainer}>
            <table style={leaderboardStyles.table}>
              <thead>
                <tr>
                  <th style={leaderboardStyles.th}>Rang</th>
                  <th style={leaderboardStyles.th}>Joueur</th>
                  <th style={leaderboardStyles.th}>💎 Gold</th>
                  <th style={leaderboardStyles.th}>Niveaux</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={leaderboardStyles.emptyRow}>
                      Aucun joueur pour l'instant
                    </td>
                  </tr>
                ) : (
                  leaderboard.map((player, index) => (
                    <tr key={player.username} style={index < 3 ? leaderboardStyles.topRow : leaderboardStyles.row}>
                      <td style={leaderboardStyles.td}>
                        <span style={leaderboardStyles.medal}>{getMedal(index)}</span>
                      </td>
                      <td style={leaderboardStyles.td}>{player.username}</td>
                      <td style={leaderboardStyles.tdGold}>{player.total_gold}</td>
                      <td style={leaderboardStyles.td}>{player.levels_completed || 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <button onClick={fetchLeaderboard} style={leaderboardStyles.refreshBtn}>
          🔄 Rafraîchir
        </button>
      </div>
    </div>
  );
}

// Composant principal GameCanvas
function GameCanvas({ user, onLogout }) {
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const [gameState, setGameState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [images, setImages] = useState({});
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Charger les sprites au montage
  useEffect(() => {
    const imageSources = {
      player: '/assets/Hat_man2.png',
      box_small: '/assets/box_small.png',
      box_2x1: '/assets/box_2x1.png',
      box_2x2: '/assets/box_2x2.png',
      crystal_gold: '/assets/crystal-gold.png',
      crystal_icy: '/assets/crystal-icy.png',
      crystal_red: '/assets/crystal-red.png',
    };

    const loadedImages = {};
    let loadedCount = 0;
    const totalImages = Object.keys(imageSources).length;

    Object.entries(imageSources).forEach(([key, src]) => {
      const img = new Image();
      img.onload = () => {
        loadedImages[key] = img;
        loadedCount++;
        if (loadedCount === totalImages) {
          setImages(loadedImages);
          setImagesLoaded(true);
        }
      };
      img.onerror = () => {
        console.error(`❌ Erreur chargement: ${key}`);
        loadedCount++;
        if (loadedCount === totalImages) {
          setImages(loadedImages);
          setImagesLoaded(true);
        }
      };
      img.src = src;
    });
  }, []);

  // Envoyer un mouvement à Python
  const sendMove = (direction) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'move',
        direction: direction
      }));
    }
  };

  // Écouteur clavier
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
      }

      const keyMap = {
        'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right',
        'w': 'up', 'W': 'up', 's': 'down', 'S': 'down',
        'a': 'left', 'A': 'left', 'd': 'right', 'D': 'right',
        'z': 'up', 'Z': 'up', 'q': 'left', 'Q': 'left'
      };

      const direction = keyMap[event.key];
      if (direction && gameState && !gameState.game_over && !gameState.victory) {
        sendMove(direction);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  // Connexion WebSocket
  useEffect(() => {
    if (!user) return;

    console.log('🔌 Connexion WebSocket à:', WS_URL);
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ Connecté au serveur');
      setConnected(true);
      ws.send(JSON.stringify({
        action: 'init',
        username: user.username,
        user_id: user.id
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'init') {
        setGameState(data);
      } else if (data.type === 'update') {
        setGameState(prev => ({
          ...prev,
          player_pos: data.player_pos,
          time_left: data.time_left,
          crystals_icy: data.crystals_icy || prev.crystals_icy,
          crystals_gold: data.crystals_gold || prev.crystals_gold,
          collected_icy: data.collected_icy ?? prev.collected_icy,
          collected_gold: data.collected_gold ?? prev.collected_gold,
          grid: data.grid || prev.grid
        }));
      } else if (data.type === 'timer_update') {
        setGameState(prev => ({
          ...prev,
          time_left: data.time_left
        }));
      } else if (data.type === 'crystal_collected') {
        setGameState(prev => ({
          ...prev,
          collected_icy: data.collected_icy ?? prev.collected_icy,
          collected_gold: data.collected_gold ?? prev.collected_gold,
          time_left: data.time_left ?? prev.time_left,
          grid: data.grid || prev.grid
        }));
      } else if (data.type === 'game_over') {
        setGameState(prev => ({
          ...prev,
          time_left: 0,
          game_over: true,
          message: data.message
        }));
      } else if (data.type === 'victory') {
        setGameState(prev => ({
          ...prev,
          victory: true,
          message: data.message,
          total_gold: data.total_gold
        }));
      } else if (data.type === 'need_crystals') {
        alert(data.message || 'Collecte tous les cristaux bleus d\'abord !');
      }
    };

    ws.onerror = (error) => {
      console.error('❌ Erreur WebSocket:', error);
    };

    ws.onclose = () => {
      console.log('❌ Déconnecté');
      setConnected(false);
    };

    return () => ws.close();
  }, [user]);

  // Dessiner le jeu
  useEffect(() => {
    if (!gameState || !canvasRef.current || !imagesLoaded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Calculer cellSize dynamique
    const gridWidth = gameState.grid[0].length;
    const gridHeight = gameState.grid.length;
    const maxCanvasSize = 600;
    const cellSize = Math.floor(maxCanvasSize / Math.max(gridWidth, gridHeight));

    canvas.width = gridWidth * cellSize;
    canvas.height = gridHeight * cellSize;

    // Effacer le canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dessiner la grille
    for (let y = 0; y < gameState.grid.length; y++) {
      for (let x = 0; x < gameState.grid[y].length; x++) {
        const cell = gameState.grid[y][x];

        // Dessiner le fond
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(x * cellSize, y * cellSize, cellSize - 1, cellSize - 1);

        // Dessiner selon le type de cellule
        if (cell === 1 && images.box_small) {
          ctx.drawImage(images.box_small, x * cellSize, y * cellSize, cellSize, cellSize);
        } else if ((cell === 2 || cell === -2) && images.box_2x1) {
          ctx.drawImage(images.box_2x1, x * cellSize, y * cellSize, cellSize, cellSize);
        } else if ((cell === 3 || cell === -3) && images.box_2x2) {
          ctx.drawImage(images.box_2x2, x * cellSize, y * cellSize, cellSize, cellSize);
        } else if (cell === 4 && images.crystal_gold) {
          ctx.drawImage(images.crystal_gold, x * cellSize + 5, y * cellSize + 5, cellSize - 10, cellSize - 10);
        } else if (cell === 5 && images.crystal_icy) {
          ctx.drawImage(images.crystal_icy, x * cellSize + 5, y * cellSize + 5, cellSize - 10, cellSize - 10);
        } else if (cell === 6 && images.crystal_red) {
          ctx.drawImage(images.crystal_red, x * cellSize + 5, y * cellSize + 5, cellSize - 10, cellSize - 10);
        } else if (cell !== 0 && cell > 0 && cell < 4) {
          // Fallback couleur
          const colors = { 1: '#8b5a3c', 2: '#6b4423', 3: '#a67c52' };
          ctx.fillStyle = colors[cell] || '#333';
          ctx.fillRect(x * cellSize, y * cellSize, cellSize - 2, cellSize - 2);
        }
      }
    }

    // Dessiner l'objectif (porte dorée)
    ctx.fillStyle = '#ffd700';
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 3;
    ctx.fillRect(
      gameState.goal_pos[0] * cellSize + 5,
      gameState.goal_pos[1] * cellSize + 5,
      cellSize - 10,
      cellSize - 10
    );
    ctx.strokeRect(
      gameState.goal_pos[0] * cellSize + 5,
      gameState.goal_pos[1] * cellSize + 5,
      cellSize - 10,
      cellSize - 10
    );

    // Dessiner le joueur
    if (images.player) {
      ctx.drawImage(
        images.player,
        gameState.player_pos[0] * cellSize + 2,
        gameState.player_pos[1] * cellSize + 2,
        cellSize - 4,
        cellSize - 4
      );
    } else {
      ctx.fillStyle = '#ff4757';
      ctx.beginPath();
      ctx.arc(
        gameState.player_pos[0] * cellSize + cellSize / 2,
        gameState.player_pos[1] * cellSize + cellSize / 2,
        cellSize / 3,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

  }, [gameState, imagesLoaded, images]);

  // Rejouer
  const handleRestart = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'restart' }));
    }
  };

  // Niveau suivant
  const handleNextLevel = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'next_level' }));
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>🎮 PathMind Game</h1>
        <div style={styles.userInfo}>
          <span>👤 {user?.username}</span>
          <button onClick={onLogout} style={styles.logoutBtn}>Déconnexion</button>
        </div>
      </div>

      <div style={styles.status}>
        Statut: {connected ? '✅ Connecté' : '❌ Déconnecté'}
        {!imagesLoaded && ' | ⏳ Chargement des images...'}
      </div>

      {gameState && (
        <div style={styles.info}>
          <span style={styles.timer}>⏱️ {gameState.time_left?.toFixed(1)}s</span>
          <span>📍 Niveau {gameState.level}</span>
          <span style={styles.icyCounter}>
            💎 Icy: {gameState.collected_icy || 0}/{gameState.total_icy || 0}
          </span>
          <span style={styles.goldCounter}>
            🏆 Gold: {gameState.collected_gold || 0}
          </span>
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={600}
        height={600}
        style={styles.canvas}
      />

      {gameState?.game_over && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h2>⏰ Game Over</h2>
            <p>{gameState.message || 'Temps écoulé !'}</p>
            <button onClick={handleRestart} style={styles.restartBtn}>
              🔄 Rejouer
            </button>
          </div>
        </div>
      )}

      {gameState?.victory && !showLeaderboard && (
        <div style={styles.overlay}>
          <div style={styles.modalVictory}>
            <h2>🎉 Victoire !</h2>
            <p>{gameState.message}</p>
            <p>🏆 Gold collectés: {gameState.total_gold}</p>
            <div style={styles.buttonGroup}>
              <button onClick={handleNextLevel} style={styles.nextBtn}>
                ➡️ Niveau suivant
              </button>
              <button onClick={() => setShowLeaderboard(true)} style={styles.leaderboardBtn}>
                🏆 Voir le classement
              </button>
            </div>
          </div>
        </div>
      )}

      {showLeaderboard && (
        <Leaderboard onClose={() => setShowLeaderboard(false)} />
      )}

      {!gameState && connected && (
        <p>⏳ Chargement du niveau...</p>
      )}

      <div style={styles.controls}>
        <p>🎮 Contrôles: ZQSD / WASD / Flèches directionnelles</p>
        <p>💎 Collectez tous les cristaux bleus avant d'atteindre la porte dorée !</p>
        <p>⚠️ Évitez les cristaux rouges (-3 secondes)</p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    textAlign: 'center',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#0f0f1a',
    minHeight: '100vh',
    color: '#fff'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px'
  },
  logoutBtn: {
    padding: '8px 15px',
    backgroundColor: '#ff4757',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer'
  },
  status: {
    padding: '10px',
    backgroundColor: '#1a1a2e',
    borderRadius: '5px',
    marginBottom: '10px',
    fontSize: '16px'
  },
  info: {
    display: 'flex',
    gap: '30px',
    justifyContent: 'center',
    marginBottom: '15px',
    fontSize: '18px',
    flexWrap: 'wrap'
  },
  timer: {
    color: '#ff6b6b',
    fontWeight: 'bold'
  },
  icyCounter: {
    color: '#74b9ff',
    fontWeight: 'bold'
  },
  goldCounter: {
    color: '#ffd700',
    fontWeight: 'bold'
  },
  canvas: {
    border: '3px solid #667eea',
    borderRadius: '10px',
    backgroundColor: '#1a1a2e',
    boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)'
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: '#1a1a2e',
    padding: '40px',
    borderRadius: '15px',
    textAlign: 'center',
    border: '2px solid #ff4757'
  },
  modalVictory: {
    backgroundColor: '#1a1a2e',
    padding: '40px',
    borderRadius: '15px',
    textAlign: 'center',
    border: '2px solid #2ed573'
  },
  buttonGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    marginTop: '20px'
  },
  restartBtn: {
    padding: '15px 30px',
    fontSize: '18px',
    backgroundColor: '#667eea',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    marginTop: '20px'
  },
  nextBtn: {
    padding: '15px 30px',
    fontSize: '18px',
    backgroundColor: '#2ed573',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer'
  },
  leaderboardBtn: {
    padding: '15px 30px',
    fontSize: '18px',
    backgroundColor: '#ffd700',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  controls: {
    marginTop: '20px',
    color: '#aaa',
    fontSize: '14px'
  }
};

const leaderboardStyles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3000
  },
  modal: {
    backgroundColor: '#1a1a2e',
    padding: '30px',
    borderRadius: '15px',
    width: '90%',
    maxWidth: '600px',
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

export default GameCanvas;