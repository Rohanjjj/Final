const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const http = require('http');

// Create an Express application
const app = express();

// Enable CORS support
app.use(cors()); // Allows all origins by default, you can customize this

// Use Express to serve static files or handle other routes if needed
app.get('/', (req, res) => {
  res.send('WebSocket server is running with Express!');
});

// Create an HTTP server using Express
const server = http.createServer(app);

// Create a WebSocket server that listens on the same HTTP server
const wss = new WebSocket.Server({ server });

const clients = {
  streamers: new Map(),  // Store streamers by room ID
  viewers: new Map()     // Store viewers by room ID
};

// Function to send JSON data to a specific client
function sendJSON(client, data) {
  if (client.readyState === WebSocket.OPEN) {
    try {
      client.send(JSON.stringify(data));
    } catch (error) {
      console.error('Error sending JSON message:', error);
    }
  }
}

// Function to broadcast a message to all viewers in a room
function broadcastToViewers(roomId, data) {
  const viewers = clients.viewers.get(roomId) || new Set();
  viewers.forEach((viewer) => {
    if (viewer.readyState === WebSocket.OPEN) {
      try {
        viewer.send(data);  // Send binary or JSON data
      } catch (error) {
        console.error('Error broadcasting to viewer:', error);
      }
    }
  });
}

wss.on('connection', (ws) => {
  console.log('New client connected.');

  ws.on('message', (message) => {
    try {
      // Handle JSON messages
      const data = JSON.parse(message);

      if (data.type === 'streamer') {
        // Handle streamer connection
        const roomId = data.roomId;
        if (clients.streamers.has(roomId)) {
          const existingStreamer = clients.streamers.get(roomId);
          // Notify viewers that a new streamer is connecting
          sendJSON(existingStreamer, { type: 'disconnect', reason: 'New streamer connected' });
          existingStreamer.close();
        }

        // Set the streamer for the room
        clients.streamers.set(roomId, ws);
        console.log(`Streamer connected to room ${roomId}.`);

        // Streamer disconnection handling
        ws.on('close', () => {
          console.log(`Streamer disconnected from room ${roomId}.`);
          clients.streamers.delete(roomId);
          // Notify all viewers that the stream has ended
          broadcastToViewers(roomId, JSON.stringify({ type: 'end-stream' }));
        });

        ws.on('error', (error) => {
          console.error('Streamer error:', error);
        });

      } else if (data.type === 'viewer') {
        // Handle viewer connection
        const roomId = data.roomId;
        if (!clients.streamers.has(roomId)) {
          sendJSON(ws, { type: 'no-stream', message: 'No active stream in this room' });
        } else {
          if (!clients.viewers.has(roomId)) {
            clients.viewers.set(roomId, new Set());
          }

          clients.viewers.get(roomId).add(ws);
          console.log(`Viewer connected to room ${roomId}.`);

          // Send active stream data to the viewer
          sendJSON(ws, { type: 'start-stream', roomId: roomId });

          // Viewer disconnection handling
          ws.on('close', () => {
            console.log(`Viewer disconnected from room ${roomId}.`);
            clients.viewers.get(roomId).delete(ws);
          });

          ws.on('error', (error) => {
            console.error('Viewer error:', error);
            clients.viewers.get(roomId).delete(ws); // Clean up if there’s an error
          });
        }
      } else {
        console.error('Unknown client type:', data.type);
        sendJSON(ws, { type: 'error', message: 'Unknown client type' });
      }
    } catch (e) {
      // Handle binary data from the streamer
      if (ws === clients.streamers.get(data.roomId)) {
        // Relay binary data to all viewers in the room
        broadcastToViewers(data.roomId, message);
      } else {
        console.error('Invalid JSON message received:', e);
        sendJSON(ws, { type: 'error', message: 'Invalid data format' });
      }
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected.');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Start the HTTP server and WebSocket server
server.listen(8080, () => {
  console.log('WebSocket server running on ws://localhost:8080');
});
