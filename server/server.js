const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const express = require('express');

// Initialize express app
const app = express();
const server = http.createServer(app);

// Enable CORS for the express server
app.use(cors());

// WebSocket server
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
      const data = JSON.parse(message);
      const roomId = data.roomId;  // Dynamic roomId from the client

      if (data.type === 'streamer') {
        // Handle streamer connection
        if (clients.streamers.has(roomId)) {
          const existingStreamer = clients.streamers.get(roomId);
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
          broadcastToViewers(roomId, JSON.stringify({ type: 'end-stream' }));
        });

        ws.on('error', (error) => {
          console.error('Streamer error:', error);
        });

      } else if (data.type === 'viewer') {
        // Handle viewer connection
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

          ws.on('close', () => {
            console.log(`Viewer disconnected from room ${roomId}.`);
            clients.viewers.get(roomId).delete(ws);
          });

          ws.on('error', (error) => {
            console.error('Viewer error:', error);
            clients.viewers.get(roomId).delete(ws); // Clean up if there’s an error
          });
        }
      } else if (data.type === 'offer' || data.type === 'answer' || data.type === 'candidate') {
        // Forward WebRTC signaling data (offer, answer, candidate)
        if (data.type === 'offer' || data.type === 'answer') {
          // Forward the offer/answer to the opposite side
          const target = data.type === 'offer' ? 'answer' : 'offer';
          broadcastToViewers(roomId, { type: target, sdp: data.sdp });
        } else if (data.type === 'candidate') {
          // Forward ICE candidates to viewers
          broadcastToViewers(roomId, { type: 'candidate', candidate: data.candidate });
        }
      } else {
        console.error('Unknown client type:', data.type);
        sendJSON(ws, { type: 'error', message: 'Unknown client type' });
      }
    } catch (e) {
      console.error('Error processing message:', e);
      sendJSON(ws, { type: 'error', message: 'Invalid data format' });
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected.');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Start the HTTP server
server.listen(8080, () => {
  console.log('WebSocket server running on wss://final-5sjc.onrender.com');
});
