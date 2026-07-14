// 🆕 THE PRO PROD SWITCH: If running online, connect to our live URL, otherwise use localhost.
const socket = io(
  window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://turdle-backend.onrender.com", // We will replace this URL in Step 3!
);

// Game states
const ROW_COUNT = 6;
const COL_COUNT = 5;
let currentRow = 0;
let currentCol = 0;
let currentGuess = "";
let currentRoomCode = "";

// HTML Grabbers
const lobbyScreen = document.getElementById("lobby-screen");
const gameScreen = document.getElementById("game-screen");
const createBtn = document.getElementById("create-btn");
const joinBtn = document.getElementById("join-btn");
const roomInput = document.getElementById("room-input");
const displayRoomCode = document.getElementById("display-room-code");
const statusMessage = document.getElementById("status-message");
const leaveBtn = document.getElementById("leave-btn");

const KB_ROWS = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "⌫"] // ⌫ acts as Backspace
];

// --- LOBBY ACTIONS ---
createBtn.addEventListener("click", () => {
  socket.emit("create_room");
});

joinBtn.addEventListener("click", () => {
  const code = roomInput.value.toUpperCase().trim();
  if (code.length === 4) {
    currentRoomCode = code; // Lock in the code for the guest
    socket.emit("join_room", code);
  } else {
    alert("Please enter a valid 4-letter code!");
  }
});

leaveBtn.addEventListener("click", () => {
    if (!currentRoomCode) return;

    // 1. Tell the server we are leaving this specific room code
    socket.emit("leave_room", currentRoomCode);

    // 2. Clear out our client-side room tracking variable
    currentRoomCode = null;

    // 3. Clear out the game boards so old games don't stack visually later
    document.getElementById('game-board').innerHTML = "";
    document.getElementById('opponent-board').innerHTML = "";

    // 4. Return safely back to the centered lobby view
    gameScreen.style.display = "none";
    lobbyScreen.style.display = "flex"; // Using flex keeps your centering fix active!
});

// --- SERVER HANDSHAKES ---
socket.on("room_created", (roomCode) => {
  currentRoomCode = roomCode;
  lobbyScreen.style.display = "none";
  gameScreen.style.display = "block";
  displayRoomCode.innerText = roomCode;

  // 🆕 SHOW the waiting text and room code header
  document.querySelector('#game-screen h2').style.display = "block";
  statusMessage.style.display = "block";
  statusMessage.innerText = "Waiting for an opponent to hop in...";
  statusMessage.style.color = "#a7a7a8"; // Cozy gray color while waiting

  leaveBtn.style.display = "block";

  // 🆕 HIDE the gameplay elements for now
  document.querySelector('.arena').style.display = "none";
  document.getElementById('keyboard-container').style.display = "none";
});

socket.on("game_start", (data) => {
  currentRoomCode = data.roomCode;
  lobbyScreen.style.display = "none";
  gameScreen.style.display = "block";
  displayRoomCode.innerText = data.roomCode;

  // 🆕 HIDE the room code header and status text completely
  document.querySelector('#game-screen h2').style.display = "none";
  statusMessage.style.display = "none";

  leaveBtn.style.display = "none";

  // 🆕 SHOW the arena grids and interactive keyboard
  document.querySelector('.arena').style.display = "flex";
  document.getElementById('keyboard-container').style.display = "flex";

  generateGameBoard();
  // Call generateKeyboard(); here too if you have it!
});

socket.on("error_message", (msg) => {
  alert(msg);
});

// --- GRID BUILDER ---
function generateGameBoard() {
  const board = document.getElementById("game-board");
  const opponentBoard = document.getElementById("opponent-board");

  board.innerHTML = "";
  opponentBoard.innerHTML = "";

  for (let r = 0; r < ROW_COUNT; r++) {
    const rowDiv = document.createElement("div");
    rowDiv.classList.add("grid-row");
    rowDiv.setAttribute("id", `row-${r}`);

    const oppRowDiv = document.createElement("div");
    oppRowDiv.classList.add("grid-row");
    oppRowDiv.setAttribute("id", `opp-row-${r}`);

    for (let c = 0; c < COL_COUNT; c++) {
      const tileDiv = document.createElement("div");
      tileDiv.classList.add("tile");
      tileDiv.setAttribute("id", `row-${r}-col-${c}`);
      rowDiv.appendChild(tileDiv);

      const oppTileDiv = document.createElement("div");
      oppTileDiv.classList.add("tile");
      oppTileDiv.setAttribute("id", `opp-row-${r}-col-${c}`);
      oppRowDiv.appendChild(oppTileDiv);
    }

    board.appendChild(rowDiv);
    opponentBoard.appendChild(oppRowDiv);
  }
}

function generateKeyboard() {
    // Loop through our array blueprint to append individual click triggers
    for (let i = 0; i < KB_ROWS.length; i++) {
        const rowContainer = document.getElementById(`kb-row-${i + 1}`);
        rowContainer.innerHTML = ""; // Clear old frames if refreshing

        KB_ROWS[i].forEach(keyText => {
            const btn = document.createElement('button');
            btn.classList.add('key-btn');
            btn.innerText = keyText;

            // Give wider sizing profile overrides to functionality buttons
            if (keyText === 'ENTER' || keyText === '⌫') {
                btn.classList.add('wide-key');
            }

            // Tap behavior routing engine
            btn.addEventListener('click', () => {
                if (!document.getElementById('game-board').hasChildNodes()) return;

                if (keyText === 'ENTER') {
                    submitGuess();
                } else if (keyText === '⌫') {
                    deleteLetter();
                } else {
                    typeLetter(keyText);
                }
            });

            rowContainer.appendChild(btn);
        });
    }
}

