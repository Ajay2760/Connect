import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import "./App.css"; // Import the CSS file

const socket = io("http://localhost:5000");

function App() {
  const [username, setUsername] = useState(""); // Store full username
  const [message, setMessage] = useState(""); // Store message text
  const [messages, setMessages] = useState([]); // Store all messages
  const [isTyping, setIsTyping] = useState(""); // Typing indicator
  const [typingTimeout, setTypingTimeout] = useState(null); // To manage typing timeout
  const [isDarkMode, setIsDarkMode] = useState(false); // Dark Mode toggle

  useEffect(() => {
    // Listen for incoming messages
    socket.on("receive-message", (data) => {
      setMessages((prev) => [...prev, data]); // Only update messages here
    });

    // Listen for typing events
    socket.on("typing", (username) => {
      setIsTyping(username ? `${username} is typing...` : "");
    });

    return () => {
      socket.off("receive-message");
      socket.off("typing");
    };
  }, []);

  const sendMessage = () => {
    if (message.trim() && username.trim()) {
      const timestamp = new Date().toLocaleTimeString();
      const messageData = { username, message, timestamp };

      // Emit message to the server
      socket.emit("send-message", messageData);

      // Clear the input field after sending
      setMessage("");
      setIsTyping(""); // Clear typing indicator when message is sent
      clearTimeout(typingTimeout); // Clear the typing timeout
    } else {
      alert("Please enter both username and message.");
    }
  };

  const handleTyping = () => {
    if (message) {
      socket.emit("typing", username); // Emit typing event to backend

      // Clear the existing timeout if there's one
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }

      // Set a new timeout to clear the typing indicator after 1 second of inactivity
      const newTimeout = setTimeout(() => {
        socket.emit("typing", ""); // Stop typing event when user stops typing
      }, 1000);

      setTypingTimeout(newTimeout); // Store the timeout ID
    } else {
      socket.emit("typing", ""); // Stop typing event when input is cleared
    }
  };

  // Toggle Dark Mode
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <div className={isDarkMode ? "container dark" : "container"}>
      <div className="header">
        Connect - Group Chat
        <button onClick={toggleDarkMode} className="dark-mode-toggle">
          {isDarkMode ? "Light Mode" : "Dark Mode"}
        </button>
      </div>

      {/* Input for username */}
      {!username && (
        <div>
          <textarea
            value={username}
            onChange={(e) => setUsername(e.target.value)} // Capture the full username
            placeholder="Enter your full username"
            rows="2"
            style={{ width: "80%", marginBottom: "20px", padding: "10px" }}
          />
        </div>
      )}

      {/* Chat box */}
      {username && (
        <>
          <div className="chat-box">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`message ${
                  msg.username === username ? "sent" : "received"
                }`}
              >
                <span className="username">{msg.username}:</span> {msg.message}
                <span className="timestamp"> {msg.timestamp}</span>
              </div>
            ))}
          </div>

          <div className="input-area">
            <input
              type="text"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                handleTyping(); // Trigger typing event on change
              }}
              placeholder="Type a message..."
            />
            <button onClick={sendMessage}>Send</button>
          </div>

          {/* Typing indicator */}
          {isTyping && <div className="typing">{isTyping}</div>}
        </>
      )}
    </div>
  );
}

export default App;
