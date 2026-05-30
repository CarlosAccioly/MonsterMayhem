const express = require("express");
const app = express();

const http = require("http").createServer(app);
const io = require("socket.io")(http);

const PORT = 3000;

app.use(express.static("public"));

// All game rooms are stored here
let rooms = {};

// Create a new room if it does not exist
function createRoom(roomName) {
    if (!rooms[roomName]) {
        rooms[roomName] = {
            board: new Array(100).fill(null),
            monsterInfo: new Array(100).fill(null),
            players: {},
            playerMonsters: {},
            nextPlayerNumber: 1,
            roundNumber: 1,
            winner: null,
            statistics: {
                totalGamesPlayed: 0,
                playerStats: {}
            }
        };
    }

    return rooms[roomName];
}

io.on("connection", (socket) => {
    console.log("A player connected: " + socket.id);

    socket.on("joinRoom", (roomName) => {
        const room = createRoom(roomName);

        if (room.nextPlayerNumber > 4) {
            socket.emit("message", "This room is full. Maximum 4 players allowed.");
            return;
        }

        socket.join(roomName);
        socket.roomName = roomName;

        const playerNumber = room.nextPlayerNumber;
        room.nextPlayerNumber++;

        room.players[socket.id] = {
            playerNumber: playerNumber,
            edge: getPlayerEdge(playerNumber),
            turnEnded: false,
            removedCount: 0,
            eliminated: false
        };

        room.playerMonsters[socket.id] = {
            vampire: 1,
            werewolf: 1,
            ghost: 1
        };

        room.statistics.playerStats[playerNumber] = {
            wins: 0,
            losses: 0
        };

        socket.emit("playerConnected", {
            socketId: socket.id,
            playerNumber: playerNumber,
            edge: room.players[socket.id].edge,
            roomName: roomName
        });

        socket.emit("remainingMonstersUpdate", room.playerMonsters[socket.id]);

        sendGameUpdate(roomName, "Player " + playerNumber + " joined room " + roomName + ".");
    });

    socket.on("placeMonster", (data) => {
        const room = rooms[socket.roomName];
        if (!room) return;

        const player = room.players[socket.id];

        if (room.winner !== null) return socket.emit("message", "The game has ended.");
        if (player.eliminated) return socket.emit("message", "You are eliminated.");
        if (player.turnEnded) return socket.emit("message", "You already ended your turn.");

        const index = data.index;
        const monster = data.monster;

        if (!isPlayerEdge(index, player.playerNumber)) {
            return socket.emit("message", "Invalid placement: use your own edge.");
        }

        if (room.board[index] !== null) {
            return socket.emit("message", "This cell already has a monster.");
        }

        if (room.playerMonsters[socket.id][monster] <= 0) {
            return socket.emit("message", "You have already placed this monster type.");
        }

        room.board[index] = getMonsterLetter(monster);

        room.monsterInfo[index] = {
            ownerSocketId: socket.id,
            ownerPlayerNumber: player.playerNumber,
            hasMoved: true,
            placedRound: room.roundNumber
        };

        room.playerMonsters[socket.id][monster]--;

        socket.emit("remainingMonstersUpdate", room.playerMonsters[socket.id]);

        sendGameUpdate(socket.roomName, "Player " + player.playerNumber + " placed a monster.");
    });

    socket.on("moveMonster", (data) => {
        const room = rooms[socket.roomName];
        if (!room) return;

        const player = room.players[socket.id];

        if (room.winner !== null) return socket.emit("message", "The game has ended.");
        if (player.eliminated) return socket.emit("message", "You are eliminated.");
        if (player.turnEnded) return socket.emit("message", "You already ended your turn.");

        const fromIndex = data.fromIndex;
        const toIndex = data.toIndex;

        if (room.board[fromIndex] === null) return socket.emit("message", "No monster selected.");

        if (room.monsterInfo[fromIndex].ownerSocketId !== socket.id) {
            return socket.emit("message", "You can only move your own monsters.");
        }

        if (room.monsterInfo[fromIndex].hasMoved) {
            return socket.emit("message", "This monster has already moved this round.");
        }

        if (!isValidMove(fromIndex, toIndex)) {
            return socket.emit("message", "Invalid move: move one cell up, down, left, or right.");
        }

        const movingMonster = room.board[fromIndex];
        const targetMonster = room.board[toIndex];

        if (targetMonster === null) {
            room.board[toIndex] = movingMonster;
            room.board[fromIndex] = null;

            room.monsterInfo[toIndex] = room.monsterInfo[fromIndex];
            room.monsterInfo[toIndex].hasMoved = true;
            room.monsterInfo[fromIndex] = null;

            sendGameUpdate(socket.roomName, "Player " + player.playerNumber + " moved a monster.");
        } else {
            const battleMessage = handleBattle(room, fromIndex, toIndex, movingMonster, targetMonster);
            checkWinner(room);
            sendGameUpdate(socket.roomName, battleMessage);
        }
    });

    socket.on("endTurn", () => {
        const room = rooms[socket.roomName];
        if (!room) return;

        const player = room.players[socket.id];

        if (player.eliminated) return socket.emit("message", "You are eliminated.");

        player.turnEnded = true;

        sendGameUpdate(socket.roomName, "Player " + player.playerNumber + " ended their turn.");
        checkRoundEnd(room, socket.roomName);
        sendRoundUpdate(socket.roomName);
    });

    socket.on("disconnect", () => {
        const roomName = socket.roomName;
        const room = rooms[roomName];

        if (room) {
            delete room.players[socket.id];
            delete room.playerMonsters[socket.id];

            sendGameUpdate(roomName, "A player disconnected.");
            checkRoundEnd(room, roomName);
        }

        console.log("A player disconnected: " + socket.id);
    });
});

