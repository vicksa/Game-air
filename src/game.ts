import Phaser from "phaser";
import type { Command } from "./controls";
import { neutral } from "./controls";
export type GameEvent =
  | { type: "hud"; hp: number; kills: number; progress: number; boss: number }
  | { type: "hit"; remaining: number }
  | { type: "checkpoint" }
  | { type: "end"; won: boolean };
export const LEVEL = {
  width: 4200,
  spawn: 80,
  groundY: 320,
  checkpoint: 1950,
  bossX: 3830,
};
type Enemy = Phaser.Physics.Arcade.Sprite & {
  hp: number;
  home: number;
  kind: string;
  nextShot: number;
  lastHit: number;
  dying: boolean;
};
export class Quest extends Phaser.Scene {
  command: Command = neutral();
  reducedMotion = false;
  private player!: Phaser.Physics.Arcade.Sprite;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private enemies!: Phaser.Physics.Arcade.Group;
  private shots!: Phaser.Physics.Arcade.Group;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private hp = 5;
  private elapsed = 0;
  private kills = 0;
  private checkpoint = 80;
  private attackUntil = 0;
  private attackContact = 0;
  private hurtUntil = 0;
  private attackReady = 0;
  private nextJump = 0;
  private lastGrounded = -Infinity;
  private jumpBufferedUntil = 0;
  private facing = 1;
  private finished = false;
  private defending = false;
  private hitEnemies = new Set<Enemy>();
  private lastHud = 0;
  private effects!: Phaser.GameObjects.Graphics;
  constructor(private notify: (event: GameEvent) => void) {
    super("quest");
  }
  preload() {
    this.load.json("sprite-atlas", "assets/atlas.json");
    for (const k of ["ninja", "guard", "archer", "boss"])
      this.load.spritesheet(k, `assets/${k}.png`, {
        frameWidth: 48,
        frameHeight: 48,
      });
    for (const k of ["city-0", "city-1", "city-2", "platform", "spikes"])
      this.load.image(k, `assets/${k}.png`);
  }
  create() {
    this.hp = 5;
    this.elapsed = 0;
    this.kills = 0;
    this.checkpoint = 80;
    this.finished = false;
    this.hurtUntil = 0;
    this.attackUntil = 0;
    this.attackReady = 0;
    this.nextJump = 0;
    this.lastGrounded = -Infinity;
    this.jumpBufferedUntil = 0;
    this.facing = 1;
    this.defending = false;
    this.lastHud = 0;
    this.command = neutral();
    this.hitEnemies.clear();
    this.cameras.main.setBackgroundColor("#10152d");
    const bg = this.add.graphics().setScrollFactor(0);
    bg.fillStyle(0xed6c6b, 0.9).fillCircle(495, 72, 29);
    bg.fillStyle(0x10152d).fillCircle(483, 65, 27);
    for (let i = 0; i < 60; i++) {
      const x = (i * 137) % 640,
        y = (i * 73) % 180;
      bg.fillStyle(0x7395b4, 0.25).fillRect(x, y, 1, 9);
    }
    for (let i = 0; i < 3; i++)
      this.add
        .tileSprite(0, 0, 640, 360, `city-${i}`)
        .setOrigin(0)
        .setScrollFactor(0)
        .setData("parallax", 0.12 + i * 0.13)
        .setName(`city-${i}`);
    this.physics.world.setBounds(0, -100, LEVEL.width, 600);
    this.platforms = this.physics.add.staticGroup();
    const ground = [
      [0, 680],
      [790, 620],
      [1540, 690],
      [2360, 650],
      [3150, 1050],
    ];
    for (const [x, w] of ground) this.platform(x, 320, w, 40);
    for (const [x, y, w] of [
      [260, 253, 130],
      [500, 205, 125],
      [960, 250, 120],
      [1180, 200, 115],
      [1650, 260, 140],
      [1880, 218, 140],
      [2130, 265, 100],
      [2520, 245, 135],
      [2770, 197, 135],
      [3230, 255, 140],
      [3470, 215, 120],
    ])
      this.platform(x, y, w, 18);
    for (const x of [540, 1100, 1720, 2660, 3300]) {
      this.add.image(x, 320, "spikes").setOrigin(0.5, 1);
    }
    this.add.text(74, 206, "TELHADOS DO AMANHECER", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#eab77b",
    });
    this.add.text(80, 225, "Siga os lampiões. Encontre o guardião.", {
      fontFamily: "monospace",
      fontSize: "8px",
      color: "#a0b2c7",
    });
    for (const x of [180, 850, 1500, 1950, 2400, 3100, 3650]) {
      this.add.rectangle(x, 288, 3, 64, 0x685366);
      this.add.rectangle(x + 10, 265, 17, 22, 0xffbc70);
      this.add.rectangle(x + 10, 265, 11, 14, 0xffe4a1);
      this.add.circle(x + 10, 265, 29, 0xffb965, 0.06);
    }
    this.add.text(1910, 175, "REFÚGIO", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#85e4cf",
    });
    this.add.text(3630, 155, "O ÚLTIMO GUARDIÃO", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#ed888c",
    });
    const atlas = this.cache.json.get("sprite-atlas") as {
      animations: Record<
        string,
        Record<string, { frames: number[]; fps: number; loop: boolean }>
      >;
    };
    for (const [kind, states] of Object.entries(atlas.animations)) {
      for (const [state, animation] of Object.entries(states)) {
        const key = `${kind}-${state}`;
        if (!this.anims.exists(key))
          this.anims.create({
            key,
            frames: animation.frames.map((frame) => ({ key: kind, frame })),
            frameRate: animation.fps,
            repeat: animation.loop ? -1 : 0,
          });
      }
    }
    this.player = this.physics.add
      .sprite(80, 290, "ninja")
      .setOrigin(0.5, 1)
      .setDepth(5);
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(19, 32).setOffset(15, 13);
    body.setMaxVelocity(200, 600);
    this.physics.add.collider(this.player, this.platforms);
    this.enemies = this.physics.add.group();
    this.shots = this.physics.add.group({ allowGravity: false });
    for (const [x, kind] of [
      [590, "guard"],
      [1010, "archer"],
      [1350, "guard"],
      [1790, "guard"],
      [2200, "archer"],
      [2600, "guard"],
      [2890, "archer"],
      [3390, "guard"],
      [3830, "boss"],
    ] as [number, string][])
      this.spawnEnemy(x, kind);
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.overlap(this.player, this.enemies, () => this.damage(1));
    this.physics.add.overlap(this.player, this.shots, (_p, s) => {
      (s as Phaser.Physics.Arcade.Sprite).destroy();
      this.damage(1);
    });
    this.keys = this.input.keyboard!.addKeys({
      left: "LEFT",
      right: "RIGHT",
      a: "A",
      d: "D",
      jump: "SPACE",
      attack: "J",
      defend: "K",
    }) as typeof this.keys;
    // Preserve short taps even when keydown and keyup arrive between render frames.
    const jumpKey = this.keys.jump,
      attackKey = this.keys.attack;
    const queueJump = () => {
      this.command.jump = true;
    };
    const queueAttack = () => {
      this.command.attack = true;
    };
    jumpKey.on("down", queueJump);
    attackKey.on("down", queueAttack);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      jumpKey.off("down", queueJump);
      attackKey.off("down", queueAttack);
    });
    this.effects = this.add.graphics().setDepth(8);
    this.cameras.main
      .setBounds(0, 0, LEVEL.width, 360)
      .startFollow(this.player, true, 0.12, 0.12, 0, 50);
  }
  private platform(x: number, y: number, w: number, h: number) {
    const p = this.add.tileSprite(x, y, w, h, "platform").setOrigin(0);
    this.platforms.add(p);
    (p.body as Phaser.Physics.Arcade.StaticBody).setSize(w, h).setOffset(0, 0);
  }
  private spawnEnemy(x: number, kind: string) {
    const e = this.enemies.create(x, 290, kind) as Enemy;
    e.setOrigin(0.5, 1);
    e.hp = kind === "boss" ? 12 : kind === "guard" ? 3 : 2;
    e.home = x;
    e.kind = kind;
    e.nextShot = 0;
    e.lastHit = 0;
    e.dying = false;
    if (kind === "boss") e.setScale(1.65);
    (e.body as Phaser.Physics.Arcade.Body).setSize(20, 32).setOffset(14, 13);
    e.play(`${kind}-idle`);
  }
  private damage(amount: number) {
    if (this.finished || this.elapsed < this.hurtUntil) return;
    if (this.defending) {
      this.hurtUntil = this.elapsed + 180;
      return;
    }
    this.hp -= amount;
    this.hurtUntil = this.elapsed + 1100;
    this.player.setVelocity(-this.facing * 110, -150);
    if (!this.reducedMotion) this.cameras.main.shake(90, 0.003);
    if (this.hp <= 0) this.end(false);
  }
  private impact(x: number, y: number) {
    for (let i = 0; i < 5; i++) {
      const bit = this.add
        .rectangle(x, y, 2, 2, i % 2 ? 0xffc477 : 0xb9f6e5)
        .setDepth(9);
      this.tweens.add({
        targets: bit,
        x: x + Math.cos(i * 1.3) * 20,
        y: y + Math.sin(i * 1.3) * 16,
        alpha: 0,
        duration: 180,
        onComplete: () => bit.destroy(),
      });
    }
    if (!this.reducedMotion) {
      this.physics.world.pause();
      this.time.delayedCall(45, () => {
        if (!this.finished) this.physics.world.resume();
      });
    }
  }
  private end(won: boolean) {
    if (this.finished) return;
    this.finished = true;
    this.player.setVelocity(0, 0);
    this.player.play(`ninja-${won ? "idle" : "death"}`, true);
    this.physics.pause();
    this.publishHud();
    this.notify({ type: "end", won });
  }
  update(_time: number, delta: number) {
    if (!this.player || this.finished) return;
    this.elapsed += delta;
    const time = this.elapsed;
    const c = this.command;
    let move = c.move;
    if (this.keys.left.isDown || this.keys.a.isDown) move = -1;
    if (this.keys.right.isDown || this.keys.d.isDown) move = 1;
    const jump = c.jump,
      attack = c.attack;
    c.jump = false;
    c.attack = false;
    this.defending = c.defend || this.keys.defend.isDown;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (move && time >= this.attackUntil) this.facing = move;
    this.player.setFlipX(this.facing < 0);
    this.player.setVelocityX(move * (this.defending ? 65 : 160));
    if (body.blocked.down || body.touching.down) this.lastGrounded = time;
    if (jump) this.jumpBufferedUntil = time + 140;
    if (
      time <= this.jumpBufferedUntil &&
      time - this.lastGrounded <= 120 &&
      time > this.nextJump
    ) {
      this.player.setVelocityY(-345);
      this.nextJump = time + 220;
      this.lastGrounded = -Infinity;
      this.jumpBufferedUntil = 0;
    }
    if (attack && time >= this.attackReady && !this.defending) {
      // Face a nearby opponent before striking, including while retreating.
      const target = (this.enemies.getChildren() as Enemy[])
        .filter(
          (e) =>
            e.active &&
            !e.dying &&
            Math.abs(e.x - this.player.x) <= 72 &&
            Math.abs(e.y - this.player.y) < 55,
        )
        .sort(
          (a, b) =>
            Math.abs(a.x - this.player.x) - Math.abs(b.x - this.player.x),
        )[0];
      if (target && target.x !== this.player.x)
        this.facing = target.x > this.player.x ? 1 : -1;
      this.player.setFlipX(this.facing < 0);
      this.attackUntil = time + 310;
      this.attackContact = time + 75;
      this.attackReady = time + 480;
      this.hitEnemies.clear();
      this.player.play("ninja-attack", true);
    }
    const attacking = time < this.attackUntil;
    this.effects.clear();
    if (attacking) {
      this.effects
        .lineStyle(2, 0x9ff6e5, 0.8)
        .beginPath()
        .arc(
          this.player.x + this.facing * 15,
          this.player.y - 22,
          29,
          this.facing > 0 ? -1.1 : 2.1,
          this.facing > 0 ? 1.1 : 4.2,
        )
        .strokePath();
    }
    const animation =
      time < this.hurtUntil - 850
        ? "hurt"
        : attacking
          ? "attack"
          : this.defending
            ? "defend"
            : !body.blocked.down
              ? "jump"
              : move
                ? "run"
                : "idle";
    if (this.player.anims.currentAnim?.key !== `ninja-${animation}`) {
      this.player.play(`ninja-${animation}`);
    }
    this.player.setAlpha(
      !this.reducedMotion && time < this.hurtUntil
        ? Math.floor(time / 90) % 2
          ? 0.45
          : 1
        : 1,
    );
    for (const enemy of [...this.enemies.getChildren()] as Enemy[]) {
      if (!enemy.active || enemy.dying) continue;
      const dx = this.player.x - enemy.x;
      enemy.setFlipX(dx < 0);
      const b = enemy.body as Phaser.Physics.Arcade.Body;
      if (enemy.lastHit > 0 && time - enemy.lastHit < 250) {
        enemy.setVelocityX(0);
        enemy.play(`${enemy.kind}-hurt`, true);
      } else if (Math.abs(dx) < 360) {
        if (enemy.kind === "archer") {
          enemy.setVelocityX(0);
          if (time > enemy.nextShot) {
            enemy.nextShot = time + 1900;
            const s = this.shots.create(
              enemy.x,
              enemy.y - 22,
              "spikes",
            ) as Phaser.Physics.Arcade.Sprite;
            s.setScale(0.35).setVelocityX(Math.sign(dx) * 180);
            s.setData("born", time);
            enemy.play("archer-attack", true);
          } else if (time >= enemy.nextShot - 1550) {
            enemy.play("archer-idle", true);
          }
        } else {
          const speed = enemy.kind === "boss" ? 90 : 48;
          enemy.setVelocityX(Math.abs(dx) > 28 ? Math.sign(dx) * speed : 0);
          if ((b.blocked.left || b.blocked.right) && b.blocked.down)
            enemy.setVelocityY(-260);
          enemy.play(
            `${enemy.kind}-${Math.abs(dx) > 28 ? "run" : "attack"}`,
            true,
          );
        }
      } else {
        enemy.setVelocityX(Math.sin(time / 850) * 22);
        enemy.play(`${enemy.kind}-idle`, true);
      }
      if (
        attacking &&
        time >= this.attackContact &&
        !this.hitEnemies.has(enemy) &&
        (enemy.x - this.player.x) * this.facing >= -18 &&
        (enemy.x - this.player.x) * this.facing <= 72 &&
        Math.abs(this.player.y - enemy.y) < 55
      ) {
        this.hitEnemies.add(enemy);
        enemy.hp--;
        this.notify({ type: "hit", remaining: enemy.hp });
        this.impact(enemy.x, enemy.y - 22);
        enemy.lastHit = time;
        if (!this.reducedMotion) enemy.setTint(0xffb5a0);
        this.time.delayedCall(130, () => {
          if (enemy.active) enemy.clearTint();
        });
        if (enemy.hp <= 0) {
          const boss = enemy.kind === "boss";
          enemy.dying = true;
          enemy.setVelocity(0, 0);
          (enemy.body as Phaser.Physics.Arcade.Body).enable = false;
          enemy.play(`${enemy.kind}-death`);
          enemy.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () =>
            enemy.destroy(),
          );
          this.kills++;
          if (boss) this.end(true);
        }
      }
      if (enemy.active && enemy.y > 410) {
        const boss = enemy.kind === "boss";
        if (boss) {
          enemy.setPosition(enemy.home, 250);
          enemy.setVelocity(0, 0);
        } else {
          enemy.destroy();
          this.kills++;
        }
      }
    }
    for (const shot of this.shots.getChildren() as Phaser.Physics.Arcade.Sprite[])
      if (time - shot.getData("born") > 4000) shot.destroy();
    if (this.player.y > 400) {
      this.hp--;
      if (this.hp <= 0) this.end(false);
      else {
        this.player.setPosition(this.checkpoint, 230).setVelocity(0, 0);
        this.hurtUntil = time + 1200;
      }
    }
    if (
      [540, 1100, 1720, 2660, 3300].some(
        (x) => Math.abs(this.player.x - x) < 20 && this.player.y > 304,
      )
    )
      this.damage(1);
    if (this.player.x > LEVEL.checkpoint && this.checkpoint === 80) {
      this.checkpoint = 1980;
      this.hp = Math.min(5, this.hp + 2);
      this.notify({ type: "checkpoint" });
    }
    this.player.x = Phaser.Math.Clamp(this.player.x, 15, LEVEL.width - 20);
    for (let i = 0; i < 3; i++) {
      const layer = this.children.getByName(
        `city-${i}`,
      ) as Phaser.GameObjects.TileSprite;
      layer.tilePositionX = this.cameras.main.scrollX * (0.12 + i * 0.13);
    }
    if (time - this.lastHud > 100) {
      this.lastHud = time;
      this.publishHud();
    }
  }
  private publishHud() {
    const boss = (this.enemies.getChildren() as Enemy[]).find(
      (e) => e.kind === "boss",
    );
    this.notify({
      type: "hud",
      hp: this.hp,
      kills: this.kills,
      progress: Math.min(100, (this.player.x / LEVEL.width) * 100),
      boss: Math.max(0, boss?.hp ?? 0),
    });
  }
}
