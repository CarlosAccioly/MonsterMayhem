const express = require("express");
const app = express();

const http = require("http").createServer(app);
const io = require("socket.io")(http);

const PORT = 3000;

// Serve the public folder
app.use(express.static("public"));

// The board is now stored on the server
// This means all players share the same board
let board = new Array(100).fill(null);

// Each player gets their own remaining monsters
let playerMonsters = {};

// Socket.IO connection
io.on("connection", (socket) => {
    console.log("A player connected: " + socket.id);

    playerMonsters[socket.id] = {
        vampire: 1,
        werewolf: 1,
        ghost: 1
    };

    socket.emit("playerConnected", socket.id);

    socket.emit("boardUpdate", {
        board: board,
        message: "Connected to the game.",
        remainingMonsters: playerMonsters[socket.id]
    });

    socket.on("placeMonster", (data) => {
        const index = data.index;
        const monster = data.monster;

        if (board[index] !== null) {
            socket.emit("message", "This cell already has a monster.");
            return;
        }

        if (playerMonsters[socket.id][monster] <= 0) {
            socket.emit("message", "You have already placed this monster type.");
            return;
        }

        board[index] = getMonsterLetter(monster);
        playerMonsters[socket.id][monster]--;

        io.emit("boardUpdate", {
            board: board,
            message: getMonsterName(board[index]) + " placed successfully.",
            remainingMonsters: playerMonsters[socket.id]
        });
    });

    socket.on("moveMonster", (data) => {
        const fromIndex = data.fromIndex;
        const toIndex = data.toIndex;

        if (isValidMove(fromIndex, toIndex) === false) {
            socket.emit("message", "Invalid move: monsters can only move one cell up, down, left, or right.");
            return;
        }

        const movingMonster = board[fromIndex];
        const targetMonster = board[toIndex];

        if (movingMonster === null) {
            socket.emit("message", "No monster selected.");
            return;
        }

        if (targetMonster === null) {
            board[toIndex] = movingMonster;
            board[fromIndex] = null;

            io.emit("boardUpdate", {
                board: board,
                message: "Monster moved successfully.",
                remainingMonsters: playerMonsters[socket.id]
            });
        } else {
            handleBattle(fromIndex, toIndex, movingMonster, targetMonster);

            io.emit("boardUpdate", {
                board: board,
                message: "Battle completed.",
                remainingMonsters: playerMonsters[socket.id]
            });
        }
    });

    socket.on("disconnect", () => {
        console.log("A player disconnected: " + socket.id);
        delete playerMonsters[socket.id];
    });
});

function isValidMove(fromIndex, toIndex) {
    const fromRow = Math.floor(fromIndex / 10);
    const fromCol = fromIndex % 10;

    const toRow = Math.floor(toIndex / 10);
    const toCol = toIndex % 10;

    const rowDifference = Math.abs(fromRow - toRow);
    const colDifference = Math.abs(fromCol - toCol);

    return (
        (rowDifference === 1 && colDifference === 0) ||
        (rowDifference === 0 && colDifference === 1)
    );
}

function handleBattle(fromIndex, toIndex, movingMonster, targetMonster) {
    if (movingMonster === targetMonster) {
        board[fromIndex] = null;
        board[toIndex] = null;
        return;
    }

    if (
        (movingMonster === "V" && targetMonster === "W") ||
        (movingMonster === "W" && targetMonster === "G") ||
        (movingMonster === "G" && targetMonster === "V")
    ) {
        board[toIndex] = movingMonster;
        board[fromIndex] = null;
    } else {
        board[fromIndex] = null;
    }
}

function getMonsterLetter(monster) {
    if (monster === "vampire") return "V";
    if (monster === "werewolf") return "W";
    if (monster === "ghost") return "G";
}

function getMonsterName(monsterLetter) {
    if (monsterLetter === "V") return "Vampire";
    if (monsterLetter === "W") return "Werewolf";
    if (monsterLetter === "G") return "Ghost";
    return "Unknown";
}

http.listen(PORT, () => {
    console.log("Monster Mayhem server running on port " + PORT);
});