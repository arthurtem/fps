import * as THREE from 'three';
import { Player } from './Player';
import { World } from './World';
import { PlayerModel } from './PlayerModel';
import { Bot } from './Bot';
import { GameSocket } from './GameSocket';

// Create scene
const scene = new THREE.Scene();

// Setup renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Add a time counter variable for button animation
let animationTime = 0;

// Add a reference to the start button
let startButton: THREE.Mesh | null = null;

// Wave system variables
let currentWave = 1;
let baseEnemyCount = 3; // Start with 3 enemies in wave 1
let remainingEnemies = baseEnemyCount;
let isWaveInProgress = true;
let waveCompleteTimer = 0;
const waveCompleteDelay = 120; // 2 seconds at 60fps before next wave

// Create bots that run toward the player
const bots: Bot[] = [];
const botSpawnDistance = 80; // Distance from player to spawn bots

// Add a game state variable to track if the game has started
let gameStarted = false;

// Add a variable to track game initialization state separately from wave progress
let gameInitialized = false;

// Track whether the game is paused
let gamePaused = false;

// Reference to the restart button
let restartButton: THREE.Mesh | null = null;

// Function to find the start and restart buttons in the scene
function findButtons() {
  // Reset references
  startButton = null;
  restartButton = null;
  
  // Look through all objects in the scene
  scene.traverse((object) => {
    if (object.userData && object.userData.isStartButton) {
      startButton = object as THREE.Mesh;
      console.log("Found start button for animation");
    }
    
    if (object.userData && object.userData.isRestartButton) {
      restartButton = object as THREE.Mesh;
      console.log("Found restart button");
    }
  });
}

// Create world (ground and sky) first
const world = new World(scene);

// Create player after world is created so we can pass the world reference
const player = new Player(scene, world);
scene.add(player.playerBody);

// Now find the buttons after scene is set up
findButtons();

// Add window resize handler - moved after player initialization
window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  player.camera.aspect = width / height;
  player.camera.updateProjectionMatrix();
  
  // Update crosshair position when window resizes
  updateCrosshairPosition();
  
  // Update weapon display position
  updateWeaponDisplayPosition();
  
  // Update wave info position
  updateWaveInfoPosition();
});

// Initialize game socket for multiplayer
let gameSocket: GameSocket | null = null;

// Add lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

// Setup shadow map properties for better quality
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.bias = -0.0005;

// Add crosshair to the center of the screen
const crosshair = document.createElement('div');
crosshair.id = 'crosshair';
document.body.appendChild(crosshair);

// Style the crosshair
const crosshairSize = 20; // Size in pixels
const lineThickness = 2; // Thickness in pixels
const crosshairColor = 'rgba(255, 255, 255, 0.8)'; // Semi-transparent white

crosshair.style.position = 'absolute';
crosshair.style.width = `${crosshairSize}px`;
crosshair.style.height = `${crosshairSize}px`;
crosshair.style.pointerEvents = 'none'; // Make sure it doesn't interfere with clicking

// Create the crosshair elements (horizontal and vertical lines)
// Horizontal Line
const horizontalLine = document.createElement('div');
horizontalLine.style.position = 'absolute';
horizontalLine.style.width = `${crosshairSize}px`;
horizontalLine.style.height = `${lineThickness}px`;
horizontalLine.style.backgroundColor = crosshairColor;
horizontalLine.style.left = '0';
horizontalLine.style.top = `${(crosshairSize - lineThickness) / 2}px`;
crosshair.appendChild(horizontalLine);

// Vertical Line
const verticalLine = document.createElement('div');
verticalLine.style.position = 'absolute';
verticalLine.style.width = `${lineThickness}px`;
verticalLine.style.height = `${crosshairSize}px`;
verticalLine.style.backgroundColor = crosshairColor;
verticalLine.style.left = `${(crosshairSize - lineThickness) / 2}px`;
verticalLine.style.top = '0';
crosshair.appendChild(verticalLine);

// Add a small dot in the center (optional)
const centerDot = document.createElement('div');
centerDot.style.position = 'absolute';
centerDot.style.width = `${lineThickness * 2}px`;
centerDot.style.height = `${lineThickness * 2}px`;
centerDot.style.backgroundColor = crosshairColor;
centerDot.style.left = `${(crosshairSize - lineThickness * 2) / 2}px`;
centerDot.style.top = `${(crosshairSize - lineThickness * 2) / 2}px`;
centerDot.style.borderRadius = '50%'; // Make it circular
crosshair.appendChild(centerDot);

// Function to update crosshair position to center of viewport
function updateCrosshairPosition() {
  crosshair.style.left = `${(window.innerWidth - crosshairSize) / 2}px`;
  crosshair.style.top = `${(window.innerHeight - crosshairSize) / 2}px`;
}

