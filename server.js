const express = require("express");
const app = express();

const http = require("http").createServer(app);
const io = require("socket.io")(http);

const PORT = 3000;

app.use(express.static("public"));

let board = new Array(100).fill(null);

let players = {};
let playerMonsters = {};
let nextPlayerNumber = 1;

io.on("connection", (socket) => {
    console.log("A player connected: " + socket.id);

    if (nextPlayerNumber > 4) {
        socket.emit("message", "Game is full. Maximum 4 players allowed.");
        return;
    }

    const playerNumber = nextPlayerNumber;
    nextPlayerNumber++;

    players[socket.id] = {
        playerNumber: playerNumber,
        edge: getPlayerEdge(playerNumber)
    };

    playerMonsters[socket.id] = {
        vampire: 1,
        werewolf: 1,
        ghost: 1
    };

    socket.emit("playerConnected", {
        socketId: socket.id,
        playerNumber: playerNumber,
        edge: players[socket.id].edge
    });

    socket.emit("boardUpdate", {
        board: board,
        message: "Connected as Player " + playerNumber + ".",
        remainingMonsters: playerMonsters[socket.id]
    });

    socket.on("placeMonster", (data) => {
        const index = data.index;
        const monster = data.monster;

        if (!isPlayerEdge(index, players[socket.id].playerNumber)) {
            socket.emit("message", "Invalid placement: you can only place monsters on your own edge.");
            return;
        }

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
            message: "Player " + playerNumber + " placed a " + getMonsterName(board[index]) + "."
        });

        socket.emit("remainingMonstersUpdate", playerMonsters[socket.id]);
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
                message: "Player " + playerNumber + " moved a monster."
            });
        } else {
            const battleMessage = handleBattle(fromIndex, toIndex, movingMonster, targetMonster);

            io.emit("boardUpdate", {
                board: board,
                message: battleMessage
            });
        }
    });

    socket.on("disconnect", () => {
        console.log("A player disconnected: " + socket.id);
        delete players[socket.id];
        delete playerMonsters[socket.id];
    });
});

function getPlayerEdge(playerNumber) {
    if (playerNumber === 1) return "Top edge";
    if (playerNumber === 2) return "Bottom edge";
    if (playerNumber === 3) return "Left edge";
    if (playerNumber === 4) return "Right edge";
}

function isPlayerEdge(index, playerNumber) {
    const row = Math.floor(index / 10);
    const col = index % 10;

    if (playerNumber === 1 && row === 0) return true;
    if (playerNumber === 2 && row === 9) return true;
    if (playerNumber === 3 && col === 0) return true;
    if (playerNumber === 4 && col === 9) return true;

    return false;
}

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
        return "Battle result: both monsters were removed.";
    }

    if (
        (movingMonster === "V" && targetMonster === "W") ||
        (movingMonster === "W" && targetMonster === "G") ||
        (movingMonster === "G" && targetMonster === "V")
    ) {
        board[toIndex] = movingMonster;
        board[fromIndex] = null;
        return "Battle result: " + getMonsterName(movingMonster) + " defeated " + getMonsterName(targetMonster) + ".";
    }

    board[fromIndex] = null;
    return "Battle result: " + getMonsterName(targetMonster) + " defeated " + getMonsterName(movingMonster) + ".";
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