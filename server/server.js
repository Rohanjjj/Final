const http = require('http');
const WebSocket = require('ws');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt'); // For password hashing
const { v4: uuidv4 } = require('uuid'); // For unique room IDs

// MongoDB Configuration
const uri = 'mongodb+srv://Teamjj:Teamjj@streamvibes.opjda.mongodb.net/?retryWrites=true&w=majority&appName=StreamVibes'; // Replace with your MongoDB URI
const client = new MongoClient(uri);
const dbName = 'StreamVibes';
let db;

// Connect to MongoDB
client.connect()
    .then(() => {
        db = client.db(dbName);
        console.log('Connected to MongoDB');
    })
    .catch(err => console.error('Failed to connect to MongoDB:', err));

// In-memory room store
const rooms = {};

// Create HTTP server
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Live Video/Audio Streaming Server with User Management');
});

// WebSocket Server
const wss = new WebSocket.Server({ server });

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
    let userId;

    ws.on('message', async (message) => {
        const parsedMessage = JSON.parse(message);

        switch (parsedMessage.type) {
            case 'register': {
                const { username, password } = parsedMessage;
                if (!username || !password) {
                    return ws.send(JSON.stringify({ type: 'error', message: 'Username and password are required' }));
                }

                try {
                    const hashedPassword = await bcrypt.hash(password, 10);
                    const user = { username, password: hashedPassword, createdAt: new Date() };
                    await db.collection('users').insertOne(user);
                    ws.send(JSON.stringify({ type: 'success', message: 'User registered successfully' }));
                } catch (err) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Failed to register user' }));
                    console.error(err);
                }
                break;
            }

            case 'login': {
                const { username, password } = parsedMessage;
                if (!username || !password) {
                    return ws.send(JSON.stringify({ type: 'error', message: 'Username and password are required' }));
                }

                try {
                    const user = await db.collection('users').findOne({ username });
                    if (!user || !(await bcrypt.compare(password, user.password))) {
                        return ws.send(JSON.stringify({ type: 'error', message: 'Invalid username or password' }));
                    }

                    userId = user._id; // Store the user ID for session tracking
                    ws.send(JSON.stringify({ type: 'success', message: 'Login successful', userId }));
                } catch (err) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Failed to log in' }));
                    console.error(err);
                }
                break;
            }

            case 'join-room': {
                const { roomId } = parsedMessage;
                if (!roomId) {
                    return ws.send(JSON.stringify({ type: 'error', message: 'Room ID is required' }));
                }

                if (!rooms[roomId]) {
                    rooms[roomId] = { streamers: new Set(), viewers: new Set(), messages: [] };
                }

                const role = parsedMessage.role || 'viewer'; // Default to viewer
                if (role === 'streamer') {
                    rooms[roomId].streamers.add(ws);
                } else {
                    rooms[roomId].viewers.add(ws);
                    ws.send(JSON.stringify({ type: 'chat-history', messages: rooms[roomId].messages }));
                }

                ws.send(JSON.stringify({ type: 'success', message: `Joined room ${roomId}` }));
                break;
            }

            case 'comment': {
                const { roomId, comment } = parsedMessage;
                if (!roomId || !comment) {
                    return ws.send(JSON.stringify({ type: 'error', message: 'Room ID and comment are required' }));
                }

                if (!rooms[roomId]) {
                    return ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
                }

                rooms[roomId].messages.push({ userId, comment, createdAt: new Date() });
                rooms[roomId].viewers.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'comment', userId, comment }));
                    }
                });
                break;
            }
        }
    });

    ws.on('close', () => {
        // Remove user from all rooms
        for (const roomId in rooms) {
            rooms[roomId].streamers.delete(ws);
            rooms[roomId].viewers.delete(ws);
            if (rooms[roomId].streamers.size === 0 && rooms[roomId].viewers.size === 0) {
                delete rooms[roomId]; // Cleanup empty room
            }
        }
    });
});

// Start server
const PORT = 8080;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
