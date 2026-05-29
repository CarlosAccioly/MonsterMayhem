// Connect to the Socket.IO server
const socket = io();

// Get elements from the HTML page
const connectionMessage = document.getElementById("connectionMessage");
const socketIdText = document.getElementById("socketId");

// Run when the server sends the player's socket ID
socket.on("playerConnected", (socketId) => {
    connectionMessage.textContent = "Player connected successfully!";
    socketIdText.textContent = socketId;
});