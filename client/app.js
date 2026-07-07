// 🆕 THE PRO PROD SWITCH: If running online, connect to our live URL, otherwise use localhost.
const socket = io(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000' 
    : 'https://YOUR-BACKEND-APP-NAME.onrender.com' // We will replace this URL in Step 3!
);

// Game states
const ROW_COUNT = 6;
const COL_COUNT = 5;
let currentRow = 0;
let currentCol = 0;
let currentGuess = "";
let currentRoomCode = "";

// HTML Grabbers
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');
const roomInput = document.getElementById('room-input');
const displayRoomCode = document.getElementById('display-room-code');
const statusMessage = document.getElementById('status-message');

// --- LOBBY ACTIONS ---
createBtn.addEventListener('click', () => {
    socket.emit('create_room');
});

joinBtn.addEventListener('click', () => {
    const code = roomInput.value.toUpperCase().trim();
    if (code.length === 4) {
        currentRoomCode = code; // Lock in the code for the guest
        socket.emit('join_room', code);
    } else {
        alert("Please enter a valid 4-letter code!");
    }
});

// --- SERVER HANDSHAKES ---
socket.on('room_created', (roomCode) => {
    currentRoomCode = roomCode;
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    displayRoomCode.innerText = roomCode;
});

socket.on('game_start', (data) => {
    currentRoomCode = data.roomCode;
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    displayRoomCode.innerText = data.roomCode;
    statusMessage.innerText = data.msg;
    statusMessage.style.color = "green";

    generateGameBoard();
});

socket.on('error_message', (msg) => {
    alert(msg);
});

// --- GRID BUILDER ---
function generateGameBoard() {
    const board = document.getElementById('game-board');
    const opponentBoard = document.getElementById('opponent-board');
    
    board.innerHTML = ""; 
    opponentBoard.innerHTML = ""; 

    for (let r = 0; r < ROW_COUNT; r++) {
        const rowDiv = document.createElement('div');
        rowDiv.classList.add('grid-row');
        rowDiv.setAttribute('id', `row-${r}`);

        const oppRowDiv = document.createElement('div');
        oppRowDiv.classList.add('grid-row');
        oppRowDiv.setAttribute('id', `opp-row-${r}`);

        for (let c = 0; c < COL_COUNT; c++) {
            const tileDiv = document.createElement('div');
            tileDiv.classList.add('tile');
            tileDiv.setAttribute('id', `row-${r}-col-${c}`);
            rowDiv.appendChild(tileDiv);

            const oppTileDiv = document.createElement('div');
            oppTileDiv.classList.add('tile');
            oppTileDiv.setAttribute('id', `opp-row-${r}-col-${c}`);
            oppRowDiv.appendChild(oppTileDiv);
        }

        board.appendChild(rowDiv);
        opponentBoard.appendChild(oppRowDiv);
    }
}

// --- TYPING MECHANICS ---
window.addEventListener('keydown', (e) => {
    if (!document.getElementById('game-board').hasChildNodes()) return;

    const key = e.key;
    if (key === 'Enter') {
        submitGuess();
    } else if (key === 'Backspace') {
        deleteLetter();
    } else if (/^[a-zA-Z]$/.test(key)) {
        typeLetter(key.toUpperCase());
    }
});

function typeLetter(letter) {
    if (currentCol >= COL_COUNT) return;
    const currentTile = document.getElementById(`row-${currentRow}-col-${currentCol}`);
    currentTile.innerText = letter;
    currentTile.classList.add('pop');
    currentGuess += letter;
    currentCol++;
}

function deleteLetter() {
    if (currentCol <= 0) return;
    currentCol--;
    const currentTile = document.getElementById(`row-${currentRow}-col-${currentCol}`);
    currentTile.innerText = "";
    currentTile.classList.remove('pop');
    currentGuess = currentGuess.slice(0, -1);
}

function submitGuess() {
    if (currentCol < COL_COUNT) {
        alert("Not enough letters! Keep hopping!");
        return;
    }
    
    // Send word to server for dictionary evaluation
    socket.emit('submit_guess', {
        guess: currentGuess,
        row: currentRow,
        roomCode: currentRoomCode
    });
}

// --- LIVE MULTIPLAYER RESULTS ---
socket.on('guess_result', (data) => {
    const { playerId, row, result } = data;

    if (playerId === socket.id) {
        // Only run this block once for our active typing frame row
        if (row === currentRow) {
            for (let c = 0; c < COL_COUNT; c++) {
                const tile = document.getElementById(`row-${row}-col-${c}`);
                
                if (!tile.classList.contains('correct') && 
                    !tile.classList.contains('present') && 
                    !tile.classList.contains('absent')) {
                    tile.classList.add(result[c]);
                }
            }
            // Safely increment down now that word validation succeeded!
            currentRow++;
            currentCol = 0;
            currentGuess = "";
        }
    } else {
        // Paint color results on opponent mini-grid
        for (let c = 0; c < COL_COUNT; c++) {
            const oppTile = document.getElementById(`opp-row-${row}-col-${c}`);
            oppTile.classList.add(result[c]); 
        }
    }
});

// Catch validation failure from server
socket.on('invalid_word', (data) => {
    alert("Not a valid word in our burrow dictionary! Try another word.");
});

// Listen for a victory/defeat declaration
socket.on('game_over', (data) => {
    statusMessage.innerText = data.msg;
    statusMessage.style.color = "gold";
    
    // Display the pop-up notification matching their outcome
    if (data.winner === socket.id) {
        alert("Victory! You were the fastest rabbit in the burrow!");
    } else {
        alert("Defeat! Your opponent crossed the finish line first.");
    }

    // 🆕 THE HOME REDIRECT: Display a quick text notice to the players
    statusMessage.innerText = "Returning to the main lobby in 5 seconds... 🐇";
    statusMessage.style.color = "#a7a7a8";

    // Wait exactly 5000 milliseconds (5 seconds) before resetting everything
    setTimeout(() => {
        // 1. Wipe out our frontend tracking variables so old data doesn't leak
        currentRow = 0;
        currentCol = 0;
        currentGuess = "";
        currentRoomCode = "";

        // 2. Clear out any text sitting inside the lobby join inputs
        roomInput.value = "";

        // 3. Reverse the CSS screens: hide the game boards, show the main lobby setup again
        gameScreen.style.display = 'none';
        lobbyScreen.style.display = 'block';

        // 4. Wipe out the internal rows and columns of both HTML grid boards
        document.getElementById('game-board').innerHTML = "";
        document.getElementById('opponent-board').innerHTML = "";
    }, 5000);
});