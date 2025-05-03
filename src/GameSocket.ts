import { io, Socket } from 'socket.io-client';
import * as THREE from 'three';
import { Player } from './Player';
import { Bot } from './Bot';
import { PlayerModel } from './PlayerModel';
import { Bullet } from './Bullet';

// Define interface for player data from server
interface RemotePlayerData {
  id: string;
  position: { x: number, y: number, z: number };
  rotation: { x: number, y: number, z: number };
  isHost: boolean;
  weapon: string;
  isAiming?: boolean;
  isShooting?: boolean;
}

// Define interface for remote players
interface RemotePlayer {
  id: string;
  model: any; // PlayerModel instance
  position: THREE.Vector3;
  rotation: THREE.Euler;
  isHost: boolean;
  weapon: string;
  isAiming: boolean;
  isShooting: boolean;
}

function getGameIdFromUrl(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('join');
}

export class GameSocket {
  private socket: Socket;
  private gameId: string | null = null;
  private player: Player;
  private scene: THREE.Scene;
  private remotePlayers: Map<string, RemotePlayer> = new Map();
  private remoteBots: Map<string, Bot> = new Map();
  private isHost: boolean = false;
  private onWaveUpdate: (wave: number, remaining: number) => void;
  private onGameStarted: () => void = () => {};
  private gameStarted: boolean = false;

