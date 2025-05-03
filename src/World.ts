import * as THREE from 'three';

export class World {
  scene: THREE.Scene;
  obstacles: THREE.Mesh[] = [];
  collidableObjects: THREE.Object3D[] = []; // For player collisions
  bunkerWidth: number = 15; // Store bunker width for reference
  terrainWidth: number = 20; // Just wider than the bunker (15 units wide)
  terrainLength: number = 120; // Shorter terrain (reduced from 200)
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createGround();
    this.createSky();
    this.createObstacles();
  }

  createGround() {
    // Create a checkerboard texture for the ground
    const textureSize = 1024;
    const checkerSize = 64;
    
    // Create a canvas to draw the texture
    const canvas = document.createElement('canvas');
    canvas.width = textureSize;
    canvas.height = textureSize;
    const context = canvas.getContext('2d');
    
    if (context) {
      // Fill with brownish ground color
      context.fillStyle = '#8B4513'; // Saddle brown for terrain
      context.fillRect(0, 0, textureSize, textureSize);
      
      // Add darker squares for checkerboard effect
      context.fillStyle = '#654321'; // Darker brown
      
      for (let x = 0; x < textureSize; x += checkerSize * 2) {
        for (let y = 0; y < textureSize; y += checkerSize * 2) {
          context.fillRect(x, y, checkerSize, checkerSize);
          context.fillRect(x + checkerSize, y + checkerSize, checkerSize, checkerSize);
        }
      }
    }
    
    // Create a texture from the canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 12); // Adjusted for the narrower width
    
    // Create a large flat surface with the checkerboard texture
    const groundGeometry = new THREE.PlaneGeometry(this.terrainWidth, this.terrainLength);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
      map: texture,
      color: 0xffffff // neutral color to allow texture to show properly
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    
    // Rotate the plane to be horizontal
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    
    // Position the ground so the player starts at one end
    ground.position.z = -this.terrainLength / 2 + 10; // Offset so player starts at one end
    
    ground.receiveShadow = true;
    
    this.scene.add(ground);
  }

  createSky() {
    // Set blue color for the sky (background)
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue color
  }
  
  createObstacles() {
    // Create various obstacles on the terrain
    const obstacleCount = 10; // Significantly reduced from 35
    const obstacleTypes = [
      { width: 2.5, height: 1.5, depth: 2.5, color: 0x8B8878 }, // Box barrier
      { width: 1.8, height: 1, depth: 3, color: 0x708090 }, // Long low wall
      { width: 1.5, height: 2, depth: 1.5, color: 0x556B2F },  // Tall barrier
    ];
    
    // Create bunker at player's end
    this.createBunker();
    
    // Add boundary walls to contain the game area
    this.addBoundaryWalls();
    
    // Start adding obstacles from a distance away from player
    const startZ = -90; // Adjusted for shorter terrain
    const endZ = -20; // Don't place obstacles too close to player
    
    // Create a more deliberate obstacle path with fewer obstacles
    const obstacle_positions = [
      { x: -5, z: -30, type: 0 },  // Near the bunker
      { x: 5, z: -40, type: 1 },
      { x: -7, z: -55, type: 2 },
      { x: 0, z: -65, type: 0 },
      { x: 6, z: -75, type: 2 },
      { x: -6, z: -80, type: 1 },
      { x: 0, z: -85, type: 0 },
      { x: -4, z: -90, type: 2 },
      { x: 5, z: -95, type: 1 },
      { x: 0, z: -100, type: 0 }
    ];
    
    // Place obstacles at defined positions
    for (const pos of obstacle_positions) {
      // Get the obstacle type
      const type = obstacleTypes[pos.type];
      
      // Create obstacle geometry
      const geometry = new THREE.BoxGeometry(type.width, type.height, type.depth);
      const material = new THREE.MeshLambertMaterial({ color: type.color });
      const obstacle = new THREE.Mesh(geometry, material);
      
      // Position obstacle at pre-defined location
      obstacle.position.set(pos.x, type.height / 2, pos.z);
      
      // Add slight rotation for visual interest
      obstacle.rotation.y = Math.PI * (Math.random() * 0.2);
      
      // Enable shadows
      obstacle.castShadow = true;
      obstacle.receiveShadow = true;
      
      // Add collision detection
      obstacle.userData.isCollidable = true;
      
      // Save reference and add to scene
      this.obstacles.push(obstacle);
      this.collidableObjects.push(obstacle);
      this.scene.add(obstacle);
    }
    
    // Add just one barricade in the middle of the course
    this.addSingleBarricade();
  }
  
  addSingleBarricade() {
    // Add a single barricade in the middle of the course
    const wallHeight = 2;
    const wallDepth = 1;
    const barrierZ = -60;
    
    // Calculate hole position
    const holeSize = 8; // Size of the hole in world units
    const holePosition = 0; // Center the hole
    
    // Left section of the barricade
    const leftWidth = (this.terrainWidth / 2) - (holeSize / 2);
    if (leftWidth > 0) {
      const leftGeometry = new THREE.BoxGeometry(leftWidth, wallHeight, wallDepth);
      const leftMaterial = new THREE.MeshLambertMaterial({ color: 0x8B8878 });
      const leftWall = new THREE.Mesh(leftGeometry, leftMaterial);
      
      leftWall.position.set(-this.terrainWidth/2 + leftWidth/2, wallHeight/2, barrierZ);
      leftWall.castShadow = true;
      leftWall.receiveShadow = true;
      
      // Add collision detection
      leftWall.userData.isCollidable = true;
      
      this.obstacles.push(leftWall);
      this.collidableObjects.push(leftWall);
      this.scene.add(leftWall);
    }
    
    // Right section of the barricade
    const rightWidth = (this.terrainWidth / 2) - (holeSize / 2);
    if (rightWidth > 0) {
      const rightGeometry = new THREE.BoxGeometry(rightWidth, wallHeight, wallDepth);
      const rightMaterial = new THREE.MeshLambertMaterial({ color: 0x8B8878 });
      const rightWall = new THREE.Mesh(rightGeometry, rightMaterial);
      
      rightWall.position.set(this.terrainWidth/2 - rightWidth/2, wallHeight/2, barrierZ);
      rightWall.castShadow = true;
      rightWall.receiveShadow = true;
      
      // Add collision detection
      rightWall.userData.isCollidable = true;
      
      this.obstacles.push(rightWall);
      this.collidableObjects.push(rightWall);
      this.scene.add(rightWall);
    }
  }
  
  createBunker() {
    // Create a fully enclosed bunker at the player's end of the terrain
    const bunkerWidth = this.bunkerWidth;
    const bunkerDepth = 10;
    const bunkerHeight = 4; // Increased height from 3 to 4
    const wallThickness = 1;
    
    // Bunker material
    const bunkerMaterial = new THREE.MeshLambertMaterial({ color: 0x5F5F5F }); // Concrete color
    
    // Bunker floor
    const floorGeometry = new THREE.BoxGeometry(bunkerWidth, 0.5, bunkerDepth);
    const floor = new THREE.Mesh(floorGeometry, bunkerMaterial);
    floor.position.set(0, 0.25, 0); // Slightly above ground to avoid z-fighting
    floor.receiveShadow = true;
    this.scene.add(floor);
    
    // Bunker ceiling
    const ceilingGeometry = new THREE.BoxGeometry(bunkerWidth, 0.5, bunkerDepth);
    const ceiling = new THREE.Mesh(ceilingGeometry, bunkerMaterial);
    ceiling.position.set(0, bunkerHeight, 0);
    ceiling.receiveShadow = true;
    ceiling.castShadow = true;
    
    // Add collision detection
    ceiling.userData.isCollidable = true;
    this.collidableObjects.push(ceiling);
    
    this.scene.add(ceiling);
    
    // Bunker back wall
    const backWallGeometry = new THREE.BoxGeometry(bunkerWidth, bunkerHeight, wallThickness);
    const backWall = new THREE.Mesh(backWallGeometry, bunkerMaterial);
    backWall.position.set(0, bunkerHeight/2, bunkerDepth/2 - wallThickness/2);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    
    // Add collision detection
    backWall.userData.isCollidable = true;
    this.collidableObjects.push(backWall);
    
    this.scene.add(backWall);
    
    // Bunker left wall
    const leftWallGeometry = new THREE.BoxGeometry(wallThickness, bunkerHeight, bunkerDepth);
    const leftWall = new THREE.Mesh(leftWallGeometry, bunkerMaterial);
    leftWall.position.set(-bunkerWidth/2 + wallThickness/2, bunkerHeight/2, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    
    // Add collision detection
    leftWall.userData.isCollidable = true;
    this.collidableObjects.push(leftWall);
    
    this.scene.add(leftWall);
    
    // Bunker right wall
    const rightWallGeometry = new THREE.BoxGeometry(wallThickness, bunkerHeight, bunkerDepth);
    const rightWall = new THREE.Mesh(rightWallGeometry, bunkerMaterial);
    rightWall.position.set(bunkerWidth/2 - wallThickness/2, bunkerHeight/2, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    
    // Add collision detection
    rightWall.userData.isCollidable = true;
    this.collidableObjects.push(rightWall);
    
    this.scene.add(rightWall);
    
    // Front wall with open window hole
    this.createFrontWallWithOpenWindow(bunkerWidth, bunkerHeight, bunkerDepth, wallThickness, bunkerMaterial);
    
    // Add interior elements
    this.addBunkerInterior(bunkerWidth, bunkerHeight, bunkerDepth);
    
    // Add game start button to the bunker
    this.addStartGameButton(bunkerWidth, bunkerHeight, bunkerDepth);
  }
  
  createFrontWallWithOpenWindow(
    bunkerWidth: number, 
    bunkerHeight: number, 
    bunkerDepth: number, 
    wallThickness: number, 
    bunkerMaterial: THREE.Material
  ) {
    // Window dimensions
    const windowWidth = 8;
    const windowHeight = 1.5;
    const windowDistFromGround = 0.8; // Reduced from 1.2 to make the window lower
    
    // Bottom part of front wall (below window)
    const bottomWallGeometry = new THREE.BoxGeometry(bunkerWidth, windowDistFromGround, wallThickness);
    const bottomWall = new THREE.Mesh(bottomWallGeometry, bunkerMaterial);
    bottomWall.position.set(0, windowDistFromGround/2, -bunkerDepth/2 + wallThickness/2);
    bottomWall.castShadow = true;
    bottomWall.receiveShadow = true;
    
    // Add collision detection
    bottomWall.userData.isCollidable = true;
    this.collidableObjects.push(bottomWall);
    
    this.scene.add(bottomWall);
    
    // Top part of front wall (above window)
    const topWallHeight = bunkerHeight - windowHeight - windowDistFromGround;
    const topWallGeometry = new THREE.BoxGeometry(bunkerWidth, topWallHeight, wallThickness);
    const topWall = new THREE.Mesh(topWallGeometry, bunkerMaterial);
    topWall.position.set(0, bunkerHeight - topWallHeight/2, -bunkerDepth/2 + wallThickness/2);
    topWall.castShadow = true;
    topWall.receiveShadow = true;
    
    // Add collision detection
    topWall.userData.isCollidable = true;
    this.collidableObjects.push(topWall);
    
    this.scene.add(topWall);
    
    // Left part of front wall (left of window)
    const sideWallWidth = (bunkerWidth - windowWidth) / 2;
    const leftSideGeometry = new THREE.BoxGeometry(sideWallWidth, windowHeight, wallThickness);
    const leftSide = new THREE.Mesh(leftSideGeometry, bunkerMaterial);
    leftSide.position.set(-bunkerWidth/2 + sideWallWidth/2, windowDistFromGround + windowHeight/2, -bunkerDepth/2 + wallThickness/2);
    leftSide.castShadow = true;
    leftSide.receiveShadow = true;
    
    // Add collision detection
    leftSide.userData.isCollidable = true;
    this.collidableObjects.push(leftSide);
    
    this.scene.add(leftSide);
    
    // Right part of front wall (right of window)
    const rightSideGeometry = new THREE.BoxGeometry(sideWallWidth, windowHeight, wallThickness);
    const rightSide = new THREE.Mesh(rightSideGeometry, bunkerMaterial);
    rightSide.position.set(bunkerWidth/2 - sideWallWidth/2, windowDistFromGround + windowHeight/2, -bunkerDepth/2 + wallThickness/2);
    rightSide.castShadow = true;
    rightSide.receiveShadow = true;
    
    // Add collision detection
    rightSide.userData.isCollidable = true;
    this.collidableObjects.push(rightSide);
    
    this.scene.add(rightSide);
    
    // Add window frame
    const frameSize = 0.15;
    const frameColor = 0x8B4513; // Brown frame
    const frameMaterial = new THREE.MeshLambertMaterial({ color: frameColor });
    
    // Horizontal frames
    const topFrameGeometry = new THREE.BoxGeometry(windowWidth + frameSize, frameSize, wallThickness + 0.05);
    const topFrame = new THREE.Mesh(topFrameGeometry, frameMaterial);
    topFrame.position.set(0, windowDistFromGround + windowHeight, -bunkerDepth/2 + wallThickness/2);
    
    // Add collision detection
    topFrame.userData.isCollidable = true;
    this.collidableObjects.push(topFrame);
    
    this.scene.add(topFrame);
    
    const bottomFrameGeometry = new THREE.BoxGeometry(windowWidth + frameSize, frameSize, wallThickness + 0.05);
    const bottomFrame = new THREE.Mesh(bottomFrameGeometry, frameMaterial);
    bottomFrame.position.set(0, windowDistFromGround, -bunkerDepth/2 + wallThickness/2);
    
    // Add collision detection
    bottomFrame.userData.isCollidable = true;
    this.collidableObjects.push(bottomFrame);
    
    this.scene.add(bottomFrame);
    
    // Vertical frames
    const leftFrameGeometry = new THREE.BoxGeometry(frameSize, windowHeight + frameSize*2, wallThickness + 0.05);
    const leftFrame = new THREE.Mesh(leftFrameGeometry, frameMaterial);
    leftFrame.position.set(-windowWidth/2, windowDistFromGround + windowHeight/2, -bunkerDepth/2 + wallThickness/2);
    
    // Add collision detection
    leftFrame.userData.isCollidable = true;
    this.collidableObjects.push(leftFrame);
    
    this.scene.add(leftFrame);
    
    const rightFrameGeometry = new THREE.BoxGeometry(frameSize, windowHeight + frameSize*2, wallThickness + 0.05);
    const rightFrame = new THREE.Mesh(rightFrameGeometry, frameMaterial);
    rightFrame.position.set(windowWidth/2, windowDistFromGround + windowHeight/2, -bunkerDepth/2 + wallThickness/2);
    
    // Add collision detection
    rightFrame.userData.isCollidable = true;
    this.collidableObjects.push(rightFrame);
    
    this.scene.add(rightFrame);
  }
  
  addBunkerInterior(bunkerWidth: number, bunkerHeight: number, bunkerDepth: number) {
    // Empty bunker interior - no furniture
    
    // Add a few crates as decorative elements
    this.addCrates(bunkerWidth, bunkerHeight, bunkerDepth);
  }
  
  addCrates(bunkerWidth: number, bunkerHeight: number, bunkerDepth: number) {
    // Add a couple of small crates in the corner
    const crateSize = 0.8;
    const crateMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    
    // Create first crate
    const crate1Geometry = new THREE.BoxGeometry(crateSize, crateSize, crateSize);
    const crate1 = new THREE.Mesh(crate1Geometry, crateMaterial);
    crate1.position.set(-bunkerWidth/2 + 1.5, crateSize/2, bunkerDepth/2 - 1.5);
    crate1.castShadow = true;
    crate1.receiveShadow = true;
    
    // Add collision detection
    crate1.userData.isCollidable = true;
    this.collidableObjects.push(crate1);
    
    this.scene.add(crate1);
    
    // Create second crate, slightly smaller and on top of the first
    const crate2Geometry = new THREE.BoxGeometry(crateSize * 0.8, crateSize * 0.8, crateSize * 0.8);
    const crate2 = new THREE.Mesh(crate2Geometry, crateMaterial);
    crate2.position.set(-bunkerWidth/2 + 1.5, crateSize + (crateSize * 0.8)/2, bunkerDepth/2 - 1.5);
    crate2.rotation.y = Math.PI / 4; // Rotate it a bit for visual interest
    crate2.castShadow = true;
    crate2.receiveShadow = true;
    
    // Add collision detection
    crate2.userData.isCollidable = true;
    this.collidableObjects.push(crate2);
    
    this.scene.add(crate2);
  }
  
  // Check for bullet collisions with obstacles
  checkBulletCollision(bulletPosition: THREE.Vector3): boolean {
    // Check if bullet hits any obstacle
    for (let i = 0; i < this.obstacles.length; i++) {
      const obstacle = this.obstacles[i];
      
      // Get obstacle's bounding box in world space
      const box = new THREE.Box3().setFromObject(obstacle);
      
      // Check if bullet position is inside the obstacle's bounding box
      if (box.containsPoint(bulletPosition)) {
        return true;
      }
    }
    
    return false;
  }
  
  // Check collision between player and obstacles
  checkPlayerCollision(playerPosition: THREE.Vector3, radius: number = 0.5): { collided: boolean, adjustedPosition: THREE.Vector3 } {
    // Create a result object
    const result = {
      collided: false,
      adjustedPosition: playerPosition.clone()
    };
    
    // Check against all collidable objects
    for (const object of this.collidableObjects) {
      // Create bounding box for the object
      const box = new THREE.Box3().setFromObject(object);
      
      // Expand the box by the player radius for better collision detection
      box.expandByScalar(radius);
      
      // Check if player position intersects with the expanded box
      if (box.containsPoint(playerPosition)) {
        result.collided = true;
        
        // Calculate correction direction based on closest face
        const boxCenter = new THREE.Vector3();
        box.getCenter(boxCenter);
        
        // Find displacement vector from box center to player
        const displacement = new THREE.Vector3().subVectors(playerPosition, boxCenter);
        
        // Calculate box half extents
        const halfExtents = new THREE.Vector3(
          (box.max.x - box.min.x) / 2,
          (box.max.y - box.min.y) / 2,
          (box.max.z - box.min.z) / 2
        );
        
        // Find axis with minimum penetration
        const absDisp = new THREE.Vector3(
          Math.abs(displacement.x),
          Math.abs(displacement.y),
          Math.abs(displacement.z)
        );
        
        // Calculate penetration depth for each axis
        const penX = halfExtents.x - absDisp.x;
        const penY = halfExtents.y - absDisp.y;
        const penZ = halfExtents.z - absDisp.z;
        
        // Find minimum penetration
        if (penX <= penY && penX <= penZ) {
          // X-axis has minimum penetration
          result.adjustedPosition.x += Math.sign(displacement.x) * penX;
        } else if (penY <= penX && penY <= penZ) {
          // Y-axis has minimum penetration
          result.adjustedPosition.y += Math.sign(displacement.y) * penY;
        } else {
          // Z-axis has minimum penetration
          result.adjustedPosition.z += Math.sign(displacement.z) * penZ;
        }
        
        break; // Exit after first collision for simplicity
      }
    }
    
    return result;
  }

  // Add a method to create a start game button in the bunker
  addStartGameButton(bunkerWidth: number, bunkerHeight: number, bunkerDepth: number): THREE.Mesh {
    // Create a button on the back wall of the bunker
    const buttonWidth = 2.0;  // Increased size for better visibility
    const buttonHeight = 2.0;
    const buttonDepth = 0.4;
    
    // Button base
    const buttonGeometry = new THREE.BoxGeometry(buttonWidth, buttonHeight, buttonDepth);
    const buttonMaterial = new THREE.MeshLambertMaterial({ 
      color: 0xff0000, // Red button
      emissive: 0xff0000, // Strong red glow
      emissiveIntensity: 0.7
    });
    const button = new THREE.Mesh(buttonGeometry, buttonMaterial);
    
    // Position the button in the center of the back wall, at eye level
    // Note: in the bunker, z is positive (deeper into the bunker) and y is up
    // Position closer to player eye level (1.6 units high) and more prominent
    button.position.set(0, 1.6, bunkerDepth/2 - 0.6);
    button.castShadow = true;
    
    // Add button to scene
    this.scene.add(button);
    
    // Create a text label for the button
    const textCanvas = document.createElement('canvas');
    textCanvas.width = 512;  // Higher resolution
    textCanvas.height = 512;
    const context = textCanvas.getContext('2d');
    
    if (context) {
      context.fillStyle = 'black';
      context.fillRect(0, 0, 512, 512);
      
      context.font = 'bold 80px Arial';  // Larger text
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = 'white';
      context.fillText('START', 256, 180);
      context.fillText('GAME', 256, 320);
    }
    
    const textTexture = new THREE.CanvasTexture(textCanvas);
    const textMaterial = new THREE.MeshBasicMaterial({ 
      map: textTexture,
      transparent: true
    });
    
    // Create a plane for the text and position it just in front of the button
    const textGeometry = new THREE.PlaneGeometry(buttonWidth, buttonHeight);
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    textMesh.position.set(0, 0, buttonDepth/2 + 0.01);
    
    // Add text to button
    button.add(textMesh);
    
    // Mark the button as interactive
    button.userData.isStartButton = true;
    
    // Add a pulsing light to make the button more noticeable
    const buttonLight = new THREE.PointLight(0xff0000, 1, 5);
    buttonLight.position.set(0, 0, -0.5);
    button.add(buttonLight);
    
    // Store the light for animation
    button.userData.light = buttonLight;
    
    return button;
  }

  // Add a method to create boundary walls
  addBoundaryWalls() {
    const wallHeight = 4; // Tall enough to prevent jumping over
    const wallThickness = 1;
    
    // Wall material - slightly different than other obstacles for visual distinction
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x555555 });
    
    // Left wall (along the length of the course)
    const leftWallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, this.terrainLength);
    const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
    leftWall.position.set(-this.terrainWidth/2 - wallThickness/2, wallHeight/2, -this.terrainLength/2 + 10);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    
    // Add collision detection
    leftWall.userData.isCollidable = true;
    this.collidableObjects.push(leftWall);
    this.scene.add(leftWall);
    
    // Right wall (along the length of the course)
    const rightWallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, this.terrainLength);
    const rightWall = new THREE.Mesh(rightWallGeometry, wallMaterial);
    rightWall.position.set(this.terrainWidth/2 + wallThickness/2, wallHeight/2, -this.terrainLength/2 + 10);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    
    // Add collision detection
    rightWall.userData.isCollidable = true;
    this.collidableObjects.push(rightWall);
    this.scene.add(rightWall);
    
    // End wall (at the far end of the course)
    const endWallGeometry = new THREE.BoxGeometry(this.terrainWidth + wallThickness*2, wallHeight, wallThickness);
    const endWall = new THREE.Mesh(endWallGeometry, wallMaterial);
    endWall.position.set(0, wallHeight/2, -this.terrainLength + 10);
    endWall.castShadow = true;
    endWall.receiveShadow = true;
    
    // Add collision detection
    endWall.userData.isCollidable = true;
    this.collidableObjects.push(endWall);
    this.scene.add(endWall);
    
    console.log("Added boundary walls to contain bots within the course");
  }
}
