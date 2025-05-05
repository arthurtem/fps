import * as THREE from 'three';
import { PlayerModel } from './PlayerModel';
import { Bullet } from './Bullet';

export class Bot {
  model: PlayerModel;
  body: THREE.Group;
  speed: number = 0.1;
  isActive: boolean = true;
  position: THREE.Vector3;
  hitbox: THREE.Sphere; // Spherical hitbox for more reliable collision
  hitboxRadius: number = 1.0; // Increased size for better hit registration
  id: string; // Unique ID for networking
  
  constructor(scene: THREE.Scene, startPosition: THREE.Vector3, playerPosition: THREE.Vector3) {
    // Create bot model based on player model
    this.model = new PlayerModel(true);
    this.body = this.model.body;
    
    // Position the bot
    this.position = startPosition.clone();
    this.body.position.copy(this.position);
    
    // Create a sphere-based hitbox for more accurate collision
    this.hitbox = new THREE.Sphere(this.position.clone(), this.hitboxRadius);
    
    // Generate a default ID
    this.id = `bot-${Math.random().toString(36).substring(2, 10)}`;
    
    // Set initial direction facing player
    this.lookAt(playerPosition);
    
    // Add to scene
    scene.add(this.body);
    
    // Start running animation
    this.model.update(true, this.speed);
  }
  
  update(playerPosition: THREE.Vector3) {
    if (!this.isActive) return;
    
    // Calculate direction toward player
    const direction = new THREE.Vector3()
      .subVectors(playerPosition, this.position)
      .normalize();
    
    // Update bot position - move toward player
    const movement = direction.clone().multiplyScalar(this.speed);
    this.position.add(movement);
    this.body.position.copy(this.position);
    
    // Update hitbox position
    this.hitbox.center.copy(this.position);
    
    // Update bot rotation to face player
    this.lookAt(playerPosition);
    
    // Update animation
    this.updateAnimation();
  }
  
  updateAnimation() {
    if (!this.isActive) return;
    
    // Just update the model animation without moving
    this.model.update(true, this.speed);
  }
  
  lookAt(targetPosition: THREE.Vector3) {
    // Calculate direction to face
    const direction = new THREE.Vector3()
      .subVectors(targetPosition, this.position)
      .normalize();
    
    // Calculate angle on XZ plane (horizontal)
    const angle = Math.atan2(direction.x, direction.z);
    
    // Apply rotation
    this.body.rotation.y = angle;
  }
  
  hit() {
    // Bot was hit by a bullet
    this.isActive = false;
    
    // Create death animation - body parts falling apart
    this.createDeathAnimation();
    
    // Log hit
    console.log('Bot hit!');
  }
  
