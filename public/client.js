const socket = io();

const connectionMessage = document.getElementById("connectionMessage");
const socketIdText = document.getElementById("socketId");
const gameBoard = document.getElementById("gameBoard");

socket.on("playerConnected", (socketId) => {
    connectionMessage.textContent = "Player connected successfully!";
    socketIdText.textContent = socketId;
});

// This function creates a simple 10x10 game board
function createBoard() {
    // Clear the board before creating it
    gameBoard.innerHTML = "";

    // A 10x10 board has 100 cells
    for (let i = 0; i < 100; i++) {
        const cell = document.createElement("div");

        // Add the CSS class to style the cell
        cell.classList.add("cell");

        // Add the cell to the board
        gameBoard.appendChild(cell);
    }
}

// Create the board when the page loads
createBoard();