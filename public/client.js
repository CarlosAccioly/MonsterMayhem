const socket = io();

const connectionMessage = document.getElementById("connectionMessage");
const socketIdText = document.getElementById("socketId");
const gameBoard = document.getElementById("gameBoard");

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

socket.on("playerConnected", (socketId) => {
    connectionMessage.textContent = "Player connected successfully!";
    socketIdText.textContent = socketId;
});

socket.on("boardUpdate", (data) => {
    board = data.board;
    messageText.textContent = data.message;

    if (data.remainingMonsters) {
        updateRemainingMonsters(data.remainingMonsters);
    }

    selectedMoveIndex = null;
    selectedMoveText.textContent = "Selected monster to move: None";

    updateBoard();
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

        if (board[index] !== null) {
            cell.textContent = board[index];
        }

        if (index === selectedMoveIndex) {
            cell.classList.add("selected-cell");
        }
    });
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