const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html'); // Serve the HTML file
});

io.on('connection', (socket) => {
    console.log('A user connected');

    // Handle audio stream
    socket.on('audio-stream', (data) => {
        socket.broadcast.emit('audio-stream', data); // Broadcast audio data to other clients
    });

    // Handle video stream
    socket.on('video-stream', (data) => {
        socket.broadcast.emit('video-stream', data); // Broadcast video data to other clients
    });

    socket.on('disconnect', () => {
        console.log('User  disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