socket.on('game_start', (data) => {
    // ... your other setup variables ...
    const roomHeader = document.querySelector('#game-screen h2');
    if (roomHeader) {
        roomHeader.style.display = 'none';
    }
    
    // Selects and hides the status text message
    document.getElementById('status-message').style.display = 'none';

    generateGameBoard();
    generateKeyboard(); // 🆕 Build the touch controls!
});

// --- TYPING MECHANICS ---
window.addEventListener("keydown", (e) => {
  if (!document.getElementById("game-board").hasChildNodes()) return;

  const key = e.key;
  if (key === "Enter") {
    submitGuess();
  } else if (key === "Backspace") {
    deleteLetter();
  } else if (/^[a-zA-Z]$/.test(key)) {
    typeLetter(key.toUpperCase());
  }
});

function typeLetter(letter) {
  if (currentCol >= COL_COUNT) return;
  const currentTile = document.getElementById(
    `row-${currentRow}-col-${currentCol}`,
  );
  currentTile.innerText = letter;
  currentTile.classList.add("pop");
  currentGuess += letter;
  currentCol++;
}

function deleteLetter() {
  if (currentCol <= 0) return;
  currentCol--;
  const currentTile = document.getElementById(
    `row-${currentRow}-col-${currentCol}`,
  );
  currentTile.innerText = "";
  currentTile.classList.remove("pop");
  currentGuess = currentGuess.slice(0, -1);
}

function submitGuess() {
  if (currentCol < COL_COUNT) {
    alert("Not enough letters! Keep hopping!");
    return;
  }

  // Send word to server for dictionary evaluation
  socket.emit("submit_guess", {
    guess: currentGuess,
    row: currentRow,
    roomCode: currentRoomCode,
  });
}

// --- LIVE MULTIPLAYER RESULTS ---
socket.on("guess_result", (data) => {
  const { playerId, row, result } = data;

  if (playerId === socket.id) {
    // Only run this block once for our active typing frame row
    if (row === currentRow) {
      for (let c = 0; c < COL_COUNT; c++) {
        const tile = document.getElementById(`row-${row}-col-${c}`);

        if (
          !tile.classList.contains("correct") &&
          !tile.classList.contains("present") &&
          !tile.classList.contains("absent")
        ) {
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
socket.on("invalid_word", (data) => {
  alert("Not a valid word in our dictionary! Try another word.");
});

// Listen for a victory/defeat declaration
socket.on("game_over", (data) => {
  statusMessage.innerText = data.msg;
  statusMessage.style.color = "gold";

  // Display the pop-up notification matching their outcome
  if (data.winner === socket.id) {
    alert("You beat the opponent!");
  } else {
    alert("Defeat! Your opponent guessed the word first.");
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
    gameScreen.style.display = "none";
    lobbyScreen.style.display = "block";

    // 4. Wipe out the internal rows and columns of both HTML grid boards
    document.getElementById("game-board").innerHTML = "";
    document.getElementById("opponent-board").innerHTML = "";
  }, 5000);
});

// --- 🆕 SINGLE GENTLY DRIFTING & SPINNING LETTERS ---
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const activeLetters = [];

// 1. Spawner: Add exactly one new large letter every 1000ms (1 second)
setInterval(() => {
    const randomLetter = alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    const randomX = Math.random() * (canvas.width - 60) + 30; // 30px padding on edges
    
    activeLetters.push({
        char: randomLetter,
        x: randomX,
        y: -50,                               // Start just above the top of the screen
        speed: Math.random() * 2.5 + 2.5,     // Gentle falling speed
        size: Math.floor(Math.random() * 20) + 50, // Random size between 50px and 70px
        opacity: 0.15,                        // Subtle background opacity
        angle: Math.random() * Math.PI * 2,   // Random starting rotation angle (0 to 360 degrees)
        spinSpeed: (Math.random() - 0.5) * 0.035 // Tiny random positive or negative rotation step per frame
    });
}, 2500);

// 2. Animation Loop: Move, rotate, and draw the active falling letters
function drawFallingLetters() {
    // Clear the screen completely on every frame to avoid trailing smears
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = activeLetters.length - 1; i >= 0; i--) {
        const letter = activeLetters[i];
        
        // Update positions and angles
        letter.y += letter.speed;
        letter.angle += letter.spinSpeed;

        // Save current canvas state before translating/rotating
        ctx.save();
        
        // Move the center point of drawing to the letter's current position
        ctx.translate(letter.x, letter.y);
        ctx.rotate(letter.angle);

        // Draw the letter centered at (0, 0) relative to our translation point
        ctx.font = `bold ${letter.size}px 'TurdleFont', sans-serif`;
        ctx.fillStyle = `hsla(135, 45%, 69%, ${letter.opacity})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle'; // Center vertically as well for perfect rotation axis
        ctx.fillText(letter.char, 0, 0);

        // Restore canvas state so other elements aren't affected by the rotation
        ctx.restore();

        // Remove the letter from the array once it drifts off the bottom of the screen
        if (letter.y > canvas.height + 100) {
            activeLetters.splice(i, 1);
        }
    }

    requestAnimationFrame(drawFallingLetters);
}

// Start the animation loop
drawFallingLetters();

// Add this to the bottom of client/app.js
socket.on("opponent_left", (data) => {
    alert(data.msg); // Pop a quick notice ("Opponent left...")
    
    // Clear out client variables and grids
    currentRoomCode = null;
    document.getElementById('game-board').innerHTML = "";
    document.getElementById('opponent-board').innerHTML = "";
    
    // Reset back to the clean lobby screen
    gameScreen.style.display = "none";
    lobbyScreen.style.display = "flex";
});