const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "https://connect-chat-q3dlqlhyp-ajay2760s-projects.vercel.app",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

let users = []; // Track online users

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Add user when they join
  socket.on("user-joined", (username) => {
    if (username && !users.includes(username)) {
      users.push(username);
      io.emit("user-list", users); // Broadcast the updated user list
    }
  });

  // Handle messages
  socket.on("send-message", (msgData) => {
    io.emit("receive-message", msgData); // Broadcast the message to all clients
  });

  // Handle typing event
  socket.on("typing", (username) => {
    socket.broadcast.emit("typing", username); // Broadcast typing status
  });

  // Remove user when they disconnect
  socket.on("disconnect", () => {
    users = users.filter((user) => user !== socket.username);
    io.emit("user-list", users); // Broadcast the updated user list
    console.log("A user disconnected:", socket.id);
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
