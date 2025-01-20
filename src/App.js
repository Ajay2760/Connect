import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import "./App.css";
import moment from "moment";

const socket = io("http://192.168.1.5:5000");

function App() {
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState("");
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userList, setUserList] = useState([]); // Track users online

  useEffect(() => {
    // Listen for incoming messages
    socket.on("receive-message", (data) => {
      setMessages((prev) => [...prev, data]); // Only update messages here
    });

    // Listen for typing events
    socket.on("typing", (username) => {
      setIsTyping(username ? `${username} is typing...` : "");
    });

    // Listen for user join and leave events
    socket.on("user-list", (users) => {
      setUserList(users);
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
    if (message.trim()) {
      socket.emit("typing", username); // Emit typing event to backend

      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }

      const newTimeout = setTimeout(() => {
        socket.emit("typing", ""); // Stop typing event when user stops typing
      }, 1000);

      setTypingTimeout(newTimeout); // Store the timeout ID
    } else {
      socket.emit("typing", ""); // Stop typing event when input is cleared
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleDeleteMessage = (index) => {
    const updatedMessages = messages.filter((_, i) => i !== index);
    setMessages(updatedMessages);
    socket.emit("delete-message", index); // Send delete event to server
  };

  const handleEditMessage = (index, newMessage) => {
    const updatedMessages = messages.map((msg, i) =>
      i === index ? { ...msg, message: newMessage } : msg
    );
    setMessages(updatedMessages);
    socket.emit("edit-message", { index, newMessage }); // Send edit event to server
  };

  return (
    <div className={isDarkMode ? "container dark" : "container"}>
      <div className="header">
        Connect - Group Chat
        <button onClick={toggleDarkMode} className="dark-mode-toggle">
          {isDarkMode ? "Light Mode" : "Dark Mode"}
        </button>
      </div>

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
                <span className="timestamp">{msg.timestamp}</span>
                {msg.username === username && (
                  <div>
                    <button onClick={() => handleDeleteMessage(index)}>
                      Delete
                    </button>
                    <button
                      onClick={() =>
                        handleEditMessage(
                          index,
                          prompt("Edit your message:", msg.message)
                        )
                      }
                    >
                      Edit
                    </button>
                  </div>
                )}
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

          {isTyping && <div className="typing">{isTyping}</div>}
        </>
      )}

      {/* Display users online */}
      <div>
        <h3>Online Users</h3>
        <ul>
          {userList.map((user, index) => (
            <li key={index}>{user}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