// Position the crosshair in the center of the screen
updateCrosshairPosition();

// Add wave info display to top of screen
const waveInfo = document.createElement('div');
waveInfo.id = 'wave-info';
document.body.appendChild(waveInfo);

// Style the wave info container
waveInfo.style.position = 'absolute';
waveInfo.style.top = '20px';
waveInfo.style.left = '50%';
waveInfo.style.transform = 'translateX(-50%)';
waveInfo.style.padding = '10px 20px';
waveInfo.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
waveInfo.style.borderRadius = '5px';
waveInfo.style.color = 'white';
waveInfo.style.fontFamily = 'Arial, sans-serif';
waveInfo.style.fontSize = '18px';
waveInfo.style.fontWeight = 'bold';
waveInfo.style.textAlign = 'center';
waveInfo.style.zIndex = '100';

// Function to update wave info position
function updateWaveInfoPosition() {
  waveInfo.style.top = '20px';
  waveInfo.style.left = '50%';
  waveInfo.style.transform = 'translateX(-50%)';
}

// Function to update wave info text
function updateWaveInfo() {
  const waveInfo = document.getElementById('wave-info');
  if (waveInfo) {
    // Hide wave info if game hasn't started yet
    if (!gameStarted) {
      waveInfo.style.display = 'none';
      return;
    } else {
      waveInfo.style.display = 'block';
    }
    
    // If in multiplayer, gameSocket handles wave display
    if (gameSocket && gameSocket.getGameId()) {
      return;
    }
    
    // Single player wave display
    waveInfo.textContent = `WAVE ${currentWave} - ENEMIES REMAINING: ${remainingEnemies}`;
    
    if (!isWaveInProgress) {
      // Show "Wave Complete" message
      waveInfo.textContent = `WAVE ${currentWave} COMPLETE - NEXT WAVE STARTING...`;
    }
  }
}

// Initialize wave info
updateWaveInfo();

// Add weapon display to bottom right corner
const weaponDisplay = document.createElement('div');
weaponDisplay.id = 'weapon-display';
document.body.appendChild(weaponDisplay);

// Style the weapon display container
weaponDisplay.style.position = 'absolute';
weaponDisplay.style.bottom = '20px';
weaponDisplay.style.right = '20px';
weaponDisplay.style.padding = '5px';
weaponDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
weaponDisplay.style.borderRadius = '5px';
weaponDisplay.style.color = 'white';
weaponDisplay.style.fontFamily = 'Arial, sans-serif';
weaponDisplay.style.fontSize = '14px';
weaponDisplay.style.display = 'flex';
weaponDisplay.style.alignItems = 'center';
weaponDisplay.style.transition = 'opacity 0.3s ease';

// Create weapon icon
const weaponIcon = document.createElement('div');
weaponIcon.id = 'weapon-icon';
weaponIcon.style.width = '50px';
weaponIcon.style.height = '30px';
weaponIcon.style.marginRight = '10px';
weaponIcon.style.backgroundImage = 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj48cGF0aCBmaWxsPSIjZmZmZmZmIiBkPSJNNTAwLjMgMjI3LjdjLTExLjYgMS40LTIyLjktMy02MS42LTI3LjctODkuOS01Ny4yLTE1OS4xLTEwMS43LTE2NS02MDA2TDI3NCAwSDIzNi4yTDIzNy4zIDUuNEMzNDYuMSAxMDEuOCAyMzUuMiAxNDguMSAxNzEuNSAxOTFjLTM4LjYgMjQuOC01MC4xIDI5LjItNjEuNyAyNy43QzU1LjggMjExLjIgMCAyMjUuNSAwIDI1NmMwIDI4LjQgNTEuNyA0My45IDEwMS44IDQwLjIgNzcuNi01LjcgMTQ4IDguMSAyMDguMyA0My44YzE3LjkgMTAuNyAzNSAyMS41IDcwLjcgMjEuNWgxOS42YzM1LjggMCAyNy45LTEwLjggNDUuOC0yMS41IDYwLjMtMzUuNyAxMzAuOC00OS41IDIwOC4zLTQzLjhDNzA0LjMgMjk5LjkgNzU2IDI4NC40IDc1NiAyNTZjMC0zMC41LTU1LjgtNDQuOC0xMDkuNy0yOC4zek0xNzMgOTMuN2MxLjYgMi43IDMuMyA1LjQuOSA5LjktMTQuOCAxNi4wMi01NC43IDUyLjc2LTk1LjIgODAuNnoiLz48L3N2Zz4=")';
weaponIcon.style.backgroundSize = 'contain';
weaponIcon.style.backgroundRepeat = 'no-repeat';
weaponIcon.style.backgroundPosition = 'center';
weaponDisplay.appendChild(weaponIcon);

