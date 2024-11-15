// streamer/src/App.js
import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const socket = io('https://final-9zfr.onrender.com'); // Replace with your server URL

function Streamer() {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);

  useEffect(() => {
    // Get access to the webcam
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((currentStream) => {
        setStream(currentStream);
        if (videoRef.current) {
          videoRef.current.srcObject = currentStream;
        }
      });

    // Notify the server that this client is the streamer
    socket.emit('start-stream');

    return () => {
      socket.disconnect();
    };
  }, []);

  const startStreaming = () => {
    if (stream) {
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (event) => {
        socket.emit('stream', event.data); // Send video data to server
      };
      mediaRecorder.start(100); // Sends data in chunks every 100ms
    }
  };

  return (
    <div>
      <h1>Streamer</h1>
      <video ref={videoRef} autoPlay muted width="600" height="400"></video>
      <button onClick={startStreaming}>Start Streaming</button>
    </div>
  );
}

export default Streamer;
