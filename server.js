// Import Express
const express = require("express");

// Create an Express app
const app = express();

// Create an HTTP server using Express
const http = require("http").createServer(app);

// Import Socket.IO and connect it to the HTTP server
const io = require("socket.io")(http);

// Set the port number
const PORT = 3000;

// Serve all files inside the public folder
app.use(express.static("public"));

// Run when a player connects
io.on("connection", (socket) => {
    console.log("A player connected: " + socket.id);

    // Send the socket ID to the connected player
    socket.emit("playerConnected", socket.id);

    // Run when a player disconnects
    socket.on("disconnect", () => {
        console.log("A player disconnected: " + socket.id);
    });
});

// Start the server
http.listen(PORT, () => {
    console.log("Monster Mayhem server running on port " + PORT);
});
