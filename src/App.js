import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import "./App.css";

const socket = io("http://192.168.1.5:5000");

function App() {
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState("");
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]); // List of online users

  useEffect(() => {
    // Listen for incoming messages
    socket.on("receive-message", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    // Listen for typing events
    socket.on("typing", (username) => {
      setIsTyping(username ? `${username} is typing...` : "");
    });

    // Listen for online users
    socket.on("user-list", (users) => {
      setOnlineUsers(users); // Update the list of online users
    });

    return () => {
      socket.off("receive-message");
      socket.off("typing");
      socket.off("user-list");
    };
  }, []);

  const sendMessage = () => {
    if (message.trim() && username.trim()) {
      const timestamp = new Date().toLocaleTimeString();
      const messageData = { username, message, timestamp };

      socket.emit("send-message", messageData); // Emit the message to the server

      setMessage(""); // Clear the input field
      setIsTyping(""); // Clear typing indicator
      clearTimeout(typingTimeout); // Clear the typing timeout
    } else {
      alert("Please enter both username and message.");
    }
  };

  const handleTyping = () => {
    if (message.trim()) {
      socket.emit("typing", username);

      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }

      const newTimeout = setTimeout(() => {
        socket.emit("typing", "");
      }, 1000);

      setTypingTimeout(newTimeout);
    } else {
      socket.emit("typing", "");
    }
  };

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
            onChange={(e) => {
              setUsername(e.target.value);
              socket.emit("user-joined", e.target.value); // Emit event when user joins
            }}
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
                handleTyping();
              }}
              placeholder="Type a message..."
            />
            <button onClick={sendMessage}>Send</button>
          </div>

          {isTyping && <div className="typing">{isTyping}</div>}
        </>
      )}

      {/* Online Users */}
      {username && (
        <div className="online-users">
          <h3>Online Users ({onlineUsers.length})</h3>
          <ul>
            {onlineUsers.map((user, index) => (
              <li key={index}>{user}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
