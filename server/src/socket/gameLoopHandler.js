// Game Loop Handler for turn management, timers, guessing, scoring, and mini-challenges
const { SOCKET_EVENTS, GAME_MODES, MINI_CHALLENGES, DEFAULT_COLOR_PALETTE } = require('../../../shared/constants');
const { calculateGuesserScore, calculateDrawerScore, normalizeGuess } = require('../../../shared/utils');
const { rooms, sanitizeRoom } = require('./roomHandler');
const Word = require('../models/Word');
const Score = require('../models/Score');
const aiPredictor = require('../utils/aiPredictor');

function setupGameLoopHandlers(io, socket) {
  // Start game request from host
  socket.on(SOCKET_EVENTS.START_GAME, () => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    if (room.host !== socket.data.username) return; // Only host can start
    if (room.players.length < 1) return;

    room.currentRound = 1;
    room.drawerIndex = 0;
    room.players.forEach(p => { p.score = 0; });
    room.teams.Red.score = 0;
    room.teams.Blue.score = 0;

    startTurnSelection(io, room);
  });

  // Drawer selects word from choices
  socket.on(SOCKET_EVENTS.SELECT_WORD, ({ word }) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || room.status !== 'WORD_SELECTION') return;
    if (room.currentDrawer !== socket.data.username) return;

    room.currentWord = word;
    startRoundDrawing(io, room);
  });

  // Process chat and guess validation
  socket.on(SOCKET_EVENTS.SEND_CHAT, ({ text }) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;

    const username = socket.data.username;
    if (!text || text.trim().length === 0) return;

    const isDrawer = room.currentDrawer === username;
    const hasGuessed = room.correctGuessers ? room.correctGuessers.includes(username) : false;
    const isPlaying = room.status === 'PLAYING';

    // If round is playing and player is not drawer and hasn't guessed yet
    if (isPlaying && !isDrawer && !hasGuessed && room.currentWord) {
      const cleanGuess = normalizeGuess(text);
      const cleanAnswer = normalizeGuess(room.currentWord);

      if (cleanGuess === cleanAnswer) {
        // Correct Guess!
        room.correctGuessers.push(username);
        const guessOrder = room.correctGuessers.length;
        const totalGuessers = Math.max(1, room.players.length - 1);
        const pointsEarned = calculateGuesserScore(guessOrder, totalGuessers, room.timeRemaining, room.roundTime);

        // Update player score
        const player = room.players.find(p => p.username === username);
        if (player) {
          player.score += pointsEarned;
          if (room.gameMode === GAME_MODES.TEAM && player.team) {
            room.teams[player.team].score += pointsEarned;
          }
        }

        // SRS 1.1: Answer Concealment
        // Notify everyone that [Name] guessed correctly, but DO NOT reveal the answer string!
        io.to(room.id).emit(SOCKET_EVENTS.CHAT_MESSAGE, {
          sender: 'System',
          text: `🎉 คุณ ${username} ทายถูกแล้ว! (+${pointsEarned} คะแนน)`,
          isSystem: true,
          isCorrectGuessNotice: true,
          guesser: username
        });

        // Notify drawer & guesser specifically
        socket.emit(SOCKET_EVENTS.CORRECT_GUESS, { points: pointsEarned });
        io.to(room.id).emit(SOCKET_EVENTS.ROOM_DATA, sanitizeRoom(room));

        // Check if all potential guessers have guessed correctly
        if (room.correctGuessers.length >= totalGuessers) {
          endRound(io, room, 'All players guessed correctly!');
        }
        return; // Don't broadcast guess as plain text
      }
    }

    // Normal chat message broadcast
    // If player has already guessed correctly during round, conceal message from players who haven't guessed yet
    if (isPlaying && hasGuessed) {
      room.players.forEach(p => {
        const targetSocket = io.sockets.sockets.get(p.socketId);
        if (targetSocket) {
          if (p.username === room.currentDrawer || room.correctGuessers.includes(p.username)) {
            targetSocket.emit(SOCKET_EVENTS.CHAT_MESSAGE, {
              sender: username,
              text: text,
              isConcealedChat: true
            });
          }
        }
      });
    } else {
      io.to(room.id).emit(SOCKET_EVENTS.CHAT_MESSAGE, {
        sender: username,
        text: text
      });
    }
  });

  // Solo AI mode: AI predict request
  socket.on(SOCKET_EVENTS.SOLO_AI_PREDICT, ({ drawEvents }) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || room.gameMode !== GAME_MODES.SOLO_AI) return;

    const result = aiPredictor.predictUserDrawing(room.currentWord, drawEvents);
    socket.emit(SOCKET_EVENTS.SOLO_AI_PREDICTION_RESULT, result);

    if (result.isCorrect && room.status === 'PLAYING') {
      const player = room.players.find(p => p.username === socket.data.username);
      if (player) player.score += 500;
      endRound(io, room, `AI correctly guessed the word "${room.currentWord}"! 🤖`);
    }
  });
}

