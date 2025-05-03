import * as THREE from 'three';

export class PlayerModel {
  body: THREE.Group;
  torso!: THREE.Mesh;
  head!: THREE.Mesh;
  
  // Simplified limbs - single pieces but with pivot points
  leftArm!: THREE.Mesh;
  rightArm!: THREE.Mesh;
  leftLeg!: THREE.Mesh;
  rightLeg!: THREE.Mesh;
  
  // Gun model
  gun!: THREE.Group;
  
  // Additional gun model for sniper rifle
  sniperRifle!: THREE.Group;
  
  // Current weapon type
  currentWeapon: string = 'assaultRifle';
  
  // Joint objects for pivoting
  leftShoulder!: THREE.Object3D;
  rightShoulder!: THREE.Object3D;
  leftHip!: THREE.Object3D;
  rightHip!: THREE.Object3D;
  
  // Animation properties
  animationSpeed: number = 0.15;
  animationTime: number = 0;
  isMoving: boolean = false;
  isSprinting: boolean = false;

  constructor(isVisible: boolean = true) {
    this.body = new THREE.Group();
    this.createHumanModel(isVisible);
    this.createGun();
  }

  createHumanModel(isVisible: boolean) {
    const height = 1.8; // 1.8 meters tall
    const headRadius = height * 0.15;
    const bodyHeight = height * 0.4;
    const bodyWidth = height * 0.25;
    const bodyDepth = height * 0.15;
    const limbWidth = height * 0.08;
    
    // Combined limb measurements
    const armLength = height * 0.35; // Combined upper+lower arm
    const legLength = height * 0.45; // Combined upper+lower leg
    
    // Materials
    const bodyMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x2E4053, // Dark blue for the body
      transparent: !isVisible,
      opacity: isVisible ? 1 : 0
    });
    
    const skinMaterial = new THREE.MeshLambertMaterial({ 
      color: 0xD7BDA3, // Skin tone
      transparent: !isVisible,
      opacity: isVisible ? 1 : 0
    });
    
    // Create a group for the upper body (torso, head, arms)
    const upperBody = new THREE.Group();
    this.body.add(upperBody);
    
    // Torso
    this.torso = new THREE.Mesh(
      new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyDepth),
      bodyMaterial
    );
    this.torso.position.y = bodyHeight / 2; // Center of the torso
    upperBody.add(this.torso);
    
    // Head
    this.head = new THREE.Mesh(
      new THREE.SphereGeometry(headRadius, 16, 16),
      skinMaterial
    );
    this.head.position.y = bodyHeight + headRadius; // Top of torso + head radius
    upperBody.add(this.head);
    
    // Create shoulder joints attached to upper body
    this.leftShoulder = new THREE.Object3D();
    this.leftShoulder.position.set(-(bodyWidth / 2 + limbWidth / 2), bodyHeight * 0.85, 0);
    upperBody.add(this.leftShoulder);
    
    this.rightShoulder = new THREE.Object3D();
    this.rightShoulder.position.set(bodyWidth / 2 + limbWidth / 2, bodyHeight * 0.85, 0);
    upperBody.add(this.rightShoulder);
    
    // Create hip joints attached to upper body at the bottom
    this.leftHip = new THREE.Object3D();
    this.leftHip.position.set(-limbWidth, 0, 0);
    upperBody.add(this.leftHip);
    
    this.rightHip = new THREE.Object3D();
    this.rightHip.position.set(limbWidth, 0, 0);
    upperBody.add(this.rightHip);
    
    // Create arms - simple box geometries
    this.leftArm = new THREE.Mesh(
      new THREE.BoxGeometry(limbWidth, armLength, limbWidth),
      skinMaterial
    );
    // Position the arm so its top is at the origin (shoulder)
    this.leftArm.position.y = -armLength / 2;
    this.leftShoulder.add(this.leftArm);
    
    this.rightArm = new THREE.Mesh(
      new THREE.BoxGeometry(limbWidth, armLength, limbWidth),
      skinMaterial
    );
    // Position the arm so its top is at the origin (shoulder)
    this.rightArm.position.y = -armLength / 2;
    this.rightShoulder.add(this.rightArm);
    
    // Create legs
    this.leftLeg = new THREE.Mesh(
      new THREE.BoxGeometry(limbWidth, legLength, limbWidth),
      bodyMaterial
    );
    // Position the leg so its top is at the origin (hip)
    this.leftLeg.position.y = -legLength / 2;
    this.leftHip.add(this.leftLeg);
    
    this.rightLeg = new THREE.Mesh(
      new THREE.BoxGeometry(limbWidth, legLength, limbWidth),
      bodyMaterial
    );
    // Position the leg so its top is at the origin (hip)
    this.rightLeg.position.y = -legLength / 2;
    this.rightHip.add(this.rightLeg);
    
    // Position the entire model so its feet are on the ground
    upperBody.position.y = height - headRadius * 2 - bodyHeight;
    
    // Set shadows
    this.body.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }

  createGun() {
    // Create a gun model
    this.gun = new THREE.Group();
    
    // Gun materials with better finish
    const gunBarrelMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x2a2a2a, // Almost black for barrel
      roughness: 0.1,
      metalness: 0.9
    });
    
    const gunBodyMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x444444, // Medium gray for body
      roughness: 0.2,
      metalness: 0.8
    });
    
    const gunHandleMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x111111, // Black for handle
      roughness: 0.9,
      metalness: 0.2
    });
    
    const gunAccentMaterial = new THREE.MeshStandardMaterial({
      color: 0x777777, // Light silver for accents
      roughness: 0.1,
      metalness: 1.0
    });
    
    // Gun barrel - make it more cylindrical and realistic
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.5, 16),
      gunBarrelMaterial
    );
    barrel.rotation.x = Math.PI / 2; // Rotate to point forward
    barrel.position.z = -0.25; // Position barrel forward
    this.gun.add(barrel);
    
    // Add barrel shroud/handguard (slightly larger cylinder around barrel)
    const barrelShroud = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.35, 16),
      gunBodyMaterial
    );
    barrelShroud.rotation.x = Math.PI / 2;
    barrelShroud.position.z = -0.18;
    this.gun.add(barrelShroud);
    
    // Gun receiver (main body)
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.12, 0.2),
      gunBodyMaterial
    );
    body.position.y = -0.05; // Position body slightly below barrel
    this.gun.add(body);
    
    // Magazine
    const magazine = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.16, 0.05),
      gunBarrelMaterial
    );
    magazine.position.y = -0.15;
    magazine.position.z = -0.05;
    this.gun.add(magazine);
    
    // Gun handle with better ergonomics
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.15, 0.09),
      gunHandleMaterial
    );
    handle.position.y = -0.14; // Position handle below body
    handle.position.z = 0.04; // Offset handle slightly backward
    handle.rotation.x = 0.3; // Angle the handle
    this.gun.add(handle);
    
    // Add a proper sight rail on top
    const sightRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.02, 0.25),
      gunAccentMaterial
    );
    sightRail.position.y = 0.07; // Position sight rail on top of receiver
    this.gun.add(sightRail);
    
    // Front sight post
    const frontSight = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.05, 0.02),
      gunAccentMaterial
    );
    frontSight.position.y = 0.10;
    frontSight.position.z = -0.32;
    this.gun.add(frontSight);
    
    // Rear sight
    const rearSight = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 0.02),
      gunAccentMaterial
    );
    rearSight.position.y = 0.10;
    rearSight.position.z = 0.05;
    this.gun.add(rearSight);
    
    // Add muzzle with flash hider
    const muzzleBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.04, 16),
      gunAccentMaterial
    );
    muzzleBase.rotation.x = Math.PI / 2;
    muzzleBase.position.z = -0.47;
    this.gun.add(muzzleBase);
    
    // Add muzzle prongs (flash hider)
    const muzzleTip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.035, 0.05, 5), // Pentagon shape
      gunBarrelMaterial
    );
    muzzleTip.rotation.x = Math.PI / 2;
    muzzleTip.position.z = -0.52;
    this.gun.add(muzzleTip);
    
    // Add trigger guard
    const triggerGuard = new THREE.Mesh(
      new THREE.TorusGeometry(0.03, 0.01, 8, 8, Math.PI),
      gunBarrelMaterial
    );
    triggerGuard.rotation.x = Math.PI / 2;
    triggerGuard.position.y = -0.08;
    triggerGuard.position.z = 0.04;
    this.gun.add(triggerGuard);
    
    // Add trigger
    const trigger = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.03, 0.01),
      gunAccentMaterial
    );
    trigger.position.y = -0.09;
    trigger.position.z = 0.04;
    this.gun.add(trigger);
    
    // Chamfer/bevel some of the sharp edges by adding small cylinders at edges
    const edgeBevel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.09, 8),
      gunBodyMaterial
    );
    edgeBevel.position.set(0.045, -0.05, 0);
    edgeBevel.rotation.z = Math.PI / 2;
    this.gun.add(edgeBevel);
    
    // Set shadows for gun
    this.gun.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    
    // Position the gun at the end of the right arm
    this.gun.position.set(0, -0.32, -0.05); // At right hand position
    this.gun.rotation.set(0, 0, 0);
    this.rightArm.add(this.gun);
    
    // Also create a sniper rifle model but make it invisible initially
    this.createSniperRifle();
  }
  
  // Create a sniper rifle model
  createSniperRifle() {
    this.sniperRifle = new THREE.Group();
    
    // Gun materials with better finish
    const gunBarrelMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x2a2a2a, // Almost black for barrel
      roughness: 0.1,
      metalness: 0.9
    });
    
    const gunBodyMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x444444, // Medium gray for body
      roughness: 0.2,
      metalness: 0.8
    });
    
    const gunHandleMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x111111, // Black for handle
      roughness: 0.9,
      metalness: 0.2
    });
    
    const gunAccentMaterial = new THREE.MeshStandardMaterial({
      color: 0x777777, // Light silver for accents
      roughness: 0.1,
      metalness: 1.0
    });
    
    const scopeMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.1,
      metalness: 0.8
    });
    
    // Long barrel (characteristic of sniper rifles)
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.8, 16),
      gunBarrelMaterial
    );
    barrel.rotation.x = Math.PI / 2; // Rotate to point forward
    barrel.position.z = -0.4; // Position barrel far forward
    this.sniperRifle.add(barrel);
    
    // Longer gun body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.12, 0.3),
      gunBodyMaterial
    );
    body.position.y = -0.05; // Position body slightly below barrel
    this.sniperRifle.add(body);
    
    // Magazine
    const magazine = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.14, 0.05),
      gunBarrelMaterial
    );
    magazine.position.y = -0.15;
    magazine.position.z = -0.05;
    this.sniperRifle.add(magazine);
    
    // Gun stock
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.10, 0.2),
      gunHandleMaterial
    );
    stock.position.y = -0.03;
    stock.position.z = 0.2;
    this.sniperRifle.add(stock);
    
    // Trigger guard
    const triggerGuard = new THREE.Mesh(
      new THREE.TorusGeometry(0.03, 0.01, 8, 8, Math.PI),
      gunBarrelMaterial
    );
    triggerGuard.rotation.x = Math.PI / 2;
    triggerGuard.position.y = -0.08;
    triggerGuard.position.z = 0.04;
    this.sniperRifle.add(triggerGuard);
    
    // Trigger
    const trigger = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.03, 0.01),
      gunAccentMaterial
    );
    trigger.position.y = -0.09;
    trigger.position.z = 0.04;
    this.sniperRifle.add(trigger);
    
    // Add scope (characteristic of sniper rifles)
    const scope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.15, 16),
      scopeMaterial
    );
    scope.position.y = 0.14;
    scope.position.z = -0.05;
    this.sniperRifle.add(scope);
    
    // Scope lens
    const scopeLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.01, 16),
      new THREE.MeshStandardMaterial({
        color: 0x0066ff,
        roughness: 0.0,
        metalness: 0.0,
        transparent: true,
        opacity: 0.8
      })
    );
    scopeLens.position.y = 0.14;
    scopeLens.position.z = -0.13;
    this.sniperRifle.add(scopeLens);
    
    // Scope mount
    const scopeMount = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 0.04),
      gunAccentMaterial
    );
    scopeMount.position.y = 0.11;
    scopeMount.position.z = -0.05;
    this.sniperRifle.add(scopeMount);
    
    // Set shadows for sniper rifle
    this.sniperRifle.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    
    // Position the sniper rifle at the end of the right arm
    this.sniperRifle.position.set(0, -0.32, -0.05); // At right hand position
    this.sniperRifle.rotation.set(0, 0, 0);
    this.sniperRifle.visible = false; // Initially invisible
    this.rightArm.add(this.sniperRifle);
  }
  
  // Position the gun for first-person view
  positionGunForFirstPerson(camera: THREE.PerspectiveCamera) {
    // Create a clone of the gun for first-person view if it doesn't exist
    if (!camera.userData.fpGun) {
      camera.userData.fpGun = this.gun.clone();
      camera.add(camera.userData.fpGun);
      
      // Position the gun more to the right of the view with improved positioning
      camera.userData.fpGun.position.set(0.35, -0.3, -0.45);
      camera.userData.fpGun.rotation.set(0.05, Math.PI/12, -0.05); // More natural angle
      camera.userData.fpGun.scale.set(0.95, 0.95, 0.95); // Slightly smaller for better FPS feel
      
      // Store original position for aiming transitions
      camera.userData.originalGunPosition = {
        x: 0.35,
        y: -0.3,
        z: -0.45
      };
      
      camera.userData.originalGunRotation = {
        x: 0.05,
        y: Math.PI/12,
        z: -0.05
      };
      
      // Define aim position (center of screen but slightly down)
      camera.userData.aimGunPosition = {
        x: 0,
        y: -0.15,
        z: -0.4
      };
      
      camera.userData.aimGunRotation = {
        x: 0,
        y: 0,
        z: 0
      };
      
      // Also create a sniper rifle clone
      camera.userData.fpSniperRifle = this.sniperRifle.clone();
      camera.add(camera.userData.fpSniperRifle);
      
      // Position the sniper rifle
      camera.userData.fpSniperRifle.position.set(0.35, -0.3, -0.45);
      camera.userData.fpSniperRifle.rotation.set(0.05, Math.PI/12, -0.05);
      camera.userData.fpSniperRifle.scale.set(0.95, 0.95, 0.95);
      camera.userData.fpSniperRifle.visible = false; // Hide initially
      
      // Make sure the gun is visible with improved materials
      camera.userData.fpGun.traverse((object: any) => {
        if (object instanceof THREE.Mesh) {
          object.material = object.material.clone();
          object.material.transparent = false;
          object.material.opacity = 1;
          
          // Add slight ambient occlusion to the first-person model for better depth
          if (object.material.color) {
            if (object.material.metalness > 0.5) {
              // Enhance metallic surfaces for better first-person view
              object.material.metalness = Math.min(1, object.material.metalness * 1.2);
              object.material.roughness = Math.max(0.05, object.material.roughness * 0.8);
            }
          }
          
          // Cast shadows for better visual quality
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
      
      // Apply same material improvements to sniper rifle
      camera.userData.fpSniperRifle.traverse((object: any) => {
        if (object instanceof THREE.Mesh) {
          object.material = object.material.clone();
          object.material.transparent = false;
          object.material.opacity = 1;
          
          if (object.material.color) {
            if (object.material.metalness > 0.5) {
              object.material.metalness = Math.min(1, object.material.metalness * 1.2);
              object.material.roughness = Math.max(0.05, object.material.roughness * 0.8);
            }
          }
          
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
    }
    
    // Add subtle idle animation - breathing effect
    if (camera.userData.fpGun) {
      const idleTime = Date.now() * 0.001; // Get current time in seconds
      const breathingY = Math.sin(idleTime * 1.5) * 0.005; // Subtle up/down motion
      const breathingAngle = Math.sin(idleTime) * 0.002; // Subtle rotation
      
      // Apply breathing animation
      camera.userData.fpGun.position.y = -0.3 + breathingY;
      camera.userData.fpGun.rotation.z = -0.05 + breathingAngle;
    }
    
    // Update visibility based on camera mode
    if (camera.userData.fpGun) {
      camera.userData.fpGun.visible = !this.isSprinting;
    }
  }
  
  // Update gun position for aiming
  updateAimPosition(camera: THREE.PerspectiveCamera, aimProgress: number) {
    if (!camera.userData.fpGun || !camera.userData.originalGunPosition) return;
    
    const orig = camera.userData.originalGunPosition;
    const aim = camera.userData.aimGunPosition;
    const origRot = camera.userData.originalGunRotation;
    const aimRot = camera.userData.aimGunRotation;
    
    // Interpolate between original and aim positions
    camera.userData.fpGun.position.x = orig.x + (aim.x - orig.x) * aimProgress;
    camera.userData.fpGun.position.y = orig.y + (aim.y - orig.y) * aimProgress;
    camera.userData.fpGun.position.z = orig.z + (aim.z - orig.z) * aimProgress;
    
    // Interpolate between original and aim rotations
    camera.userData.fpGun.rotation.x = origRot.x + (aimRot.x - origRot.x) * aimProgress;
    camera.userData.fpGun.rotation.y = origRot.y + (aimRot.y - origRot.y) * aimProgress;
    camera.userData.fpGun.rotation.z = origRot.z + (aimRot.z - origRot.z) * aimProgress;
    
    // Add subtle sway that reduces as aiming progresses (more stable when aimed)
    if (aimProgress < 1) {
      const idleTime = Date.now() * 0.001;
      const swayFactor = 1 - aimProgress; // Reduce sway as we aim
      
      // Only add breathing effect when not fully aimed
      const breathingY = Math.sin(idleTime * 1.5) * 0.005 * swayFactor;
      const breathingAngle = Math.sin(idleTime) * 0.002 * swayFactor;
      
      // Apply subtle breathing movement that decreases while aiming
      camera.userData.fpGun.position.y += breathingY;
      camera.userData.fpGun.rotation.z += breathingAngle;
    }
  }
  
  // Trigger shooting animation and effects
  triggerShootAnimation(camera: THREE.PerspectiveCamera) {
    if (!camera.userData.fpGun) return;
    
    // Variables for animation
    let animationTime = 0;
    const recoilAmount = 0.03;
    const recoverySpeed = 0.2;
    
    // Clone original position for animation
    const originalPosX = camera.userData.fpGun.position.x;
    const originalPosY = camera.userData.fpGun.position.y;
    const originalPosZ = camera.userData.fpGun.position.z;
    const originalRotX = camera.userData.fpGun.rotation.x;
    
    // Apply immediate recoil
    camera.userData.fpGun.position.z += recoilAmount;
    camera.userData.fpGun.rotation.x += recoilAmount * 5;
    
    // Create muzzle flash
    this.createMuzzleFlash(camera);
    
    // Animate recovery
    const recoilRecovery = setInterval(() => {
      animationTime += recoverySpeed;
      
      // Ease back to original position
      const recovery = Math.min(1, animationTime);
      
      camera.userData.fpGun.position.z = originalPosZ + recoilAmount * (1 - recovery);
      camera.userData.fpGun.rotation.x = originalRotX + (recoilAmount * 5) * (1 - recovery);
      
      // End animation when complete
      if (recovery >= 1) {
        clearInterval(recoilRecovery);
      }
    }, 16);
  }
  
  // Simple muzzle flash effect
  createMuzzleFlash(camera: THREE.PerspectiveCamera) {
    if (!camera.userData.fpGun) return;
    
    // Simply add recoil animation - no visual flash effect needed
    // The bullet with white trail will be visible enough
  }
  
  // Update gun visibility for third-person view
  updateGunVisibility(isFirstPerson: boolean) {
    // Gun on character model only visible in third person
    if (this.gun) {
      this.gun.visible = !isFirstPerson;
    }
  }
  
  setSprinting(isSprinting: boolean) {
    this.isSprinting = isSprinting;
    
    // Find the upper body group (parent of the torso)
    const upperBody = this.torso.parent as THREE.Group;
    
    if (isSprinting) {
      // Lean forward when sprinting (tilt the upper body)
      upperBody.rotation.x = 0.3; // About 17 degrees forward tilt
      
      // Move head slightly forward to follow the tilt
      this.head.position.z = 0.15;
      
      // Adjust the shoulder positions slightly for cohesion
      this.leftShoulder.position.z = 0.05;
      this.rightShoulder.position.z = 0.05;
      
      // Use rotation for arm bending instead of replacing geometry
      this.leftArm.rotation.x = 0.5; // Bend arms at elbow
      this.rightArm.rotation.x = 0.5;
    } else {
      // Return to normal standing position
      upperBody.rotation.x = 0;
      
      // Reset positions
      this.head.position.z = 0;
      this.leftShoulder.position.z = 0;
      this.rightShoulder.position.z = 0;
      
      // Reset arm bend
      this.leftArm.rotation.x = 0;
      this.rightArm.rotation.x = 0;
    }
  }
  
  // Update the running/sprinting animation
  update(isMoving: boolean, moveSpeed: number) {
    this.isMoving = isMoving;
    
    if (isMoving) {
      // Adjust animation speed based on movement speed
      const speedFactor = moveSpeed * 10; 
      
      // Increment animation time
      this.animationTime += this.animationSpeed * speedFactor;
      
      // Calculate swing angle based on animation time (sine wave)
      const swingCycle = Math.sin(this.animationTime);
      let hipSwingAngle = swingCycle * 0.5; // Base hip rotation
      let shoulderSwingAngle = -hipSwingAngle * 0.8; // Arms swing opposite to legs
      
      // Additional animation variables
      let armBend = 0.2; // Default arm bend
      let legBend = 0.1; // Default leg bend
      
      if (this.isSprinting) {
        // Exaggerate angles for sprinting
        hipSwingAngle *= 1.3;
        shoulderSwingAngle *= 1.3;
        
        // More pronounced bends for limbs
        armBend = 0.8;
        legBend = 0.6;
        
        // Apply "push off" effect based on the swing cycle
        // More bending when leg is forward, straighter when pushing back
        const legForwardBend = Math.max(0, swingCycle) * 0.5;
        legBend += legForwardBend;
      } else {
        // Normal walking
        const legForwardBend = Math.max(0, swingCycle) * 0.3;
        legBend += legForwardBend;
      }
      
      // Apply animations to limbs
      
      // Legs - hip rotations 
      this.leftHip.rotation.x = hipSwingAngle;
      this.rightHip.rotation.x = -hipSwingAngle;
      
      // Leg bending during movement
      // Add knee bend when leg moves forward
      if (hipSwingAngle > 0) {
        // Left leg moving forward - increase bend
        this.leftLeg.rotation.x = Math.min(0.6, legBend * hipSwingAngle);
      } else {
        this.leftLeg.rotation.x = 0;
      }
      
      if (-hipSwingAngle > 0) {
        // Right leg moving forward - increase bend
        this.rightLeg.rotation.x = Math.min(0.6, legBend * -hipSwingAngle);
      } else {
        this.rightLeg.rotation.x = 0;
      }
      
      // Arms - shoulder rotations
      this.leftShoulder.rotation.x = shoulderSwingAngle;
      this.rightShoulder.rotation.x = -shoulderSwingAngle;
      
      // Add slight side-to-side arm movement to enhance realism
      this.leftShoulder.rotation.z = 0.1 * Math.cos(this.animationTime);
      this.rightShoulder.rotation.z = -0.1 * Math.cos(this.animationTime);
      
      // Dynamic arm bending during movement cycle
      // Add more bend when arm swings backward
      if (shoulderSwingAngle < 0) {
        // Left arm moving backward - increase bend
        this.leftArm.rotation.x = Math.max(0, armBend * -shoulderSwingAngle);
      } else {
        // When moving forward, keep minimal bend
        this.leftArm.rotation.x = 0.1;
      }
      
      if (-shoulderSwingAngle < 0) {
        // Right arm moving backward - increase bend
        this.rightArm.rotation.x = Math.max(0, armBend * shoulderSwingAngle);
      } else {
        // When moving forward, keep minimal bend
        this.rightArm.rotation.x = 0.1;
      }
      
    } else {
      // Reset to standing position when not moving
      this.leftHip.rotation.x = 0;
      this.rightHip.rotation.x = 0;
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      
      this.leftShoulder.rotation.x = 0;
      this.rightShoulder.rotation.x = 0;
      this.leftShoulder.rotation.z = 0;
      this.rightShoulder.rotation.z = 0;
      
      // Keep slight arm bend even when standing
      if (this.isSprinting) {
        this.leftArm.rotation.x = 0.5;
        this.rightArm.rotation.x = 0.5;
      } else {
        this.leftArm.rotation.x = 0.1;
        this.rightArm.rotation.x = 0.1;
      }
    }
  }
  
  // Method to clone the model
  clone(): THREE.Group {
    return this.body.clone();
  }

  // Switch between weapons
  switchWeapon(camera: THREE.PerspectiveCamera, weaponType: string) {
    this.currentWeapon = weaponType;
    
    // In third-person view, update model visibility
    if (this.gun) {
      this.gun.visible = weaponType === 'assaultRifle' && !camera.userData.fpGun;
    }
    
    if (this.sniperRifle) {
      this.sniperRifle.visible = weaponType === 'sniperRifle' && !camera.userData.fpSniperRifle;
    }
    
    // In first-person view, update FP model visibility
    if (camera.userData.fpGun) {
      camera.userData.fpGun.visible = weaponType === 'assaultRifle';
    }
    
    if (camera.userData.fpSniperRifle) {
      camera.userData.fpSniperRifle.visible = weaponType === 'sniperRifle';
    }
  }
} 