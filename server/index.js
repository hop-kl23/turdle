const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// We start with an empty array and load it dynamically over the internet
let WORD_LIST = [];
// 🆕 OUR NEW EXPANDED DICTIONARY SYSTEM
let REJECT_DICTIONARY = []; // Combines answers + allowed guesses (12,000+ words)
let SECRET_ANSWER_LIST = []; // Only the 2,300 good words to pick the puzzle from

async function loadFullDictionary() {
  try {
    // Link 1: The core answer list (common words)
    const answersUrl =
      "https://gist.githubusercontent.com/cfreshman/a03ef2cba789d8cf00c08f767e0fad7b/raw/wordle-answers-alphabetical.txt";
    // Link 2: The massive allowed guess list (obscure words/plurals)
    const allowedGuessesUrl =
      "https://gist.githubusercontent.com/cfreshman/cdcdf777450c5b5301e439061d29694c/raw/wordle-allowed-guesses.txt";

    // Fetch both files simultaneously
    const [ansRes, allowRes] = await Promise.all([
      fetch(answersUrl),
      fetch(allowedGuessesUrl),
    ]);
    const ansText = await ansRes.text();
    const allowText = await allowRes.text();

    // Process the core secret answers
    SECRET_ANSWER_LIST = ansText
      .split("\n")
      .map((w) => w.trim().toUpperCase())
      .filter((w) => w.length === 5);

    // Process the allowed input guesses
    const allowedList = allowText
      .split("\n")
      .map((w) => w.trim().toUpperCase())
      .filter((w) => w.length === 5);

    // Combine both lists so players can guess ANY of the 12,000+ valid words
    REJECT_DICTIONARY = [...SECRET_ANSWER_LIST, ...allowedList];

    console.log(
      `📚 Success! Unlocked ${SECRET_ANSWER_LIST.length} puzzle answers and ${REJECT_DICTIONARY.length} total valid guess words.`,
    );
  } catch (error) {
    console.error(
      "❌ Failed to fetch vocabulary streams, falling back:",
      error,
    );
    SECRET_ANSWER_LIST = ["HARES", "BUNNY", "RABBIT", "SLATE", "CRANE"];
    REJECT_DICTIONARY = [...SECRET_ANSWER_LIST, "ZILCH", "AAHED", "XYSTl"];
  }
}
loadFullDictionary();

const activeRooms = {};

io.on("connection", (socket) => {
  console.log("A rabbit crawled into the server:", socket.id);

  // --- EVENT 1: CREATING A NEW ROOM ---
  socket.on("create_room", () => {
    const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();

    // Pick a completely random target word from our loaded 2,300+ list
    // Change WORD_LIST to SECRET_ANSWER_LIST here:
    const randomSecretWord =
      SECRET_ANSWER_LIST[
        Math.floor(Math.random() * SECRET_ANSWER_LIST.length)
      ] || "HARES";
    activeRooms[roomCode] = {
      players: [socket.id],
      secretWord: randomSecretWord,
    };

    socket.join(roomCode);
    socket.emit("room_created", roomCode);
    console.log(
      `🆕 Room ${roomCode} created. Secret Word is: ${randomSecretWord}`,
    );
  });

  // --- EVENT 2: JOINING AN EXISTING ROOM ---
  socket.on("join_room", async (roomCode) => {
    const room = activeRooms[roomCode];

    if (!room) {
      socket.emit("error_message", "Burrow not found! Check the code.");
      return;
    }
    if (room.players.length >= 2) {
      socket.emit("error_message", "This burrow is full!");
      return;
    }

    room.players.push(socket.id);
    await socket.join(roomCode);
    console.log(`🤝 Player ${socket.id} joined Room ${roomCode}`);

    // Small delay to ensure WebSockets fully bridge routing maps
    setTimeout(() => {
      io.to(roomCode).emit("game_start", {
        roomCode: roomCode,
        msg: "Both rabbits are ready! Start racing!",
      });
    }, 50);
  });

  // --- EVENT 3: PROCESSING A PLAYER'S GUESS ---
  socket.on("submit_guess", (data) => {
    const { guess, row, roomCode } = data;
    const room = activeRooms[roomCode];

    if (!room) {
      socket.emit("error_message", "Synchronization error.");
      return;
    }

    // ❌ REJECTION LOGIC: Check if the typed word exists inside our real English database
    // Change WORD_LIST.includes to REJECT_DICTIONARY.includes here:
    if (!REJECT_DICTIONARY.includes(guess)) {
      console.log(`❌ Blocked fake word: "${guess}" from ${socket.id}`);
      socket.emit("invalid_word", { row: row });
      return;
    }

    const secret = room.secretWord;
    let result = Array(5).fill("absent");
    let secretLetterCounts = {};

    // Pass 1: Find Greens
    for (let i = 0; i < 5; i++) {
      const secretLetter = secret[i];
      secretLetterCounts[secretLetter] =
        (secretLetterCounts[secretLetter] || 0) + 1;

      if (guess[i] === secret[i]) {
        result[i] = "correct";
        secretLetterCounts[secretLetter]--;
      }
    }

    // Pass 2: Find Yellows
    for (let i = 0; i < 5; i++) {
      if (result[i] === "correct") continue;
      const guessLetter = guess[i];

      if (
        secretLetterCounts[guessLetter] &&
        secretLetterCounts[guessLetter] > 0
      ) {
        result[i] = "present";
        secretLetterCounts[guessLetter]--;
      }
    }

    // Broadcast colors to everyone in the channel
    io.to(roomCode).emit("guess_result", {
      playerId: socket.id,
      row: row,
      result: result,
    });

    // Safe fallback back directly to the sender pipeline
    socket.emit("guess_result", {
      playerId: socket.id,
      row: row,
      result: result,
    });

    // Check Victory
    const isWinningGuess = result.every((status) => status === "correct");
    if (isWinningGuess) {
      io.to(roomCode).emit("game_over", {
        winner: socket.id,
        msg: `🎉 A rabbit cracked the code! Word was ${secret}.`,
      });

      setTimeout(() => {
        delete activeRooms[roomCode];
        console.log(
          `🧹 Cleaned up and deleted Room ${roomCode} from active memory.`,
        );
      }, 6000);
    }
  });

  socket.on("disconnect", () => {
    console.log("A rabbit left the server:", socket.id);
  });
});

server.listen(3000, () => {
  console.log("Server crawling on port 3000");
});
