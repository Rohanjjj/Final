const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Attach WebSocket server to the HTTP server
const wss = new WebSocket.Server({ server });

const rooms = {}; // { roomId: { streamer: ws, viewers: [] } }

// WebSocket Server Logic
wss.on('connection', (ws) => {
    console.log('A client connected');

    ws.on('message', (message) => {
        try {
            const parsed = JSON.parse(message);
            const { type, roomId, data } = parsed;

            switch (type) {
                case 'create-room':
                    const newRoomId = uuidv4();
                    rooms[newRoomId] = { streamer: ws, viewers: [] };
                    ws.roomId = newRoomId;
                    ws.isStreamer = true;
                    ws.send(JSON.stringify({ type: 'room-created', roomId: newRoomId }));
                    console.log(`Room created: ${newRoomId}`);
                    break;

                case 'join-room':
                    if (rooms[roomId]) {
                        rooms[roomId].viewers.push(ws);
                        ws.roomId = roomId;
                        ws.isStreamer = false;
                        ws.send(JSON.stringify({ type: 'room-joined', success: true }));
                        console.log(`Viewer joined room: ${roomId}`);
                    } else {
                        ws.send(JSON.stringify({ type: 'room-joined', success: false, message: 'Room not found' }));
                    }
                    break;

                case 'offer':
                    if (rooms[roomId]) {
                        rooms[roomId].viewers.forEach((viewer) => {
                            viewer.send(JSON.stringify({ type: 'offer', roomId: roomId, offer: data }));
                        });
                    }
                    break;

                case 'answer':
                    if (rooms[roomId] && rooms[roomId].streamer) {
                        rooms[roomId].streamer.send(JSON.stringify({ type: 'answer', roomId: roomId, answer: data }));
                    }
                    break;

                case 'candidate':
                    const { candidate } = data;
                    if (rooms[roomId]) {
                        rooms[roomId].viewers.forEach((viewer) => {
                            if (viewer !== ws) {
                                viewer.send(JSON.stringify({ type: 'candidate', roomId: roomId, candidate }));
                            }
                        });
                        if (rooms[roomId].streamer) {
                            rooms[roomId].streamer.send(JSON.stringify({ type: 'candidate', roomId: roomId, candidate }));
                        }
                    }
                    break;

                default:
                    console.log('Unknown message type:', type);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        const roomId = ws.roomId;
        if (ws.isStreamer) {
            if (rooms[roomId]) {
                rooms[roomId].viewers.forEach((viewer) => {
                    viewer.send(JSON.stringify({ type: 'room-closed', message: 'Streamer has disconnected.' }));
                });
                delete rooms[roomId];
                console.log(`Room ${roomId} closed`);
            }
        } else if (roomId && rooms[roomId]) {
            rooms[roomId].viewers = rooms[roomId].viewers.filter((viewer) => viewer !== ws);
            console.log(`Viewer disconnected from room: ${roomId}`);
        }
    });
});

// Express Routes
app.get('/', (req, res) => {
    res.send('WebSocket Server is running!');
});

// Server Port
const PORT = process.env.PORT || 3000;

// Start the HTTP server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
