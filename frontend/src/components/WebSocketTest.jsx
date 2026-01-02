import React, { useEffect, useState } from 'react';

function WebSocketTest() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [connected, setConnected] = useState(false);
  const [ws, setWs] = useState(null);

  useEffect(() => {
    // Créer la connexion WebSocket
    const websocket = new WebSocket('ws://localhost:8000/ws/game');
    
    // Quand la connexion s'ouvre
    websocket.onopen = () => {
      console.log('✅ Connecté au serveur Python !');
      setConnected(true);
    };
    
    // Quand on reçoit un message de Python
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('📨 Message reçu de Python:', data);
      
      // Ajouter le message à la liste
      setMessages(prev => [...prev, data]);
    };
    
    // Si erreur
    websocket.onerror = (error) => {
      console.error('❌ Erreur WebSocket:', error);
    };
    
    // Si déconnexion
    websocket.onclose = () => {
      console.log('❌ Déconnecté du serveur');
      setConnected(false);
    };
    
    // Sauvegarder le websocket
    setWs(websocket);
    
    // Nettoyer à la fermeture du composant
    return () => {
      websocket.close();
    };
  }, []);
  
  // Fonction pour envoyer un message à Python
  const sendMessage = () => {
    if (ws && connected && inputText) {
      const message = {
        action: 'test',
        text: inputText
      };
      
      console.log('📤 Envoi à Python:', message);
      ws.send(JSON.stringify(message));
      
      // Vider le champ
      setInputText('');
    }
  };

  return (
    <div style={styles.container}>
      <h1>🔌 Test WebSocket React ↔ Python</h1>
      
      {/* Indicateur de connexion */}
      <div style={styles.status}>
        Statut: {connected ? '✅ Connecté' : '❌ Déconnecté'}
      </div>
      
      {/* Zone d'envoi */}
      <div style={styles.inputArea}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Tapez un message..."
          style={styles.input}
          disabled={!connected}
        />
        <button 
          onClick={sendMessage}
          disabled={!connected}
          style={styles.button}
        >
          Envoyer à Python
        </button>
      </div>
      
      {/* Affichage des messages */}
      <div style={styles.messagesArea}>
        <h3>Messages reçus de Python :</h3>
        {messages.map((msg, index) => (
          <div key={index} style={styles.message}>
            <strong>Type:</strong> {msg.type} <br />
            <strong>Message:</strong> {msg.message || JSON.stringify(msg)}
          </div>
        ))}
      </div>
    </div>
  );
}

// Styles simples
const styles = {
  container: {
    padding: '20px',
    maxWidth: '800px',
    margin: '0 auto',
    fontFamily: 'Arial, sans-serif'
  },
  status: {
    padding: '10px',
    backgroundColor: '#f0f0f0',
    borderRadius: '5px',
    marginBottom: '20px',
    fontSize: '18px'
  },
  inputArea: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px'
  },
  input: {
    flex: 1,
    padding: '10px',
    fontSize: '16px',
    borderRadius: '5px',
    border: '1px solid #ccc'
  },
  button: {
    padding: '10px 20px',
    fontSize: '16px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer'
  },
  messagesArea: {
    backgroundColor: '#f9f9f9',
    padding: '15px',
    borderRadius: '5px',
    maxHeight: '400px',
    overflowY: 'auto'
  },
  message: {
    padding: '10px',
    backgroundColor: 'white',
    marginBottom: '10px',
    borderRadius: '5px',
    border: '1px solid #e0e0e0'
  }
};

export default WebSocketTest;