const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins
  },
});

let users = []; // Track online users
let messages = []; // Store messages

io.on("connection", (socket) => {
  console.log("A user connected");

  // Add user to the online list
  socket.on("set-username", (username) => {
    users.push(username);
    io.emit("user-list", users); // Update all clients with the new user list
  });

  // Handle messages
  socket.on("send-message", (msgData) => {
    messages.push(msgData); // Store the message
    io.emit("receive-message", msgData); // Broadcast the message to all clients
  });

  // Handle typing event
  socket.on("typing", (username) => {
    socket.broadcast.emit("typing", username); // Broadcast typing status to all other clients
  });

  // Handle message deletion
  socket.on("delete-message", (index) => {
    messages = messages.filter((_, i) => i !== index);
    io.emit("receive-message", messages); // Send updated messages to all clients
  });

  // Handle message editing
  socket.on("edit-message", ({ index, newMessage }) => {
    messages[index].message = newMessage; // Update message text
    io.emit("receive-message", messages); // Send updated messages to all clients
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
    // Remove user from the online list
    users = users.filter((user) => user !== socket.id);
    io.emit("user-list", users); // Update all clients with the new user list
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
