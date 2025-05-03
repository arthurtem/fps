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
    
    // Make bot invisible
    this.body.visible = false;
    
    // Log hit
    console.log('Bot hit!');
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