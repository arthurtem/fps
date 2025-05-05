const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the dist directory (after build)
app.use(express.static(path.join(__dirname, '../dist')));

// Game state
const games = {}; // { gameId: { host: socketId, players: [{ id, position, rotation, ... }], bots: [] } }
const playerSockets = {}; // { socketId: gameId }

// Interval to broadcast full game state to all players in a game
const SYNC_INTERVAL = 20; // milliseconds (reduced from 50ms for smoother updates)
const syncIntervals = {}; // Store intervals by game ID

// Function to start sync interval for a game
function startSyncInterval(gameId) {
  if (syncIntervals[gameId]) {
    clearInterval(syncIntervals[gameId]);
  }
  
  syncIntervals[gameId] = setInterval(() => {
    const game = games[gameId];
    if (!game || game.players.length === 0) {
      clearInterval(syncIntervals[gameId]);
      delete syncIntervals[gameId];
      return;
    }
    
    // Send full game state to all players
    io.to(gameId).emit('game-state-sync', {
      players: game.players,
      bots: game.bots,
      wave: game.wave,
      remainingEnemies: game.remainingEnemies,
      isWaveInProgress: game.isWaveInProgress
    });
  }, SYNC_INTERVAL);
  
  console.log(`Started sync interval for game: ${gameId} with tick rate: ${1000/SYNC_INTERVAL}Hz`);
}

// Function to update bot positions server-side (called only by host)
function updateBots(gameId) {
  const game = games[gameId];
  if (!game) return;
  
  // Skip bot movement updates if the game is paused
  if (game.gamePaused) return;
  
  const currentTime = Date.now();
  const timeDelta = (currentTime - (game.lastBotUpdate || currentTime)) / 1000; // Convert to seconds
  game.lastBotUpdate = currentTime;
  
  // Use a fixed time step for more consistent movement
  const moveSpeed = 3.0; // Units per second
  
  // Loop through active bots and update their positions based on target
  game.bots.forEach(bot => {
    if (!bot.isActive) return;
    
    // Find the closest player to target
    let closestPlayer = null;
    let closestDistance = Infinity;
    
    game.players.forEach(player => {
      const distance = calculateDistance(bot.position, player.position);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPlayer = player;
      }
    });
    
    if (closestPlayer) {
      // Move bot toward closest player
      const direction = calculateDirection(bot.position, closestPlayer.position);
      
      // Consistent movement speed using time delta
      bot.position.x += direction.x * moveSpeed * timeDelta;
      bot.position.z += direction.z * moveSpeed * timeDelta;
      
      // Check if bot reached player
      if (closestDistance < 5) {
        console.log(`Bot reached player: ${closestPlayer.id}`);
        // Mark bot as inactive and notify all players
        bot.isActive = false;
        game.remainingEnemies--;
        
        io.to(gameId).emit('bot-reached-player', {
          botId: bot.id,
          playerId: closestPlayer.id,
          remainingEnemies: game.remainingEnemies
        });
        
        // Check if wave is complete
        checkWaveCompletion(gameId);
      }
    }
  });
}

// Helper function to calculate distance between two positions
function calculateDistance(pos1, pos2) {
  const dx = pos1.x - pos2.x;
  const dz = pos1.z - pos2.z;
  return Math.sqrt(dx * dx + dz * dz);
}

// Helper function to calculate direction vector
function calculateDirection(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.sqrt(dx * dx + dz * dz);
  
  if (length === 0) return { x: 0, z: 0 };
  
  return {
    x: dx / length,
    z: dz / length
  };
}

// Update bot spawning logic to ensure they only spawn within the course boundaries
function spawnBotWithinCourse(gameId, waveNum, index) {
  if (!games[gameId]) return; // Game might have ended
  
  // Define course boundaries - ensure these match the terrain dimensions in World.ts
  const courseWidth = 20; // Width of the terrain from World.ts
  const safeMargin = 2; // Stay away from walls to prevent clipping
  
  // Calculate random position that's definitely within the course boundaries
  const spawnX = (Math.random() - 0.5) * (courseWidth - safeMargin * 2); // Stay within borders
  
  // Z position - spawn from halfway to the end of the course, to ensure bots are visible
  // Keep them away from the end wall too
  const minZ = -110; // Start spawning from this position (further away)
  const maxZ = -60; // Don't spawn closer than this to the player
  const spawnZ = minZ + Math.random() * (maxZ - minZ); // Correct calculation to spawn between minZ and maxZ
  
  const bot = {
    id: `bot-wave${waveNum}-${index}`,
    position: {
      x: spawnX,
      y: 0,
      z: spawnZ
    },
    isActive: true,
    spawnTime: Date.now()
  };
  
  games[gameId].bots.push(bot);
  
  // Notify all players about new bot
  io.to(gameId).emit('bot-spawned', bot);
  
  console.log(`Spawned bot ${bot.id} for wave ${waveNum} in game ${gameId} at (${spawnX.toFixed(1)}, ${spawnZ.toFixed(1)})`);
}