// Create weapon name
const weaponName = document.createElement('div');
weaponName.id = 'weapon-name';
weaponName.textContent = 'Assault Rifle';
weaponDisplay.appendChild(weaponName);

// Function to update weapon display position
function updateWeaponDisplayPosition() {
  // Keep it in the bottom right corner
  weaponDisplay.style.bottom = '20px';
  weaponDisplay.style.right = '20px';
}

// Helper function to update the weapon display when switching weapons
function updateWeaponDisplay(weaponType: string) {
  const weaponName = document.getElementById('weapon-name');
  const weaponIcon = document.getElementById('weapon-icon');
  
  if (weaponName && weaponIcon) {
    // Update name based on weapon type
    weaponName.textContent = weaponType === 'assaultRifle' ? 'Assault Rifle' : 'Sniper Rifle';
    
    // Update icon - different SVG for each weapon
    if (weaponType === 'assaultRifle') {
      // Assault rifle icon (original)
      weaponIcon.style.backgroundImage = 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj48cGF0aCBmaWxsPSIjZmZmZmZmIiBkPSJNNTAwLjMgMjI3LjdjLTExLjYgMS40LTIyLjktMy02MS42LTI3LjctODkuOS01Ny4yLTE1OS4xLTEwMS43LTE2NS02MDA2TDI3NCAwSDIzNi4yTDIzNy4zIDUuNEMzNDYuMSAxMDEuOCAyMzUuMiAxNDguMSAxNzEuNSAxOTFjLTM4LjYgMjQuOC01MC4xIDI5LjItNjEuNyAyNy43QzU1LjggMjExLjIgMCAyMjUuNSAwIDI1NmMwIDI4LjQgNTEuNyA0My45IDEwMS44IDQwLjIgNzcuNi01LjcgMTQ4IDguMSAyMDguMyA0My44YzE3LjkgMTAuNyAzNSAyMS41IDcwLjcgMjEuNWgxOS42YzM1LjggMCAyNy45LTEwLjggNDUuOC0yMS41IDYwLjMtMzUuNyAxMzAuOC00OS41IDIwOC4zLTQzLjhDNzA0LjMgMjk5LjkgNzU2IDI4NC40IDc1NiAyNTZjMC0zMC41LTU1LjgtNDQuOC0xMDkuNy0yOC4zek0xNzMgOTMuN2MxLjYgMi43IDMuMyA1LjQuOSA5LjktMTQuOCAxNi4wMi01NC43IDUyLjc2LTk1LjIgODAuNnoiLz48L3N2Zz4=")';
    } else {
      // Sniper rifle icon (new)
      weaponIcon.style.backgroundImage = 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj48cGF0aCBmaWxsPSIjZmZmZmZmIiBkPSJNNTEyIDExMnYtMTZjMC04LjgtNy4yLTE2LTE2LTE2aC00OHYtMTZjMC04LjgtNy4yLTE2LTE2LTE2aC0xMDQuOGwtMTcuOC0xOS4yQzMwNC4zIDEyLjUgMjk2LjMgOCAyODcuNyA4aC02My41Yy04LjYgMC0xNi42IDQuNS0yMS4yIDExLjhMMTg1LjIgNDhIODBjLTguOCAwLTE2IDcuMi0xNiAxNnYxNkgxNmMtOC44IDAtMTYgNy4yLTE2IDE2djE2YzAgOC44IDcuMiAxNiAxNiAxNmgxNnY5MTJjMCA4LjkgNy4yIDE2IDE2IDE2aDQwYzQuNSAwIDguOS0yIDEyLTVsNDEuNi00MS42IDI0LjggMjQuOGMzLjEgMy4xIDcuNCA0LjggMTEuNyA0LjhoMzJjNC40IDAgOC42LTEuOCAxMS43LTQuOGwyNC44LTI0LjggNDEuNiA0MS42YzMuMSAzIDcuNCA1IDEyIDVoNDBjOC44IDAgMTYtNy4xIDE2LTE2VjExMmg0ZTNMMjY0IDEzNC40YzAuNyAwLjcgMS43IDEuMiAyLjcgMS41bDE3MC45IDQyLjdjNC4zIDEuMSA4LjggMC4xIDEyLjEtMi41bDUyLTQxLjZjMy4xLTIuNSA0LjktNi4zIDQuOS0xMC4zIDAtMi4yLTAuNi00LjUtMS43LTYuNWwtNDgtNjRjLTIuMS0yLjgtNS4zLTQuNC04LjgtNC40aC0xMDR2LTMyYzAgLTguOC03LjItMTYtMTYtMTZoLTEwNHYxNkgxMjh2LTE2SDk2djE2SDgwYy04LjggMC0xNiA3LjItMTYgMTZ2NjRoNDY0Yy0xLjcgMjAuOC0zLjMgNDEuNy01IDYyLjVjLTMuOSA0Ny45LTcuOCA5NS45LTExLjkgMTQzLjRjLTQuMyA0OS42LTkuNyA5OC43LTE1LjIgMTQ3LjlsLTE3LjQgMTU1djE5LjJoLTIwLjZjLTIuNSAwLTUuMSAwLjcgLTcuMiAyLjFsLS43MS43MSAtOS4xLTYuMGMtMjAuOC0xMy44LTQxLjIgOC4yLTYyLjEgNS43NSAtMjIuMy0yLjctNDMuNS01LjMtNjQuMy0xMi41IC0yMS43LTcuNS00MC45LTIwLTU1LjItMzguNyAtMzAuMy0zOS40LTIyLjQtOTYuNSAyOS4xLTExMiA3LjEtMi4xIDE0LjUtMyAyMS44LTMuN3Y1Ni43YzAgOS42IDcuNyAxNy4zIDE3LjMgMTcuMyAxMy4yIDAgMTMuMi0yMCAwLTIwIC0xIC0yLjQtMi44IC0zLjkgLTQuNyAtMy45djQwYy0zMC4zIDIuNSAtNTkuOSAxNS44LTgwLjMgMzguOSAtNy45IDgtMTQuNiAxNy4zLTE5LjQgMjcuOWwtMTguNC0xOS41Yy0zLjEtMy4zLTcuNS01LjItMTIuMS01LjJoLTE5LjNsLTI3LjYtMTA5Yy0xMy43LTUzLjktMjMuMy0xMDktMjkuOC0xNjQuMS05LTE3My42LTcuNi0yNDEuOSA2LjEtNDE1Ljl6Ii8+PC9zdmc+")';
    }
  }
}

