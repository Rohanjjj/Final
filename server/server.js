const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");

// Environment variables for Render
const PORT = process.env.PORT || 8080;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/websocket-demo";

// Express app setup
const app = express();
app.use(bodyParser.json()); // Middleware to parse JSON bodies

// MongoDB connection
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.error("MongoDB connection error:", error));

// User schema for MongoDB
const userSchema = new mongoose.Schema({
  userId: String,       // Unique user identifier
  role: String,         // "streamer" or "viewer"
  metadata: Object,     // Additional user metadata
  connected: { type: Boolean, default: false }, // Connection status
});

const User = mongoose.model("User", userSchema);

// Create HTTP server and attach WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Active WebSocket connections
const activeUsers = new Map(); // Map of userId -> WebSocket connection

// Function to send JSON data to a WebSocket client
function sendJSON(client, data) {
  if (client.readyState === WebSocket.OPEN) {
    try {
      client.send(JSON.stringify(data));
    } catch (error) {
      console.error("Error sending JSON:", error);
    }
  }
}

// Broadcast messages to users by role
async function broadcastByRole(role, data) {
  const users = await User.find({ role, connected: true });
  users.forEach((user) => {
    const client = activeUsers.get(user.userId);
    if (client && client.readyState === WebSocket.OPEN) {
      sendJSON(client, data);
    }
  });
}

// WebSocket connection handling
wss.on("connection", (ws) => {
  console.log("New WebSocket connection.");

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);

      // Register a user
      if (data.type === "register") {
        const { userId, role, metadata } = data;
        const user = await User.findOneAndUpdate(
          { userId },
          { role, metadata, connected: true },
          { upsert: true, new: true }
        );
        activeUsers.set(userId, ws);
        sendJSON(ws, { type: "register-success", user });
        console.log(`User registered: ${userId} (${role})`);
      }

      // Streamer sending data
      else if (data.type === "streamer-data") {
        if (data.userId && activeUsers.has(data.userId)) {
          await broadcastByRole("viewer", { type: "stream-data", payload: data.payload });
        } else {
          sendJSON(ws, { type: "error", message: "Unauthorized streamer" });
        }
      }

      // Viewer requesting data
      else if (data.type === "viewer-request") {
        sendJSON(ws, { type: "viewer-response", message: "Request received" });
      }

      // Unknown message type
      else {
        sendJSON(ws, { type: "error", message: "Unknown message type" });
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
      sendJSON(ws, { type: "error", message: "Invalid message format" });
    }
  });

  ws.on("close", async () => {
    console.log("WebSocket connection closed.");

    for (const [userId, client] of activeUsers) {
      if (client === ws) {
        activeUsers.delete(userId);
        await User.findOneAndUpdate({ userId }, { connected: false });
        console.log(`User disconnected: ${userId}`);
        break;
      }
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

// REST API routes
app.post("/register", async (req, res) => {
  const { userId, role, metadata } = req.body;
  try {
    const user = await User.findOneAndUpdate(
      { userId },
      { role, metadata, connected: false },
      { upsert: true, new: true }
    );
    res.json({ message: "User registered successfully", user });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ error: "Error registering user" });
  }
});

app.post("/broadcast", async (req, res) => {
  const { role, payload } = req.body;
  try {
    await broadcastByRole(role, { type: "broadcast", payload });
    res.json({ message: `Broadcast to ${role} users completed.` });
  } catch (error) {
    console.error("Error broadcasting message:", error);
    res.status(500).json({ error: "Error broadcasting message" });
  }
});

app.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Error fetching users" });
  }
});

app.delete("/users/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    await User.findOneAndDelete({ userId });
    res.json({ message: `User ${userId} deleted.` });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Error deleting user" });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
