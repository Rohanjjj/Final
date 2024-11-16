// Server Configuration
const SERVER_URL = 'ws://localhost:8080'; // Update with your deployed server URL
const ROOM_ID = 'room1'; // Replace with dynamically generated or selected room ID

const ws = new WebSocket(`${SERVER_URL}?roomId=${ROOM_ID}&role=streamer`);

// Get DOM Elements
const localVideo = document.getElementById('localVideo');
const commentsDiv = document.getElementById('comments');
const commentForm = document.getElementById('commentForm');
const commentInput = document.getElementById('commentInput');

// WebRTC Configuration
const peerConnections = {};
const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' } // Use public STUN server
    ]
};

// Capture Streamer's Video/Audio
async function startStreaming() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = stream;

        // Send stream to new peers
        ws.onmessage = async (event) => {
            const message = JSON.parse(event.data);

            if (message.type === 'webrtc-signal') {
                const { signal, senderId } = message;

                if (!peerConnections[senderId]) {
                    peerConnections[senderId] = new RTCPeerConnection(config);

                    // Add local stream to the connection
                    stream.getTracks().forEach(track => peerConnections[senderId].addTrack(track, stream));

                    peerConnections[senderId].onicecandidate = (event) => {
                        if (event.candidate) {
                            ws.send(JSON.stringify({ 
                                type: 'webrtc-signal', 
                                signal: { candidate: event.candidate }, 
                                targetId: senderId 
                            }));
                        }
                    };

                    // Handle remote streams if needed
                }

                if (signal.sdp) {
                    await peerConnections[senderId].setRemoteDescription(signal);
                    const answer = await peerConnections[senderId].createAnswer();
                    await peerConnections[senderId].setLocalDescription(answer);
                    ws.send(JSON.stringify({ type: 'webrtc-signal', signal: answer, targetId: senderId }));
                } else if (signal.candidate) {
                    await peerConnections[senderId].addIceCandidate(signal.candidate);
                }
            }
        };
    } catch (err) {
        console.error('Error starting stream:', err);
    }
}

// Handle Comments
commentForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const comment = commentInput.value;
    ws.send(JSON.stringify({ type: 'comment', roomId: ROOM_ID, comment }));
    commentInput.value = '';
});

// Append Comments to Chat
ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'comment') {
        const commentElement = document.createElement('p');
        commentElement.textContent = message.comment;
        commentsDiv.appendChild(commentElement);
        commentsDiv.scrollTop = commentsDiv.scrollHeight;
    }
};

// Start Streaming
startStreaming();
