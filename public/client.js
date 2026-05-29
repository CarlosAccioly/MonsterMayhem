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

// This stores the monster selected for placement
let selectedMonster = null;

// This stores the board state
// Empty cells are stored as null
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
    messageText.textContent = "Click an empty cell to place the Vampire.";
});

werewolfButton.addEventListener("click", () => {
    selectedMonster = "werewolf";
    selectedMonsterText.textContent = "Selected monster to place: Werewolf";
    messageText.textContent = "Click an empty cell to place the Werewolf.";
});

ghostButton.addEventListener("click", () => {
    selectedMonster = "ghost";
    selectedMonsterText.textContent = "Selected monster to place: Ghost";
    messageText.textContent = "Click an empty cell to place the Ghost.";
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
    // If the cell has a monster and no monster is already selected, select it
    if (board[index] !== null && selectedMoveIndex === null) {
        selectedMoveIndex = index;
        selectedMoveText.textContent = "Selected monster to move: " + getMonsterName(board[index]);
        messageText.textContent = "Now click a nearby cell to move or battle.";
        updateBoard();
        return;
    }

    // If a monster is selected, try to move or battle
    if (selectedMoveIndex !== null) {
        moveMonster(selectedMoveIndex, index);
        return;
    }

    // If no monster is selected to move, place a new monster
    if (board[index] === null && selectedMonster !== null) {
        placeMonster(index);
        return;
    }

    messageText.textContent = "Please choose a monster to place or select a monster to move.";
}

// Place a monster on an empty cell
function placeMonster(index) {
    if (selectedMonster === null) {
        messageText.textContent = "Please choose a monster first.";
        return;
    }

    if (board[index] !== null) {
        messageText.textContent = "This cell already has a monster.";
        return;
    }

    if (remainingMonsters[selectedMonster] <= 0) {
        messageText.textContent = "You have already placed this monster type.";
        return;
    }

    board[index] = getMonsterLetter(selectedMonster);
    remainingMonsters[selectedMonster]--;

    messageText.textContent = getMonsterName(board[index]) + " placed successfully.";

    updateRemainingMonsters();
    updateBoard();
}

// Move a selected monster to another cell
function moveMonster(fromIndex, toIndex) {
    if (fromIndex === toIndex) {
        messageText.textContent = "Invalid move: choose a different cell.";
        return;
    }

    if (isValidMove(fromIndex, toIndex) === false) {
        messageText.textContent = "Invalid move: monsters can only move one cell up, down, left, or right.";
        return;
    }

    const movingMonster = board[fromIndex];
    const targetMonster = board[toIndex];

    // If the target cell is empty, move normally
    if (targetMonster === null) {
        board[toIndex] = movingMonster;
        board[fromIndex] = null;

        messageText.textContent = "Monster moved successfully.";
    } else {
        // If the target cell has a monster, battle happens
        handleBattle(fromIndex, toIndex, movingMonster, targetMonster);
    }

    selectedMoveIndex = null;
    selectedMoveText.textContent = "Selected monster to move: None";

    updateBoard();
}

// Check if the monster is moving only one cell up, down, left, or right
function isValidMove(fromIndex, toIndex) {
    const fromRow = Math.floor(fromIndex / 10);
    const fromCol = fromIndex % 10;

    const toRow = Math.floor(toIndex / 10);
    const toCol = toIndex % 10;

    const rowDifference = Math.abs(fromRow - toRow);
    const colDifference = Math.abs(fromCol - toCol);

    if (rowDifference === 1 && colDifference === 0) {
        return true;
    }

    if (rowDifference === 0 && colDifference === 1) {
        return true;
    }

    return false;
}

// This function handles monster battle rules
function handleBattle(fromIndex, toIndex, movingMonster, targetMonster) {
    // Same monster type: both are removed
    if (movingMonster === targetMonster) {
        board[fromIndex] = null;
        board[toIndex] = null;

        messageText.textContent = "Battle result: both " + getMonsterName(movingMonster) + " monsters were removed.";
        return;
    }

    // Vampire beats Werewolf
    if (movingMonster === "V" && targetMonster === "W") {
        board[fromIndex] = null;
        board[toIndex] = "V";

        messageText.textContent = "Battle result: Vampire defeated Werewolf.";
        return;
    }

    if (movingMonster === "W" && targetMonster === "V") {
        board[fromIndex] = null;
        board[toIndex] = "V";

        messageText.textContent = "Battle result: Vampire defeated Werewolf.";
        return;
    }

    // Werewolf beats Ghost
    if (movingMonster === "W" && targetMonster === "G") {
        board[fromIndex] = null;
        board[toIndex] = "W";

        messageText.textContent = "Battle result: Werewolf defeated Ghost.";
        return;
    }

    if (movingMonster === "G" && targetMonster === "W") {
        board[fromIndex] = null;
        board[toIndex] = "W";

        messageText.textContent = "Battle result: Werewolf defeated Ghost.";
        return;
    }

    // Ghost beats Vampire
    if (movingMonster === "G" && targetMonster === "V") {
        board[fromIndex] = null;
        board[toIndex] = "G";

        messageText.textContent = "Battle result: Ghost defeated Vampire.";
        return;
    }

    if (movingMonster === "V" && targetMonster === "G") {
        board[fromIndex] = null;
        board[toIndex] = "G";

        messageText.textContent = "Battle result: Ghost defeated Vampire.";
        return;
    }
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