function startTurnSelection(io, room) {
  if (room.roundTimer) clearInterval(room.roundTimer);

  room.status = 'WORD_SELECTION';
  room.correctGuessers = [];
  room.drawingHistory = [];

  // Pick current drawer
  if (room.players.length === 0) return;
  const currentDrawerObj = room.players[room.drawerIndex % room.players.length];
  room.currentDrawer = currentDrawerObj.username;

  // Mini-Challenges System (Randomized per round if enabled)
  if (room.miniChallengeEnabled) {
    const challengeTypes = [
      MINI_CHALLENGES.NONE,
      MINI_CHALLENGES.COLOUR_FIX,
      MINI_CHALLENGES.DONT_LIFT_PEN,
      MINI_CHALLENGES.GEOMETRIC_ONLY
    ];
    room.currentChallenge = challengeTypes[Math.floor(Math.random() * challengeTypes.length)];
    if (room.currentChallenge === MINI_CHALLENGES.COLOUR_FIX) {
      room.forcedColor = DEFAULT_COLOR_PALETTE[Math.floor(Math.random() * DEFAULT_COLOR_PALETTE.length)];
    } else {
      room.forcedColor = null;
    }
  } else {
    room.currentChallenge = MINI_CHALLENGES.NONE;
    room.forcedColor = null;
  }

  // Get 3 random words for drawer selection
  const wordChoices = Word.getRandomWords(3).map(w => w.word);
  room.wordOptions = wordChoices;

  io.to(room.id).emit(SOCKET_EVENTS.ROOM_DATA, sanitizeRoom(room));
  io.to(room.id).emit(SOCKET_EVENTS.DRAW_CLEAR);

  // Send word choices only to drawer
  const drawerSocket = room.players.find(p => p.username === room.currentDrawer);
  if (drawerSocket) {
    const socketObj = io.sockets.sockets.get(drawerSocket.socketId);
    if (socketObj) {
      socketObj.emit(SOCKET_EVENTS.WORD_SELECTION, { words: wordChoices });
    }
  }

  // Auto-select first word if drawer doesn't pick in 10s
  let autoTimer = 10;
  room.roundTimer = setInterval(() => {
    autoTimer--;
    if (autoTimer <= 0) {
      clearInterval(room.roundTimer);
      if (room.status === 'WORD_SELECTION') {
        room.currentWord = wordChoices[0];
        startRoundDrawing(io, room);
      }
    }
  }, 1000);
}

function startRoundDrawing(io, room) {
  if (room.roundTimer) clearInterval(room.roundTimer);

  room.status = 'PLAYING';
  room.timeRemaining = room.roundTime;

  io.to(room.id).emit(SOCKET_EVENTS.ROUND_START, {
    drawer: room.currentDrawer,
    round: room.currentRound,
    totalRounds: room.totalRounds,
    challenge: room.currentChallenge,
    forcedColor: room.forcedColor,
    roundTime: room.roundTime
  });

  io.to(room.id).emit(SOCKET_EVENTS.ROOM_DATA, sanitizeRoom(room));

  room.roundTimer = setInterval(() => {
    room.timeRemaining--;
    io.to(room.id).emit(SOCKET_EVENTS.TIMER_TICK, { timeRemaining: room.timeRemaining });

    if (room.timeRemaining <= 0) {
      clearInterval(room.roundTimer);
      endRound(io, room, 'Time is up!');
    }
  }, 1000);
}

function endRound(io, room, reason = '') {
  if (room.roundTimer) clearInterval(room.roundTimer);
  room.status = 'ROUND_OVER';

  // Calculate Drawer Score based on SRS formula:
  // Drawer Score = Base Points * (correct_guessers / total_guessers)
  const totalGuessers = Math.max(1, room.players.length - 1);
  const correctCount = room.correctGuessers ? room.correctGuessers.length : 0;
  const drawerPoints = calculateDrawerScore(correctCount, totalGuessers);

  const drawerPlayer = room.players.find(p => p.username === room.currentDrawer);
  if (drawerPlayer) {
    drawerPlayer.score += drawerPoints;
    if (room.gameMode === GAME_MODES.TEAM && drawerPlayer.team) {
      room.teams[drawerPlayer.team].score += drawerPoints;
    }
  }

  io.to(room.id).emit(SOCKET_EVENTS.ROUND_END, {
    word: room.currentWord,
    reason: reason,
    drawerPoints: drawerPoints,
    correctGuessers: room.correctGuessers
  });

  io.to(room.id).emit(SOCKET_EVENTS.ROOM_DATA, sanitizeRoom(room));

  // Advance drawer index
  room.drawerIndex++;

  // Check if round cycle is complete (every player has drawn once in this round)
  if (room.drawerIndex >= room.players.length) {
    room.drawerIndex = 0;
    room.currentRound++;
  }

  // Check if game match is over
  setTimeout(() => {
    if (room.currentRound > room.totalRounds || room.players.length <= 1) {
      endGameMatch(io, room);
    } else {
      startTurnSelection(io, room);
    }
  }, 5000); // 5 second pause to display answer and round results
}

function endGameMatch(io, room) {
  if (room.roundTimer) clearInterval(room.roundTimer);
  room.status = 'GAME_OVER';

  // SRS 2.2 & 3.1: Save score to leaderboard for non-Solo AI games
  if (room.gameMode !== GAME_MODES.SOLO_AI) {
    room.players.forEach(p => {
      Score.addRecord(p.username, p.score, room.gameMode);
    });
  }

  // Determine winner(s)
  let winnerText = '';
  if (room.gameMode === GAME_MODES.TEAM) {
    if (room.teams.Red.score > room.teams.Blue.score) {
      winnerText = 'Team Red Wins! 🔴';
    } else if (room.teams.Blue.score > room.teams.Red.score) {
      winnerText = 'Team Blue Wins! 🔵';
    } else {
      winnerText = "It's a Tie! 🤝";
    }
  } else {
    const sorted = [...room.players].sort((a, b) => b.score - a.score);
    winnerText = sorted[0] ? `Winner: ${sorted[0].username} 🏆` : 'Game Over';
  }

  io.to(room.id).emit(SOCKET_EVENTS.GAME_OVER, {
    winnerText,
    finalScores: room.players.map(p => ({ username: p.username, score: p.score, team: p.team })),
    teamScores: room.teams
  });

  io.to(room.id).emit(SOCKET_EVENTS.ROOM_DATA, sanitizeRoom(room));
}

module.exports = {
  setupGameLoopHandlers
};
