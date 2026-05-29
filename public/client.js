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

// This stores the monster selected for placement
let selectedMonster = null;

// This stores the board state
// Each empty cell is null
let board = new Array(100).fill(null);

// This controls how many monsters are still available to place
let remainingMonsters = {
    vampire: 1,
    werewolf: 1,
    ghost: 1
};

// This stores the index of the monster selected for movement
let selectedMoveIndex = null;

socket.on("playerConnected", (socketId) => {
    connectionMessage.textContent = "Player connected successfully!";
    socketIdText.textContent = socketId;
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

// Create the 10x10 board
function createBoard() {
    gameBoard.innerHTML = "";

    for (let i = 0; i < 100; i++) {
        const cell = document.createElement("div");

        cell.classList.add("cell");
        cell.dataset.index = i;

        cell.addEventListener("click", () => {
            handleCellClick(i);
        });

        gameBoard.appendChild(cell);
    }

    updateBoard();
}

// Decide what happens when a board cell is clicked
function handleCellClick(index) {
    // If the cell has a monster, select it for movement
    if (board[index] !== null) {
        selectedMoveIndex = index;
        selectedMoveText.textContent = "Selected monster to move: " + getMonsterName(board[index]);
        updateBoard();
        return;
    }

    // If an empty cell is clicked and a monster is selected to move, move it
    if (board[index] === null && selectedMoveIndex !== null) {
        moveMonster(selectedMoveIndex, index);
        return;
    }

    // If no monster is selected to move, place a new monster
    if (board[index] === null && selectedMonster !== null) {
        placeMonster(index);
        return;
    }

    alert("Please choose a monster to place or select a monster to move.");
}

// Place a monster on an empty cell
function placeMonster(index) {
    if (selectedMonster === null) {
        alert("Please choose a monster first.");
        return;
    }

    if (board[index] !== null) {
        alert("This cell already has a monster.");
        return;
    }

    if (remainingMonsters[selectedMonster] <= 0) {
        alert("You have already placed this monster type.");
        return;
    }

    board[index] = getMonsterLetter(selectedMonster);
    remainingMonsters[selectedMonster]--;

    updateRemainingMonsters();
    updateBoard();
}

// Move a selected monster to an empty cell
function moveMonster(fromIndex, toIndex) {
    if (board[toIndex] !== null) {
        alert("You cannot move to an occupied cell.");
        return;
    }

    board[toIndex] = board[fromIndex];
    board[fromIndex] = null;

    selectedMoveIndex = null;
    selectedMoveText.textContent = "Selected monster to move: None";

    updateBoard();
}

// Update the board display
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

// Update the remaining monster text
function updateRemainingMonsters() {
    remainingMonstersText.textContent =
        "Vampire: " + remainingMonsters.vampire +
        " | Werewolf: " + remainingMonsters.werewolf +
        " | Ghost: " + remainingMonsters.ghost;
}

// Convert monster name into board letter
function getMonsterLetter(monster) {
    if (monster === "vampire") {
        return "V";
    }

    if (monster === "werewolf") {
        return "W";
    }

    if (monster === "ghost") {
        return "G";
    }
}

// Convert monster letter into full name
function getMonsterName(monsterLetter) {
    if (monsterLetter === "V") {
        return "Vampire";
    }

    if (monsterLetter === "W") {
        return "Werewolf";
    }

    if (monsterLetter === "G") {
        return "Ghost";
    }

    return "Unknown";
}

createBoard();