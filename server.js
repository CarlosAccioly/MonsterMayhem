const express = require("express");
const app = express();

const http = require("http").createServer(app);
const io = require("socket.io")(http);

const PORT = 3000;

app.use(express.static("public"));

io.on("connection", (socket) => {
    console.log("A player connected: " + socket.id);

    socket.emit("playerConnected", socket.id);

    socket.on("disconnect", () => {
        console.log("A player disconnected: " + socket.id);
    });
});

http.listen(PORT, () => {
    console.log("Monster Mayhem server running on port " + PORT);
});