// Position the weapon display
updateWeaponDisplayPosition();

// Add event listener for weapon switching
document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'e') {
    // The Player class handles the actual weapon switching logic
    // We just need to call updateWeaponDisplay here with the current weapon
    // after the player has toggled it
    setTimeout(() => {
      // Give a small delay to ensure the Player object has updated its state
      updateWeaponDisplay(player.currentWeapon);
    }, 50);
  }
});

// Function to update wave state from multiplayer
function onWaveUpdate(wave: number, remaining: number) {
  if (wave > 0) currentWave = wave;
  remainingEnemies = remaining;
  updateWaveInfo();
}

// Handle URL parameters for game joining
function checkForGameInvite() {
  const urlParams = new URLSearchParams(window.location.search);
  const joinGameId = urlParams.get('join');
  
  if (joinGameId) {
    console.log("Join game ID from URL:", joinGameId); // Debug logging
    
    // Create the GameSocket and join the game
    gameSocket = new GameSocket(player, scene, onWaveUpdate);
    // Connect the player to the socket for shooting events
    player.setGameSocket(gameSocket);
    
    // Set callback for when game is started by host
    gameSocket.setGameStartedCallback(() => {
      gameStarted = true;
      gameInitialized = true;
    });
    
    gameSocket.joinGame(joinGameId);
    
    // Show joining message
    const message = document.createElement('div');
    message.style.position = 'absolute';
    message.style.top = '50%';
    message.style.left = '50%';
    message.style.transform = 'translate(-50%, -50%)';
    message.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    message.style.color = 'white';
    message.style.padding = '20px';
    message.style.borderRadius = '10px';
    message.style.zIndex = '1000';
    message.textContent = `Joining game ${joinGameId}...`;
    document.body.appendChild(message);
    
    // Remove after 3 seconds
    setTimeout(() => document.body.removeChild(message), 3000);
  }
  
  // Call at the end of the function
  setTimeout(updateCopyButtonVisibility, 1000); // Small delay to ensure gameSocket is initialized
}

// Add multiplayer UI to instructions
const instructions = document.createElement('div');
instructions.style.position = 'absolute';
instructions.style.top = '10px';
instructions.style.width = '100%';
instructions.style.textAlign = 'center';
instructions.style.color = '#ffffff';
instructions.style.fontFamily = 'Arial, Helvetica, sans-serif';
instructions.style.fontSize = '16px';
instructions.innerHTML = 'Click to play<br>';
instructions.innerHTML += 'Move: ZQSD/WASD/Arrow keys<br>';
instructions.innerHTML += 'Sprint: Shift or Fn + Z<br>';
instructions.innerHTML += 'Jump: Space<br>';
instructions.innerHTML += 'Aim: Right-click (hold)<br>';
instructions.innerHTML += 'Shoot: Command key<br>';
instructions.innerHTML += 'Toggle Camera: F<br>';
instructions.innerHTML += 'Switch Weapon: E<br>';
instructions.innerHTML += 'Look around: Mouse<br><br>Multiplayer:<br>';
instructions.innerHTML += 'Create Game: M<br>';
instructions.innerHTML += 'Share the link to invite friends';
document.body.appendChild(instructions);