// Update the startNewWave function to use our new bot spawning function
function startNewWave(gameId) {
  if (!games[gameId]) return;
  
  // Only start waves if the game has been started
  if (!games[gameId].gameStarted) {
    console.log(`Cannot start wave for game ${gameId} - game not started yet`);
    return;
  }
  
  // Increment wave number
  games[gameId].wave++;
  const waveNum = games[gameId].wave;
  
  // Calculate enemy count (base + wave number)
  const enemyCount = 3 + (waveNum - 1);
  games[gameId].remainingEnemies = enemyCount;
  games[gameId].isWaveInProgress = true;
  
  // Clear previous bots
  games[gameId].bots = [];
  
  console.log(`Starting wave ${waveNum} for game ${gameId} with ${enemyCount} enemies`);
  
  // Notify all players about new wave
  io.to(gameId).emit('wave-update', {
    wave: waveNum,
    remainingEnemies: enemyCount,
    isWaveInProgress: true
  });
  
  // Spawn bots for this wave with server-controlled positions
  const spawnDelay = 500; // ms between bot spawns
  
  for (let i = 0; i < enemyCount; i++) {
    setTimeout(() => {
      spawnBotWithinCourse(gameId, waveNum, i);
    }, i * spawnDelay);
  }
}

// Check if wave is complete and start new wave if needed
function checkWaveCompletion(gameId) {
  const game = games[gameId];
  if (!game) return;
  
  // Don't start new waves if the game is paused
  if (game.gamePaused) return;
  
  if (game.remainingEnemies <= 0 && game.isWaveInProgress) {
    game.isWaveInProgress = false;
    
    // Notify all players about wave complete
    io.to(gameId).emit('wave-complete', {
      wave: game.wave
    });
    
    // Start new wave after delay
    setTimeout(() => {
      if (games[gameId] && !games[gameId].gamePaused) {
        startNewWave(gameId);
      }
    }, 3000);
  }
}

