import { PerspectiveCamera, Vector3, BoxGeometry, MeshBasicMaterial, Mesh, Object3D, Group, Scene } from 'three';
import { PlayerModel } from './PlayerModel';
import { Bullet } from './Bullet';
import { World } from './World';

export class Player {
  camera: PerspectiveCamera;
  playerBody: Mesh;
  playerModel: PlayerModel;
  exampleModel: Group; // For the visible model in front
  walkSpeed: number = 0.08; // Normal walking speed (reduced)
  sprintSpeed: number = 0.2; // Fast sprint speed (reduced but still faster than walking)
  moveSpeed: number = 0.08; // Current speed (defaults to walk)
  airControlFactor: number = 0.05; // Significantly reduced control in air (only 5% of normal)
  rotationSpeed: number = 0.002;
  keys: { [key: string]: boolean } = {};
  yaw: number = 0;
  pitch: number = 0;
  
  // Camera modes
  isThirdPerson: boolean = false;
  thirdPersonDistance: number = 5; // Distance behind player
  thirdPersonHeight: number = 2; // Height above player
  
  // Player states
  isSprinting: boolean = false; // Changed from sneaking to sprinting
  isMoving: boolean = false;
  
  // Aiming state
  isAiming: boolean = false;
  aimTransitionProgress: number = 0;
  transitionSpeed: number = 0.1; // Speed of transition when aiming
  defaultFOV: number = 75; // Default field of view
  aimingFOV: number = 65; // Zoomed in field of view when aiming
  
  // Weapon state
  currentWeapon: string = 'assaultRifle'; // 'assaultRifle' or 'sniperRifle'
  
  // Shooting state
  canShoot: boolean = true;
  shootCooldown: number = 0;
  bullets: Bullet[] = [];
  recoilAmount: number = 0.01; // Very subtle recoil (reduced from 0.03)
  recoilRecovery: number = 0.003; // Slightly faster recovery
  currentRecoil: number = 0;
  
  // Standard heights
  normalEyeHeight: number;
  
  // Jumping and physics variables
  gravity: number = 0.01;
  jumpForce: number = 0.2;
  velocity: Vector3 = new Vector3(0, 0, 0);
  horizontalVelocity: Vector3 = new Vector3(0, 0, 0);
  friction: number = 0.92; // Ground friction
  airFriction: number = 0.99; // Air friction
  isGrounded: boolean = true;
  jumpCooldown: number = 0;
  
  // For animation
  currentSpeed: number = 0;
  
  // Reference to scene for bullet creation
  scene: Scene;
  
  world: World; // Reference to the world for collision detection
  playerRadius: number = 0.5; // Player collision radius
  
  // Accuracy properties
  readonly ACCURACY_STANDING_AIMING: number = 0.0; // Perfect accuracy (no spread)
  readonly ACCURACY_STANDING: number = 0.01; // Slightly inaccurate when standing still but not aiming
  readonly ACCURACY_MOVING: number = 0.03; // More inaccurate when moving
  readonly ACCURACY_JUMPING: number = 0.06; // Very inaccurate when in the air
  
  // Add a new property at the top of the Player class to track the GameSocket instance
  gameSocket: any = null;
  
  constructor(scene: Scene, world: World) {
    this.scene = scene;
    this.world = world; // Store reference to world
    
    // Create player body (cube)
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshBasicMaterial({ color: 0x0000ff }); // Blue cube
    material.transparent = true;
    material.opacity = 0.0; // Make the cube invisible for first-person
    this.playerBody = new Mesh(geometry, material);
    this.playerBody.position.set(0, 0, 0); // Position the cube at ground level
    
    // Create the human model for the player (visible in third person)
    this.playerModel = new PlayerModel(true); // Now visible for third-person view
    this.playerBody.add(this.playerModel.body);
    
    // Create a visible example model in front of the player
    this.exampleModel = new PlayerModel(true).body;
    this.exampleModel.position.set(0, 0, -5); // 5 meters in front of the starting position
    
    // Calculate proper eye level
    // The exact values from PlayerModel.ts:
    const modelHeight = 1.8; // Total height of model in meters
    const headRadius = modelHeight * 0.15; // From PlayerModel.ts
    
    // The head center position in the model
    const headCenterY = modelHeight - headRadius;
    
    // Calculate eye level to be exactly at the center of the head
    this.normalEyeHeight = headCenterY;
    
    // Create the camera (first-person view)
    this.camera = new PerspectiveCamera(this.defaultFOV, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Add the camera to the player body directly
    this.playerBody.add(this.camera);
    // Position the camera at the player's eye level (center of the head)
    this.updateCameraPosition();
    
    // Initialize first-person gun
    this.playerModel.positionGunForFirstPerson(this.camera);
    
    // Log the camera height for debugging
    console.log('Camera height from ground:', this.normalEyeHeight);
    console.log('Model total height:', modelHeight);
    console.log('Head center position:', headCenterY);
    
    // Set up controls
    this.setupControls();
  }

  setupControls() {
    // Setup key listeners
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      
      // Handle function key + z for additional sprint alternative
      if (e.key.toLowerCase() === 'z' && e.getModifierState('Fn')) {
        this.keys['sprint'] = true;
        this.startSprinting();
      }
      
      // Handle shift key for sprinting (changed from sneaking)
      if (e.key === 'Shift') {
        this.keys['sprint'] = true;
        this.startSprinting();
      }
      
      // Toggle camera mode with F key
      if (e.key.toLowerCase() === 'f') {
        this.toggleCameraMode();
      }
      
      // Toggle weapon with E key
      if (e.key.toLowerCase() === 'e') {
        this.toggleWeapon();
      }
      
      // Toggle aiming with Right Shift key
      if (e.key === 'Shift' && e.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT) {
        if (this.isAiming) {
          this.stopAiming();
        } else {
          this.startAiming();
        }
      }
      
      // Command/Meta key removed from controls
    });
    
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
      
