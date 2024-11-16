// Server Configuration
const SERVER_URL = 'wss://final-9zfr.onrender.com'; // Update with your deployed server URL

let ROOM_ID = null;

// Fetch dynamically generated room ID from the server
async function fetchRoomId() {
    try {
        const response = await fetch(`${SERVER_URL}/create-room`);
        const data = await response.json();
        ROOM_ID = data.roomId;
        console.log(`Room ID: ${ROOM_ID}`);
        document.getElementById('roomIdDisplay').textContent = `Room ID: ${ROOM_ID}`;
    } catch (err) {
        console.error('Failed to fetch room ID:', err);
        document.getElementById('roomIdDisplay').textContent = 'Error fetching room ID.';
    }
}

// WebRTC and WebSocket configuration
async function startStreaming() {
    if (!ROOM_ID) {
        console.error('Room ID is not set. Cannot start streaming.');
        return;
    }

    const ws = new WebSocket(`${SERVER_URL.replace('http', 'ws')}?roomId=${ROOM_ID}&role=streamer`);

    // Get DOM Elements
    const localVideo = document.getElementById('localVideo');
    const commentsDiv = document.getElementById('comments');
    const commentForm = document.getElementById('commentForm');
    const commentInput = document.getElementById('commentInput');

    // WebRTC configuration
    const peerConnections = {};
    const config = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' } // Use public STUN server
        ]
    };

    // Capture streamer's video/audio
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = stream;

        // Handle incoming WebSocket messages
        ws.onmessage = async (event) => {
            const message = JSON.parse(event.data);

            if (message.type === 'webrtc-signal') {
                const { signal, senderId } = message;

                if (!peerConnections[senderId]) {
                    peerConnections[senderId] = new RTCPeerConnection(config);

                    // Add local stream to peer connection
                    stream.getTracks().forEach(track => peerConnections[senderId].addTrack(track, stream));

                    // Handle ICE candidates
                    peerConnections[senderId].onicecandidate = (event) => {
                        if (event.candidate) {
                            ws.send(JSON.stringify({
                                type: 'webrtc-signal',
                                signal: { candidate: event.candidate },
                                targetId: senderId
                            }));
                        }
                    };
                }

                // Handle SDP (Session Description Protocol) signals
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

    // Handle comments submission
    commentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const comment = commentInput.value;
        ws.send(JSON.stringify({ type: 'comment', roomId: ROOM_ID, comment }));
        commentInput.value = '';
    });

    // Append comments to chat
    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'comment') {
            const commentElement = document.createElement('p');
            commentElement.textContent = message.comment;
            commentsDiv.appendChild(commentElement);
            commentsDiv.scrollTop = commentsDiv.scrollHeight;
        }
    };
}

// Initialize and start
fetchRoomId().then(() => {
    startStreaming();
});
