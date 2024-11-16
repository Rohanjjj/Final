const http = require('http');
const WebSocket = require('ws');
const { MongoClient } = require('mongodb');

// MongoDB Configuration
const uri = 'mongodb://localhost:27017'; // Replace with your MongoDB URI
const client = new MongoClient(uri);
const dbName = 'liveStreamDB';
let db;

client.connect()
    .then(() => {
        db = client.db(Meta);
        console.log('Connected to MongoDB');
    })
    .catch(err => console.error('Failed to connect to MongoDB:', err));

// HTTP Server
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket server for live streaming');
});

// WebSocket Server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('New client connected');

    // Broadcast incoming messages to all connected clients
    ws.on('message', (message) => {
        console.log(`Received: ${message}`);
        wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
    });

    ws.send('Welcome to the live streaming platform!');
});

// Start server
const PORT = 8080;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
