const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');

// Initialize express app
const app = express();
const server = http.createServer(app);

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// WebSocket server
const wss = new WebSocket.Server({ server });

// MongoDB setup
const mongoURI = 'mongodb+srv://Teamjj:Teamjj@streamvibes.opjda.mongodb.net/?retryWrites=true&w=majority&appName=StreamVibes';
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });

const roomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  streamer: { type: String },
  comments: [
    {
      viewerId: String,
      message: String,
      timestamp: { type: Date, default: Date.now },
    },
  ],
});

const Room = mongoose.model('Room', roomSchema);

// Clients object for tracking connections
const clients = {
  streamers: new Map(), // Tracks active streamers by roomId
  viewers: new Map(),   // Tracks active viewers by roomId
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

// Function to broadcast binary data (video/audio/screen) to all viewers in a room
function broadcastBinaryToViewers(roomId, binaryData) {
  const viewers = clients.viewers.get(roomId) || new Set();
  viewers.forEach((viewer) => {
    if (viewer.readyState === WebSocket.OPEN) {
      viewer.send(binaryData); // Forward binary data
    }
  });
}

// WebSocket connection logic
wss.on('connection', (ws) => {
  console.log('New client connected.');

  ws.on('message', async (message) => {
    try {
      // Try to parse the message as JSON
      const data = JSON.parse(message);
      const roomId = data.roomId;

      if (data.type === 'streamer') {
        // Handle streamer connections
        if (clients.streamers.has(roomId)) {
          const existingStreamer = clients.streamers.get(roomId);
          sendJSON(existingStreamer, { type: 'disconnect', reason: 'New streamer connected' });
          existingStreamer.close();
        }

        clients.streamers.set(roomId, ws);
        let room = await Room.findOne({ roomId });
        if (!room) {
          room = new Room({ roomId });
          await room.save();
        }

        console.log(`Streamer connected to room ${roomId}.`);
        ws.on('close', () => {
          console.log(`Streamer disconnected from room ${roomId}.`);
          clients.streamers.delete(roomId);
          broadcastBinaryToViewers(roomId, JSON.stringify({ type: 'end-stream' }));
        });

      } else if (data.type === 'viewer') {
        // Handle viewer connections
        if (!clients.streamers.has(roomId)) {
          sendJSON(ws, { type: 'no-stream', message: 'No active stream in this room' });
        } else {
          if (!clients.viewers.has(roomId)) clients.viewers.set(roomId, new Set());
          clients.viewers.get(roomId).add(ws);
          console.log(`Viewer connected to room ${roomId}.`);
          sendJSON(ws, { type: 'start-stream', roomId });

          ws.on('close', () => {
            console.log(`Viewer disconnected from room ${roomId}.`);
            clients.viewers.get(roomId).delete(ws);
          });
        }

      } else if (data.type === 'comment') {
        // Handle comments from viewers
        const { viewerId, message } = data;
        await Room.updateOne({ roomId }, { $push: { comments: { viewerId, message } } });
        sendJSON(clients.streamers.get(roomId), { type: 'comment', viewerId, message });

      } else if (['offer', 'answer', 'candidate'].includes(data.type)) {
        // Handle WebRTC signaling
        if (data.target === 'streamer') {
          // Forward signaling data to the streamer
          const streamer = clients.streamers.get(roomId);
          if (streamer) {
            sendJSON(streamer, data);
          }
        } else {
          // Broadcast signaling data to viewers
          broadcastBinaryToViewers(roomId, data);
        }

      } else {
        console.error('Unknown message type:', data.type);
        sendJSON(ws, { type: 'error', message: 'Unknown message type' });
      }
    } catch (error) {
      // If message is not JSON, treat it as binary data
      const roomId = Array.from(clients.streamers.keys()).find((key) => clients.streamers.get(key) === ws);
      if (roomId) {
        broadcastBinaryToViewers(roomId, message); // Relay binary data (e.g., video/audio/screen)
      } else {
        console.error('Received binary data from unknown streamer.');
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

// Express routes
app.get('/', (req, res) => res.send('WebSocket server is running'));
app.get('/rooms/:roomId/comments', async (req, res) => {
  const { roomId } = req.params;
  try {
    const room = await Room.findOne({ roomId });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room.comments);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start the HTTP server
server.listen(8080, () => console.log('WebSocket server running on ws://localhost:8080'));