function handleBattle(room, fromIndex, toIndex, movingMonster, targetMonster) {
    const movingInfo = room.monsterInfo[fromIndex];
    const targetInfo = room.monsterInfo[toIndex];

    if (movingMonster === targetMonster) {
        increaseRemovedCount(room, movingInfo.ownerSocketId);
        increaseRemovedCount(room, targetInfo.ownerSocketId);

        room.board[fromIndex] = null;
        room.board[toIndex] = null;
        room.monsterInfo[fromIndex] = null;
        room.monsterInfo[toIndex] = null;

        return "Battle result: both monsters were removed.";
    }

    const movingWins =
        (movingMonster === "V" && targetMonster === "W") ||
        (movingMonster === "W" && targetMonster === "G") ||
        (movingMonster === "G" && targetMonster === "V");

    if (movingWins) {
        increaseRemovedCount(room, targetInfo.ownerSocketId);

        room.board[toIndex] = movingMonster;
        room.board[fromIndex] = null;

        room.monsterInfo[toIndex] = movingInfo;
        room.monsterInfo[toIndex].hasMoved = true;
        room.monsterInfo[fromIndex] = null;

        return "Battle result: " + getMonsterName(movingMonster) + " defeated " + getMonsterName(targetMonster) + ".";
    }

    increaseRemovedCount(room, movingInfo.ownerSocketId);

    room.board[fromIndex] = null;
    room.monsterInfo[fromIndex] = null;

    return "Battle result: " + getMonsterName(targetMonster) + " defeated " + getMonsterName(movingMonster) + ".";
}

function increaseRemovedCount(room, socketId) {
    if (!room.players[socketId]) return;

    room.players[socketId].removedCount++;

    if (room.players[socketId].removedCount >= 10) {
        room.players[socketId].eliminated = true;
        room.players[socketId].turnEnded = true;
    }
}

function checkWinner(room) {
    const activePlayers = Object.values(room.players).filter((player) => {
        return player.eliminated === false;
    });

    if (activePlayers.length === 1 && Object.keys(room.players).length > 1 && room.winner === null) {
        room.winner = activePlayers[0].playerNumber;
        updateStatistics(room, room.winner);
    }
}

function updateStatistics(room, winningPlayerNumber) {
    room.statistics.totalGamesPlayed++;

    Object.values(room.players).forEach((player) => {
        const number = player.playerNumber;

        if (number === winningPlayerNumber) {
            room.statistics.playerStats[number].wins++;
        } else {
            room.statistics.playerStats[number].losses++;
        }
    });
}

function checkRoundEnd(room, roomName) {
    const activeSocketIds = Object.keys(room.players).filter((socketId) => {
        return room.players[socketId].eliminated === false;
    });

    if (activeSocketIds.length === 0) return;

    const allEnded = activeSocketIds.every((socketId) => {
        return room.players[socketId].turnEnded === true;
    });

    if (allEnded) {
        room.roundNumber++;

        activeSocketIds.forEach((socketId) => {
            room.players[socketId].turnEnded = false;
        });

        resetMonsterMovement(room);

        sendGameUpdate(roomName, "Round " + room.roundNumber + " has started.");
    }
}

function resetMonsterMovement(room) {
    for (let i = 0; i < room.monsterInfo.length; i++) {
        if (room.monsterInfo[i] !== null) {
            room.monsterInfo[i].hasMoved = false;
        }
    }
}

function sendGameUpdate(roomName, message) {
    const room = rooms[roomName];

    io.to(roomName).emit("boardUpdate", {
        board: room.board,
        message: message,
        players: getPlayersForClient(room),
        winner: room.winner,
        statistics: room.statistics
    });

    sendRoundUpdate(roomName);
}

function sendRoundUpdate(roomName) {
    const room = rooms[roomName];

    const activeSocketIds = Object.keys(room.players).filter((socketId) => {
        return room.players[socketId].eliminated === false;
    });

    let endedCount = 0;

    activeSocketIds.forEach((socketId) => {
        if (room.players[socketId].turnEnded) {
            endedCount++;
        }
    });

    Object.keys(room.players).forEach((socketId) => {
        io.to(socketId).emit("roundUpdate", {
            roundNumber: room.roundNumber,
            hasEndedTurn: room.players[socketId].turnEnded,
            endedCount: endedCount,
            totalPlayers: activeSocketIds.length
        });
    });
}

function getPlayersForClient(room) {
    return Object.values(room.players).map((player) => {
        return {
            playerNumber: player.playerNumber,
            removedCount: player.removedCount,
            eliminated: player.eliminated
        };
    });
}

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