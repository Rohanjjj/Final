// viewer/src/App.js
import React, { useRef, useEffect } from 'react';
import io from 'socket.io-client';

const socket = io('https://final-9zfr.onrender.com'); // Replace with your server URL

function Viewer() {
  const videoRef = useRef(null);

  useEffect(() => {
    // Receive streaming data and display it
    socket.on('stream', (data) => {
      const videoBlob = new Blob([data], { type: 'video/webm' });
      const videoUrl = URL.createObjectURL(videoBlob);
      if (videoRef.current) {
        videoRef.current.src = videoUrl;
        videoRef.current.play();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div>
      <h1>Viewer</h1>
      <video ref={videoRef} autoPlay controls width="600" height="400"></video>
    </div>
  );
}

export default Viewer;
