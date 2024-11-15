// server/index.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

let streamerSocket = null; // To keep track of the streamer

io.on('connection', (socket) => {
  console.log('A client connected:', socket.id);

  // Designate the streamer
  socket.on('start-stream', () => {
    if (!streamerSocket) {
      streamerSocket = socket;
      console.log('Streamer connected:', socket.id);
    } else {
      console.log('A new connection attempted to start streaming but a streamer is already connected.');
    }
  });

  // Handle streaming data from the streamer
  socket.on('stream', (data) => {
    if (socket === streamerSocket) {
      socket.broadcast.emit('stream', data); // Broadcast to viewers only
    }
  });

  // Handle streamer disconnection
  socket.on('disconnect', () => {
    if (socket === streamerSocket) {
      console.log('Streamer disconnected');
      streamerSocket = null;
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
