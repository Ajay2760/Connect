const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

let onlineUsers = [];

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("user-joined", (username) => {
    onlineUsers.push(username);
    io.emit("user-list", onlineUsers);
  });

  socket.on("send-message", (data) => {
    const timestamp = new Date().toLocaleTimeString();
    const messageData = { ...data, timestamp };
    io.emit("receive-message", messageData); // Send the message with timestamp
  });

  socket.on("user-left", (username) => {
    onlineUsers = onlineUsers.filter((user) => user !== username);
    io.emit("user-list", onlineUsers);
    io.emit("user-left", username);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