// Modify the createCopyLinkButton function
function createCopyLinkButton() {
  // Remove any existing button first
  const existingBtn = document.getElementById('copy-link-button');
  if (existingBtn) {
    document.body.removeChild(existingBtn);
  }

  console.log("Creating copy link button");
  
  const copyLinkBtn = document.createElement('div');
  copyLinkBtn.id = 'copy-link-button';
  copyLinkBtn.style.position = 'fixed';
  copyLinkBtn.style.top = '10px'; // Position at top right corner
  copyLinkBtn.style.right = '10px';
  copyLinkBtn.style.padding = '10px 15px'; // Smaller, more discrete size
  copyLinkBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'; // Semi-transparent background
  copyLinkBtn.style.color = 'white';
  copyLinkBtn.style.borderRadius = '5px';
  copyLinkBtn.style.fontFamily = 'Arial, sans-serif';
  copyLinkBtn.style.fontSize = '14px'; // Smaller text
  copyLinkBtn.style.fontWeight = 'bold';
  copyLinkBtn.style.cursor = 'pointer';
  copyLinkBtn.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.3)';
  copyLinkBtn.style.zIndex = '9999';
  copyLinkBtn.style.textAlign = 'center';
  copyLinkBtn.style.transition = 'all 0.2s';
  copyLinkBtn.style.border = '1px solid rgba(255, 255, 255, 0.3)';
  copyLinkBtn.style.display = 'block';
  copyLinkBtn.innerText = '🔗 Copy Game Link';
  
  // Add hover effect
  copyLinkBtn.addEventListener('mouseover', () => {
    copyLinkBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
  });
  
  copyLinkBtn.addEventListener('mouseout', () => {
    copyLinkBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  });
  
  // Click event to copy link
  copyLinkBtn.addEventListener('click', () => {
    let gameLink;
    
    if (gameSocket) {
      console.log("Getting game ID from socket...");
      const gameId = gameSocket.getGameId();
      console.log("Retrieved game ID:", gameId);
      
      const currentUrl = window.location.href.split('?')[0]; // Remove any existing parameters
      gameLink = `${currentUrl}?join=${gameId}`;
      console.log("Created game link:", gameLink);
    } else {
      // If no game is active, create one on the fly
      console.log("No active game, creating new GameSocket...");
      gameSocket = new GameSocket(player, scene, onWaveUpdate);
      player.setGameSocket(gameSocket);
      console.log("Created GameSocket, now creating game...");
      gameSocket.createGame();
      
      // Wait briefly for game creation before copying
      setTimeout(() => {
        if (gameSocket) {
          console.log("In timeout callback, getting game ID...");
          const gameId = gameSocket.getGameId();
          console.log("Game ID in timeout:", gameId);
          
          const currentUrl = window.location.href.split('?')[0];
          const newGameLink = `${currentUrl}?join=${gameId}`;
          console.log("Created new game link:", newGameLink);
          
          navigator.clipboard.writeText(newGameLink).then(() => {
            console.log("Copied link to clipboard successfully");
            copyLinkBtn.innerText = '✅ Copied!';
          }).catch(err => {
            console.error("Error copying to clipboard:", err);
          });
        } else {
          console.error("GameSocket is null in timeout callback");
        }
      }, 2000); // Increased timeout for better reliability
      return;
    }
    
    if (gameLink) {
      navigator.clipboard.writeText(gameLink).then(() => {
        console.log("Copied link to clipboard successfully");
        // Visual feedback for copied link
        const originalText = copyLinkBtn.innerText;
        copyLinkBtn.innerText = '✅ Copied!';
        
        setTimeout(() => {
          copyLinkBtn.innerText = originalText;
        }, 2000);
      }).catch(err => {
        console.error("Failed to copy link:", err);
        copyLinkBtn.innerText = '❌ Failed';
        
        setTimeout(() => {
          copyLinkBtn.innerText = '🔗 Copy Game Link';
        }, 2000);
      });
    } else {
      console.error("GameLink is undefined or null");
    }
  });
  
  document.body.appendChild(copyLinkBtn);
  console.log("Copy button added to DOM");
  return copyLinkBtn;
}

// Instead of trying to hide/show the button, just recreate it whenever needed
function updateCopyButtonVisibility() {
  // Always recreate the button
  return createCopyLinkButton();
}

// Modify pointerlockchange to keep the button visible
document.addEventListener('pointerlockchange', () => {
  const copyLinkBtn = document.getElementById('copy-link-button');
  if (document.pointerLockElement === document.body) {
    instructions.style.display = 'none';
    // Hide the button during gameplay for less distraction
    if (copyLinkBtn) copyLinkBtn.style.display = 'none';
  } else {
    instructions.style.display = 'block';
    // Show the button when not in gameplay
    if (copyLinkBtn) {
      copyLinkBtn.style.display = 'block';
    } else {
      createCopyLinkButton();
    }
  }
});