      // When releasing z or shift, also check if we need to release sprint
      if ((e.key.toLowerCase() === 'z' && this.keys['sprint']) || e.key === 'Shift') {
        this.keys['sprint'] = false;
        this.stopSprinting();
      }
    });

    // Right-click handler for aiming
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault(); // Prevent default context menu
    });

    // Right-click to toggle aiming
    document.addEventListener('mousedown', (e) => {
      if (e.button === 2) { // Right mouse button
        if (this.isAiming) {
          this.stopAiming();
        } else {
          this.startAiming();
        }
      }
    });
    
    // Left-click for shooting
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Left mouse button
        this.keys['shoot'] = true; // Track shooting state with a flag
      }
    });
    
    // Stop shooting when mouse button is released
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) { // Left mouse button
        this.keys['shoot'] = false;
      }
    });

    // Setup mouse movement for looking around
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === document.body) {
        // Calculate sensitivity based on weapon and aiming state
        let sensitivityMultiplier = 1.0;
        
        // Reduce sensitivity when aiming
        if (this.isAiming) {
          if (this.currentWeapon === 'sniperRifle') {
            // Less extreme sensitivity reduction when aiming with sniper rifle
            // Increased from previous values for smoother aiming
            const zoomFactor = this.aimTransitionProgress;
            sensitivityMultiplier = 0.35 - (zoomFactor * 0.2); // 0.35 at start of aiming to 0.15 when fully zoomed
          } else {
            // Normal sensitivity reduction when aiming with assault rifle
            sensitivityMultiplier = 0.6;
          }
        }
        
        // Apply sensitivity to mouse movement
        const adjustedMovementX = e.movementX * this.rotationSpeed * sensitivityMultiplier;
        const adjustedMovementY = e.movementY * this.rotationSpeed * sensitivityMultiplier;
        
        // Update yaw (horizontal rotation) and pitch (vertical rotation)
        this.yaw -= adjustedMovementX;
        this.pitch -= adjustedMovementY;
        
        // Clamp the pitch to avoid flipping
        this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
        
        // Apply the rotation to the player body
        this.playerBody.rotation.y = this.yaw;
        
        if (this.isThirdPerson) {
          // In third person, update camera position based on new rotation
          this.updateCameraPosition();
        } else {
          // In first person, just rotate the camera's pitch
          this.camera.rotation.x = this.pitch;
        }
      }
    });

    // Request pointer lock when clicking on the game
    document.body.addEventListener('click', () => {
      if (document.pointerLockElement !== document.body) {
        document.body.requestPointerLock();
      }
    });
  }
  
  // Then add this method near other shooting related methods
  setGameSocket(gameSocket: any) {
    this.gameSocket = gameSocket;
  }

  // Update the shoot method to send the shot event to other players in multiplayer
  shoot() {
    // Only shoot if cooldown is done and not in third person
    if (!this.canShoot || this.isThirdPerson) return;
    
    this.canShoot = false;
    
    // Set weapon-specific cooldown
    if (this.currentWeapon === 'assaultRifle') {
      this.shootCooldown = 10; // Faster fire rate for assault rifle
    } else {
      this.shootCooldown = 30; // Slower fire rate for sniper rifle
    }
    
    // Play gun firing animation through PlayerModel
    this.playerModel.triggerShootAnimation(this.camera);
    
    // Calculate bullet spawn position (at gun muzzle)
    const bulletSpawnPos = new Vector3();
    
    if (this.camera.userData.fpGun) {
      // Find muzzle position in the active gun model
      let muzzlePosition = new Vector3();
      
      if (this.currentWeapon === 'assaultRifle' && this.camera.userData.fpGun) {
        muzzlePosition.set(0, 0, -0.52); // Assault rifle muzzle position
        muzzlePosition.applyMatrix4(this.camera.userData.fpGun.matrixWorld);
      } else if (this.currentWeapon === 'sniperRifle' && this.camera.userData.fpSniperRifle) {
        muzzlePosition.set(0, 0, -0.6); // Sniper rifle muzzle position (longer barrel)
        muzzlePosition.applyMatrix4(this.camera.userData.fpSniperRifle.matrixWorld);
      } else {
        // Fallback if gun not found - use camera position
        this.camera.getWorldPosition(muzzlePosition);
      }
      
      bulletSpawnPos.copy(muzzlePosition);
    } else {
      // Fallback if gun not found - use camera position
      this.camera.getWorldPosition(bulletSpawnPos);
    }
    
    // Create a direction vector pointing exactly where the player is looking
    // Based directly on the camera's world direction
    const bulletDirection = new Vector3(0, 0, -1); // Forward direction in camera space
    
    // Apply camera's rotation to get world direction
    this.camera.getWorldDirection(bulletDirection);
    
    // Apply accuracy based on player state and weapon
    this.applyAccuracySpread(bulletDirection);
    
    // Create bullet
    const bullet = new Bullet(bulletSpawnPos, bulletDirection, this.scene);
    
    // Set different bullet properties based on weapon
    if (this.currentWeapon === 'sniperRifle') {
      // Sniper bullets are faster and have longer trails
      bullet.velocity.multiplyScalar(1.5); // 50% faster
      bullet.maxTrailLength = 30; // Longer trail
    }
    
    // Add bullet to array
    this.bullets.push(bullet);
    
    // Apply recoil based on weapon
    this.applyRecoil();
    
    // Notify other players about the shot if in multiplayer
    if (this.gameSocket) {
      this.gameSocket.playerShoot(bulletSpawnPos, bulletDirection);
    }
  }
  
  applyAccuracySpread(bulletDirection: Vector3): void {
    // Determine accuracy based on player state and weapon
    let spread = 0;
    
    // Different base accuracy for different weapons
    const weaponAccuracyMultiplier = this.currentWeapon === 'sniperRifle' ? 0.3 : 1.0;
    
    if (this.isAiming) {
      if (this.isGrounded) {
        // Perfect accuracy when standing still and aiming
        spread = this.ACCURACY_STANDING_AIMING * weaponAccuracyMultiplier;
      } else {
        // Reduced accuracy when jumping and aiming
        spread = this.ACCURACY_JUMPING * 0.5 * weaponAccuracyMultiplier;
      }
    } else {
      // Not aiming
      if (!this.isMoving && this.isGrounded) {
        // Standing still but not aiming
        spread = this.ACCURACY_STANDING * weaponAccuracyMultiplier;
      } else if (this.isMoving && this.isGrounded) {
        // Moving but on ground
        spread = this.ACCURACY_MOVING * weaponAccuracyMultiplier;
      } else {
        // In the air (jumping/falling)
        spread = this.ACCURACY_JUMPING * weaponAccuracyMultiplier;
      }
    }
    
    // Additional spread due to recoil (muzzle climbing)
    const recoilSpread = this.currentRecoil;
    
    // Apply spread by adding random deviation to the direction vector
    if (spread > 0 || recoilSpread > 0) {
      // Calculate total spread
      const totalSpread = spread + recoilSpread;
      
      // Add random deviation within the spread range
      bulletDirection.x += (Math.random() - 0.5) * totalSpread * 2;
      bulletDirection.y += (Math.random() - 0.5) * totalSpread * 2;
      bulletDirection.z += (Math.random() - 0.5) * totalSpread * 2;
      
      // Re-normalize the direction vector
      bulletDirection.normalize();
    }
  }
  
  applyRecoil() {
    // Different recoil for different weapons
    let recoilAmount;
    
    if (this.currentWeapon === 'assaultRifle') {
      recoilAmount = this.recoilAmount; // Default recoil for assault rifle
    } else {
      recoilAmount = this.recoilAmount * 3; // Higher recoil for sniper rifle
    }
    
    // Add recoil (mostly vertical with slight random horizontal deviation)
    this.currentRecoil += recoilAmount;
    
    // Limit maximum recoil
    const maxRecoil = this.currentWeapon === 'assaultRifle' ? 0.05 : 0.12;
    this.currentRecoil = Math.min(this.currentRecoil, maxRecoil);
  }
  
  updateRecoil() {
    // Recover from recoil gradually
    if (this.currentRecoil > 0) {
      // Different recovery rates for different weapons
      const recoveryRate = this.currentWeapon === 'assaultRifle' 
        ? this.recoilRecovery 
        : this.recoilRecovery * 0.5; // Slower recovery for sniper
      
      this.currentRecoil -= recoveryRate;
      
      // Apply recoil to camera pitch
      if (this.currentRecoil > 0) {
        // Apply recoil to camera pitch only if in first person
        if (!this.isThirdPerson) {
          this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch - this.currentRecoil * 0.1));
          this.camera.rotation.x = this.pitch;
        }
      } else {
        this.currentRecoil = 0;
      }
    }
    
    // Update shooting cooldown
    if (this.shootCooldown > 0) {
      this.shootCooldown--;
      if (this.shootCooldown === 0) {
        this.canShoot = true;
      }
    }
  }
  
  updateBullets() {
    // Update all bullets and remove dead ones
    this.bullets = this.bullets.filter(bullet => bullet.update());
  }
  
  startAiming() {
    if (!this.isThirdPerson) { // Only allow aiming in first-person mode
      this.isAiming = true;
    }
  }
  
  stopAiming() {
    this.isAiming = false;
  }
  
  updateAimTransition() {
    // Different transition speeds for different weapons
    let transitionSpeed = this.transitionSpeed;
    if (this.currentWeapon === 'sniperRifle') {
      // Slower, more deliberate transition for sniper scope
      transitionSpeed = this.transitionSpeed * 0.7;
    }
    
    if (this.isAiming) {
      // Transition to aiming position
      this.aimTransitionProgress = Math.min(1, this.aimTransitionProgress + transitionSpeed);
    } else {
      // Transition back to normal position
      this.aimTransitionProgress = Math.max(0, this.aimTransitionProgress - transitionSpeed);
    }
    
    // Apply transition to FOV for zoom effect
    const targetFOV = this.isAiming ? this.aimingFOV : this.defaultFOV;
    this.camera.fov = this.defaultFOV + (targetFOV - this.defaultFOV) * this.aimTransitionProgress;
    this.camera.updateProjectionMatrix();
    
    // Update gun position based on aim transition
    this.playerModel.updateAimPosition(this.camera, this.aimTransitionProgress);
    
    // Update crosshair visibility for sniper rifle during transition
    const crosshair = document.getElementById('crosshair');
    if (crosshair && this.currentWeapon === 'sniperRifle') {
      // Hide crosshair as soon as we start aiming with sniper rifle
      if (this.isAiming && !this.isThirdPerson) {
        crosshair.style.display = 'none';
      } else if (!this.isThirdPerson) {
        // Only show crosshair when fully returned to non-aiming state
        crosshair.style.display = this.aimTransitionProgress < 0.1 ? 'block' : 'none';
      }
    }
  }
  
  toggleCameraMode() {
    this.isThirdPerson = !this.isThirdPerson;
    
    // Make player model visible in third person, invisible in first person
    this.playerModel.body.traverse((object) => {
      if (object instanceof Mesh) {
        object.material.transparent = !this.isThirdPerson;
        object.material.opacity = this.isThirdPerson ? 1 : 0;
      }
    });
    
    // Update gun visibility based on camera mode
    if (this.isThirdPerson) {
      // In third person view, show gun on character model
      this.playerModel.updateGunVisibility(false);
      
      // Hide first-person gun if it exists
      if (this.camera.userData.fpGun) {
        this.camera.userData.fpGun.visible = false;
      }
      
      // Exit aiming mode if active
      this.stopAiming();
    } else {
      // In first person view, hide gun on character model
      this.playerModel.updateGunVisibility(true);
      
      // Show first-person gun
      this.playerModel.positionGunForFirstPerson(this.camera);
    }
    
    // Update camera position for the new mode
    this.updateCameraPosition();
  }
  
  updateCameraPosition() {
    if (this.isThirdPerson) {
      // Third-person camera position - behind and above player
      this.camera.position.set(0, this.thirdPersonHeight, this.thirdPersonDistance);
      this.camera.rotation.set(-0.3, 0, 0); // Look down slightly at player
      
      // Update gun visibility for third-person
      this.playerModel.updateGunVisibility(false);
      
      // Remove first-person gun if it exists
      if (this.camera.userData.fpGun) {
        this.camera.userData.fpGun.visible = false;
      }
    } else {
      // First-person camera position - at eye level
      let eyeHeight = this.normalEyeHeight;
      
      // When sprinting in first person, move camera a bit forward to simulate leaning forward
      if (this.isSprinting) {
        this.camera.position.set(0, eyeHeight, -0.3); // Move forward slightly
      } else {
        this.camera.position.set(0, eyeHeight, 0);
      }
      
      this.camera.rotation.set(this.pitch, 0, 0); // Apply pitch directly to camera
      
      // Update gun visibility for first-person
      this.playerModel.updateGunVisibility(true);
      
      // Position the first-person gun
      this.playerModel.positionGunForFirstPerson(this.camera);
    }
  }

  startSprinting() {
    if (!this.isSprinting && this.isGrounded) {
      this.isSprinting = true;
      
      // Stop aiming when sprinting
      if (this.isAiming) {
        this.stopAiming();
      }
      
      // Update the player model to show sprinting animation
      this.playerModel.setSprinting(true);
      
      // Update camera position
      this.updateCameraPosition();
    }
  }

  stopSprinting() {
    if (this.isSprinting) {
      this.isSprinting = false;
      
      // Update the player model to stop sprinting animation
      this.playerModel.setSprinting(false);
      
      // Update camera position
      this.updateCameraPosition();
    }
  }

  updateAnimationState() {
    // Check if player is moving
    const isMovingNow = this.horizontalVelocity.length() > 0.01;
    
    // Update moving state
    this.isMoving = isMovingNow;
    
    // Get current movement speed for animation speed scaling
    this.currentSpeed = this.horizontalVelocity.length();
    
    // Update player model animation - pass the actual speed for more natural animation
    this.playerModel.update(this.isMoving, this.isSprinting ? this.sprintSpeed : this.walkSpeed);
  }

  applyMovementForce(direction: Vector3, speed: number) {
    // Apply player rotation to direction
    direction.applyQuaternion(this.playerBody.quaternion);
    direction.y = 0; // Keep movement on the horizontal plane
    direction.normalize(); // Normalize to ensure consistent speed
    
    // Scale by speed factor
    direction.multiplyScalar(speed);
    
    // Add to horizontal velocity
    if (this.isGrounded) {
      // On ground, we have full control
      this.horizontalVelocity.add(direction);
    } else {
      // In air, we have reduced control
      const airControl = direction.clone().multiplyScalar(this.airControlFactor);
      this.horizontalVelocity.add(airControl);
    }
  }

  moveForward(speed: number) {
    const direction = new Vector3(0, 0, -1);
    this.applyMovementForce(direction, speed);
  }

  moveBackward(speed: number) {
    const direction = new Vector3(0, 0, 1);
    this.applyMovementForce(direction, speed);
  }

  moveLeft(speed: number) {
    const direction = new Vector3(-1, 0, 0);
    this.applyMovementForce(direction, speed);
  }

  moveRight(speed: number) {
    const direction = new Vector3(1, 0, 0);
    this.applyMovementForce(direction, speed);
  }

  jump() {
    if (this.isGrounded && this.jumpCooldown <= 0) {
      // Only apply vertical force for jumping, no forward thrust
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
      this.jumpCooldown = 5; // Add a small cooldown for jump
    }
  }

  applyPhysics() {
    // Apply gravity to vertical velocity
    this.velocity.y -= this.gravity;
    
    // Apply friction to horizontal movement
    if (this.isGrounded) {
      // More friction on ground
      this.horizontalVelocity.multiplyScalar(this.friction);
    } else {
      // Less friction in air (maintain momentum)
      this.horizontalVelocity.multiplyScalar(this.airFriction);
    }
    
    // Determine max speed based on movement state
    let maxHorizontalSpeed;
    if (!this.isGrounded) {
      maxHorizontalSpeed = this.sprintSpeed; // In air, can go up to sprint speed
    } else if (this.isSprinting) {
      maxHorizontalSpeed = this.sprintSpeed;
    } else {
      maxHorizontalSpeed = this.walkSpeed;
    }
    
    // Cap horizontal velocity to max speed
    const horizontalSpeed = this.horizontalVelocity.length();
    if (horizontalSpeed > maxHorizontalSpeed) {
      this.horizontalVelocity.normalize().multiplyScalar(maxHorizontalSpeed);
    }
    
    // Calculate new position based on velocity
    const newPosition = this.playerBody.position.clone();
    newPosition.y += this.velocity.y;
    
    // Handle horizontal movement with collision detection
    // First try moving in X direction
    const positionAfterX = newPosition.clone();
    positionAfterX.x += this.horizontalVelocity.x;
    
    // Check for collisions in X direction
    const collisionResultX = this.world.checkPlayerCollision(positionAfterX, this.playerRadius);
    if (!collisionResultX.collided) {
      // No collision, accept X movement
      newPosition.x = positionAfterX.x;
    } else {
      // Collision occurred, position adjusted by collision system
      newPosition.x = collisionResultX.adjustedPosition.x;
      // Stop X velocity
      this.horizontalVelocity.x = 0;
    }
    
    // Then try moving in Z direction
    const positionAfterZ = newPosition.clone();
    positionAfterZ.z += this.horizontalVelocity.z;
    
    // Check for collisions in Z direction
    const collisionResultZ = this.world.checkPlayerCollision(positionAfterZ, this.playerRadius);
    if (!collisionResultZ.collided) {
      // No collision, accept Z movement
      newPosition.z = positionAfterZ.z;
    } else {
      // Collision occurred, position adjusted by collision system
      newPosition.z = collisionResultZ.adjustedPosition.z;
      // Stop Z velocity
      this.horizontalVelocity.z = 0;
    }
    
    // Update player position
    this.playerBody.position.copy(newPosition);
    
    // Check if player is on the ground
    if (this.playerBody.position.y <= 0) {
      this.playerBody.position.y = 0;
      this.velocity.y = 0;
      this.isGrounded = true;
    }
    
    // Apply a minimum threshold to stop very small movements
    if (horizontalSpeed < 0.001) {
      this.horizontalVelocity.set(0, 0, 0);
    }
    
    // Handle jump cooldown
    if (this.jumpCooldown > 0) {
      this.jumpCooldown--;
    }
  }

  // Toggle between weapons
  toggleWeapon() {
    // If currently aiming, cancel aiming when switching weapons
    if (this.isAiming) {
      this.stopAiming();
      this.aimTransitionProgress = 0; // Immediately reset zoom level
      this.camera.fov = this.defaultFOV;
      this.camera.updateProjectionMatrix();
    }
    
    // Toggle between assault rifle and sniper rifle
    if (this.currentWeapon === 'assaultRifle') {
      this.currentWeapon = 'sniperRifle';
      
      // Sniper rifle has higher accuracy but slower fire rate
      this.shootCooldown = 30; // Longer cooldown for sniper
      
      // Update UI to show sniper rifle
      const weaponNameEl = document.getElementById('weapon-name');
      if (weaponNameEl) {
        weaponNameEl.textContent = 'Sniper Rifle';
      }
      
      // Extreme zoom when aiming with sniper
      this.aimingFOV = 15; // Ultra-tight FOV for sniper scope (changed from 25 to 15)
      
      console.log('Switched to Sniper Rifle');
    } else {
      this.currentWeapon = 'assaultRifle';
      
      // Assault rifle has faster fire rate
      this.shootCooldown = 10; // Default cooldown for assault rifle
      
      // Update UI to show assault rifle
      const weaponNameEl = document.getElementById('weapon-name');
      if (weaponNameEl) {
        weaponNameEl.textContent = 'Assault Rifle';
      }
      
      // Normal zoom when aiming with assault rifle
      this.aimingFOV = 65; // Default FOV for assault rifle
      
      console.log('Switched to Assault Rifle');
    }
    
    // Hide scope overlay if it exists
    const scopeOverlay = document.getElementById('scope-overlay');
    if (scopeOverlay) {
      scopeOverlay.style.display = 'none';
    }
    
    // Tell the PlayerModel to update the weapon model
    this.playerModel.switchWeapon(this.camera, this.currentWeapon);
  }

  // Create a scope overlay for sniper rifle
  createScopeOverlay() {
    // Check if we already have a scope overlay
    if (document.getElementById('scope-overlay')) {
      return; // Already exists
    }
    
    // Create scope overlay container
    const scopeOverlay = document.createElement('div');
    scopeOverlay.id = 'scope-overlay';
    scopeOverlay.style.position = 'absolute';
    scopeOverlay.style.top = '0';
    scopeOverlay.style.left = '0';
    scopeOverlay.style.width = '100%';
    scopeOverlay.style.height = '100%';
    scopeOverlay.style.pointerEvents = 'none';
    scopeOverlay.style.display = 'none'; // Hidden by default
    scopeOverlay.style.transition = 'opacity 0.2s';
    scopeOverlay.style.zIndex = '100'; // Ensure it's on top
    document.body.appendChild(scopeOverlay);
    
    // Create scope circle (outer circle)
    const scopeCircle = document.createElement('div');
    scopeCircle.style.position = 'absolute';
    scopeCircle.style.top = '50%';
    scopeCircle.style.left = '50%';
    scopeCircle.style.width = '68vh'; // Slightly smaller for extreme zoom
    scopeCircle.style.height = '68vh';
    scopeCircle.style.transform = 'translate(-50%, -50%)';
    scopeCircle.style.border = '3px solid black'; // Thicker border
    scopeCircle.style.borderRadius = '50%';
    scopeCircle.style.boxShadow = '0 0 0 9999px rgba(0, 0, 0, 0.9)'; // Darker outside for extreme zoom
    // Add a subtle scope lens effect with bluish tint for high-powered scope
    scopeCircle.style.background = 'radial-gradient(circle, rgba(200, 230, 255, 0.15) 0%, rgba(0, 40, 80, 0.25) 100%)';
    scopeOverlay.appendChild(scopeCircle);
    
    // Create thinner crosshair lines for precision
    const createCrosshairLine = (vertical: boolean) => {
      const line = document.createElement('div');
      line.style.position = 'absolute';
      line.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'; // Semi-transparent
      
      if (vertical) {
        line.style.width = '1px';
        line.style.height = '68vh';
        line.style.top = '50%';
        line.style.left = '50%';
        line.style.transform = 'translateX(-50%)';
      } else {
        line.style.width = '68vh';
        line.style.height = '1px';
        line.style.top = '50%';
        line.style.left = '50%';
        line.style.transform = 'translateY(-50%)';
      }
      
      scopeOverlay.appendChild(line);
    };
    
    // Add vertical and horizontal lines
    createCrosshairLine(true);
    createCrosshairLine(false);
    
    // Add center dot
    const centerDot = document.createElement('div');
    centerDot.style.position = 'absolute';
    centerDot.style.width = '2px'; // Smaller for precision
    centerDot.style.height = '2px';
    centerDot.style.backgroundColor = 'rgba(255, 0, 0, 0.8)'; // Red for better visibility
    centerDot.style.borderRadius = '50%';
    centerDot.style.top = '50%';
    centerDot.style.left = '50%';
    centerDot.style.transform = 'translate(-50%, -50%)';
    scopeOverlay.appendChild(centerDot);
    
    // Add distance markers with numbers for rangefinding (elevation marks)
    const addDistanceMarker = (distance: number, position: number) => {
      // Create a container for the marker and number
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.top = `calc(50% + ${position}vh)`;
      container.style.left = '50%';
      container.style.transform = 'translate(-50%, -50%)';
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.justifyContent = 'center';
      container.style.width = '30px';
      
      // Add the dot
      const dot = document.createElement('div');
      dot.style.width = '3px';
      dot.style.height = '3px';
      dot.style.backgroundColor = 'black';
      dot.style.borderRadius = '50%';
      container.appendChild(dot);
      
      // Add distance number
      const number = document.createElement('div');
      number.style.position = 'absolute';
      number.style.left = '15px';
      number.style.fontSize = '8px';
      number.style.fontFamily = 'monospace';
      number.style.color = 'black';
      number.textContent = distance.toString();
      container.appendChild(number);
      
      scopeOverlay.appendChild(container);
    };
    
    // Add range markers at increasing intervals
    addDistanceMarker(100, 5);
    addDistanceMarker(200, 10);
    addDistanceMarker(300, 15);
    addDistanceMarker(400, 20);
    addDistanceMarker(500, 25);
    addDistanceMarker(600, 30);
    
    // Add windage markers (horizontal marks)
    for (let i = 1; i <= 6; i++) {
      // Create marks at smaller intervals for precision
      const interval = i * 5;
      
      // Right side marks
      const rightMark = document.createElement('div');
      rightMark.style.position = 'absolute';
      rightMark.style.width = '3px';
      rightMark.style.height = '3px';
      rightMark.style.backgroundColor = 'black';
      rightMark.style.top = '50%';
      rightMark.style.left = `calc(50% + ${interval}vh)`;
      rightMark.style.transform = 'translate(-50%, -50%)';
      rightMark.style.borderRadius = '50%';
      scopeOverlay.appendChild(rightMark);
      
      // Left side marks
      const leftMark = document.createElement('div');
      leftMark.style.position = 'absolute';
      leftMark.style.width = '3px';
      leftMark.style.height = '3px';
      leftMark.style.backgroundColor = 'black';
      leftMark.style.top = '50%';
      leftMark.style.left = `calc(50% - ${interval}vh)`;
      leftMark.style.transform = 'translate(-50%, -50%)';
      leftMark.style.borderRadius = '50%';
      scopeOverlay.appendChild(leftMark);
    }
    
    // Add mildot pattern for range estimation
    const addMilDot = (x: number, y: number) => {
      if (x === 0 && y === 0) return; // Skip center point
      
      const dot = document.createElement('div');
      dot.style.position = 'absolute';
      dot.style.width = '2px';
      dot.style.height = '2px';
      dot.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      dot.style.top = `calc(50% + ${y * 10}vh)`;
      dot.style.left = `calc(50% + ${x * 10}vh)`;
      dot.style.transform = 'translate(-50%, -50%)';
      dot.style.borderRadius = '50%';
      scopeOverlay.appendChild(dot);
    };
    
    // Create mil-dot pattern (skip the center point)
    for (let y = -2; y <= 2; y++) {
      for (let x = -2; x <= 2; x++) {
        addMilDot(x, y);
      }
    }
    
    // Add scope edge details (outer ring)
    const scopeEdge = document.createElement('div');
    scopeEdge.style.position = 'absolute';
    scopeEdge.style.top = '50%';
    scopeEdge.style.left = '50%';
    scopeEdge.style.width = '74vh'; // Slightly larger than the scope circle
    scopeEdge.style.height = '74vh';
    scopeEdge.style.transform = 'translate(-50%, -50%)';
    scopeEdge.style.border = '12px solid black'; // Thick border representing the physical scope edge
    scopeEdge.style.borderRadius = '50%';
    scopeEdge.style.pointerEvents = 'none';
    scopeOverlay.insertBefore(scopeEdge, scopeOverlay.firstChild); // Add at the beginning so it's behind other elements
  }
  
  // Update scope overlay visibility
  updateScopeOverlay() {
    const scopeOverlay = document.getElementById('scope-overlay');
    if (!scopeOverlay) return;
    
    // Only show scope overlay when aiming with sniper rifle in first-person
    const shouldShowScope = this.isAiming && 
                         this.currentWeapon === 'sniperRifle' && 
                         !this.isThirdPerson &&
                         this.aimTransitionProgress > 0.9; // Only show when almost fully aimed
    
    scopeOverlay.style.display = shouldShowScope ? 'block' : 'none';
    
    // Get the crosshair element
    const crosshair = document.getElementById('crosshair');
    if (crosshair) {
      // Hide crosshair when aiming with sniper rifle at any zoom level, or in third person
      if (this.isThirdPerson) {
        crosshair.style.display = 'none';
      } else if (this.currentWeapon === 'sniperRifle' && this.isAiming) {
        // Always hide crosshair when aiming with sniper rifle, regardless of zoom level
        crosshair.style.display = 'none';
      } else {
        // Show crosshair in first person with assault rifle or not aiming
        crosshair.style.display = 'block';
      }
    }
  }

  // New method to check bullet collisions with bots more efficiently
  checkBulletBotCollisions(bots: any[]) {
    // For each active bullet
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      
      // Check collision with each bot
      for (let j = 0; j < bots.length; j++) {
        const bot = bots[j];
        if (bot.isActive) {
          // Use the enhanced checkHit method that takes the entire bullet object
          if (bot.checkHit(bullet)) {
            // If hit, destroy bullet and break to next bullet
            bullet.destroy();
            this.bullets.splice(i, 1);
            break; // Bullet can only hit one bot
          }
        }
      }
    }
  }

  update() {
    // Create scope overlay if it doesn't exist
    if (this.currentWeapon === 'sniperRifle' && !document.getElementById('scope-overlay')) {
      this.createScopeOverlay();
    }
    
    // Determine base move speed based on player state
    let baseSpeed = this.isSprinting ? this.sprintSpeed : this.walkSpeed;
    
    // Slow down movement speed when aiming
    if (this.isAiming && !this.isThirdPerson) {
      // More slowdown when aiming with sniper rifle, especially when fully zoomed
      if (this.currentWeapon === 'sniperRifle') {
        // Calculate reduction based on zoom level - more reduction as we fully zoom in
        const zoomFactor = this.aimTransitionProgress;
        // Starts at 40% speed and drops to 20% when fully zoomed
        const sniperSlowdown = 0.4 - (zoomFactor * 0.2);
        baseSpeed *= sniperSlowdown;
      } else {
        // Normal slowdown for assault rifle
        baseSpeed *= 0.6;
      }
    }
    
    // Handle movement input
    // Support both WASD and ZQSD controls (Z forward, Q left, S backward, D right)
    if (this.keys['w'] || this.keys['z'] || this.keys['arrowup']) this.moveForward(baseSpeed);
    if (this.keys['s'] || this.keys['arrowdown']) this.moveBackward(baseSpeed);
    if (this.keys['a'] || this.keys['q'] || this.keys['arrowleft']) this.moveLeft(baseSpeed);
    if (this.keys['d'] || this.keys['arrowright']) this.moveRight(baseSpeed);
    
    // Handle jumping
    if (this.keys[' ']) {
      this.jump();
    }
    
    // Handle continuous shooting with left mouse button
    if (this.keys['shoot'] && this.canShoot) {
      this.shoot();
    }
    
    // Update aiming transition
    this.updateAimTransition();
    
    // Update recoil recovery
    this.updateRecoil();
    
    // Update bullets
    this.updateBullets();
    
    // Update scope overlay if using sniper rifle
    if (this.currentWeapon === 'sniperRifle') {
      this.updateScopeOverlay();
    }
    
    // Apply physics (gravity, friction, velocity)
    this.applyPhysics();
    
    // Update animation state
    this.updateAnimationState();
  }
}