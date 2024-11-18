const express = require('express');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// Initialize the express application
const app = express();
const server = app.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on port ${process.env.PORT || 3000}`);
});

// Set up WebSocket server
const wss = new WebSocket.Server({ server });

// Store rooms and connected clients
const rooms = {};

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('A client connected');

    // Handle incoming messages from clients
    ws.on('message', (message) => {
        console.log('Message received:', message);

        try {
            const data = JSON.parse(message);

            // Handle case when 'candidate' is part of the message
            if (data.candidate) {
                const { candidate } = data;

                // Ensure that the room exists
                if (data.roomId && rooms[data.roomId]) {
                    const roomClients = rooms[data.roomId];
                    roomClients.forEach(client => {
                        if (client !== ws && client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({ candidate }));
                        }
                    });
                }
            } else if (data.roomId) {
                // Handle room creation
                if (!rooms[data.roomId]) {
                    rooms[data.roomId] = [];
                    console.log(`Room created: ${data.roomId}`);
                }
                rooms[data.roomId].push(ws);
                ws.send(JSON.stringify({ message: `Joined room ${data.roomId}` }));
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    // Handle client disconnections
    ws.on('close', () => {
        console.log('A client disconnected');
        Object.keys(rooms).forEach((roomId) => {
            const roomClients = rooms[roomId];
            const index = roomClients.indexOf(ws);
            if (index !== -1) {
                roomClients.splice(index, 1);
                console.log(`Client removed from room: ${roomId}`);
            }
        });
    });
});
const express = require('express');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// Initialize the express application
const app = express();
const server = app.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on port ${process.env.PORT || 3000}`);
});

// Set up WebSocket server
const wss = new WebSocket.Server({ server });

// Store rooms and connected clients
const rooms = {};

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('A client connected');

    // Handle incoming messages from clients
    ws.on('message', (message) => {
        console.log('Message received:', message);

        try {
            const data = JSON.parse(message);

            // Handle case when 'candidate' is part of the message
            if (data.candidate) {
                const { candidate } = data;

                // Ensure that the room exists
                if (data.roomId && rooms[data.roomId]) {
                    const roomClients = rooms[data.roomId];
                    roomClients.forEach(client => {
                        if (client !== ws && client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({ candidate }));
                        }
                    });
                }
            } else if (data.roomId) {
                // Handle room creation
                if (!rooms[data.roomId]) {
                    rooms[data.roomId] = [];
                    console.log(`Room created: ${data.roomId}`);
                }
                rooms[data.roomId].push(ws);
                ws.send(JSON.stringify({ message: `Joined room ${data.roomId}` }));
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    // Handle client disconnections
    ws.on('close', () => {
        console.log('A client disconnected');
        Object.keys(rooms).forEach((roomId) => {
            const roomClients = rooms[roomId];
            const index = roomClients.indexOf(ws);
            if (index !== -1) {
                roomClients.splice(index, 1);
                console.log(`Client removed from room: ${roomId}`);
            }
        });
    });
});
