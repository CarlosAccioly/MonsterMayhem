const socket = io();

const connectionMessage = document.getElementById("connectionMessage");
const socketIdText = document.getElementById("socketId");
const gameBoard = document.getElementById("gameBoard");

const playerInfoText = document.getElementById("playerInfoText");
const playerEdgeText = document.getElementById("playerEdgeText");

const roundText = document.getElementById("roundText");
const turnStatusText = document.getElementById("turnStatusText");
const endedPlayersText = document.getElementById("endedPlayersText");
const endTurnButton = document.getElementById("endTurnButton");

const playersStatusBox = document.getElementById("playersStatusBox");
const winnerText = document.getElementById("winnerText");

const vampireButton = document.getElementById("vampireButton");
const werewolfButton = document.getElementById("werewolfButton");
const ghostButton = document.getElementById("ghostButton");

const selectedMonsterText = document.getElementById("selectedMonsterText");
const remainingMonstersText = document.getElementById("remainingMonstersText");
const selectedMoveText = document.getElementById("selectedMoveText");
const messageText = document.getElementById("messageText");

let selectedMonster = null;
let selectedMoveIndex = null;
let board = new Array(100).fill(null);

let playerNumber = null;
let playerEdge = null;
let hasEndedTurn = false;

socket.on("playerConnected", (data) => {
    connectionMessage.textContent = "Player connected successfully!";
    socketIdText.textContent = data.socketId;

    playerNumber = data.playerNumber;
    playerEdge = data.edge;

    playerInfoText.textContent = "Player: " + playerNumber;
    playerEdgeText.textContent = "Your edge: " + playerEdge;

    updateBoard();
});

socket.on("boardUpdate", (data) => {
    board = data.board;
    messageText.textContent = data.message;

    selectedMoveIndex = null;
    selectedMoveText.textContent = "Selected monster to move: None";

    if (data.players) {
        updatePlayersStatus(data.players);
    }

    if (data.winner !== null) {
        winnerText.textContent = "Game Over! Winner: Player " + data.winner;
        endTurnButton.disabled = true;
    }

    updateBoard();
});

socket.on("roundUpdate", (data) => {
    hasEndedTurn = data.hasEndedTurn;

    roundText.textContent = "Round: " + data.roundNumber;

    if (hasEndedTurn) {
        turnStatusText.textContent = "Your turn status: Ended";
        endTurnButton.disabled = true;
    } else {
        turnStatusText.textContent = "Your turn status: Not ended";
        endTurnButton.disabled = false;
    }

    endedPlayersText.textContent =
        "Players ended turn: " + data.endedCount + " / " + data.totalPlayers;
});

socket.on("remainingMonstersUpdate", (remainingMonsters) => {
    updateRemainingMonsters(remainingMonsters);
});

socket.on("message", (message) => {
    messageText.textContent = message;
});

vampireButton.addEventListener("click", () => {
    selectedMonster = "vampire";
    selectedMonsterText.textContent = "Selected monster to place: Vampire";
});

werewolfButton.addEventListener("click", () => {
    selectedMonster = "werewolf";
    selectedMonsterText.textContent = "Selected monster to place: Werewolf";
});

ghostButton.addEventListener("click", () => {
    selectedMonster = "ghost";
    selectedMonsterText.textContent = "Selected monster to place: Ghost";
});

endTurnButton.addEventListener("click", () => {
    socket.emit("endTurn");
});

function createBoard() {
    gameBoard.innerHTML = "";

    for (let i = 0; i < 100; i++) {
        const cell = document.createElement("div");

        cell.classList.add("cell");

        cell.addEventListener("click", () => {
            handleCellClick(i);
        });

        gameBoard.appendChild(cell);
    }

    updateBoard();
}

function handleCellClick(index) {
    if (hasEndedTurn) {
        messageText.textContent = "You already ended your turn. Wait for the next round.";
        return;
    }

    if (board[index] !== null && selectedMoveIndex === null) {
        selectedMoveIndex = index;
        selectedMoveText.textContent = "Selected monster to move: " + getMonsterName(board[index]);
        updateBoard();
        return;
    }

    if (selectedMoveIndex !== null) {
        socket.emit("moveMonster", {
            fromIndex: selectedMoveIndex,
            toIndex: index
        });
        return;
    }

    if (board[index] === null && selectedMonster !== null) {
        socket.emit("placeMonster", {
            index: index,
            monster: selectedMonster
        });
        return;
    }

    messageText.textContent = "Please choose a monster to place or select a monster to move.";
}

function updateBoard() {
    const cells = document.querySelectorAll(".cell");

    cells.forEach((cell, index) => {
        cell.textContent = "";
        cell.classList.remove("selected-cell");
        cell.classList.remove("player-edge");

        if (isMyEdge(index)) {
            cell.classList.add("player-edge");
        }

        if (board[index] !== null) {
            cell.textContent = board[index];
        }

        if (index === selectedMoveIndex) {
            cell.classList.add("selected-cell");
        }
    });
}

function updatePlayersStatus(players) {
    playersStatusBox.innerHTML = "";

    players.forEach((player) => {
        const playerLine = document.createElement("p");

        playerLine.classList.add("player-status");

        if (player.eliminated) {
            playerLine.classList.add("eliminated-player");
            playerLine.textContent =
                "Player " + player.playerNumber +
                " | Removed monsters: " + player.removedCount +
                " | Status: Eliminated";
        } else {
            playerLine.classList.add("active-player");
            playerLine.textContent =
                "Player " + player.playerNumber +
                " | Removed monsters: " + player.removedCount +
                " | Status: Active";
        }

        playersStatusBox.appendChild(playerLine);
    });
}

function isMyEdge(index) {
    const row = Math.floor(index / 10);
    const col = index % 10;

    if (playerNumber === 1 && row === 0) return true;
    if (playerNumber === 2 && row === 9) return true;
    if (playerNumber === 3 && col === 0) return true;
    if (playerNumber === 4 && col === 9) return true;

    return false;
}

function updateRemainingMonsters(remainingMonsters) {
    remainingMonstersText.textContent =
        "Vampire: " + remainingMonsters.vampire +
        " | Werewolf: " + remainingMonsters.werewolf +
        " | Ghost: " + remainingMonsters.ghost;
}

function getMonsterName(monsterLetter) {
    if (monsterLetter === "V") return "Vampire";
    if (monsterLetter === "W") return "Werewolf";
    if (monsterLetter === "G") return "Ghost";
    return "Unknown";
}

createBoard();