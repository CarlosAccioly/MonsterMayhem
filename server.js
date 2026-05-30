const express = require("express");
const app = express();

const http = require("http").createServer(app);
const io = require("socket.io")(http);

const PORT = 3000;

app.use(express.static("public"));

let board = new Array(100).fill(null);
let monsterInfo = new Array(100).fill(null);

let players = {};
let playerMonsters = {};
let nextPlayerNumber = 1;

let roundNumber = 1;
let winner = null;

// Global statistics stored on the server
let statistics = {
    totalGamesPlayed: 0,
    playerStats: {}
};

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
        edge: getPlayerEdge(playerNumber),
        turnEnded: false,
        removedCount: 0,
        eliminated: false
    };

    playerMonsters[socket.id] = {
        vampire: 1,
        werewolf: 1,
        ghost: 1
    };

    // Create statistics for this player
    statistics.playerStats[playerNumber] = {
        wins: 0,
        losses: 0
    };

    socket.emit("playerConnected", {
        socketId: socket.id,
        playerNumber: playerNumber,
        edge: players[socket.id].edge
    });

    socket.emit("remainingMonstersUpdate", playerMonsters[socket.id]);

    sendGameUpdate("Connected as Player " + playerNumber + ".");

    socket.on("placeMonster", (data) => {
        if (winner !== null) {
            socket.emit("message", "The game has ended. Winner: Player " + winner);
            return;
        }

        if (players[socket.id].eliminated) {
            socket.emit("message", "You are eliminated and cannot place monsters.");
            return;
        }

        if (players[socket.id].turnEnded) {
            socket.emit("message", "You already ended your turn.");
            return;
        }

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

        monsterInfo[index] = {
            ownerSocketId: socket.id,
            ownerPlayerNumber: playerNumber,
            hasMoved: true,
            placedRound: roundNumber
        };

        playerMonsters[socket.id][monster]--;

        socket.emit("remainingMonstersUpdate", playerMonsters[socket.id]);

        sendGameUpdate("Player " + playerNumber + " placed a " + getMonsterName(board[index]) + ".");
    });

    socket.on("moveMonster", (data) => {
        if (winner !== null) {
            socket.emit("message", "The game has ended. Winner: Player " + winner);
            return;
        }

        if (players[socket.id].eliminated) {
            socket.emit("message", "You are eliminated and cannot move monsters.");
            return;
        }

        if (players[socket.id].turnEnded) {
            socket.emit("message", "You already ended your turn.");
            return;
        }

        const fromIndex = data.fromIndex;
        const toIndex = data.toIndex;

        if (board[fromIndex] === null) {
            socket.emit("message", "No monster selected.");
            return;
        }

        if (monsterInfo[fromIndex].ownerSocketId !== socket.id) {
            socket.emit("message", "You can only move your own monsters.");
            return;
        }

        if (monsterInfo[fromIndex].hasMoved) {
            socket.emit("message", "This monster has already moved this round.");
            return;
        }

        if (!isValidMove(fromIndex, toIndex)) {
            socket.emit("message", "Invalid move: monsters can only move one cell up, down, left, or right.");
            return;
        }

        const movingMonster = board[fromIndex];
        const targetMonster = board[toIndex];

        if (targetMonster === null) {
            board[toIndex] = movingMonster;
            board[fromIndex] = null;

            monsterInfo[toIndex] = monsterInfo[fromIndex];
            monsterInfo[toIndex].hasMoved = true;
            monsterInfo[fromIndex] = null;

            sendGameUpdate("Player " + playerNumber + " moved a monster.");
        } else {
            const battleMessage = handleBattle(fromIndex, toIndex, movingMonster, targetMonster);
            checkWinner();
            sendGameUpdate(battleMessage);
        }
    });

    socket.on("endTurn", () => {
        if (players[socket.id].eliminated) {
            socket.emit("message", "You are eliminated.");
            return;
        }

        players[socket.id].turnEnded = true;
        sendGameUpdate("Player " + playerNumber + " ended their turn.");

        checkRoundEnd();
        sendRoundUpdate();
    });

    socket.on("disconnect", () => {
        console.log("A player disconnected: " + socket.id);

        delete players[socket.id];
        delete playerMonsters[socket.id];

        checkRoundEnd();
        sendGameUpdate("A player disconnected.");
    });
});

