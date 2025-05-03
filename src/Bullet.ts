import * as THREE from 'three';

export class Bullet {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  scene: THREE.Scene;
  lifespan: number = 100; // How many frames the bullet lives for
  age: number = 0;
  trail: THREE.Line;
  trailPositions: THREE.Vector3[];
  maxTrailLength: number = 20;
  
  constructor(position: THREE.Vector3, direction: THREE.Vector3, scene: THREE.Scene) {
    this.scene = scene;
    
    // Create bullet geometry and material
    const geometry = new THREE.SphereGeometry(0.03, 8, 8);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffff00
    });
    
    // Create bullet mesh and add to scene
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(position);
    scene.add(this.mesh);
    
    // Set initial velocity (speed of bullet) - guaranteed straight line
    this.velocity = direction.clone().normalize().multiplyScalar(1.5);
    
    // Create straight line trail
    this.trailPositions = [position.clone()];
    
    // Create trail geometry
    const trailGeometry = new THREE.BufferGeometry().setFromPoints(this.trailPositions);
    
    // Create trail material (white line)
    const trailMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 1
    });
    
    // Create line and add to scene
    this.trail = new THREE.Line(trailGeometry, trailMaterial);
    scene.add(this.trail);
  }
  
  update() {
    // Update age
    this.age++;
    
    // Apply velocity to position (straight line, no gravity)
    this.mesh.position.add(this.velocity);
    
    // No gravity - completely straight path
    // this.velocity.y -= 0.001; // Removed gravity
    
    // Update trail
    this.updateTrail();
    
    // Check if bullet has reached end of life
    if (this.age >= this.lifespan) {
      this.destroy();
      return false;
    }
    
    return true;
  }
  
  updateTrail() {
    // Add current position to the trail positions
    this.trailPositions.push(this.mesh.position.clone());
    
    // Limit trail length by removing old positions
    if (this.trailPositions.length > this.maxTrailLength) {
      this.trailPositions.shift();
    }
    
    // Update the trail geometry
    const trailGeometry = new THREE.BufferGeometry().setFromPoints(this.trailPositions);
    this.trail.geometry.dispose(); // Clean up old geometry
    this.trail.geometry = trailGeometry;
  }
  
  destroy() {
    // Remove bullet from scene
    this.scene.remove(this.mesh);
    
    // Remove trail
    this.scene.remove(this.trail);
    
    // Clean up geometry
    this.mesh.geometry.dispose();
    if (this.mesh.material instanceof THREE.Material) {
      this.mesh.material.dispose();
    }
    this.trail.geometry.dispose();
    if (this.trail.material instanceof THREE.Material) {
      this.trail.material.dispose();
    }
  }
} 