// Handle socket connections
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Create a new game
  socket.on('create-game', () => {
    const gameId = uuidv4().substring(0, 8); // Generate a shorter game ID
    
    games[gameId] = {
      host: socket.id,
      players: [{
        id: socket.id,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        isHost: true,
        weapon: 'assaultRifle',
        health: 100
      }],
      bots: [],
      wave: 1,
      remainingEnemies: 3, // Base enemy count for wave 1
      isWaveInProgress: false, // Initially set to false until game is started
      lastUpdate: Date.now(), // Track last update time
      gameStarted: false, // Track if game has been started
      gamePaused: false // Track game pause state
    };
    
    playerSockets[socket.id] = gameId;
    
    // Join the socket room
    socket.join(gameId);
    
    // Start sync interval for this game
    startSyncInterval(gameId);
    
    // Send game ID to host
    socket.emit('game-created', { 
      gameId,
      playerId: socket.id,
      isHost: true
    });
    
    console.log(`Game created: ${gameId} by host: ${socket.id}`);
  });

  // Toggle pause state (only host can control this)
  socket.on('toggle-pause', () => {
    const gameId = playerSockets[socket.id];
    if (!gameId || !games[gameId] || games[gameId].host !== socket.id) return;
    
    // Toggle pause state
    games[gameId].gamePaused = !games[gameId].gamePaused;
    
    console.log(`Game ${gameId} ${games[gameId].gamePaused ? 'paused' : 'resumed'} by host ${socket.id}`);
    
    // Notify all players about pause state change
    io.to(gameId).emit('game-pause-state', {
      isPaused: games[gameId].gamePaused
    });
  });

  // Host updates bot positions directly (for more consistent behavior)
  socket.on('host-update-bots', () => {
    const gameId = playerSockets[socket.id];
    if (!gameId || !games[gameId] || games[gameId].host !== socket.id) return;
    
    // Update bots server-side
    updateBots(gameId);
  });

  // Player shoots
  socket.on('player-shoot', (data) => {
    const gameId = playerSockets[socket.id];
    if (!gameId || !games[gameId]) return;
    
    // Broadcast to all players in the same game
    socket.to(gameId).emit('player-shot', {
      playerId: socket.id,
      position: data.position,
      direction: data.direction,
      weapon: data.weapon
    });
    
    // Check bullet hits against bots (server-side verification)
    if (data.checkHits && games[gameId]) {
      const game = games[gameId];
      
      // Simple ray-based hit detection
      game.bots.forEach(bot => {
        if (!bot.isActive) return;
        
        // Calculate if bullet path intersects with bot
        // This is a simplified version - you might want to implement more sophisticated collision detection
        const hitResult = checkBulletHit(
          data.position, 
          data.direction, 
          bot.position,
          1.0 // Bot hit radius
        );
        
        if (hitResult) {
          // Bot was hit - mark as inactive
          bot.isActive = false;
          game.remainingEnemies--;
          
          // Notify all players about bot hit
          io.to(gameId).emit('bot-killed', {
            botId: bot.id,
            remainingEnemies: game.remainingEnemies,
            shooterId: socket.id
          });
          
          // Check if wave is complete
          checkWaveCompletion(gameId);
        }
      });
    }
  });

  // Simple function to check if a bullet hits a bot
  function checkBulletHit(bulletPos, bulletDir, botPos, botRadius) {
    // Convert to proper format for calculations
    const bulletPosition = { x: bulletPos.x, y: bulletPos.y, z: bulletPos.z };
    const bulletDirection = { x: bulletDir.x, y: bulletDir.y, z: bulletDir.z };
    
    // Calculate vector from bullet to bot
    const dx = botPos.x - bulletPosition.x;
    const dy = botPos.y - bulletPosition.y;
    const dz = botPos.z - bulletPosition.z;
    
    // Project this vector onto the bullet direction
    const dirLength = Math.sqrt(
      bulletDirection.x * bulletDirection.x +
      bulletDirection.y * bulletDirection.y +
      bulletDirection.z * bulletDirection.z
    );
    
    // Normalize bullet direction
    const normDir = {
      x: bulletDirection.x / dirLength,
      y: bulletDirection.y / dirLength,
      z: bulletDirection.z / dirLength
    };
    
    // Calculate dot product (projection length)
    const dotProduct = dx * normDir.x + dy * normDir.y + dz * normDir.z;
    
    // Calculate closest point on ray to bot center
    const closestPoint = {
      x: bulletPosition.x + normDir.x * dotProduct,
      y: bulletPosition.y + normDir.y * dotProduct,
      z: bulletPosition.z + normDir.z * dotProduct
    };
    
    // Calculate distance from closest point to bot center
    const distanceSquared = 
      Math.pow(closestPoint.x - botPos.x, 2) +
      Math.pow(closestPoint.y - botPos.y, 2) +
      Math.pow(closestPoint.z - botPos.z, 2);
    
    // Check if this distance is less than bot radius
    return distanceSquared <= (botRadius * botRadius);
  }

  // Join an existing game
  socket.on('join-game', ({ gameId }) => {
    console.log(`Player ${socket.id} attempting to join game: ${gameId}`);
    const game = games[gameId];
    
    if (!game) {
      console.log(`Game ${gameId} not found. Available games: ${Object.keys(games).join(', ')}`);
      socket.emit('join-error', { error: 'Game not found' });
      return;
    }
    
    console.log(`Game ${gameId} found with ${game.players.length} players.`);
    
    // Check if player is already in this game (prevent duplicates)
    const existingPlayerIndex = game.players.findIndex(p => p.id === socket.id);
    if (existingPlayerIndex >= 0) {
      console.log(`Player ${socket.id} is already in game ${gameId}, skipping add`);
    } else {
      // Add player to the game
      game.players.push({
        id: socket.id,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        isHost: false,
        weapon: 'assaultRifle',
        health: 100
      });
      
      console.log(`Player ${socket.id} added to game ${gameId}`);
    }
    
    playerSockets[socket.id] = gameId;
    
    // Join the socket room for this game - move this up before notifications
    socket.join(gameId);
    console.log(`Player ${socket.id} joined socket room: ${gameId}`);
    
    // Log room members for verification
    const roomSockets = io.sockets.adapter.rooms.get(gameId);
    console.log(`Room ${gameId} now has ${roomSockets ? roomSockets.size : 0} sockets.`);
    if (roomSockets) {
      console.log(`Room members: ${Array.from(roomSockets).join(', ')}`);
    }
    
    // Notify the joining player
    socket.emit('game-joined', {
      gameId,
      playerId: socket.id,
      isHost: game.host === socket.id,
      players: game.players,
      bots: game.bots,
      wave: game.wave,
      remainingEnemies: game.remainingEnemies,
      isWaveInProgress: game.isWaveInProgress
    });
    
    // Only notify other players if this is a new player
    if (existingPlayerIndex === -1) {
      // Notify OTHER players about the new player (not everyone including the new player)
      socket.to(gameId).emit('player-joined', {
        playerId: socket.id,
        id: socket.id, // Send both for compatibility
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 }
      });
    }
    
    console.log(`Player ${socket.id} joined game: ${gameId}`);
  });

  // Player updates their position and rotation
  socket.on('player-update', (data) => {
    const gameId = playerSockets[socket.id];
    if (!gameId || !games[gameId]) return;
    
    // Find and update player data
    const player = games[gameId].players.find(p => p.id === socket.id);
    if (player) {
      player.position = data.position;
      player.rotation = data.rotation;
      player.weapon = data.weapon;
      player.isAiming = data.isAiming;
      player.isShooting = data.isShooting;
      
      // Use socket.volatile for performance with frequent updates
      // This will drop packets if network is congested but maintain real-time flow
      socket.to(gameId).volatile.emit('player-moved', {
        playerId: socket.id,
        position: data.position,
        rotation: data.rotation,
        weapon: data.weapon,
        isAiming: data.isAiming,
        isShooting: data.isShooting
      });
    }
  });

  // Bot hit
  socket.on('bot-hit', (data) => {
    const gameId = playerSockets[socket.id];
    if (!gameId || !games[gameId]) return;
    
    // Update bot state 
    const botIndex = games[gameId].bots.findIndex(bot => bot.id === data.botId);
    if (botIndex !== -1) {
      games[gameId].bots[botIndex].isActive = false;
      games[gameId].remainingEnemies--;
      
      // Check if wave is complete
      if (games[gameId].remainingEnemies <= 0) {
        games[gameId].isWaveInProgress = false;
        
        // Start new wave after delay
        setTimeout(() => {
          if (games[gameId]) {
            startNewWave(gameId);
          }
        }, 3000);
        
        // Notify all players about wave complete
        io.to(gameId).emit('wave-complete', {
          wave: games[gameId].wave
        });
      } else {
        // Notify all players about bot hit
        io.to(gameId).emit('bot-killed', {
          botId: data.botId,
          remainingEnemies: games[gameId].remainingEnemies
        });
      }
    }
  });

  // Host spawns a bot
  socket.on('spawn-bot', (data) => {
    const gameId = playerSockets[socket.id];
    if (!gameId || !games[gameId] || games[gameId].host !== socket.id) return;
    
    const botId = `bot-${uuidv4().substring(0, 8)}`;
    const bot = {
      id: botId,
      position: data.position,
      isActive: true,
      spawnTime: Date.now()
    };
    
    games[gameId].bots.push(bot);
    
    console.log(`Bot spawned in game ${gameId}: ${botId} at position:`, data.position);
    
    // Notify all players about new bot
    io.to(gameId).emit('bot-spawned', bot);
  });

  // Handle game start event from host
  socket.on('start-game', () => {
    const gameId = playerSockets[socket.id];
    if (!gameId || !games[gameId] || games[gameId].host !== socket.id) return;
    
    console.log(`Game ${gameId} started by host ${socket.id}`);
    
    // Mark the game as started
    games[gameId].gameStarted = true;
    games[gameId].isWaveInProgress = true;
    
    // Notify all players that the game has started
    io.to(gameId).emit('game-started', {
      wave: games[gameId].wave,
      remainingEnemies: games[gameId].remainingEnemies
    });
    
    // Start the first wave
    startNewWave(gameId);
  });

  // Player disconnects
  socket.on('disconnect', () => {
    const gameId = playerSockets[socket.id];
    
    if (gameId && games[gameId]) {
      // Remove player from the game
      games[gameId].players = games[gameId].players.filter(player => player.id !== socket.id);
      
      // If host left, either transfer host or delete the game
      if (games[gameId].host === socket.id) {
        if (games[gameId].players.length > 0) {
          // Transfer host to another player
          const newHost = games[gameId].players[0];
          games[gameId].host = newHost.id;
          newHost.isHost = true;
          
          // Notify new host
          io.to(newHost.id).emit('host-transferred');
        } else {
          // Delete the game if no players left
          delete games[gameId];
          console.log(`Game deleted: ${gameId}`);
          return;
        }
      }
      
      // Notify remaining players
      io.to(gameId).emit('player-left', { playerId: socket.id });
      
      console.log(`Player ${socket.id} left game: ${gameId}`);
    }
    
    // Remove from player sockets
    delete playerSockets[socket.id];
    
    console.log(`Player disconnected: ${socket.id}`);
  });
});

// Catch-all route to serve the main app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
