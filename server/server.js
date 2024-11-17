const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const rooms = {}; // { roomId: { streamer: ws, viewers: [] } }

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
                    ws.roomId = newRoomId; // Track the room the streamer owns
                    ws.isStreamer = true;
                    ws.send(JSON.stringify({ type: 'room-created', roomId: newRoomId }));
                    console.log(`Room created: ${newRoomId}`);
                    break;

                case 'join-room':
                    if (rooms[roomId]) {
                        rooms[roomId].viewers.push(ws);
                        ws.roomId = roomId; // Track the room the viewer joined
                        ws.isStreamer = false;
                        ws.send(JSON.stringify({ type: 'room-joined', success: true }));
                        console.log(`Viewer joined room: ${roomId}`);
                    } else {
                        ws.send(JSON.stringify({ type: 'room-joined', success: false, message: 'Room not found' }));
                    }
                    break;

                case 'stream-data':
                    if (rooms[roomId] && rooms[roomId].streamer === ws) {
                        // Broadcast stream data to all viewers
                        rooms[roomId].viewers.forEach((viewer) => {
                            viewer.send(JSON.stringify({ type: 'stream-data', data }));
                        });
                    }
                    break;

                case 'comment':
                    if (rooms[roomId]) {
                        // Send comments to the streamer and other viewers
                        const { message } = data;
                        const commentPacket = JSON.stringify({ type: 'comment', message });
                        if (rooms[roomId].streamer) {
                            rooms[roomId].streamer.send(commentPacket);
                        }
                        rooms[roomId].viewers.forEach((viewer) => {
                            if (viewer !== ws) viewer.send(commentPacket); // Avoid echoing to sender
                        });
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
            // Remove the room if the streamer disconnects
            if (rooms[roomId]) {
                rooms[roomId].viewers.forEach((viewer) => {
                    viewer.send(JSON.stringify({ type: 'room-closed', message: 'Streamer has disconnected.' }));
                });
                delete rooms[roomId];
                console.log(`Room ${roomId} closed`);
            }
        } else if (roomId && rooms[roomId]) {
            // Remove the viewer from the room
            rooms[roomId].viewers = rooms[roomId].viewers.filter((viewer) => viewer !== ws);
            console.log(`Viewer disconnected from room: ${roomId}`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