// Call this at startup
checkForGameInvite();

// Create copy button on page load
createCopyLinkButton();

// Function to restart the game
function restartGame() {
  console.log("Restarting game...");
  
  // Reset game state variables
  currentWave = 1;
  baseEnemyCount = 3;
  remainingEnemies = baseEnemyCount;
  isWaveInProgress = true;
  gamePaused = false;
  
  // Clear all existing bots
  for (let i = bots.length - 1; i >= 0; i--) {
    scene.remove(bots[i].body);
    bots.splice(i, 1);
  }
  
  // Create new bots for wave 1
  for (let i = 0; i < baseEnemyCount; i++) {
    createBot();
  }
  
  // Reset player position
  player.playerBody.position.set(0, 1, 0);
  player.velocity.set(0, 0, 0);
  
  // Update wave info display
  updateWaveInfo();
  
  // Show restart message
  const restartMessage = document.createElement('div');
  restartMessage.style.position = 'absolute';
  restartMessage.style.top = '50%';
  restartMessage.style.left = '50%';
  restartMessage.style.transform = 'translate(-50%, -50%)';
  restartMessage.style.padding = '20px 30px';
  restartMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  restartMessage.style.color = '#00ff00';
  restartMessage.style.fontFamily = 'Arial, sans-serif';
  restartMessage.style.fontSize = '32px';
  restartMessage.style.borderRadius = '10px';
  restartMessage.style.textAlign = 'center';
  restartMessage.style.zIndex = '2000';
  restartMessage.textContent = 'GAME RESTARTED - WAVE 1';
  
  document.body.appendChild(restartMessage);
  
  // Remove the message after 2 seconds
  setTimeout(() => {
    document.body.removeChild(restartMessage);
  }, 2000);
}

// Function to toggle paused state
function togglePauseGame() {
  // In multiplayer mode, only host can toggle pause and it's handled by the server
  if (gameSocket && gameSocket.getIsHost()) {
    // Let the server handle the pause state toggle
    gameSocket.togglePauseGame();
    return;
  }
  
  // For single player, handle pause state locally
  gamePaused = !gamePaused;
  console.log(gamePaused ? "Waves paused" : "Waves resumed");
  
  // Show message
  const pauseMessage = document.createElement('div');
  pauseMessage.style.position = 'absolute';
  pauseMessage.style.top = '50%';
  pauseMessage.style.left = '50%';
  pauseMessage.style.transform = 'translate(-50%, -50%)';
  pauseMessage.style.padding = '20px 30px';
  pauseMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  pauseMessage.style.color = gamePaused ? '#ff0000' : '#00ff00';
  pauseMessage.style.fontFamily = 'Arial, sans-serif';
  pauseMessage.style.fontSize = '32px';
  pauseMessage.style.borderRadius = '10px';
  pauseMessage.style.textAlign = 'center';
  pauseMessage.style.zIndex = '2000';
  pauseMessage.textContent = gamePaused ? 'WAVES PAUSED' : 'WAVES RESUMED';
  
  document.body.appendChild(pauseMessage);
  
  // Remove the message after 2 seconds
  setTimeout(() => {
    document.body.removeChild(pauseMessage);
  }, 2000);
}

// Listen for pause state updates from the server in multiplayer
document.addEventListener('game-pause-update', ((event: CustomEvent) => {
  gamePaused = event.detail.isPaused;
  console.log(`Game pause state updated from server: ${gamePaused ? 'Paused' : 'Resumed'}`);
}) as EventListener);

// Add a function to initialize the game when the button is clicked
function initializeGame() {
  // If game is already initialized, toggle pause state 
  if (gameInitialized) {
    togglePauseGame();
    return;
  }
  
  // First initialization - start the game
  gameInitialized = true;
  gameStarted = true;
  
  // In multiplayer, the host will notify the server
  if (gameSocket && gameSocket.getIsHost()) {
    console.log("Host is starting the game for all players");
    gameSocket.startGame();
    // The server will trigger the game-started event for all clients
  } else if (!gameSocket) {
    // For single-player only, initialize wave and bots locally
    // Initialize game state
    currentWave = 1;
    baseEnemyCount = 3;
    remainingEnemies = baseEnemyCount;
    isWaveInProgress = true;
    
    // Spawn initial wave of bots
    for (let i = 0; i < baseEnemyCount; i++) {
      createBot();
    }
    
    // Update wave info display
    updateWaveInfo();
    
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
  }
}