function handleBattle(fromIndex, toIndex, movingMonster, targetMonster) {
    const movingInfo = monsterInfo[fromIndex];
    const targetInfo = monsterInfo[toIndex];

    if (movingMonster === targetMonster) {
        increaseRemovedCount(movingInfo.ownerSocketId);
        increaseRemovedCount(targetInfo.ownerSocketId);

        board[fromIndex] = null;
        board[toIndex] = null;
        monsterInfo[fromIndex] = null;
        monsterInfo[toIndex] = null;

        return "Battle result: both monsters were removed.";
    }

    if (
        (movingMonster === "V" && targetMonster === "W") ||
        (movingMonster === "W" && targetMonster === "G") ||
        (movingMonster === "G" && targetMonster === "V")
    ) {
        increaseRemovedCount(targetInfo.ownerSocketId);

        board[toIndex] = movingMonster;
        board[fromIndex] = null;

        monsterInfo[toIndex] = movingInfo;
        monsterInfo[toIndex].hasMoved = true;
        monsterInfo[fromIndex] = null;

        return "Battle result: " + getMonsterName(movingMonster) + " defeated " + getMonsterName(targetMonster) + ".";
    }

    increaseRemovedCount(movingInfo.ownerSocketId);

    board[fromIndex] = null;
    monsterInfo[fromIndex] = null;

    return "Battle result: " + getMonsterName(targetMonster) + " defeated " + getMonsterName(movingMonster) + ".";
}

function increaseRemovedCount(socketId) {
    if (!players[socketId]) return;

    players[socketId].removedCount++;

    if (players[socketId].removedCount >= 10) {
        players[socketId].eliminated = true;
        players[socketId].turnEnded = true;
    }
}

function checkWinner() {
    const activePlayers = Object.values(players).filter((player) => {
        return player.eliminated === false;
    });

    if (activePlayers.length === 1 && Object.keys(players).length > 1 && winner === null) {
        winner = activePlayers[0].playerNumber;
        updateStatistics(winner);
    }
}

function updateStatistics(winningPlayerNumber) {
    statistics.totalGamesPlayed++;

    Object.values(players).forEach((player) => {
        const number = player.playerNumber;

        if (!statistics.playerStats[number]) {
            statistics.playerStats[number] = {
                wins: 0,
                losses: 0
            };
        }

        if (number === winningPlayerNumber) {
            statistics.playerStats[number].wins++;
        } else {
            statistics.playerStats[number].losses++;
        }
    });
}

function checkRoundEnd() {
    const activeSocketIds = Object.keys(players).filter((socketId) => {
        return players[socketId].eliminated === false;
    });

    if (activeSocketIds.length === 0) return;

    const allEnded = activeSocketIds.every((socketId) => {
        return players[socketId].turnEnded === true;
    });

    if (allEnded) {
        roundNumber++;

        activeSocketIds.forEach((socketId) => {
            players[socketId].turnEnded = false;
        });

        resetMonsterMovement();

        sendGameUpdate("Round " + roundNumber + " has started. Monsters can move again.");
    }
}

function resetMonsterMovement() {
    for (let i = 0; i < monsterInfo.length; i++) {
        if (monsterInfo[i] !== null) {
            monsterInfo[i].hasMoved = false;
        }
    }
}

function sendGameUpdate(message) {
    io.emit("boardUpdate", {
        board: board,
        message: message,
        players: getPlayersForClient(),
        winner: winner,
        statistics: statistics
    });

    sendRoundUpdate();
}

function sendRoundUpdate() {
    const activeSocketIds = Object.keys(players).filter((socketId) => {
        return players[socketId].eliminated === false;
    });

    let endedCount = 0;

    activeSocketIds.forEach((socketId) => {
        if (players[socketId].turnEnded) {
            endedCount++;
        }
    });

    Object.keys(players).forEach((socketId) => {
        io.to(socketId).emit("roundUpdate", {
            roundNumber: roundNumber,
            hasEndedTurn: players[socketId].turnEnded,
            endedCount: endedCount,
            totalPlayers: activeSocketIds.length
        });
    });
}

function getPlayersForClient() {
    return Object.values(players).map((player) => {
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