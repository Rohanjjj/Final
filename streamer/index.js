const WebSocket = require('ws');

// Replace with the actual server URL
const serverUrl = 'ws://localhost:3000'; 
const socket = new WebSocket(serverUrl);

// Handle connection
socket.on('open', () => {
    console.log('Connected to the server');

    // Create a new room
    const createRoomMessage = JSON.stringify({ type: 'create-room' });
    socket.send(createRoomMessage);
});

// Handle incoming messages
socket.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === 'room-created') {
        console.log(`Room created with ID: ${data.roomId}`);
        const roomId = data.roomId;

        // Example: Send some streaming data
        setInterval(() => {
            const streamData = {
                type: 'stream-data',
                roomId: roomId,
                data: 'streaming-video-data-here'  // Simulating video stream
            };
            socket.send(JSON.stringify(streamData));
        }, 2000); // Send stream data every 2 seconds

        // Example: Send a comment after 5 seconds
        setTimeout(() => {
            const comment = {
                type: 'comment',
                roomId: roomId,
                data: { message: 'Hello viewers! Keep watching!' }
            };
            socket.send(JSON.stringify(comment));
        }, 5000);
    }
});

// Handle errors
socket.on('error', (error) => {
    console.error('WebSocket Error:', error);
});

// Handle close
socket.on('close', () => {
    console.log('Connection closed');
});
