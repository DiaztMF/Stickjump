import Phaser from "phaser";
import nipplejs from "nipplejs";

class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
    this.joystickDirection = { x: 0, y: 0 };
    this.isJumping = false;
  }

  preload() {
    this.load.image('gameBackground', '../background/Summer5.png');
    this.load.audio('bgm', '../sound/Backsound.mp3');
    this.load.audio('jump_sound', '../sound/Jumpsound.mp3');
    this.load.audio('level_complete_sound', '../sound/levelcomplete.mp3');
    this.load.audio('win_sound', '../sound/winner.mp3');
  }

  create() {
    this.currentLevel = 1;
    this.canJump = true;
    this.movingPlatformsArray = [];

    // Add background image
    this.add.image(0, 0, 'gameBackground').setOrigin(0, 0).setDisplaySize(1280, 700);

    // Start background music
    this.sound.play('bgm', { loop: true });

    // 2. Base Ground (Dipisah dari group level agar tidak terhapus saat reset level)
    this.baseGround = this.add.rectangle(640, 690, 1280, 20, 0x8b4513);
    this.physics.add.existing(this.baseGround, true); // Static body

    // Create Lava at the bottom
    this.lava = this.add.rectangle(
      this.scale.width / 2,
      this.scale.height + 50, // Position it slightly below the bottom edge initially
      this.scale.width,
      100, // Height of the lava
      0xff4500 // Orange-red color for lava
    );
    this.physics.add.existing(this.lava, true); // Make it a static body

    // Generate bird texture
    const birdGraphics = this.add.graphics();
    birdGraphics.fillStyle(0x000000, 1);
    birdGraphics.slice(10, 10, 10, 0, 180, true);
    birdGraphics.fillPath();
    birdGraphics.generateTexture('bird', 20, 20);
    birdGraphics.destroy();

    // Generate coin texture
    const coinGraphics = this.add.graphics();
    coinGraphics.fillStyle(0xffd700, 1); // Gold color
    coinGraphics.fillCircle(10, 10, 10);
    coinGraphics.generateTexture('coin', 20, 20);
    coinGraphics.destroy();

    // 3. UI
    this.score = 0;
    this.coinIcon = this.add.image(1180, 35, 'coin').setDepth(9998);
    this.scoreText = this.add.text(1200, 16, "0", {
      fontSize: "32px",
      fill: "#fff",
      fontStyle: "bold",
      stroke: "#000",
      strokeThickness: 2,
    }).setDepth(9999);
    
    this.levelText = this.add.text(16, 16, "LEVEL 1", {
      fontSize: "32px",
      fill: "#fff",
      fontStyle: "bold",
      stroke: "#000",
      strokeThickness: 2,
    });
    this.add.text(16, 56, "ARROWS to Move  |  SPACE to Jump", {
      fontSize: "18px",
      fill: "#fff",
      stroke: "#000",
      strokeThickness: 4,
    });
    this.levelText.setDepth(9999);
    this.winOverlay = this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      0x000000,
      0.5
    );
    this.winOverlay.setDepth(999);
    this.winOverlay.setVisible(false);

    // 4. Initialize Groups
    this.platformsGroup = this.physics.add.staticGroup(); // Hanya untuk platform level
    this.spikesGroup = this.physics.add.staticGroup(); // Spikes sebaiknya static
    this.coinsGroup = this.physics.add.staticGroup(); // Group untuk koin

    // Group khusus moving platform (kinematic)
    this.movingPlatformsGroup = this.physics.add.group({
      immovable: true,
      allowGravity: false,
    });

    this.birdsGroup = this.physics.add.group({
      allowGravity: false
    });
    this.time.addEvent({
      delay: 3000,
      callback: this.spawnBird,
      callbackScope: this,
      loop: true,
    });

    // 5. Create Player
    // Set visible false agar kotak hitbox tidak menutupi gambar stickman
    this.player = this.add.rectangle(100, 500, 20, 40, 0x000000);
    this.player.setVisible(false);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    // FIX: Drag x untuk efek gesekan udara sedikit
    this.player.body.setDragX(500);

    // Draw stickman graphics container
    this.stickmanGraphics = this.add.graphics();
    
    // Initialize Joystick
    const joystickContainer = document.getElementById('joystick-container');
    if (joystickContainer) {
      const joystick = nipplejs.create({
        zone: joystickContainer,
        mode: 'static',
        position: { left: '50%', top: '50%' },
        color: 'white',
      });

      joystick.on('move', (evt, data) => {
        this.joystickDirection.x = data.vector.x;
        this.joystickDirection.y = data.vector.y;
      });

      joystick.on('end', () => {
        this.joystickDirection.x = 0;
        this.joystickDirection.y = 0;
      });
    }

    // Initialize Jump Button
    const jumpButton = document.getElementById('jump-button');
    if (jumpButton) {
      jumpButton.addEventListener('pointerdown', () => {
        this.isJumping = true;
      });
      jumpButton.addEventListener('pointerup', () => {
        this.isJumping = false;
      });
      jumpButton.addEventListener('pointerout', () => {
        this.isJumping = false;
      });
    }

    // 6. Level Data
    this.levels = {
      1: {
        platforms: [
          { x: 100, y: 650, width: 200, height: 20 },
          { x: 350, y: 550, width: 150, height: 20 },
          { x: 600, y: 450, width: 150, height: 20 },
        ],
        spikes: [
          { x: 250, y: 640 },
          { x: 280, y: 640 },
          { x: 450, y: 540 },
        ],
        coins: [
          { x: 200, y: 600 },
          { x: 400, y: 500 },
          { x: 500, y: 400 },
        ],
        finish: { x: 700, y: 400 },
      },
      2: {
        platforms: [
          { x: 100, y: 550, width: 150, height: 20 },
          { x: 300, y: 480, width: 100, height: 20 },
          { x: 500, y: 400, width: 100, height: 20 },
          { x: 680, y: 320, width: 120, height: 20 },
        ],
        spikes: [
          { x: 200, y: 540 },
          { x: 350, y: 470 },
          { x: 380, y: 470 },
          { x: 550, y: 390 },
          { x: 580, y: 390 },
        ],
        movingPlatforms: [
          { startX: 250, y: 350, endX: 380, speed: 100, width: 100 },
        ],
        coins: [
          { x: 100, y: 500 },
          { x: 300, y: 430 },
          { x: 500, y: 350 },
          { x: 680, y: 270 },
        ],
        finish: { x: 730, y: 270 },
      },
      3: {
        platforms: [
          { x: 100, y: 550, width: 120, height: 20 },
          { x: 280, y: 480, width: 80, height: 20 },
          { x: 450, y: 420, width: 80, height: 20 },
          { x: 620, y: 350, width: 80, height: 20 },
        ],
        spikes: [
          { x: 180, y: 540 },
          { x: 210, y: 540 },
          { x: 330, y: 470 },
          { x: 500, y: 410 },
          { x: 530, y: 410 },
          { x: 670, y: 340 },
        ],
        movingPlatforms: [
          { startX: 180, y: 380, endX: 320, speed: 120, width: 90 },
          { startX: 520, y: 280, endX: 680, speed: 150, width: 90 },
        ],
        coins: [
          { x: 100, y: 500 },
          { x: 280, y: 430 },
          { x: 450, y: 370 },
          { x: 620, y: 300 },
        ],
        finish: { x: 750, y: 220 },
      },
      4: {
        platforms: [
          { x: 100, y: 550, width: 120, height: 20 },
          { x: 520, y: 380, width: 80, height: 20 },
        ],
        spikes: [
          { x: 180, y: 540 },
          { x: 210, y: 540 },
          { x: 350, y: 470 },
        ],
        movingPlatforms: [
          { startX: 250, y: 480, endX: 620, speed: 120, width: 90 },
          { startX: 520, y: 280, endX: 680, speed: 150, width: 90 },
        ],
        coins: [
          { x: 100, y: 500 },
          { x: 350, y: 430 },
          { x: 520, y: 330 },
          { x: 600, y: 230 },
        ],
        finish: { x: 750, y: 220 },
      },
      5: {
        platforms: [
          { x: 80, y: 560, width: 100, height: 20 },
          { x: 250, y: 500, width: 90, height: 20 },
          { x: 420, y: 440, width: 90, height: 20 },
          { x: 600, y: 380, width: 80, height: 20 },
          { x: 720, y: 300, width: 120, height: 20 },
        ],
        spikes: [
          { x: 160, y: 550 },
          { x: 190, y: 550 },
          { x: 300, y: 490 },
          { x: 330, y: 490 },
          { x: 460, y: 430 },
          { x: 490, y: 430 },
          { x: 630, y: 370 },
          { x: 660, y: 370 },
          { x: 690, y: 370 },
        ],
        movingPlatforms: [
          { startX: 180, y: 420, endX: 360, speed: 130, width: 100 },
          { startX: 500, y: 260, endX: 750, speed: 160, width: 90 },
        ],
        coins: [
          { x: 80, y: 510 },
          { x: 250, y: 450 },
          { x: 420, y: 390 },
          { x: 600, y: 330 },
          { x: 720, y: 250 },
        ],
        finish: { x: 760, y: 250 },
      },
    };

    // Create initial level
    this.createLevel(this.currentLevel);

    // 7. Collisions
    // Collide dengan base ground
    this.physics.add.collider(this.player, this.baseGround);
    // Collide dengan platform level
    this.physics.add.collider(this.player, this.platformsGroup);
    // Collide dengan moving platforms
    this.physics.add.collider(this.player, this.movingPlatformsGroup);

    // Overlaps
    this.physics.add.overlap(
      this.player,
      this.spikesGroup,
      this.hitSpike,
      null,
      this
    );
    this.physics.add.overlap(
      this.player,
      this.finishSprite,
      this.reachFinish,
      null,
      this
    );
    this.physics.add.overlap(
      this.player,
      this.lava,
      this.hitLava,
      null,
      this
    );
    this.physics.add.overlap(
      this.player,
      this.coinsGroup,
      this.collectCoin,
      null,
      this
    );

    // Input
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.spaceKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );
  }

  update() {
    // Player movement
    if (this.joystickDirection.x > 0) {
      this.player.body.setVelocityX(200);
    } else if (this.joystickDirection.x < 0) {
      this.player.body.setVelocityX(-200);
    } else if (this.cursors.left.isDown || this.keyA.isDown) {
      this.player.body.setVelocityX(-200);
    } else if (this.cursors.right.isDown || this.keyD.isDown) {
      this.player.body.setVelocityX(200);
    } else {
      this.player.body.setVelocityX(0);
    }

    // Jump Logic
    this.canJump =
      this.player.body.touching.down || this.player.body.blocked.down;

    if ((Phaser.Input.Keyboard.JustDown(this.spaceKey) || this.isJumping) && this.canJump) {
      this.player.body.setVelocityY(-500); // Increased jump force for gravity
      this.sound.play('jump_sound');
      if (this.isJumping) {
        this.isJumping = false; // Prevent repeated jumps while holding the button
      }
    }

    // Stickman Animation
    this.updateStickman();

    // Moving Platforms Logic
    this.movingPlatformsArray.forEach((plat) => {
      // Bolak balik
      if (plat.body.velocity.x > 0 && plat.x >= plat.endX) {
        plat.body.setVelocityX(-plat.speed);
      } else if (plat.body.velocity.x < 0 && plat.x <= plat.startX) {
        plat.body.setVelocityX(plat.speed);
      }

      // FIX: Agar player ikut bergerak dengan platform
      if (plat.body.touching.up && this.player.body.touching.down) {
        // Cek apakah player berdiri di atas platform ini secara spesifik
        // (Perkiraan kasar berdasarkan posisi Y dan X)
        if (
          Math.abs(
            this.player.y - (plat.y - plat.height / 2 - this.player.height / 2)
          ) < 5
        ) {
          // Tambahkan velocity platform ke player agar "lengket"
          this.player.x += plat.body.velocity.x * (1 / 60); // approx delta time
        }
      }
    });

    if (this.player.y > 650) {
      this.resetPlayer();
    }

    // Clean up off-screen birds
    this.birdsGroup.getChildren().forEach(bird => {
      if (bird.x > this.scale.width) {
        bird.destroy();
      }
    });
  }

  updateStickman() {
    this.stickmanGraphics.clear();
    this.stickmanGraphics.lineStyle(3, 0xffffff, 1);

    const x = this.player.x;
    const y = this.player.y;

    // Visual offset sedikit agar pas di tengah kotak hitbox
    // Head
    this.stickmanGraphics.strokeCircle(x, y - 15, 8);

    // Body
    this.stickmanGraphics.beginPath();
    this.stickmanGraphics.moveTo(x, y - 7);
    this.stickmanGraphics.lineTo(x, y + 10);
    this.stickmanGraphics.strokePath();

    // Arms (simple animation based on velocity)
    const armOffset =
      Math.sin(this.time.now / 100) *
      (this.player.body.velocity.x !== 0 ? 5 : 0);
    this.stickmanGraphics.beginPath();
    this.stickmanGraphics.moveTo(x - 10, y - 5 + armOffset);
    this.stickmanGraphics.lineTo(x, y - 5);
    this.stickmanGraphics.lineTo(x + 10, y - 5 - armOffset);
    this.stickmanGraphics.strokePath();

    // Legs (running animation)
    const legOffset =
      Math.sin(this.time.now / 50) *
      (this.player.body.velocity.x !== 0 ? 8 : 0);
    this.stickmanGraphics.beginPath();
    this.stickmanGraphics.moveTo(x, y + 10);
    this.stickmanGraphics.lineTo(x - 5 + legOffset, y + 20);
    this.stickmanGraphics.moveTo(x, y + 10);
    this.stickmanGraphics.lineTo(x + 5 - legOffset, y + 20);
    this.stickmanGraphics.strokePath();
  }

  createLevel(level) {
    // FIX: Clear group dengan benar (destroy children)
    this.platformsGroup.clear(true, true);
    this.spikesGroup.clear(true, true);
    this.movingPlatformsGroup.clear(true, true);
    this.coinsGroup.clear(true, true);
    this.movingPlatformsArray = [];

    if (this.finishSprite) this.finishSprite.destroy();
    if (this.flagGraphics) this.flagGraphics.destroy();

    const levelData = this.levels[level];

    // Static Platforms
    levelData.platforms.forEach((p) => {
      const platform = this.add.rectangle(
        p.x,
        p.y,
        p.width,
        p.height,
        0x8b4513
      );
      platform.setStrokeStyle(2, 0x654321);
      this.platformsGroup.add(platform);
    });

    // Coins
    if (levelData.coins) {
      levelData.coins.forEach(c => {
        this.coinsGroup.create(c.x, c.y, 'coin');
      });
    }

    // Moving Platforms
    if (levelData.movingPlatforms) {
      levelData.movingPlatforms.forEach((mp) => {
        const movingPlat = this.add.rectangle(
          mp.startX,
          mp.y,
          mp.width,
          20,
          0xd2691e
        );
        movingPlat.setStrokeStyle(2, 0x8b4513);

        // Masukkan ke group dynamic tapi immovable
        this.movingPlatformsGroup.add(movingPlat);

        movingPlat.body.setVelocityX(mp.speed);
        movingPlat.startX = mp.startX;
        movingPlat.endX = mp.endX;
        movingPlat.speed = mp.speed;

        this.movingPlatformsArray.push(movingPlat);
      });
    }

    // Spikes
    levelData.spikes.forEach((s) => {
      const spike = this.add.triangle(
        s.x,
        s.y - 10,
        0,
        10,
        -10,
        -10,
        10,
        -10,
        0xff0000
      );
      spike.setStrokeStyle(2, 0x8b0000);
      spike.setDepth(1);
      this.spikesGroup.add(spike);
      // Re-adjust body triangle physics is tricky in Phaser Arcade default (it's usually a box)
      // But default box body is fine for spikes usually
      spike.body.setSize(16, 16);
      spike.body.setOffset(-8, -8);
    });

    // Finish Flag
    this.createFlag(levelData.finish.x, levelData.finish.y);

    // Setup collision overlap for finish newly created sprite
    this.finishSprite = this.add.rectangle(
      levelData.finish.x,
      levelData.finish.y - 25,
      30,
      50,
      0x00ff00,
      0
    );
    this.physics.add.existing(this.finishSprite, true);

    // Re-establish collider for new objects is handled by group update usually,
    // but overlap needs specific object reference if not a group.
    // Since we check overlap in create() against 'this.finishSprite',
    // we need to update that reference or add to a group.
    // Best way: Use a group for finish zone or re-add overlap here.
    this.physics.add.overlap(
      this.player,
      this.finishSprite,
      this.reachFinish,
      null,
      this
    );
  }

  createFlag(x, y) {
    this.flagGraphics = this.add.graphics();
    this.flagGraphics.fillStyle(0x000000, 1);
    this.flagGraphics.fillRect(x - 2, y - 50, 4, 50);
    this.flagGraphics.fillStyle(0x00ff00, 1);
    this.flagGraphics.fillTriangle(
      x + 2,
      y - 45,
      x + 2,
      y - 25,
      x + 27,
      y - 35
    );
    this.flagGraphics.lineStyle(2, 0x008800, 1);
    this.flagGraphics.strokeTriangle(
      x + 2,
      y - 45,
      x + 2,
      y - 25,
      x + 27,
      y - 35
    );
  }

  collectCoin(player, coin) {
    coin.disableBody(true, true);
    this.sound.play('jump_sound');
    this.score++;
    this.scoreText.setText(this.score);
  }

  spawnBird() {
    const birdY = Phaser.Math.Between(50, 200);
    const birdSprite = this.birdsGroup.create(0, birdY, 'bird');
    birdSprite.body.velocity.x = Phaser.Math.Between(100, 200);
  }

  hitSpike(player, spike) {
    this.cameras.main.shake(200, 0.01);
    this.resetPlayer();
  }

  hitLava(player, lava) {
    this.cameras.main.shake(200, 0.01);
    this.resetPlayer();
  }

  resetPlayer() {
    this.player.x = 100;
    this.player.y = 500;
    this.player.body.setVelocity(0, 0);
  }

  reachFinish(player, finish) {
    // Prevent multiple triggers
    if (this.isChangingLevel) return;
    this.isChangingLevel = true;

    this.currentLevel++;

    if (this.currentLevel > 5) {
      this.sound.stopByKey('bgm');
      this.sound.play('win_sound');
      this.winOverlay.setVisible(true);
      this.levelText.setText("🎉 YOU WIN! 🎉");
      this.levelText.setFontSize("60px");

      // Center text
      this.levelText.setOrigin(0.5);
      this.levelText.setPosition(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2
      );

      this.player.body.setEnable(false);

      this.time.delayedCall(5000, () => {
        this.currentLevel = 1;
        this.score = 0;
        this.scoreText.setText(this.score);
        this.levelText.setText("LEVEL 1");
        this.levelText.setFontSize("32px");

        // Reset to top-left HUD style
        this.levelText.setOrigin(0, 0);
        this.levelText.setPosition(16, 16);

        this.winOverlay.setVisible(false);

        this.levelText.setDepth(999);
        this.player.body.setEnable(true);
        this.createLevel(this.currentLevel);
        this.resetPlayer();
        this.isChangingLevel = false;
        this.sound.play('bgm', { loop: true }); // Restart BGM
      });
    } else {
      this.sound.play('level_complete_sound');
      this.levelText.setText("LEVEL " + this.currentLevel);
      this.cameras.main.flash(200);
      this.createLevel(this.currentLevel);
      this.resetPlayer();
      this.time.delayedCall(100, () => {
        this.isChangingLevel = false;
      });
    }
  }
}

const config = {
  type: Phaser.AUTO,
  width: 1280,
  height: 700,
  parent: "game-container",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 1000 },
      debug: false,
    },
  },
  scene: [GameScene],
};

const game = new Phaser.Game(config);