// Function to handle mouse click on objects
function onMouseClick(event: MouseEvent) {
  // Only process clicks when in game (pointer is locked)
  if (document.pointerLockElement !== document.body) {
    return;
  }
  
  // Cast a ray from the camera position in the direction the camera is facing
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), player.camera); // Center of screen
  
  // Check for intersections with objects
  const intersects = raycaster.intersectObjects(scene.children, true);
  
  // Check if we clicked on any button
  for (let i = 0; i < intersects.length; i++) {
    const object = intersects[i].object;
    // Check if the clicked object or its parent is a button
    let currentObj: THREE.Object3D | null = object;
    let buttonType = '';
    
    // Look for buttons in the object or any parent
    while (currentObj) {
      if (currentObj.userData && currentObj.userData.isStartButton) {
        buttonType = 'start';
        break;
      }
      if (currentObj.userData && currentObj.userData.isRestartButton) {
        buttonType = 'restart';
        break;
      }
      currentObj = currentObj.parent;
    }
    
    if (buttonType === 'start') {
      console.log("Start/Pause button clicked!");
      initializeGame();
      break;
    } else if (buttonType === 'restart') {
      console.log("Restart button clicked!");
      restartGame();
      break;
    }
  }
}

// Add click event listener
document.addEventListener('click', onMouseClick);

// Modify the animation loop to only process bots if the game has started
function animate() {
  requestAnimationFrame(animate);
  
  // Update time counter for animations
  animationTime += 0.03;
  
  // Animate the buttons
  if (startButton) {
    // Update button text based on game state
    if (gameStarted && startButton.userData.textMesh && startButton.userData.textCanvas) {
      // Change to "PAUSE WAVES" when game is active or "RESUME WAVES" when paused
      const buttonText = gamePaused ? "RESUME\nWAVES" : "PAUSE\nWAVES";
      
      const context = startButton.userData.textCanvas.getContext('2d');
      if (context) {
        context.clearRect(0, 0, 512, 512);
        context.fillStyle = 'black';
        context.fillRect(0, 0, 512, 512);
        
        context.font = 'bold 80px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = 'white';
        
        // Split text into lines if it contains newline
        const lines = buttonText.split('\n');
        if (lines.length > 1) {
          context.fillText(lines[0], 256, 180);
          context.fillText(lines[1], 256, 320);
        } else {
          context.fillText(buttonText, 256, 256);
        }
        
        // Update texture
        const material = startButton.userData.textMesh.material as THREE.MeshBasicMaterial;
        if (material && material.map) {
          material.map.needsUpdate = true;
        }
      }
    }
    
    // Scale pulsing animation
    const scale = 1.0 + Math.sin(animationTime * 2) * 0.05;
    startButton.scale.set(scale, scale, scale);
    
    // Light intensity pulsing
    if (startButton.userData.light) {
      startButton.userData.light.intensity = 0.7 + Math.sin(animationTime * 3) * 0.3;
    }
  }
  
  // Animate the restart button (only show when game has started)
  if (restartButton) {
    // Show restart button only when game has been started
    restartButton.visible = gameStarted;
    
    if (restartButton.visible) {
      // Scale pulsing animation
      const scale = 1.0 + Math.sin(animationTime * 2 + 1) * 0.05; // Offset phase for different timing
      restartButton.scale.set(scale, scale, scale);
      
      // Light intensity pulsing
      if (restartButton.userData.light) {
        restartButton.userData.light.intensity = 0.7 + Math.sin(animationTime * 3 + 1) * 0.3;
      }
    }
  }
  
  // Always update player - pause only affects wave progression
  player.update();
  
  // Update multiplayer if active
  if (gameSocket) {
    // Update our position to other players - send every frame for smoother movement
    gameSocket.updatePlayerPosition(
      player.playerBody.position,
      new THREE.Euler(player.pitch, player.yaw, 0)
    );
    
    // Update remote players and bots - passing 1/60 as deltaTime (assuming 60fps)
    gameSocket.update(1/60);
    
    // Skip local bot handling if in multiplayer mode
    if (gameSocket.getGameId()) {
      // Only the host controls bots in multiplayer
      if (gameSocket.getIsHost() && gameStarted) {
        // Check if all bots are dead and wave is still in progress
        if (remainingEnemies === 0 && isWaveInProgress) {
          isWaveInProgress = false;
          waveCompleteTimer = waveCompleteDelay;
          updateWaveInfo(); // Show wave complete message
        }
        
        // Handle wave complete timer
        if (!isWaveInProgress && waveCompleteTimer > 0) {
          waveCompleteTimer--;
          
          if (waveCompleteTimer === 0) {
            // New wave will be handled by server
          }
        }
      }
    }
  }

  // Only process bot logic if game has started and not paused
  // When paused, bots should freeze in their current positions
  if (gameStarted && !gamePaused) {
    // Update bots and count remaining active ones
    let activeBotsCount = 0;
    
    // In single player or as host, update bots locally
    if (!gameSocket || !gameSocket.getGameId()) {
      for (let i = 0; i < bots.length; i++) {
        if (bots[i].isActive) {
          activeBotsCount++;
          
          // Update bot movement
          bots[i].update(player.playerBody.position);
          
          // Check if bot reached player
          if (bots[i].hasReachedTarget(player.playerBody.position, 5)) {
            console.log("Bot reached player!");
            bots[i].hit(); // Make bot disappear
            activeBotsCount--;
            
            // Update remaining enemies count
            remainingEnemies = activeBotsCount;
            updateWaveInfo();
          }
        }
      }
    } else {
      // In multiplayer, just count active bots without updating them
      activeBotsCount = bots.filter(bot => bot.isActive).length;
    }
    
    // Use enhanced bullet-bot collision detection
    player.checkBulletBotCollisions(bots);
    
    // Count active bots after potential bullet hits
    remainingEnemies = bots.filter(bot => bot.isActive).length;
    updateWaveInfo();
    
    // Check if all bots are dead and wave is still in progress
    if (remainingEnemies === 0 && isWaveInProgress) {
      isWaveInProgress = false;
      waveCompleteTimer = waveCompleteDelay;
      updateWaveInfo(); // Show wave complete message
    }
    
    // Handle wave complete timer only if not paused
    if (!isWaveInProgress && waveCompleteTimer > 0 && !gamePaused) {
      waveCompleteTimer--;
      
      if (waveCompleteTimer === 0) {
        // Start next wave
        startNewWave();
      }
    }
  }

  // Update crosshair visibility based on camera mode
  crosshair.style.display = player.isThirdPerson ? 'none' : 'block';
  
  // Update weapon display visibility based on camera mode
  weaponDisplay.style.opacity = player.isThirdPerson ? '0' : '1';
  
  // Render the scene
  renderer.render(scene, player.camera);
}

