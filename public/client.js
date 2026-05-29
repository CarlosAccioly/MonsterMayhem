const socket = io();

const connectionMessage = document.getElementById("connectionMessage");
const socketIdText = document.getElementById("socketId");
const gameBoard = document.getElementById("gameBoard");

const vampireButton = document.getElementById("vampireButton");
const werewolfButton = document.getElementById("werewolfButton");
const ghostButton = document.getElementById("ghostButton");
const selectedMonsterText = document.getElementById("selectedMonsterText");

let selectedMonster = null;

socket.on("playerConnected", (socketId) => {
    connectionMessage.textContent = "Player connected successfully!";
    socketIdText.textContent = socketId;
});

vampireButton.addEventListener("click", () => {
    selectedMonster = "vampire";
    selectedMonsterText.textContent = "Selected monster: Vampire";
});

werewolfButton.addEventListener("click", () => {
    selectedMonster = "werewolf";
    selectedMonsterText.textContent = "Selected monster: Werewolf";
});

ghostButton.addEventListener("click", () => {
    selectedMonster = "ghost";
    selectedMonsterText.textContent = "Selected monster: Ghost";
});

function createBoard() {
    gameBoard.innerHTML = "";

    for (let i = 0; i < 100; i++) {
        const cell = document.createElement("div");

        cell.classList.add("cell");
        cell.dataset.index = i;

        cell.addEventListener("click", () => {
            placeMonster(cell);
        });

        gameBoard.appendChild(cell);
    }
}

function placeMonster(cell) {
    if (selectedMonster === null) {
        alert("Please choose a monster first.");
        return;
    }

    if (cell.textContent !== "") {
        alert("This cell already has a monster.");
        return;
    }

    if (selectedMonster === "vampire") {
        cell.textContent = "V";
    } else if (selectedMonster === "werewolf") {
        cell.textContent = "W";
    } else if (selectedMonster === "ghost") {
        cell.textContent = "G";
    }
}

createBoard();