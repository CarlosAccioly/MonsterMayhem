const express = require("express");
const app = express();

const http = require("http").createServer(app);
const io = require("socket.io")(http);

const PORT = 3000;

// Serve the public folder
app.use(express.static("public"));

// Socket.IO connection
io.on("connection", (socket) => {
    console.log("A player connected: " + socket.id);

    // Send the player's socket ID to the browser
    socket.emit("playerConnected", socket.id);

    socket.on("disconnect", () => {
        console.log("A player disconnected: " + socket.id);
    });
});

// Start the server
http.listen(PORT, () => {
    console.log("Monster Mayhem server running on port " + PORT);
});