// Start animation
animate();

// Remove default margin and padding from body
document.body.style.margin = '0';
document.body.style.padding = '0';
document.body.style.overflow = 'hidden';

// Update the keydown handler for 'M' key
document.addEventListener('keydown', (e) => {
  // Press M to create a new multiplayer game
  if (e.key.toLowerCase() === 'm' && !gameSocket) {
    gameSocket = new GameSocket(player, scene, onWaveUpdate);
    // Connect the player to the socket for shooting events
    player.setGameSocket(gameSocket);
    
    // Set callback for when game is started by host
    gameSocket.setGameStartedCallback(() => {
      gameStarted = true;
      gameInitialized = true;
    });
    
    gameSocket.createGame();
    
    // Update copy button visibility
    setTimeout(updateCopyButtonVisibility, 1000); // Small delay to ensure gameSocket is initialized
  }
});

// Helper function to create a bot at a random position along the course
function createBot() {
  // Define course boundaries - ensure these match the terrain dimensions in World.ts
  const courseWidth = world.terrainWidth;
  const safeMargin = 2; // Stay away from walls to prevent clipping
  
  // Calculate random position that's definitely within the course boundaries
  const spawnX = (Math.random() - 0.5) * (courseWidth - safeMargin * 2); // Stay within borders
  
  // Z position - spawn from halfway to the end of the course, to ensure bots are visible
  // Keep them away from the end wall too
  const minZ = -110; // Start spawning from this position (further away)
  const maxZ = -60; // Don't spawn closer than this to the player
  const spawnZ = minZ + Math.random() * (maxZ - minZ); // Correct calculation to spawn between minZ and maxZ
  
  const spawnPosition = new THREE.Vector3(spawnX, 0, spawnZ);
  
  // Create a bot targeting the player position
  const bot = new Bot(scene, spawnPosition, player.playerBody.position);
  
  // Add to bots array
  bots.push(bot);
  
  console.log(`Created bot at position (${spawnX.toFixed(1)}, ${spawnZ.toFixed(1)})`);
  
  return bot;
}

// Function to start a new wave
function startNewWave() {
  currentWave++;
  const enemyCount = baseEnemyCount + (currentWave - 1); // One more enemy each wave
  remainingEnemies = enemyCount;
  isWaveInProgress = true;
  
  // Clear any inactive bots from previous wave
  for (let i = bots.length - 1; i >= 0; i--) {
    if (!bots[i].isActive) {
      scene.remove(bots[i].body);
      bots.splice(i, 1);
    }
  }
  
  // Spawn new bots for this wave
  for (let i = 0; i < enemyCount; i++) {
    createBot();
  }
  
  // Update wave display
  updateWaveInfo();
  
  console.log(`Wave ${currentWave} started with ${enemyCount} bots`);
}

// Create initial bots for first wave
// for (let i = 0; i < baseEnemyCount; i++) {
//   createBot();
// }