  constructor(player: Player, scene: THREE.Scene, onWaveUpdate: (wave: number, remaining: number) => void) {
    this.player = player;
    this.scene = scene;
    this.onWaveUpdate = onWaveUpdate;
    
    // Initialize socket connection
    // In production, use the current hostname, in development use localhost
    const serverUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:3000' 
      : window.location.origin;
    
    console.log(`Connecting to Socket.IO server at ${serverUrl}`);
    this.socket = io(serverUrl);
    
    // Add connection debug logging
    this.socket.on('connect', () => {
      console.log('%c Socket connected with ID: ' + this.socket.id, 'background: #222; color: #bada55');
      
      // Check URL parameters for game ID
      const joinGameId = getGameIdFromUrl();
      if (joinGameId) {
        console.log(`Found game ID in URL: ${joinGameId}, attempting to join...`);
        this.joinGame(joinGameId);
      }
    });
    
    this.socket.on('disconnect', () => {
      console.log('%c Socket disconnected', 'background: #222; color: #ff5555');
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
    
    // Set up socket event listeners
    this.setupSocketListeners();
    this.setupAdditionalSocketListeners();
    
    // Show debug UI
    this.showDebugUI();
  }

  private setupSocketListeners() {
    // Successful game creation
    this.socket.on('game-created', (data: { gameId: string, playerId: string, isHost: boolean }) => {
      this.gameId = data.gameId;
      this.isHost = data.isHost;
      
      console.log(`Game created with ID: ${this.gameId}, isHost: ${this.isHost}`);
      
      // Show game ID on screen for sharing
      this.displayGameLink();
    });

    // Full game state synchronization from server
    this.socket.on('game-state-sync', (data: {
      players: RemotePlayerData[],
      bots: any[],
      wave: number,
      remainingEnemies: number,
      isWaveInProgress: boolean
    }) => {
      console.log("Received full game state sync");
      
      // Update all remote players
      data.players.forEach(playerData => {
        if (playerData.id !== this.socket.id) {
          // If player exists, update them, otherwise add them
          if (this.remotePlayers.has(playerData.id)) {
            this.updateRemotePlayer(playerData);
          } else {
            this.addRemotePlayer(playerData);
          }
        }
      });
      
      // Handle players who left (in data but not in our list)
      this.remotePlayers.forEach((player, id) => {
        const stillExists = data.players.some(p => p.id === id);
        if (!stillExists && id !== this.socket.id) {
          this.removeRemotePlayer(id);
        }
      });
      
      // Sync all bots
      // First, remove any bots that no longer exist in the game state
      this.remoteBots.forEach((bot, id) => {
        const stillExists = data.bots.some(b => b.id === id);
        if (!stillExists) {
          this.removeRemoteBot(id);
        }
      });
      
      // Then add or update bots from the game state
      data.bots.forEach(botData => {
        if (this.remoteBots.has(botData.id)) {
          // Update existing bot
          this.updateRemoteBot(botData);
        } else if (botData.isActive) {
          // Add new bot
          this.addRemoteBot(botData);
        }
      });
      
      // Update wave info
      this.updateWaveInfoDisplay(data.wave, data.remainingEnemies);
      
      // If host, send bot updates back to server
      if (this.isHost) {
        this.sendHostBotUpdates();
      }
    });

    // Join error
    this.socket.on('join-error', (data: { error: string }) => {
      console.error(`Failed to join game: ${data.error}`);
      alert(`Error joining game: ${data.error}. Please check the game ID and try again.`);
      
      // Show available games on console for debugging
      console.log('If you\'re testing locally, try creating a new game instead.');
    });

    // Successful game join
    this.socket.on('game-joined', (data: { 
      gameId: string,
      playerId: string,
      isHost: boolean,
      players: RemotePlayerData[],
      bots: any[],
      wave: number,
      remainingEnemies: number,
      isWaveInProgress: boolean
    }) => {
      this.gameId = data.gameId;
      this.isHost = data.isHost;
      
      console.log(`%c Successfully joined game: ${this.gameId}`, 'background: #222; color: #bada55');
      console.log(`Players in game: ${data.players.length}`);
      data.players.forEach(player => {
        console.log(`- Player ${player.id.substring(0,8)} at position: (${player.position.x.toFixed(2)}, ${player.position.z.toFixed(2)})`);
      });
      
      // Process other players already in the game
      data.players.forEach(playerData => {
        if (playerData.id !== this.socket.id) {
          console.log(`Adding existing player from game: ${playerData.id}`);
          this.addRemotePlayer(playerData);
        }
      });
      
      // Process bots already in the game
      data.bots.forEach(botData => {
        if (botData.isActive) {
          this.addRemoteBot(botData);
        }
      });
      
      // Update wave info
      this.updateWaveInfoDisplay(data.wave, data.remainingEnemies);
      
      // Display join success
      this.displayJoinSuccess();
      
      // Display game link for sharing
      this.displayGameLink();
    });

    // New player joined
    this.socket.on('player-joined', (data: RemotePlayerData) => {
      console.log(`%c New player joined the game: ${data.id.substring(0,8)}`, 'background: #222; color: #00ff00');
      
      // Skip adding yourself as a remote player
      if (data.id === this.socket.id) {
        console.log(`Ignoring player-joined event for self (${data.id.substring(0,8)})`);
        return;
      }
      
      // Check if player already exists in our remote players list
      if (this.remotePlayers.has(data.id)) {
        console.log(`Player ${data.id.substring(0,8)} already exists in our list, updating instead of adding`);
        this.updateRemotePlayer(data);
      } else {
        console.log(`Adding new player ${data.id.substring(0,8)} to the scene`);
        this.addRemotePlayer(data);
      }
    });

    // Player left
    this.socket.on('player-left', (data: { playerId: string }) => {
      this.removeRemotePlayer(data.playerId);
    });

    // Player moved
    this.socket.on('player-moved', (data: RemotePlayerData) => {
      console.log(`%c Received movement for player: ${data.id.substring(0,8)}`, 'color: #00ff00');
      console.log(`Position: (${data.position.x.toFixed(2)}, ${data.position.y.toFixed(2)}, ${data.position.z.toFixed(2)})`);
      this.updateRemotePlayer(data);
    });

    // Player shot
    this.socket.on('player-shot', (data: { 
      playerId: string, 
      position: { x: number, y: number, z: number }, 
      direction: { x: number, y: number, z: number },
      weapon: string
    }) => {
      this.handleRemotePlayerShot(data);
    });

    // Bot spawned
    this.socket.on('bot-spawned', (data: any) => {
      this.addRemoteBot(data);
    });

    // Bot killed
    this.socket.on('bot-killed', (data: { botId: string, remainingEnemies: number }) => {
      this.handleRemoteBotKill(data);
    });

    // Wave complete
    this.socket.on('wave-complete', (data: { wave: number }) => {
      // Update UI to show wave complete
      const waveInfo = document.getElementById('wave-info');
      if (waveInfo) {
        waveInfo.textContent = `WAVE ${data.wave} COMPLETE - NEXT WAVE STARTING...`;
      }
    });

    // Wave update
    this.socket.on('wave-update', (data: { 
      wave: number, 
      remainingEnemies: number,
      isWaveInProgress: boolean
    }) => {
      this.updateWaveInfoDisplay(data.wave, data.remainingEnemies);
      
      console.log(`Received wave update: Wave ${data.wave}, Enemies: ${data.remainingEnemies}`);
      
      // Bot spawning is now handled by the server automatically
      // No need to spawn bots from the client side
    });

    // Host transfered
    this.socket.on('host-transferred', () => {
      this.isHost = true;
      alert('You are now the host of this game!');
    });

    // Game started event (triggered by host clicking the start button)
    this.socket.on('game-started', (data: { 
      wave: number, 
      remainingEnemies: number 
    }) => {
      console.log(`Game started: Wave ${data.wave}, Enemies: ${data.remainingEnemies}`);
      
      // Mark game as started
      this.gameStarted = true;

      // Call the game initialization callback
      this.onGameStarted();
      
      // Update wave info
      this.updateWaveInfoDisplay(data.wave, data.remainingEnemies);
      
      // Show a message indicating the game has started
      const startedMessage = document.createElement('div');
      startedMessage.style.position = 'absolute';
      startedMessage.style.top = '50%';
      startedMessage.style.left = '50%';
      startedMessage.style.transform = 'translate(-50%, -50%)';
      startedMessage.style.padding = '20px 30px';
      startedMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      startedMessage.style.color = '#00ff00';
      startedMessage.style.fontFamily = 'Arial, sans-serif';
      startedMessage.style.fontSize = '32px';
      startedMessage.style.borderRadius = '10px';
      startedMessage.style.textAlign = 'center';
      startedMessage.style.zIndex = '2000';
      startedMessage.textContent = 'WAVE 1 STARTING!';
      
      document.body.appendChild(startedMessage);
      
      // Remove the message after 2 seconds
      setTimeout(() => {
        document.body.removeChild(startedMessage);
      }, 2000);
    });
  }

  // Create a new game
  public createGame() {
    // First check if we should be joining a game instead
    const joinGameId = getGameIdFromUrl();
    if (joinGameId) {
      console.log(`Found game ID in URL: ${joinGameId}, joining instead of creating...`);
      this.joinGame(joinGameId);
      return;
    }
    
    console.log("Creating new game via socket...");
    this.socket.emit('create-game');
    
    // Add a fallback timeout in case the server doesn't respond
    setTimeout(() => {
      if (!this.gameId) {
        console.log("Game ID not received from server after timeout, generating local ID");
        // Generate a local ID if the server doesn't respond
        this.gameId = 'local-' + Math.random().toString(36).substring(2, 10);
        this.isHost = true;
        
        // Still show the game link
        this.displayGameLink();
      }
    }, 2000);
  }

  // Join an existing game with the given ID
  public joinGame(gameId: string) {
    console.log("Joining game with ID:", gameId);
    this.socket.emit('join-game', { gameId });
  }

  // Update player position and rotation
  public updatePlayerPosition(position: THREE.Vector3, rotation: THREE.Euler) {
    if (!this.gameId) return;
    
    // Send position update more frequently with no throttling
    this.socket.volatile.emit('player-update', {
      position: { 
        x: position.x, 
        y: position.y, 
        z: position.z 
      },
      rotation: { 
        x: rotation.x, 
        y: rotation.y, 
        z: rotation.z 
      },
      weapon: this.player.currentWeapon,
      isAiming: this.player.isAiming,
      isShooting: false
    });
  }

  // Player shoots
  public playerShoot(position: THREE.Vector3, direction: THREE.Vector3) {
    if (!this.gameId) return;
    
    this.socket.emit('player-shoot', {
      position: { 
        x: position.x, 
        y: position.y, 
        z: position.z 
      },
      direction: { 
        x: direction.x, 
        y: direction.y, 
        z: direction.z 
      },
      weapon: this.player.currentWeapon,
      checkHits: true // Request server-side hit verification
    });
    
    // Also update player state showing shooting
    this.socket.emit('player-update', {
      position: { 
        x: position.x, 
        y: position.y, 
        z: position.z 
      },
      rotation: { 
        x: this.player.pitch, 
        y: this.player.yaw, 
        z: 0 
      },
      weapon: this.player.currentWeapon,
      isAiming: this.player.isAiming,
      isShooting: true
    });
  }

  // Bot hit notification
  public botHit(botId: string) {
    if (!this.gameId) return;
    
    this.socket.emit('bot-hit', { botId });
  }

  // Host spawns a bot
  public spawnBot(position: THREE.Vector3) {
    if (!this.gameId || !this.isHost) return;
    
    this.socket.emit('spawn-bot', {
      position: { 
        x: position.x, 
        y: position.y, 
        z: position.z 
      }
    });
  }

  // Add a remote player to the scene
  private addRemotePlayer(data: RemotePlayerData) {
    // Create a new PlayerModel for the remote player
    const model = new PlayerModel(true);
    
    // Position the model
    const position = new THREE.Vector3(
      data.position.x,
      data.position.y,
      data.position.z
    );
    model.body.position.copy(position);
    
    // Set rotation
    model.body.rotation.set(
      data.rotation.x,
      data.rotation.y,
      data.rotation.z
    );
    
    // Add player name label
    this.addPlayerLabel(model.body, data.id);
    
    // Add to scene
    this.scene.add(model.body);
    
    // Store in remote players map
    this.remotePlayers.set(data.id, {
      id: data.id,
      model: model,
      position: position,
      rotation: new THREE.Euler(
        data.rotation.x,
        data.rotation.y,
        data.rotation.z
      ),
      isHost: data.isHost,
      weapon: data.weapon || 'assaultRifle',
      isAiming: data.isAiming || false,
      isShooting: data.isShooting || false
    });
    
    console.log(`Added remote player: ${data.id}`);
  }

  // Add player name label above the player model
  private addPlayerLabel(playerBody: THREE.Group, playerId: string) {
    // Create a canvas for the player label
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    
    canvas.width = 256;
    canvas.height = 64;
    
    context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Generate a consistent player name based on the ID to avoid exposing socket IDs
    // and ensure the same player always gets the same name
    const playerNames = [
      'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo',
      'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet'
    ];
    
    // Use the first few characters of the ID to determine a consistent player name
    const nameIndex = Math.abs(playerId.charCodeAt(0) + 
                              (playerId.charCodeAt(1) || 0) + 
                              (playerId.charCodeAt(2) || 0)) % playerNames.length;
    
    const playerName = playerId === this.socket.id ? 'You' : playerNames[nameIndex];
    
    context.font = '24px Arial';
    context.fillStyle = playerId === this.socket.id ? '#00ff00' : 'white'; // Green for self
    context.textAlign = 'center';
    context.fillText(playerName, canvas.width / 2, canvas.height / 2 + 8);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    
    // Create sprite material
    const material = new THREE.SpriteMaterial({ 
      map: texture,
      depthTest: false
    });
    
    // Create sprite
    const sprite = new THREE.Sprite(material);
    sprite.position.set(0, 3, 0); // Position above player head
    sprite.scale.set(4, 1, 1);
    
    // Add to player body
    playerBody.add(sprite);
  }

  // Remove a remote player from the scene
  private removeRemotePlayer(playerId: string) {
    const player = this.remotePlayers.get(playerId);
    if (player) {
      // Remove from scene
      this.scene.remove(player.model.body);
      
      // Remove from map
      this.remotePlayers.delete(playerId);
      
      console.log(`Removed remote player: ${playerId}`);
    }
  }

  // Update a remote player's position and rotation
  private updateRemotePlayer(data: RemotePlayerData) {
    console.log(`Updating remote player: ${data.id}, position:`, data.position);
    const player = this.remotePlayers.get(data.id);
    if (player) {
      // Create target position for smoother movement
      const targetPosition = new THREE.Vector3(
        data.position.x,
        data.position.y,
        data.position.z
      );
      
      // Lerp current position toward target for smoother movement
      player.position.lerp(targetPosition, 0.3);
      player.model.body.position.copy(player.position);
      
      // Smooth rotation interpolation
      const targetRotationY = data.rotation.y;
      // Interpolate rotation for smoothness
      player.model.body.rotation.y = THREE.MathUtils.lerp(
        player.model.body.rotation.y,
        targetRotationY,
        0.3
      );
      
      // Update rotation
      player.rotation.set(
        data.rotation.x,
        data.rotation.y,
        data.rotation.z
      );
      
      // Update weapon if changed
      if (data.weapon && data.weapon !== player.weapon) {
        player.weapon = data.weapon;
        player.model.switchWeapon(null, data.weapon);
      }
      
      // Update animation state based on movement
      player.model.update(true, 0.08);
      
      // Update aiming state
      if (data.isAiming !== undefined) {
        player.isAiming = data.isAiming;
      }
      
      // Handle shooting animation if needed
      if (data.isShooting) {
        player.model.triggerShootAnimation(null);
      }
    } else {
      console.warn(`Received update for unknown player: ${data.id}`);
      // If we get an update for a player we don't know about, add them
      this.addRemotePlayer(data);
    }
  }

  // Handle remote player shooting
  private handleRemotePlayerShot(data: { 
    playerId: string, 
    position: { x: number, y: number, z: number }, 
    direction: { x: number, y: number, z: number },
    weapon: string
  }) {
    // Create a bullet from the shooting player's position
    const position = new THREE.Vector3(
      data.position.x,
      data.position.y,
      data.position.z
    );
    
    const direction = new THREE.Vector3(
      data.direction.x,
      data.direction.y,
      data.direction.z
    );
    
    // Create bullet
    const bullet = new Bullet(position, direction, this.scene);
    
    // Set different bullet properties based on weapon
    if (data.weapon === 'sniperRifle') {
      // Sniper bullets are faster and have longer trails
      bullet.velocity.multiplyScalar(1.5); // 50% faster
      bullet.maxTrailLength = 30; // Longer trail
    }
    
    // Add to player's bullets array
    this.player.bullets.push(bullet);
  }

  // Add a remote bot to the scene
  private addRemoteBot(data: any) {
    // Create a new Bot instance
    const spawnPosition = new THREE.Vector3(
      data.position.x,
      data.position.y,
      data.position.z
    );
    
    // Create a bot targeting the player position
    const bot = new Bot(this.scene, spawnPosition, this.player.playerBody.position);
    
    // Set custom ID for networking
    bot.id = data.id;
    
    // Store in remote bots map
    this.remoteBots.set(data.id, bot);
  }

  // Handle a remote bot being killed
  private handleRemoteBotKill(data: { botId: string, remainingEnemies: number }) {
    const bot = this.remoteBots.get(data.botId);
    if (bot) {
      // Mark bot as inactive
      bot.hit();
      
      // Update wave info
      this.updateWaveInfoDisplay(0, data.remainingEnemies); // 0 to maintain current wave
    }
  }

  // Display game link for sharing
  private displayGameLink() {
    console.log("displayGameLink called, gameId =", this.gameId);
    
    // Ensure we have a game ID
    if (!this.gameId) {
      console.log("No game ID available, generating one for display");
      this.gameId = 'display-' + Math.random().toString(36).substring(2, 10);
    }
    
    // Create link container if it doesn't exist
    let linkContainer = document.getElementById('game-link-container');
    if (!linkContainer) {
      linkContainer = document.createElement('div');
      linkContainer.id = 'game-link-container';
      linkContainer.style.position = 'absolute';
      linkContainer.style.bottom = '20px';  // Moved to bottom left
      linkContainer.style.left = '20px';    // Moved to bottom left
      linkContainer.style.padding = '15px 20px';
      linkContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      linkContainer.style.borderRadius = '8px';
      linkContainer.style.color = 'white';
      linkContainer.style.fontFamily = 'Arial, sans-serif';
      linkContainer.style.fontSize = '16px';
      linkContainer.style.zIndex = '1000';
      linkContainer.style.boxShadow = '0 0 10px rgba(0,255,0,0.5)'; // Add glow effect
      document.body.appendChild(linkContainer);
    }
    
    // Create the share link - ensure we're using the absolute URL with the game ID parameter
    const currentUrl = window.location.href.split('?')[0]; // Remove any existing parameters
    const gameLink = `${currentUrl}?join=${this.gameId}`;
    
    console.log("Game link created:", gameLink);
    
    // Set container content with a more prominent copy button
    linkContainer.innerHTML = `
      <div style="margin-bottom: 8px; font-weight: bold; font-size: 18px; color: #00ff00;">Multiplayer Game</div>
      <div style="margin-bottom: 8px;">Game ID: <span style="color: #00ff00; font-weight: bold;">${this.gameId}</span></div>
      <div style="margin-bottom: 12px;">Share this link to play together:</div>
      <input type="text" value="${gameLink}" style="width: 100%; padding: 8px; margin-bottom: 10px; background: #333; color: #fff; border: 1px solid #00ff00;" readonly onclick="this.select()">
      <button id="copy-game-link" style="padding: 10px; width: 100%; background: #00ff00; color: #000; border: none; font-weight: bold; cursor: pointer; border-radius: 4px;">COPY LINK</button>
    `;
    
    // Add copy button functionality
    setTimeout(() => {
      const copyButton = document.getElementById('copy-game-link');
      if (copyButton) {
        copyButton.addEventListener('click', () => {
          navigator.clipboard.writeText(gameLink)
            .then(() => {
              copyButton.textContent = 'COPIED!';
              setTimeout(() => {
                copyButton.textContent = 'COPY LINK';
              }, 2000);
            })
            .catch(err => {
              console.error('Failed to copy link:', err);
            });
        });
      }
    }, 100);
    
    console.log("Game link container updated with ID:", this.gameId);
  }

  // Display join success message
  private displayJoinSuccess() {
    // Create message element
    const message = document.createElement('div');
    message.style.position = 'absolute';
    message.style.top = '50%';
    message.style.left = '50%';
    message.style.transform = 'translate(-50%, -50%)';
    message.style.padding = '20px';
    message.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    message.style.color = 'white';
    message.style.borderRadius = '10px';
    message.style.fontFamily = 'Arial, sans-serif';
    message.style.fontSize = '24px';
    message.style.zIndex = '2000';
    message.style.textAlign = 'center';
    message.innerText = 'Successfully joined game!';
    
    // Add to body
    document.body.appendChild(message);
    
    // Remove after 2 seconds
    setTimeout(() => {
      document.body.removeChild(message);
    }, 2000);
  }

  // Get game ID with fallback
  public getGameId(): string {
    // If for some reason gameId is null, generate one on the spot
    if (!this.gameId) {
      console.log("Game ID was null in getGameId(), generating fallback ID");
      this.gameId = 'fallback-' + Math.random().toString(36).substring(2, 10);
    }
    
    console.log("Returning game ID:", this.gameId);
    return this.gameId;
  }

  // Check if player is host
  public getIsHost(): boolean {
    return this.isHost;
  }

  // Update remote players and bots
  public update(deltaTime: number) {
    // Update remote players animations and positions
    this.remotePlayers.forEach(player => {
      player.model.update(true, 0.08);
    });
    
    // Send player position update every frame
    if (this.player && this.player.playerBody) {
      this.updatePlayerPosition(
        this.player.playerBody.position,
        new THREE.Euler(this.player.pitch, this.player.yaw, 0)
      );
    }
    
    // Only host sends bot updates to server
    if (this.isHost) {
      // Instead of locally updating bots, tell server to handle it
      this.sendHostBotUpdates();
    }
    
    // Local visual updates for all bots (but no position changes!)
    this.remoteBots.forEach(bot => {
      if (bot.isActive) {
        // Only update animations, not positions, since server controls movement
        bot.updateAnimation();
      }
    });
  }

  // New helper to remove a bot from the game
  private removeRemoteBot(botId: string) {
    const bot = this.remoteBots.get(botId);
    if (bot) {
      // Remove from scene
      this.scene.remove(bot.body);
      
      // Remove from map
      this.remoteBots.delete(botId);
      
      console.log(`Removed remote bot: ${botId}`);
    }
  }
  
  // New helper to update an existing bot's position
  private updateRemoteBot(data: any) {
    const bot = this.remoteBots.get(data.id);
    if (bot && data.position) {
      console.log(`Updating bot ${data.id.substring(0,6)} position from server`);
      
      // Always trust the server position - copy it exactly
      bot.position.set(
        data.position.x,
        data.position.y,
        data.position.z
      );
      bot.body.position.copy(bot.position);
      
      // Update hitbox position
      bot.hitbox.center.copy(bot.position);
      
      // Update active state
      if (bot.isActive !== data.isActive) {
        bot.isActive = data.isActive;
        if (!bot.isActive) {
          bot.body.visible = false;
        }
      }
    }
  }
  
  // Send bot updates from host to server
  private sendHostBotUpdates() {
    if (this.isHost && this.gameId) {
      this.socket.emit('host-update-bots');
    }
  }

  // New event handler for bot reaching player
  setupAdditionalSocketListeners() {
    // Bot reached player
    this.socket.on('bot-reached-player', (data: {
      botId: string,
      playerId: string,
      remainingEnemies: number
    }) => {
      console.log(`Bot ${data.botId} reached player ${data.playerId}`);
      
      const bot = this.remoteBots.get(data.botId);
      if (bot) {
        bot.hit();
      }
      
      this.updateWaveInfoDisplay(0, data.remainingEnemies);
      
      // Show visual feedback if it's the local player
      if (data.playerId === this.socket.id) {
        // Flash screen red or show damage effect
        this.showDamageEffect();
      }
    });
  }
  
  // Show damage effect when hit by a bot
  private showDamageEffect() {
    // Create damage overlay if it doesn't exist
    let damageOverlay = document.getElementById('damage-overlay');
    if (!damageOverlay) {
      damageOverlay = document.createElement('div');
      damageOverlay.id = 'damage-overlay';
      damageOverlay.style.position = 'fixed';
      damageOverlay.style.top = '0';
      damageOverlay.style.left = '0';
      damageOverlay.style.width = '100%';
      damageOverlay.style.height = '100%';
      damageOverlay.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
      damageOverlay.style.pointerEvents = 'none';
      damageOverlay.style.zIndex = '1000';
      damageOverlay.style.opacity = '0';
      damageOverlay.style.transition = 'opacity 0.1s ease-in-out';
      document.body.appendChild(damageOverlay);
    }
    
    // Show and fade out
    damageOverlay.style.opacity = '1';
    setTimeout(() => {
      damageOverlay.style.opacity = '0';
    }, 300);
  }

  // Add this method to the GameSocket class
  private showDebugUI() {
    // Create debug container if it doesn't exist
    let debugContainer = document.getElementById('multiplayer-debug');
    if (!debugContainer) {
      debugContainer = document.createElement('div');
      debugContainer.id = 'multiplayer-debug';
      debugContainer.style.position = 'absolute';
      debugContainer.style.bottom = '20px';
      debugContainer.style.left = '20px';
      debugContainer.style.padding = '10px';
      debugContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      debugContainer.style.borderRadius = '5px';
      debugContainer.style.color = 'white';
      debugContainer.style.fontFamily = 'monospace';
      debugContainer.style.fontSize = '12px';
      debugContainer.style.zIndex = '1000';
      debugContainer.style.maxWidth = '300px';
      debugContainer.style.maxHeight = '200px';
      debugContainer.style.overflow = 'auto';
      document.body.appendChild(debugContainer);
    }
    
    // Update the debug info
    setInterval(() => {
      if (!debugContainer) return;
      
      // Helper function to get player name from ID
      const getPlayerName = (id: string) => {
        const playerNames = [
          'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo',
          'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet'
        ];
        
        if (id === this.socket.id) return 'You';
        
        const nameIndex = Math.abs(id.charCodeAt(0) + 
                                 (id.charCodeAt(1) || 0) + 
                                 (id.charCodeAt(2) || 0)) % playerNames.length;
        return playerNames[nameIndex];
      };
      
      let playerList = '';
      this.remotePlayers.forEach((player, id) => {
        const playerName = getPlayerName(id);
        const pos = player.position;
        playerList += `<div>${playerName}: (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})</div>`;
      });
      
      let botCount = 0;
      this.remoteBots.forEach(bot => {
        if (bot.isActive) botCount++;
      });
      
      const connectionStatus = this.socket.connected ? 
        '<span style="color: #00ff00;">CONNECTED</span>' : 
        '<span style="color: #ff0000;">DISCONNECTED</span>';
      
      debugContainer.innerHTML = `
        <div style="margin-bottom: 5px; color: #00ff00;"><strong>MULTIPLAYER DEBUG:</strong></div>
        <div>Game ID: ${this.gameId || 'N/A'}</div>
        <div>Status: ${connectionStatus}</div>
        <div>Is Host: ${this.isHost ? 'YES' : 'NO'}</div>
        <div>Remote Players: ${this.remotePlayers.size}</div>
        <div>Active Bots: ${botCount}</div>
        <div style="margin-top: 5px; border-top: 1px solid #666; padding-top: 5px;">
          <strong>PLAYER LIST:</strong>
          ${playerList || '<div>No remote players</div>'}
        </div>
      `;
    }, 500); // Update every 500ms
  }

  // Host starts the game (triggered by the start button)
  public startGame() {
    if (!this.gameId || !this.isHost) return;
    
    console.log(`Host is starting the game: ${this.gameId}`);
    this.socket.emit('start-game');
  }

  // Method to set the game started callback
  public setGameStartedCallback(callback: () => void) {
    this.onGameStarted = callback;
  }

  // Update wave info method
  private updateWaveInfoDisplay(wave: number, remaining: number) {
    // Update the callback
    this.onWaveUpdate(wave, remaining);

    // Also update UI directly if needed
    const waveInfo = document.getElementById('wave-info');
    if (waveInfo) {
      // Hide wave info if game hasn't started
      if (!this.gameStarted) {
        waveInfo.style.display = 'none';
        return;
      } else {
        waveInfo.style.display = 'block';
        waveInfo.textContent = `WAVE ${wave} - ENEMIES REMAINING: ${remaining}`;
      }
    }
  }
} 