  createDeathAnimation() {
    // First detach all parts from hierarchy so they can fall independently
    const detachedParts: THREE.Mesh[] = [];
    const worldPositions: THREE.Vector3[] = [];
    const worldQuaternions: THREE.Quaternion[] = [];
    const worldScales: THREE.Vector3[] = [];
    
    // Map to track which parts have hit the ground
    const partsOnGround = new Map<THREE.Mesh, boolean>();
    
    // Get the world position of the bot
    const botWorldPosition = new THREE.Vector3();
    this.body.getWorldPosition(botWorldPosition);
    
    // Scene reference for re-adding the parts
    let sceneRef: THREE.Scene | null = null;
    
    // Find all meshes that need to be detached
    this.body.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        // Get the world positioning data
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        
        // Get the world transformation of this part
        object.getWorldPosition(worldPos);
        object.getWorldQuaternion(worldQuat);
        object.getWorldScale(worldScale);
        
        // Store references and transforms
        detachedParts.push(object);
        worldPositions.push(worldPos);
        worldQuaternions.push(worldQuat);
        worldScales.push(worldScale);
        
        // Get scene reference if we don't have it
        if (!sceneRef && this.body.parent) {
          sceneRef = this.body.parent as THREE.Scene;
        }
      }
    });
    
    // Hide the original bot
    this.body.visible = false;
    
    // Now add each part to the scene directly with its world transform
    detachedParts.forEach((part, index) => {
      // Remove part from current parent
      if (part.parent) {
        part.parent.remove(part);
      }
      
      // Reset the part's local transform to match its previous world transform
      part.position.copy(worldPositions[index]);
      part.quaternion.copy(worldQuaternions[index]);
      part.scale.copy(worldScales[index]);
      
      // Add to scene directly
      if (sceneRef) {
        sceneRef.add(part);
        
        // Calculate explosion force (very subtle for a small pop effect)
        const explosionForce = 0.05; // Drastically reduced from 0.3
        
        // Direction from center of bot (for mild pop effect)
        const toCenter = new THREE.Vector3().subVectors(botWorldPosition, part.position);
        const distance = toCenter.length();
        
        // Calculate direction - very gentle outward force
        let directionVec: THREE.Vector3;
        if (distance > 0.001) {
          // Parts move slightly outward from center
          directionVec = toCenter.normalize().multiplyScalar(-explosionForce);
        } else {
          // Random direction for center parts (very small)
          directionVec = new THREE.Vector3(
            (Math.random() - 0.5) * explosionForce * 0.5,
            0,
            (Math.random() - 0.5) * explosionForce * 0.5
          );
        }
        
        // Add minimal upward velocity - just enough to separate parts
        directionVec.y += Math.random() * 0.08 + 0.03;
        
        // Add tiny bit of randomness
        directionVec.x += (Math.random() - 0.5) * 0.02;
        directionVec.z += (Math.random() - 0.5) * 0.02;
        
        // Store velocity in userData
        part.userData.velocity = directionVec;
        
        // Add minimal rotational momentum - just enough to make parts fall naturally
        // For limbs (longer objects), still add slight tilt to ensure they fall over
        const isLongObject = part.geometry.boundingBox && 
                             (part.geometry.boundingBox.max.y - part.geometry.boundingBox.min.y > 0.4);
        
        part.userData.rotationVelocity = new THREE.Vector3(
          (Math.random() - 0.5) * 0.05 + (isLongObject ? 0.03 : 0), // Much less X rotation
          (Math.random() - 0.5) * 0.02,                             // Minimal Y rotation
          (Math.random() - 0.5) * 0.05 + (isLongObject ? 0.03 : 0)  // Much less Z rotation
        );
        
        // Ensure limbs tend to fall over naturally
        if (isLongObject) {
          // Determine if this is likely a leg/arm by checking if it's below center
          if (part.position.y < botWorldPosition.y) {
            // Add just a tiny initial tilt
            part.rotation.x += (Math.random() - 0.5) * 0.05;
            part.rotation.z += (Math.random() - 0.5) * 0.05;
          }
        }
        
        // Mark as not on ground initially
        partsOnGround.set(part, false);
        
        // Set up transparency for fading
        if (part.material) {
          if (Array.isArray(part.material)) {
            part.material.forEach(mat => {
              mat.transparent = true;
              mat.opacity = 1.0;
            });
          } else {
            part.material.transparent = true;
            part.material.opacity = 1.0;
          }
        }
      }
    });
    
    // Animation parameters
    const totalDuration = 4.0;      // Shorter total duration 
    const fallDuration = 2.0;       // Less time for parts to fall
    const groundFadeDuration = 2.0; // Fade duration after hitting ground
    const startTime = Date.now();
    
    // Physics parameters - adjusted for subtle falling effect
    const gravity = 0.01;        // Gentler gravity
    const bounceCoeff = 0.1;     // Less bouncy
    const groundFriction = 0.95; // More friction for quicker stopping
    
    // Create animation loop
    const animateBodyParts = () => {
      // Calculate elapsed time
      const elapsedTime = (Date.now() - startTime) / 1000;
      const progress = Math.min(1.0, elapsedTime / totalDuration);
      
      // Only update physics while we're in the falling phase
      const isInFallingPhase = elapsedTime < fallDuration;
      
      // Update each body part
      detachedParts.forEach((part) => {
        // Check if this part is on the ground
        const isOnGround = partsOnGround.get(part) || false;
        
        if (!isOnGround && isInFallingPhase) {
          // Still falling - apply physics
          
          // Apply gravity to Y velocity
          part.userData.velocity.y -= gravity;
          
          // Move the part
          part.position.add(part.userData.velocity);
          
          // Apply rotation based on velocity and current orientation
          // This creates more realistic tumbling behavior
          
          // Add basic rotation
          part.rotation.x += part.userData.rotationVelocity.x;
          part.rotation.y += part.userData.rotationVelocity.y;
          part.rotation.z += part.userData.rotationVelocity.z;
          
          // Check if part has hit the ground
          if (part.position.y < 0) {
            // Snap to ground (with tiny offset to prevent z-fighting)
            part.position.y = 0.001;
            
            // Bounce with dampening
            part.userData.velocity.y *= -bounceCoeff;
            
            // Apply extra friction when hitting ground
            part.userData.velocity.x *= groundFriction;
            part.userData.velocity.z *= groundFriction;
            
            // Reduce rotation velocity when hitting ground
            part.userData.rotationVelocity.x *= 0.8;
            part.userData.rotationVelocity.z *= 0.8;
            
            // Check if velocity is very small, consider it stopped
            if (Math.abs(part.userData.velocity.y) < 0.02 && 
                part.userData.velocity.length() < 0.05) {
              // Mark as on ground - no more physics updates
              partsOnGround.set(part, true);
              
              // Record the time when this part hit the ground for fading
              part.userData.groundHitTime = Date.now();
            }
          }
        } else {
          // Part is on ground or falling phase is over
          
          // If we haven't recorded a hit time yet, do it now
          if (!part.userData.groundHitTime) {
            part.userData.groundHitTime = Date.now();
            partsOnGround.set(part, true);
          }
          
          // Calculate how long this part has been on the ground
          const groundTime = (Date.now() - part.userData.groundHitTime) / 1000;
          
          // Only start fading after a delay so parts fade at different times
          if (groundTime > 0.2) {
            // Calculate fade progress (from 1.0 to 0.0)
            const fadeProgress = Math.min(1.0, (groundTime - 0.2) / groundFadeDuration);
            const opacity = 1.0 - fadeProgress;
            
            // Apply fading
            if (part.material) {
              if (Array.isArray(part.material)) {
                part.material.forEach(mat => {
                  mat.opacity = opacity;
                });
              } else {
                part.material.opacity = opacity;
              }
            }
          }
        }
      });
      
      // Continue animation until complete
      if (progress < 1.0) {
        requestAnimationFrame(animateBodyParts);
      } else {
        // Animation complete, cleanup
        // Remove all parts from scene
        detachedParts.forEach(part => {
          if (part.parent) {
            part.parent.remove(part);
          }
        });
      }
    };
    
    // Start animation
    animateBodyParts();
  }
  
  // Enhanced function to check if bot is hit by a bullet
  checkHit(bullet: Bullet): boolean {
    if (!this.isActive) return false;
    
    // Get bullet's current and previous positions
    const bulletPosition = bullet.mesh.position.clone();
    const bulletPreviousPosition = bulletPosition.clone().sub(bullet.velocity);
    
    // Method 1: Simple sphere collision detection - Fast and more forgiving
    if (this.hitbox.containsPoint(bulletPosition)) {
      this.hit();
      return true;
    }
    
    // Method 2: Ray casting for fast-moving bullets
    // Create a ray representing the bullet's path this frame
    const bulletDirection = bullet.velocity.clone().normalize();
    const bulletRay = new THREE.Ray(bulletPreviousPosition, bulletDirection);
    
    // Calculate distance from the current bullet position to the previous
    const bulletDistanceThisFrame = bullet.velocity.length();
    
    // Test for ray intersection with the bot's hitbox
    const target = new THREE.Vector3();
    const rayResult = bulletRay.intersectSphere(this.hitbox, target);
    if (rayResult) {
      // Calculate if the intersection point is between the previous and current position
      const distanceFromPrevious = rayResult.distanceTo(bulletPreviousPosition);
      if (distanceFromPrevious <= bulletDistanceThisFrame * 1.1) { // 10% margin
        this.hit();
        return true;
      }
    }
    
    // Method 3: Bounding box check as a backup
    const boundingBox = new THREE.Box3().setFromObject(this.body);
    if (boundingBox.containsPoint(bulletPosition)) {
      this.hit();
      return true;
    }
    
    return false;
  }
  
  // Check if bot has reached the player
  hasReachedTarget(playerPosition: THREE.Vector3, threshold: number = 2): boolean {
    const distance = this.position.distanceTo(playerPosition);
    return distance < threshold;
  }
} 