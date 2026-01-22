export class Player{
  constructor(canvas, editor){
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.editor = editor;
    this.running = false;
    this.paused = false; // NEW: pause state
    this._prevGridLineColor = null; // snapshot of grid line color before play
    this._prevGravity = null; // snapshot of gravity before play

    this.player = { x: 64, y: 300, w:28, h:28, vy:0, grounded:false };
    this.speed = 240; // px/sec world
    this.gravity = 1400;
    this.jumpVel = -520;
    // ship mode parameters
    this.mode = "normal"; // normal | ship | ball
    // wave mode params
    // slightly reduced speeds for smoother control
    this.waveUpVel = { vx: 220, vy: -360 };   // diagonal-up velocity when holding (world px/sec)
    this.waveDownVel = { vx: 220, vy: 360 };  // diagonal-down velocity when not holding
    this.waveOverrideSpeed = true; // use wave velocities instead of normal forward speed when in wave mode
    this.holding = false; // input hold for ship thrust
    this.shipThrust = 1400; // upward acceleration while holding (reduced from 2200)
    this.shipGravity = 600; // gentle downward acceleration when not holding
    this.shipMaxUpVel = -700; // clamp upward velocity in ship
    // UFO mode: behaves like cube but allows mid-air jumps (single mid-air jump)
    this.ufoExtraJumpVel = -420; // vertical impulse when using ufo mid-air jump
    this.ufoUsedAirJump = false;

    this._raf = null;

    // NEW: track jump requests so orbs can respond when input occurs while overlapping
    this.jumpRequested = false;

    // store any active background tweens so multiple triggers can run
    this._bgTweens = [];
    // separate ground tweens for G Triggers
    this._groundTweens = [];
    this._colorTweens = []; // NEW: color tween queue for color-trigger effects
    this._moveTweens = []; // NEW: move tween queue for move-trigger effects
    this._rotateTweens = []; // NEW: rotate tween queue for rotate-trigger effects
    this._alphaTweens = []; // NEW: alpha tween queue for alpha-trigger effects
    this._gridTweens = []; // NEW: grid-line color tweens for GR triggers

    // snapshot of editor object colors to allow restoring after play
    this._editorColorSnapshot = null;
    // snapshot of editor object positions to allow restoring after play (for move triggers)
    this._editorPositionSnapshot = null;
    // snapshot of editor object rotations to allow restoring after play (for rotate triggers)
    this._editorRotationSnapshot = null;
    this._editorGroupSnapshot = null;

    this._bindControls();

    // store previous editor zoom while running so we can restore on stop
    this._prevEditorZoom = null;
    this._prevBgColor = null;

    // camera smoothing position for eased follow (prevents jitter when grounded)
    this._camPos = { x: 0, y: 0 };
    this._camSmooth = 0.08; // reduced smoothing (less easing -> more responsive follow)
  }

  _bindControls(){
    // keyboard input: space acts as jump in normal mode, hold in ship mode
    window.addEventListener("keydown", (e)=>{
      if(!this.running) return;
      // allow A/D or ArrowLeft/ArrowRight for platformer movement
      if((e.code === "ArrowLeft" || e.key === "a" || e.key === "A") && this.editor.platformerMode){
        this.moveLeft = true; e.preventDefault(); return;
      }
      if((e.code === "ArrowRight" || e.key === "d" || e.key === "D") && this.editor.platformerMode){
        this.moveRight = true; e.preventDefault(); return;
      }
      if(e.code === "Space"){
        if(this.mode === "ship"){
          // begin holding thrust
          this.holding = true;
        } else {
          // queue a jump request for normal mode
          this.jumpRequested = true;
        }
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e)=>{
      if(!this.running) return;
      if((e.code === "ArrowLeft" || e.key === "a" || e.key === "A") && this.editor.platformerMode){
        this.moveLeft = false; e.preventDefault(); return;
      }
      if((e.code === "ArrowRight" || e.key === "d" || e.key === "D") && this.editor.platformerMode){
        this.moveRight = false; e.preventDefault(); return;
      }
      if(e.code === "Space"){
        if(this.mode === "ship"){
          this.holding = false;
        } else {
          // no-op on keyup for normal jump
        }
        e.preventDefault();
      }
    });
    // pointer input: pointerdown begins either a jump request (normal) or hold (ship) or gravity flip (ball)
    this.canvas.addEventListener("pointerdown", (e)=>{
      if(!this.running) return;
      // when in wave mode, pointerdown toggles holding immediately (so movement flips instantly)
      if(this.mode === "wave"){
        this.holding = true;
        e.preventDefault();
        return;
      }
      if(this.mode === "ship"){
        this.holding = true;
      } else if(this.mode === "ball"){
        // attempt gravity flip only if player is on floor or ceiling;
        // if not flipping (i.e. not on surface) set a jump request so orbs can respond to the click.
        if(this._isOnSurface()){
          // flip gravity sign and invert velocities appropriately
          this.gravity = -this.gravity;
          // also flip vertical velocity so the player doesn't immediately escape
          this.player.vy = -this.player.vy;
        } else {
          // allow click to act as an orb-trigger while in ball mode (won't flip when not on a surface)
          this.jumpRequested = true;
        }
      } else {
        this.jumpRequested = true;
      }
    });
    this.canvas.addEventListener("pointerup", (e)=>{
      if(!this.running) return;
      // if in wave mode, pointerup toggles holding off immediately
      if(this.mode === "wave"){
        this.holding = false;
        e.preventDefault();
        return;
      }
      if(this.mode === "ship"){
        this.holding = false;
      }
    });
  }

  start(){
    if(this.running) return;
    this.running = true;
    this.paused = false;
    // snapshot current editor object colors so we can restore them when play stops
    try{
      this._editorColorSnapshot = this.editor.objects.map(o => ({ id: o.id, color: o.color }));
      this._editorPositionSnapshot = this.editor.objects.map(o => ({ id: o.id, x: o.x, y: o.y }));
      this._editorRotationSnapshot = this.editor.objects.map(o => ({ id: o.id, rotation: Number(o.rotation || 0) }));
      // snapshot group tags (meta.groups / legacy meta.group) so edit-group-trigger can be reverted
      this._editorGroupSnapshot = this.editor.objects.map(o => {
        const groups = (o.meta && Array.isArray(o.meta.groups)) ? [...o.meta.groups]
                       : (o.meta && typeof o.meta.group === "string" && o.meta.group ? [o.meta.group] : []);
        return { id: o.id, groups };
      });
    }catch(e){
      this._editorColorSnapshot = null;
    }
    // snapshot original editor background color so we can restore it after the run
    this._prevBgColor = this.editor.bgColor;
    // snapshot original ground colors so we can restore them after the run
    this._prevGroundColor = this.editor.groundColor;
    this._prevGroundOutlineColor = this.editor.groundOutlineColor;
    // snapshot original grid line color so we can restore it after the run
    this._prevGridLineColor = this.editor.gridLineColor;
    // snapshot gravity so flips during play can be reverted on stop/restart
    this._prevGravity = this.gravity;
    // snapshot level
    this.level = JSON.parse(JSON.stringify(this.editor.objects));
    // place player at first start object if present (start has no collision)
    const startObj = this.level.find(o => o.type === "start");
    if(startObj){
      this.player.x = startObj.x;
      this.player.y = startObj.y - this.player.h;
    } else {
      this.player.x = 64; this.player.y = 300;
    }
    // reset player & camera
    this.player.vy = 0; this.player.grounded = false;
    // ensure wave mode state resets hold flag
    this.holding = false;
    // mark grounded if starting on the ground (helps immediate surface checks such as ball gravity flip)
    try{
      const g = Math.max(4, this.editor.gridSize|0);
      const GROUND_Y = 560 + (g / 2);
      if(Math.abs((this.player.y + this.player.h) - GROUND_Y) < 4){
        this.player.grounded = true;
      }
    }catch(e){}
    // reset to default mode on run start (respect editor.startAsUfo)
    // start priority: UFO > Ship > Ball > Normal
    // Use editor.startGamemode (cube, ship, ball, ufo, wave). Map 'cube' to normal mode.
    const startMode = (this.editor && typeof this.editor.startGamemode === "string") ? this.editor.startGamemode : "cube";
    switch(startMode){
      case "ship": this.mode = "ship"; break;
      case "ball": this.mode = "ball"; break;
      case "ufo": this.mode = "ufo"; break;
      case "wave": this.mode = "wave"; break;
      case "cube":
      default:
        this.mode = "normal";
        break;
    }
    // ensure gravity sign is positive at run start
    if(typeof this.gravity === "number" && this.gravity < 0) this.gravity = Math.abs(this.gravity);
    this.holding = false;
    this.startTime = performance.now();

    // store previous editor zoom and set to default zoom while playing
    this._prevEditorZoom = this.editor.zoom;
    this.editor.setZoom(1.0);

    // camera offset from editor
    this.editorPrevMode = this.editor.mode;
    this.editor.setMode("play-preview");

    // handle play-time grid disabling: snapshot current showGrid and apply disable-if-configured
    this._prevShowGrid = this.editor.showGrid;
    if(this.editor.disableGridWhilePlaying){
      this.editor.showGrid = false;
    }

    // NEW: stop the editor's continuous render loop so only the player's loop draws while playing
    try{
      if(typeof this.editor.stop === "function") this.editor.stop();
    }catch(e){}

    // NEW: hide UI controls while playing
    try{ document.body.classList.add("playing"); }catch(e){}

    this._last = performance.now();
    this._loop();
  }

  // pause execution without resetting run state
  pause(){
    if(!this.running || this.paused) return;
    this.paused = true;
    if(this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  // resume from paused state
  resume(){
    if(!this.running || !this.paused) return;
    this.paused = false;
    this._last = performance.now();
    this._loop();
  }

  stop(){
    this.running = false;
    if(this._raf) cancelAnimationFrame(this._raf);
    // restore previous zoom if we saved one
    if(this._prevEditorZoom !== null){
      this.editor.setZoom(this._prevEditorZoom);
      this._prevEditorZoom = null;
    }
    // restore the editor/background color to the starter color from before the run
    if(this._prevBgColor !== null){
      this.editor.bgColor = this._prevBgColor;
      this._prevBgColor = null;
    }
    // restore ground colors to what they were before the run
    if(this._prevGroundColor !== null){
      this.editor.groundColor = this._prevGroundColor;
      this._prevGroundColor = null;
    }
    if(this._prevGroundOutlineColor !== null){
      this.editor.groundOutlineColor = this._prevGroundOutlineColor;
      this._prevGroundOutlineColor = null;
    }
    // restore grid line color to what it was before the run
    if(this._prevGridLineColor !== null){
      this.editor.gridLineColor = this._prevGridLineColor;
      this._prevGridLineColor = null;
    }
    // restore gravity to original value that was present when the run started
    if(this._prevGravity !== null){
      this.gravity = this._prevGravity;
      this._prevGravity = null;
    }
    // restore any editor object colors that were changed during play (revert color-trigger effects)
    if(this._editorColorSnapshot && Array.isArray(this._editorColorSnapshot)){
      for(const snap of this._editorColorSnapshot){
        const obj = this.editor.objects.find(x => x.id === snap.id);
        if(obj){
          obj.color = snap.color;
        }
      }
      // force a render so UI reflects restored colors immediately
      try{ this.editor._render(); }catch(e){}
      this._editorColorSnapshot = null;
    }
    // restore positions changed by move triggers
    if(this._editorPositionSnapshot && Array.isArray(this._editorPositionSnapshot)){
      for(const snap of this._editorPositionSnapshot){
        const obj = this.editor.objects.find(x => x.id === snap.id);
        if(obj){
          obj.x = snap.x;
          obj.y = snap.y;
        }
      }
      try{ this.editor._render(); }catch(e){}
      this._editorPositionSnapshot = null;
    }
    // restore rotations changed by rotate triggers
    if(this._editorRotationSnapshot && Array.isArray(this._editorRotationSnapshot)){
      for(const snap of this._editorRotationSnapshot){
        const obj = this.editor.objects.find(x => x.id === snap.id);
        if(obj){
          obj.rotation = snap.rotation;
        }
      }
      try{ this.editor._render(); }catch(e){}
      this._editorRotationSnapshot = null;
    }
    // restore group tags changed by edit-group-trigger
    if(this._editorGroupSnapshot && Array.isArray(this._editorGroupSnapshot)){
      for(const snap of this._editorGroupSnapshot){
        const obj = this.editor.objects.find(x => x.id === snap.id);
        if(!obj) continue;
        if(!snap.groups || snap.groups.length === 0){
          // remove group metadata if original had none
          if(obj.meta){
            delete obj.meta.groups;
            delete obj.meta.group;
            // if meta becomes empty, remove it to keep parity with original minimal state
            if(Object.keys(obj.meta).length === 0) delete obj.meta;
          }
        } else {
          obj.meta = obj.meta || {};
          obj.meta.groups = Array.isArray(snap.groups) ? [...snap.groups] : [];
          obj.meta.group = obj.meta.groups.length ? obj.meta.groups[0] : undefined;
        }
      }
      try{ this.editor._render(); }catch(e){}
      this._editorGroupSnapshot = null;
    }
    // clear any active tweens so they don't continue after stopping
    this._bgTweens = [];
    this._groundTweens = [];
    this._colorTweens = [];
    this._moveTweens = [];
    this._rotateTweens = [];
    this._alphaTweens = [];
    this._gridTweens = [];
    this.editor.setMode("editor");

    // restore editor grid visibility if we changed it for play
    if(typeof this._prevShowGrid !== "undefined"){
      this.editor.showGrid = this._prevShowGrid;
      this._prevShowGrid = undefined;
    }

    // NEW: restart the editor's continuous render loop now that play stopped
    try{
      if(typeof this.editor.start === "function") this.editor.start();
    }catch(e){}

    // NEW: restore UI controls after stopping
    try{ document.body.classList.remove("playing"); }catch(e){}

  }

  // restart the current run: reset player to start and reset timers/camera
  restart(){
    // Restore any editor object colors that were changed during play (revert color-trigger effects)
    if(this._editorColorSnapshot && Array.isArray(this._editorColorSnapshot)){
      for(const snap of this._editorColorSnapshot){
        const obj = this.editor.objects.find(x => x.id === snap.id);
        if(obj){
          obj.color = snap.color;
        }
      }
      // also restore running level copy if present
      if(this.level && Array.isArray(this.level)){
        for(const snap of this._editorColorSnapshot){
          const rl = this.level && Array.isArray(this.level) ? this.level.find(x => x.id === snap.id) : null;
          if(rl) rl.color = snap.color;
        }
      }
    }

    // restore positions changed by move triggers to the snapshot taken at start
    if(this._editorPositionSnapshot && Array.isArray(this._editorPositionSnapshot)){
      for(const snap of this._editorPositionSnapshot){
        const obj = this.editor.objects.find(x => x.id === snap.id);
        if(obj){
          obj.x = snap.x;
          obj.y = snap.y;
        }
      }
      try{ this.editor._render(); }catch(e){}
      this._editorPositionSnapshot = null;
    }
    // restore rotations changed by rotate triggers to the snapshot taken at start
    if(this._editorRotationSnapshot && Array.isArray(this._editorRotationSnapshot)){
      for(const snap of this._editorRotationSnapshot){
        const obj = this.editor.objects.find(x => x.id === snap.id);
        if(obj){
          obj.rotation = snap.rotation;
        }
      }
      try{ this.editor._render(); }catch(e){}
      this._editorRotationSnapshot = null;
    }
    // restore editor background and ground colors to what they were before the run
    if(this._prevBgColor !== null){
      this.editor.bgColor = this._prevBgColor;
    }
    if(this._prevGroundColor !== null){
      this.editor.groundColor = this._prevGroundColor;
    }
    if(this._prevGroundOutlineColor !== null){
      this.editor.groundOutlineColor = this._prevGroundOutlineColor;
    }

    // ensure gravity is reset when restarting so player won't be stuck inverted after death
    if(this._prevGravity !== null){
      this.gravity = this._prevGravity;
    }

    // refresh level snapshot in case objects changed (use editor.objects which we just restored)
    this.level = JSON.parse(JSON.stringify(this.editor.objects));
    const startObj = this.level.find(o => o.type === "start");
    if(startObj){
      this.player.x = startObj.x;
      this.player.y = startObj.y - this.player.h;
    } else {
      this.player.x = 64; this.player.y = 300;
    }
    this.player.vy = 0;
    this.player.grounded = false;
    this.startTime = performance.now();
    // update camera to follow reset position immediately
    const safeZoom = Math.max(0.2, Number(this.editor.zoom) || 1);
    this.editor.offset.x = - (this.player.x - 160) / safeZoom;
    this.editor.offset.y = - (this.player.y - 220) / safeZoom;
  }

  _loop(){
    if(this.paused) return; // do not continue loop while paused
    const now = performance.now();
    const dt = Math.min(0.033, (now - this._last)/1000);
    this._last = now;
    this._update(dt);
    this._draw();
    if(this.running) this._raf = requestAnimationFrame(()=>this._loop());
  }

  _update(dt){
    // If a Y Holder is actively holding the player's Y, lock vertical motion immediately so gravity/frame integration cannot move the player.
    if(this._yHolderHolding){
      // Freeze vertical velocity and keep the player at the held Y each frame.
      this.player.vy = 0;
      if(typeof this._yHolderHeldY === "number") this.player.y = this._yHolderHeldY;
      // consume jump requests so they don't inadvertently trigger while held
      this.jumpRequested = false;
    }

    // handle normal-mode / ufo / wave jump/holding behavior
    if(this.mode === "normal"){
      if(this.jumpRequested){
        if(this.player.grounded){
          this.player.vy = this.jumpVel;
          this.player.grounded = false;
        }
      }
    } else if(this.mode === "ufo"){
      if(this.jumpRequested){
        // grounded: regular jump; in-air: apply UFO mid-air impulse any time a jump is requested
        if(this.player.grounded){
          this.player.vy = this.jumpVel;
          this.player.grounded = false;
        } else {
          this.player.vy = Math.min(this.player.vy, this.ufoExtraJumpVel);
        }
      }
    } else if(this.mode === "wave"){
      // Wave mode behavior:
      // - If platformerMode is enabled, horizontal movement is driven by platformer inputs (moveLeft/moveRight or no auto-forward)
      // - Vertical velocity still toggles between waveUpVel.vy and waveDownVel.vy based on holding (so wave feel remains)
      if(this.editor && this.editor.platformerMode){
        // horizontal control: respect moveLeft/moveRight flags
        if(this.moveLeft && !this.moveRight){
          this.player.vx = -this.speed; // use same speed magnitude for lateral movement
        } else if(this.moveRight && !this.moveLeft){
          this.player.vx = this.speed;
        } else {
          this.player.vx = 0;
        }
        // vertical component still controlled by wave up/down velocities
        if(this.holding){
          this.player.vy = this.waveUpVel.vy;
        } else {
          this.player.vy = this.waveDownVel.vy;
        }
      } else {
        // original default behavior: instant diagonal velocities (auto-forward)
        if(this.holding){
          // go diagonally up
          this.player.vx = this.waveUpVel.vx;
          this.player.vy = this.waveUpVel.vy;
        } else {
          // go diagonally down
          this.player.vx = this.waveDownVel.vx;
          this.player.vy = this.waveDownVel.vy;
        }
      }
      // do not treat as grounded; position integration below will use these velocities
    }

    // movement integration
    if(this.mode === "wave"){
      // wave mode uses its own vx/vy set above; integrate both components directly (instant changes)
      // ensure fallback vx exists
      if(typeof this.player.vx !== "number") this.player.vx = this.waveUpVel.vx;
      this.player.x += (this.player.vx || 0) * dt;
      this.player.y += (this.player.vy || 0) * dt;
      this.player.grounded = false;
    } else {
      // default forward motion for non-wave modes
      if(this.editor && this.editor.platformerMode){
        // platformer: free horizontal control via moveLeft/moveRight flags
        if(this.moveLeft && !this.moveRight){
          this.player.x -= this.speed * dt;
        } else if(this.moveRight && !this.moveLeft){
          this.player.x += this.speed * dt;
        } // if both or none pressed, no horizontal auto movement
      } else {
        this.player.x += this.speed * dt;
      }
      if(this.mode === "ship"){
        if(this.holding){
          // accelerate upward
          this.player.vy -= this.shipThrust * dt;
        } else {
          // gentle downward acceleration
          this.player.vy += this.shipGravity * dt;
        }
        // clamp upward velocity to avoid runaway
        if(this.player.vy < this.shipMaxUpVel) this.player.vy = this.shipMaxUpVel;
        // integrate position
        this.player.y += this.player.vy * dt;
        // in ship mode we do not set grounded by default (flies)
        this.player.grounded = false;
      } else {
        // normal platformer gravity
        this.player.vy += this.gravity * dt;
        this.player.y += this.player.vy * dt;
      }
    }

    // simple collision with level blocks
    this.player.grounded = false;

    // simple per-frame integration for 'physics-block' objects so each is updated once per frame
    if(this.level && Array.isArray(this.level)){
      const g = Math.max(4, this.editor.gridSize|0);
      const GROUND_Y = 560 + (g / 2);
      for(const pb of this.level){
        if(pb.type === "physics-block"){
          // ensure meta physics fields exist
          pb.meta = pb.meta || {};
          if(typeof pb.meta.vx !== "number") pb.meta.vx = 0;
          if(typeof pb.meta.vy !== "number") pb.meta.vy = 0;
          if(typeof pb.meta.angVel !== "number") pb.meta.angVel = 0; // deg/sec
          // integrate velocities
          // gravity affects vertical velocity (use game gravity)
          pb.meta.vy += this.gravity * dt;
          // clamp velocities to sane limits to avoid runaway values
          // choose caps that are larger than typical game velocities but prevent explosion
          const MAX_VY = 3000; // px/sec
          const MAX_VX = 1000; // px/sec
          const MAX_ANG = 720; // deg/sec
          if(!Number.isFinite(pb.meta.vy)) pb.meta.vy = 0;
          if(!Number.isFinite(pb.meta.vx)) pb.meta.vx = 0;
          if(!Number.isFinite(pb.meta.angVel)) pb.meta.angVel = 0;
          pb.meta.vy = Math.max(-MAX_VY, Math.min(MAX_VY, pb.meta.vy));
          pb.meta.vx = Math.max(-MAX_VX, Math.min(MAX_VX, pb.meta.vx));
          pb.meta.angVel = Math.max(-MAX_ANG, Math.min(MAX_ANG, pb.meta.angVel)); // clamp angular velocity
          // integrate position
          pb.x += pb.meta.vx * dt;
          pb.y += pb.meta.vy * dt;
          // integrate rotation (deg)
          pb.rotation = (Number(pb.rotation || 0) + (pb.meta.angVel || 0) * dt) % 360;
          // basic ground collision: stop at ground and zero vertical velocity
          if(!this.editor.noGround){
            if(pb.y + pb.h > GROUND_Y){
              pb.y = GROUND_Y - pb.h;
              pb.meta.vy = 0;
              // small damping to angular velocity when hitting ground
              pb.meta.angVel *= 0.6;
            }
          }

          // NEW: collide physics block with solids and other physics blocks
          // simple AABB separation and basic velocity response
          for(const other of this.level){
            if(other === pb) continue;
            // treat these as solids that physics-blocks should collide with
            const solidTypes = ["block","platform","half-hazard","physics-block","saw","wheel","wheel-2"];
            // include saw-2 as a solid collision target like saw
            if(!solidTypes.includes("saw-2")) solidTypes.push("saw-2");
            if(!solidTypes.includes(other.type)) continue;
            // compute AABB overlap
            const ax1 = pb.x, ay1 = pb.y, ax2 = pb.x + pb.w, ay2 = pb.y + pb.h;
            const bx1 = other.x, by1 = other.y, bx2 = other.x + other.w, by2 = other.y + other.h;
            if(ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1){
              // overlap amounts
              const overlapX = Math.min(ax2, bx2) - Math.max(ax1, bx1);
              const overlapY = Math.min(ay2, by2) - Math.max(ay1, by1);
              // separate along the smallest penetration axis
              if(overlapX < overlapY){
                // push pb left or right
                if((pb.x + pb.w/2) < (other.x + other.w/2)){
                  pb.x -= overlapX + 0.5;
                  // basic bounce/friction response
                  pb.meta.vx = Math.min(pb.meta.vx * -0.25, 300);
                } else {
                  pb.x += overlapX + 0.5;
                  pb.meta.vx = Math.max(pb.meta.vx * -0.25, -300);
                }
              } else {
                // push pb up or down
                if((pb.y + pb.h/2) < (other.y + other.h/2)){
                  pb.y -= overlapY + 0.5;
                  pb.meta.vy = Math.min(pb.meta.vy * -0.2, 800);
                } else {
                  pb.y += overlapY + 0.5;
                  pb.meta.vy = Math.max(pb.meta.vy * -0.2, -800);
                }
              }

              // if collided with another physics-block, exchange a fraction of velocities for simple momentum transfer
              if(other.type === "physics-block"){
                other.meta = other.meta || {};
                if(typeof other.meta.vx !== "number") other.meta.vx = 0;
                if(typeof other.meta.vy !== "number") other.meta.vy = 0;
                // swap a portion of velocities
                const transfer = 0.45; // fraction transferred
                const vxA = pb.meta.vx, vyA = pb.meta.vy;
                const vxB = other.meta.vx, vyB = other.meta.vy;
                pb.meta.vx = vxA * (1 - transfer) + vxB * transfer;
                pb.meta.vy = vyA * (1 - transfer) + vyB * transfer;
                other.meta.vx = vxB * (1 - transfer) + vxA * transfer;
                other.meta.vy = vyB * (1 - transfer) + vyA * transfer;
                // apply slight damping so they don't ping-pong forever
                pb.meta.vx *= 0.9; pb.meta.vy *= 0.9;
                other.meta.vx *= 0.9; other.meta.vy *= 0.9;
              } else {
                // collided with static solid: apply friction and small angular impulse
                pb.meta.vx *= 0.85;
                pb.meta.vy *= 0.9;
                pb.meta.angVel += (Math.random() - 0.5) * 30;
              }
            }
          }
        }
      }
    }

    // iterate with index so we can remove items safely (orbs)
    for(let i=0; i < this.level.length; i++){
      const o = this.level[i];
      // skip start marker (no collision) or flashlight (non-colliding) or dark crystal
      // also treat christmas-tree, flower, flower-field, purple-flower, half-decoration and diamond-disc as decorative/non-colliding
      if(o.type === "start" || o.type === "decoration" || o.type === "flashlight" || o.type === "dark-crystal" || o.type === "christmas-tree" || o.type === "star-light" || o.type === "flower" || o.type === "flower-field" || o.type === "purple-flower" || o.type === "half-decoration" || o.type === "diamond-disc") continue;
      // only rectangle collisions (for orb we'll do circle check below)
      const px = this.player.x, py = this.player.y, pw = this.player.w, ph = this.player.h;

      // Ship Portal: when overlapping, switch player into ship mode (non-colliding)
      if(o.type === "ship-portal"){
        if(px < o.x + o.w && px + pw > o.x && py < o.y + o.h && py + ph > o.y){
          // activate ship mode immediately
          this.mode = "ship";
          // give a small upward kick so it's obvious
          this.player.vy = Math.min(this.player.vy, -80);
          // mark triggered so it doesn't spam (but keep in level visually)
          o._triggered = true;
        }
        // do not treat as collision
        continue;
      }

      // Wave Portal: when overlapping, switch player into wave gamemode (non-colliding)
      if(o.type === "wave-portal"){
        if(px < o.x + o.w && px + pw > o.x && py < o.y + o.h && py + ph > o.y){
          this.mode = "wave";
          // instantly set velocities according to current hold state so the change is immediate
          if(this.holding){
            this.player.vx = this.waveUpVel.vx;
            this.player.vy = this.waveUpVel.vy;
          } else {
            this.player.vx = this.waveDownVel.vx;
            this.player.vy = this.waveDownVel.vy;
          }
          o._triggered = true;
        }
        continue;
      }

      // Cube Portal: when overlapping, switch player back to normal (cube) mode (non-colliding)
      if(o.type === "cube-portal"){
        if(px < o.x + o.w && px + pw > o.x && py < o.y + o.h && py + ph > o.y){
          // switch back to normal/cube mode
          this.mode = "normal";
          // small downward nudge so it feels like mode change happened (non-jarring)
          this.player.vy = Math.max(this.player.vy, -60);
          o._triggered = true;
        }
        // do not treat as collision
        continue;
      }

      // Ball Portal: when overlapping, switch player into ball mode (non-colliding)
      if(o.type === "ball-portal"){
        if(px < o.x + o.w && px + pw > o.x && py < o.y + o.h && py + ph > o.y){
          this.mode = "ball";
          // ensure gravity is positive by default when entering ball mode
          if(typeof this.gravity === "number" && this.gravity < 0) this.gravity = Math.abs(this.gravity);
          o._triggered = true;
        }
        continue;
      }
      // UFO Portal: when overlapping, switch player into ufo mode (cube-like but can jump mid-air)
      if(o.type === "ufo-portal"){
        if(px < o.x + o.w && px + pw > o.x && py < o.y + o.h && py + ph > o.y){
          this.mode = "ufo";
          // reset the ufo air-jump tracker so player can use one mid-air jump after entering
          // no single-use tracking — UFO can jump mid-air freely
          // minor upward nudge so the change is obvious
          this.player.vy = Math.min(this.player.vy, -60);
          o._triggered = true;
        }
        continue;
      }

      // BG Trigger: when player's center passes trigger.x => start background fade
      if(o.type === "bg-trigger"){
        // avoid retriggering the same object multiple times in a run
        if(!o._triggered){
          const playerCenterX = this.player.x + this.player.w/2;
          // ensure o.x is a valid finite number before comparing
          const triggerX = (typeof o.x === "number" && isFinite(o.x)) ? o.x : Infinity;
          if(playerCenterX >= triggerX){
            o._triggered = true;
            // read target color and fade time from meta (default safe values)
            const target = (o.meta && o.meta.bgColor) ? o.meta.bgColor : this.editor.bgColor || "#ffffff";
            // ensure fade is a finite number
            const fadeRaw = (o.meta && typeof o.meta.fadeTime === "number") ? Number(o.meta.fadeTime) : 0.6;
            const fade = (isFinite(fadeRaw)) ? fadeRaw : 0.6;
            // start color tween on editor.bgColor
            this._startBgFade(target, Math.max(0, fade));
          }
        }
        // BG triggers do not collide - continue to next object
        continue;
      }

      // G Trigger: when player's center passes trigger.x => start ground fade (ground color or outline)
      if(o.type === "g-trigger"){
        if(!o._triggered){
          const playerCenterX = this.player.x + this.player.w/2;
          const triggerX = (typeof o.x === "number" && isFinite(o.x)) ? o.x : Infinity;
          if(playerCenterX >= triggerX){
            o._triggered = true;
            const meta = o.meta || {};
            const targetColor = meta.color || this.editor.groundColor || "#e6e6e6";
            const targetProp = meta.target || "ground"; // "ground" or "outline"
            const fadeRaw = (typeof meta.fadeTime === "number") ? Number(meta.fadeTime) : 0.6;
            const fade = (isFinite(fadeRaw) && fadeRaw >= 0) ? fadeRaw : 0.6;
            this._startGroundFade(targetProp, targetColor, Math.max(0, fade));
          }
        }
        // G triggers do not collide
        continue;
      }

      // GR Trigger: when player's center passes trigger.x => start grid line color fade
      if(o.type === "gr-trigger"){
        if(!o._triggered){
          const playerCenterX = this.player.x + this.player.w/2;
          const triggerX = (typeof o.x === "number" && isFinite(o.x)) ? o.x : Infinity;
          if(playerCenterX >= triggerX){
            o._triggered = true;
            const meta = o.meta || {};
            const targetColor = meta.targetGridColor || this.editor.gridLineColor || "#d0d0d0";
            const fadeRaw = (typeof meta.fadeTime === "number") ? Number(meta.fadeTime) : 0.6;
            const fade = (isFinite(fadeRaw) && fadeRaw >= 0) ? fadeRaw : 0.6;
            this._startGridFade(targetColor, Math.max(0, fade));
          }
        }
        continue;
      }

      // Color Trigger: when player's center passes trigger.x => change color of first object matching group id
      if(o.type === "color-trigger"){
        if(!o._triggered){
          const playerCenterX = this.player.x + this.player.w/2;
          const triggerX = (typeof o.x === "number" && isFinite(o.x)) ? o.x : Infinity;
          if(playerCenterX >= triggerX){
            o._triggered = true;
            const meta = o.meta || {};
            const targetGroup = meta.targetGroup || "";
            const targetColor = meta.color || "#ffffff";
            const fadeRaw = (typeof meta.fadeTime === "number") ? Number(meta.fadeTime) : 0.6;
            const fade = (isFinite(fadeRaw) && fadeRaw >= 0) ? fadeRaw : 0.6;
            // find ALL objects in editor.objects with meta.group === targetGroup and apply change
            if(targetGroup !== ""){
              const matches = this.editor.objects.filter(x => {
                if(!x.meta) return false;
                if(Array.isArray(x.meta.groups)) return x.meta.groups.includes(targetGroup);
                return x.meta.group === targetGroup;
              });
              for(const found of matches){
                if(fade <= 0){
                  found.color = targetColor;
                  const running = this.level.find(x => x.id === found.id);
                  if(running) running.color = targetColor;
                } else {
                  // start a color tween for each matching object
                  this._startColorChange(found, targetColor, Math.max(0, fade));
                }
              }
            }
          }
        }
        continue;
      }

      // Alpha Trigger: when player's center passes trigger.x => change opacity (meta.alpha) of objects matching group id
      if(o.type === "alpha-trigger"){
        if(!o._triggered){
          const playerCenterX = this.player.x + this.player.w/2;
          const triggerX = (typeof o.x === "number" && isFinite(o.x)) ? o.x : Infinity;
          if(playerCenterX >= triggerX){
            o._triggered = true;
            const meta = o.meta || {};
            const targetGroup = meta.targetGroup || "";
            const targetAlpha = (typeof meta.alpha === "number") ? meta.alpha : 1;
            const fadeRaw = (typeof meta.fadeTime === "number") ? Number(meta.fadeTime) : 0.6;
            const fade = (isFinite(fadeRaw) && fadeRaw >= 0) ? fadeRaw : 0.6;
            if(targetGroup !== ""){
              const matches = this.editor.objects.filter(x => {
                if(!x.meta) return false;
                if(Array.isArray(x.meta.groups)) return x.meta.groups.includes(targetGroup);
                return x.meta.group === targetGroup;
              });
              for(const found of matches){
                if(fade <= 0){
                  if(!found.meta) found.meta = {};
                  found.meta.alpha = targetAlpha;
                  const running = this.level.find(x => x.id === found.id);
                  if(running){ running.meta = running.meta || {}; running.meta.alpha = targetAlpha; }
                } else {
                  this._startAlphaChange(found, targetAlpha, Math.max(0, fade));
                }
              }
            }
          }
        }
        continue;
      }

      // Move Trigger: when player's center passes trigger.x => move first object with meta.group matching targetGroup
      if(o.type === "move-trigger"){
        if(!o._triggered){
          const playerCenterX = this.player.x + this.player.w/2;
          const triggerX = (typeof o.x === "number" && isFinite(o.x)) ? o.x : Infinity;
          if(playerCenterX >= triggerX){
            o._triggered = true;
            const meta = o.meta || {};
            const targetGroup = meta.targetGroup || "";
            const moveX = Number(meta.moveX) || 0;
            const moveY = Number(meta.moveY) || 0;
            const fadeRaw = (typeof meta.moveTime === "number") ? Number(meta.moveTime) : 0.6;
            const moveTime = (isFinite(fadeRaw) && fadeRaw >= 0) ? fadeRaw : 0.6;
            const lockX = !!meta.lockToPlayerX;
            const lockY = !!meta.lockToPlayerY;
            const lockDuration = Math.max(0, Number(meta.lockDuration) || 0);
            if(targetGroup !== ""){
              // apply to all matching objects
              const matches = this.editor.objects.filter(x => {
                if(!x.meta) return false;
                if(Array.isArray(x.meta.groups)) return x.meta.groups.includes(targetGroup);
                return x.meta.group === targetGroup;
              });
              const g = Math.max(4, this.editor.gridSize|0);
              for(const found of matches){
                if(lockX || lockY){
                  // start an individual lock per matching object
                  this._startLock(found, { lockX, lockY, duration: lockDuration, offsetGridX: moveX, offsetGridY: moveY });
                } else {
                  const targetX = (Number(found.x) || 0) + (moveX * g);
                  const targetY = (Number(found.y) || 0) + (moveY * g);
                  if(moveTime <= 0){
                    found.x = targetX;
                    found.y = targetY;
                    const running = this.level.find(x => x.id === found.id);
                    if(running){ running.x = targetX; running.y = targetY; }
                  } else {
                    this._startMove(found, { x: targetX, y: targetY }, Math.max(0, moveTime));
                  }
                }
              }
            }
          }
        }
        continue;
      }

      // Rotate Trigger: when player's center passes trigger.x => rotate first object with meta.group matching targetGroup
      if(o.type === "rotate-trigger"){
        if(!o._triggered){
          const playerCenterX = this.player.x + this.player.w/2;
          const triggerX = (typeof o.x === "number" && isFinite(o.x)) ? o.x : Infinity;
          if(playerCenterX >= triggerX){
            o._triggered = true;
            const meta = o.meta || {};
            const targetGroup = meta.targetGroup || meta.target || "";
            const centerGroup = meta.centerGroup || "";
            const degrees = Number(meta.degrees) || 0;
            const spins = Math.max(0, Number(meta.spins) || 0);
            const timeRaw = (typeof meta.rotateTime === "number") ? Number(meta.rotateTime) : 0.6;
            const rotateTime = (isFinite(timeRaw) && timeRaw >= 0) ? timeRaw : 0.6;
            if(targetGroup !== ""){
              // apply rotation to all objects matching targetGroup
              const matches = this.editor.objects.filter(x => {
                if(!x.meta) return false;
                if(Array.isArray(x.meta.groups)) return x.meta.groups.includes(targetGroup);
                return x.meta.group === targetGroup;
              });
              // resolve center object once if provided (prefer live object)
              const centerObj = centerGroup ? this.editor.objects.find(x => {
                if(!x.meta) return false;
                if(Array.isArray(x.meta.groups)) return x.meta.groups.includes(centerGroup);
                return x.meta.group === centerGroup;
              }) : null;
              const totalDegrees = degrees + (spins * 360);
              for(const found of matches){
                this._startRotate(found, centerObj, totalDegrees, rotateTime);
              }
            }
          }
        }
        continue;
      }

      // Spawn Trigger: when player's center passes trigger.x => re-enable triggers that belong to a target group
      if(o.type === "spawn-trigger"){
        if(!o._triggered){
          const playerCenterX = this.player.x + this.player.w/2;
          const triggerX = (typeof o.x === "number" && isFinite(o.x)) ? o.x : Infinity;
          if(playerCenterX >= triggerX){
            o._triggered = true;
            const meta = o.meta || {};
            const targetGroup = meta.targetGroup || "";
            if(targetGroup !== ""){
              // for each object in editor.objects that is a trigger type and belongs to the target group,
              // clear their _triggered flag so they can activate again later even if their X isn't passed yet.
              for(const candidate of this.editor.objects){
                if(!candidate.meta) continue;
                // consider triggers that normally set _triggered: move-trigger, rotate-trigger, alpha-trigger, color-trigger, gr-trigger, bg-trigger, edit-group-trigger
                const triggerTypes = ["move-trigger","rotate-trigger","alpha-trigger","color-trigger","gr-trigger","bg-trigger","edit-group-trigger","spawn-trigger"];
                if(!triggerTypes.includes(candidate.type)) continue;
                const groups = Array.isArray(candidate.meta.groups) ? candidate.meta.groups : (candidate.meta.group ? [candidate.meta.group] : []);
                if(groups.includes(targetGroup)){
                  // clear both editor object and running level copy flags so they can fire again
                  candidate._triggered = false;
                  const running = this.level.find(x => x.id === candidate.id);
                  if(running) running._triggered = false;
                }
              }
            }
          }
        }
        continue;
      }

      // Nudge Block:when overlapping, apply a one-time nudge to the player in the block's facing direction (non-colliding)
      if(o.type === "nudge"){
        const px = this.player.x, py = this.player.y, pw = this.player.w, ph = this.player.h;
        // trigger when the player ENTERS overlap (edge-detect) so the block can nudge multiple times
        const overlapping = (px < o.x + o.w && px + pw > o.x && py < o.y + o.h && py + ph > o.y);
        if(overlapping && !o._nudgeActive){
          o._nudgeActive = true;
          const dir = (o.meta && o.meta.direction) ? String(o.meta.direction) : "right";
          const strengthGrid = Math.max(0, Number(o.meta && o.meta.strength) || 1);
          const g = Math.max(4, this.editor.gridSize|0);
          const pushPx = strengthGrid * g;
          if(dir === "left"){ this.player.x -= pushPx; this.player.y -= Math.min(6, Math.round(g*0.125)); }
          else if(dir === "right"){this.player.x += pushPx; this.player.y -= Math.min(6, Math.round(g*0.125)); }
          else if(dir === "up"){this.player.y -= pushPx; }
          else if(dir === "down"){this.player.y += pushPx; }
          else { this.player.x += pushPx; this.player.y -= Math.min(6, Math.round(g*0.125)); }
        }
        // clear active flag when no longer overlapping so future re-entries re-trigger
        if(!overlapping && o._nudgeActive) o._nudgeActive = false;
        continue;
      }

      // special-case orb (circular) collision: collect / trigger bounce only when jumpRequested while overlapping
      if(o.type === "orb" || o.type === "strong-orb" || o.type === "weak-orb"){
        // treat orb as circle centered in its cell (works for both orb types)
        const cx = o.x + o.w/2;
        const cy = o.y + o.h/2;
        const radius = Math.min(o.w, o.h) / 2 * 1.4;
        const nearestX = Math.max(px, Math.min(cx, px + pw));
        const nearestY = Math.max(py, Math.min(cy, py + ph));
        const dx = cx - nearestX;
        const dy = cy - nearestY;
        if((dx*dx + dy*dy) <= (radius*radius)){
          // currently overlapping an orb
          // Allow orb activation when:
          // - a normal jump was requested, OR
          // - in ship mode and the player is currently holding thrust, OR
          // - in ball mode and a jump request was set by pointer (see pointerdown handling)
          if(this.jumpRequested || (this.mode === "ship" && this.holding)){
            // remove orb and give upward bounce; strong-orb gives a stronger bounce
            this.level.splice(i,1);
            i--;
            // weak-orb provides a weaker bounce than regular orb
            const strength = (o.type === "strong-orb") ? 0.95 : (o.type === "weak-orb" ? 0.45 : 0.6);
            this.player.vy = Math.min(this.player.vy, this.jumpVel * strength);
            this.player.grounded = false;
            // consume the jump request if present; also clear hold-trigger for ship so it doesn't re-consume
            this.jumpRequested = false;
            if(this.mode === "ship") this.holding = false;
            continue;
          } else {
            continue;
          }
        } else {
          continue;
        }
      }

      // If this object is a y-holder and the player is NOT overlapping it, clear its active hold flag so release detection works.
      if(o.type === "y-holder"){
        const overlappingForYHolder = (px < o.x + o.w && px + pw > o.x && py < o.y + o.h && py + ph > o.y);
        if(!overlappingForYHolder && o._yHoldActive){
          // clear per-object active flag immediately when no longer overlapping
          o._yHoldActive = false;
        }
      }

      // rectangle overlap check for other objects
      if(px < o.x + o.w && px + pw > o.x && py < o.y + o.h && py + ph > o.y){
        // if hitting a hazard, restart the level immediately
        if(o.type === "hazard" || o.type === "half-hazard" || o.type === "saw"){
           this.restart();
           // break out of collision processing for this frame
           break;
         }
        // treat wheels (both wheel and wheel-2) like saws (deadly)
        if(o.type === "wheel" || o.type === "wheel-2"){
           this.restart();
           break;
        }
        // treat saw-2 as deadly like saw
        if(o.type === "saw-2"){
           this.restart();
           break;
        }

        // if touching a jump pad: do NOT act as a solid block — any overlap triggers the pad bounce.
        if(o.type === "jump" || o.type === "strong-jump" || o.type === "weak-jump"){
          const prevY = this.player.y - this.player.vy * dt;
          // If coming from above, place on top then bounce (keeps natural landing behavior)
          if(prevY + ph <= o.y){
            this.player.y = o.y - ph;
          }
          // Apply bounce impulse (stronger than regular jump); strong-jump is more powerful
          // weak-jump is slightly weaker than regular jump
          const multiplier = (o.type === "strong-jump") ? 1.65 : (o.type === "weak-jump" ? 0.85 : 1.15);
          this.player.vy = this.jumpVel * multiplier;
          this.player.grounded = false;
          // Nudge horizontally a tiny bit away so we don't continuously retrigger the pad if fully overlapping
          if(this.player.x + pw/2 < o.x + o.w/2){
            this.player.x -= 1;
          } else {
            this.player.x += 1;
          }
          // continue without treating as solid collision
          continue;
        }

        // simple resolution: if coming from above, place on top
        const prevY = this.player.y - this.player.vy * dt;
        // if gravity is positive (normal), landing occurs when coming from above; if gravity is negative, landing occurs when coming from below
        if(this.gravity >= 0 ? (prevY + ph <= o.y) : (prevY >= o.y + o.h)){
          if(this.gravity >= 0){
            this.player.y = o.y - ph;
          } else {
            // when inverted gravity, "ground" is the block bottom, so align player to block bottom
            this.player.y = o.y + o.h;
          }
          this.player.vy = 0;
          this.player.grounded = true;
        } else {
          // Non-top collision (side or from below).
          // Special Y Holder behavior: side or bottom contact holds player's Y in place (no death), top still acts as normal solid above.
          if(o.type === "y-holder"){
            // Determine whether the contact is from below (player came up into the block) or a side contact.
            const comingFromBelow = (this.gravity >= 0) ? (prevY >= o.y + o.h) : (prevY + ph <= o.y);
            if(comingFromBelow){
              // If hit from below/top (player landed on its top), behave like a normal solid top: place the player on top and stop vertical motion.
              if(this.gravity >= 0){
                this.player.y = o.y - ph;
              } else {
                this.player.y = o.y + o.h;
              }
              this.player.vy = 0;
              this.player.grounded = true;
              continue;
            } else {
              // Side or bottom contact: enable persistent Y-hold while the player remains touching the holder.
              // Mark the object as actively holding and capture the exact Y the player had at the moment of first contact.
              if(!o._yHoldActive){
                // only capture the held Y the first time the player touches this holder
                o._yHoldActive = true;
                // record which object is performing the hold so release detection is reliable
                this._yHolderHoldingId = o.id;
                this._yHolderHolding = true;
                // store exact current player Y (no upward snapping)
                this._yHolderHeldY = this.player.y;
              }
              // Immediately enforce the held Y and clear vertical momentum so no falling occurs this frame.
              this.player.y = this._yHolderHeldY;
              this.player.vy = 0;
              this.jumpRequested = false;
              // prevent treating this as a fatal side/bottom collision and stop further collision handling for this frame
              continue;
            }
          }

          // Treat side/bottom collisions with regular blocks as deadly (restart) like spikes.
          if(o.type === "block" || o.type === "platform" || o.type === "physics-block" || o.type === "bobby"){
            // In platformer mode, side/bottom hits should not kill the player:
            if(this.editor && this.editor.platformerMode){
              // resolve horizontal overlap by nudging player to the left of the obstacle
              // Determine whether the collision came from below (player was moving up into the object's bottom)
              // Use prevY to detect whether player was previously below the object (coming from underneath).
              const comingFromBelow = (this.gravity >= 0) ? (prevY >= o.y + o.h) : (prevY + ph <= o.y);
              if(comingFromBelow){
                // Nudge vertically away from the object: push player below the block if they hit its bottom,
                // or above if gravity is inverted and they hit the top when moving down.
                if(this.gravity >= 0){
                  // place player just below the object to avoid re-collision
                  this.player.y = o.y + o.h + 0.1;
                  // stop upward momentum to avoid immediate re-contact
                  if(typeof this.player.vy === "number" && this.player.vy < 0) this.player.vy = 0;
                } else {
                  // inverted gravity: player hitting from top should be nudged above the object
                  this.player.y = o.y - ph - 0.1;
                  if(typeof this.player.vy === "number" && this.player.vy > 0) this.player.vy = 0;
                }
              } else {
                // Side collision: resolve horizontally as before
                if(this.player.x + pw/2 < o.x + o.w/2){
                  this.player.x = o.x - pw - 0.1;
                } else {
                  this.player.x = o.x + o.w + 0.1;
                }
                // zero small horizontal momentum if present (defensive)
                if(typeof this.player.vx === "number") this.player.vx = 0;
              }
            } else {
              // default fatal behavior outside of platformer mode
              this.restart();
              break;
            }
          } else {
            // default behavior for other object types: prevent overlap horizontally
            this.player.x = o.x - pw - 0.1;
          }
        }
      }

      // Edit-Group Trigger: when player's center passes trigger.x => modify groups (add/remove) on matching objects
      if(o.type === "edit-group-trigger"){
        if(!o._triggered){
          const playerCenterX = this.player.x + this.player.w/2;
          const triggerX = (typeof o.x === "number" && isFinite(o.x)) ? o.x : Infinity;
          if(playerCenterX >= triggerX){
            o._triggered = true;
            const meta = o.meta || {};
            const targetGroup = meta.targetGroup || "";
            // parse add/remove lists stored as arrays (editor writes arrays)
            const toAdd = Array.isArray(meta.addGroups) ? meta.addGroups : (typeof meta.addGroups === "string" ? meta.addGroups.split(",").map(s=>s.trim()).filter(Boolean) : []);
            const toRemove = Array.isArray(meta.removeGroups) ? meta.removeGroups : (typeof meta.removeGroups === "string" ? meta.removeGroups.split(",").map(s=>s.trim()).filter(Boolean) : []);
            if(targetGroup !== ""){
              const matches = this.editor.objects.filter(x => {
                if(!x.meta) return false;
                if(Array.isArray(x.meta.groups)) return x.meta.groups.includes(targetGroup);
                return x.meta.group === targetGroup;
              });
              for(const found of matches){
                if(!found.meta) found.meta = {};
                // ensure groups array exists
                if(!Array.isArray(found.meta.groups)){
                  found.meta.groups = [];
                  if(typeof found.meta.group === "string" && found.meta.group) found.meta.groups.push(found.meta.group);
                }
                // remove requested groups
                for(const rem of toRemove){
                  found.meta.groups = found.meta.groups.filter(g => g !== rem);
                }
                // add requested groups (avoid duplicates)
                for(const add of toAdd){
                  if(!found.meta.groups.includes(add)) found.meta.groups.push(add);
                }
                // keep legacy single-group for compatibility
                if(found.meta.groups.length) found.meta.group = found.meta.groups[0];
                else { delete found.meta.group; delete found.meta.groups; }
                // also apply to running level copy if present
                const running = this.level.find(x => x.id === found.id);
                if(running){
                  if(!running.meta) running.meta = {};
                  if(found.meta.groups) running.meta.groups = [...found.meta.groups];
                  if(found.meta.group) running.meta.group = found.meta.group;
                }
              }
            }
          }
        }
        continue;
      }

    }

    // clear y-holder holding if no longer touching any holder objects
    if(this._yHolderHolding){
      let any = false;
      for(const obj of this.level || []){
        if(obj && obj._yHoldActive){
          any = true;
          break;
        }
      }
      if(!any){
        this._yHolderHolding = false;
        delete this._yHolderHeldY;
      }
    }

    // update active background tweens (advance and apply)
    if(this._bgTweens.length){
      const remaining = [];
      for(const t of this._bgTweens){
        t.elapsed += dt;
        const p = Math.min(1, t.elapsed / t.duration);
        const c = this._lerpColor(t.from, t.to, p);
        // apply to editor.bgColor and CSS root var for immediate visual effect
        // Only update the editor's background color so the in-game canvas background changes;
        // do NOT modify the page root -- keeps outer UI/background unchanged.
        this.editor.bgColor = c;
        if(p < 1) remaining.push(t);
      }
      this._bgTweens = remaining;
    }

    // update active ground tweens (advance and apply)
    if(this._groundTweens.length){
      const remainingG = [];
      for(const t of this._groundTweens){
        t.elapsed += dt;
        const p = Math.min(1, t.elapsed / t.duration);
        const c = this._lerpColor(t.from, t.to, p);
        // apply to the chosen ground property
        if(t.prop === "outline"){
          this.editor.groundOutlineColor = c;
        } else {
          this.editor.groundColor = c;
        }
        if(p < 1) remainingG.push(t);
      }
      this._groundTweens = remainingG;
    }

    // update active grid-line color tweens (advance and apply)
    if(this._gridTweens.length){
      const remainingGR = [];
      for(const t of this._gridTweens){
        t.elapsed += dt;
        const p = Math.min(1, t.elapsed / t.duration);
        const c = this._lerpColor(t.from, t.to, p);
        this.editor.gridLineColor = c;
        if(p < 1) remainingGR.push(t);
      }
      this._gridTweens = remainingGR;
    }

    // update active color tweens (advance and apply)
    if(this._colorTweens.length){
      const remainingC = [];
      for(const t of this._colorTweens){
        t.elapsed += dt;
        const p = Math.min(1, t.elapsed / t.duration);
        const c = this._lerpColor(t.from, t.to, p);
        // find object by id in editor.objects and apply interpolated color
        const o = this.editor.objects.find(x => x.id === t.objId);
        if(o){ o.color = c; }
        // ALSO apply to the running level copy so it renders immediately while playing
        const rl = this.level.find(x => x.id === t.objId);
        if(rl){ rl.color = c; }
        if(p < 1) remainingC.push(t);
      }
      this._colorTweens = remainingC;
    }

    // update active alpha tweens (advance and apply)
    if(this._alphaTweens.length){
      const remainingA = [];
      for(const t of this._alphaTweens){
        t.elapsed += dt;
        const p = Math.min(1, t.elapsed / t.duration);
        // linear lerp between numbers
        const val = t.from + (t.to - t.from) * p;
        // apply to editor.objects meta.alpha and running level copy meta.alpha
        const o = this.editor.objects.find(x => x.id === t.objId);
        if(o){ o.meta = o.meta || {}; o.meta.alpha = val; }
        const rl = this.level.find(x => x.id === t.objId);
        if(rl){ rl.meta = rl.meta || {}; rl.meta.alpha = val; }
        if(p < 1) remainingA.push(t);
      }
      this._alphaTweens = remainingA;
    }

    // update active move tweens (advance and apply)
    if(this._moveTweens.length){
      const remainingM = [];
      for(const t of this._moveTweens){
        // lock-style tween: keep object anchored to player's position + initial relative offset (with optional extra offset)
        if(t.lockX || t.lockY){
          t.elapsed += dt;
          const p = Math.min(1, t.elapsed / Math.max(1e-9, t.duration)); // p used only to decide end
          const o = this.editor.objects.find(x => x.id === t.objId);
          const rl = this.level.find(x => x.id === t.objId);
          if(o){
            // compute target x/y based on player's current position + initial rel + extra offset
            const targetX = (t.lockX) ? (this.player.x + t.rel.x + t.offset.x) : o.x;
            const targetY = (t.lockY) ? (this.player.y + t.rel.y + t.offset.y) : o.y;
            o.x = targetX;
            o.y = targetY;
          }
          if(rl){
            const targetX = (t.lockX) ? (this.player.x + t.rel.x + t.offset.x) : rl.x;
            const targetY = (t.lockY) ? (this.player.y + t.rel.y + t.offset.y) : rl.y;
            rl.x = targetX;
            rl.y = targetY;
          }
          if(p < 1) remainingM.push(t);
          // when p >=1 the lock ends and the tween is not kept
          continue;
        }

        // non-lock linear move tween (existing behavior)
        t.elapsed += dt;
        const p = Math.min(1, t.elapsed / t.duration);
        // simple linear interpolation for x/y
        const nx = t.from.x + (t.to.x - t.from.x) * p;
        const ny = t.from.y + (t.to.y - t.from.y) * p;
        // apply to editor.objects and running level copy
        const o = this.editor.objects.find(x => x.id === t.objId);
        if(o){ o.x = nx; o.y = ny; }
        const rl = this.level.find(x => x.id === t.objId);
        if(rl){ rl.x = nx; rl.y = ny; }
        if(p < 1) remainingM.push(t);
      }
      this._moveTweens = remainingM;
    }

    // update active rotate tweens (advance and apply)
    if(this._rotateTweens.length){
      const remainingR = [];
      for(const t of this._rotateTweens){
        t.elapsed += dt;
        const p = Math.min(1, t.elapsed / Math.max(1e-9, t.duration));
        const ang = t.from + (t.to - t.from) * p;
        // apply rotation value
        const o = this.editor.objects.find(x => x.id === t.objId);
        const rl = this.level.find(x => x.id === t.objId);
        if(o) o.rotation = ang;
        if(rl) rl.rotation = ang;
        // if a pivot/center is specified, compute rotated position of object's center around pivot
        if(t.centerId){
          // resolve pivot coords: prefer stored pivot, but try to find live center object if available
          let pivotX = t.pivot ? t.pivot.x : null;
          let pivotY = t.pivot ? t.pivot.y : null;
          const centerObj = this.editor.objects.find(x => x.id === t.centerId) || null;
          if(centerObj){
            pivotX = Number(centerObj.x) + (centerObj.w ? centerObj.w/2 : 0);
            pivotY = Number(centerObj.y) + (centerObj.h ? centerObj.h/2 : 0);
          }
          if(pivotX !== null && pivotY !== null){
            const angleRad = (ang * Math.PI) / 180;
            // use original center position captured when tween started
            const ox = t.origCenter.x;
            const oy = t.origCenter.y;
            const dx = ox - pivotX, dy = oy - pivotY;
            const nx = pivotX + (dx * Math.cos(angleRad) - dy * Math.sin(angleRad));
            const ny = pivotY + (dx * Math.sin(angleRad) + dy * Math.cos(angleRad));
            // apply top-left positions so object remains centered at computed center
            if(o){ o.x = nx - (o.w ? o.w/2 : 0); o.y = ny - (o.h ? o.h/2 : 0); }
            if(rl){ rl.x = nx - (rl.w ? rl.w/2 : 0); rl.y = ny - (rl.h ? rl.h/2 : 0); }
          }
        }
        if(p < 1) remainingR.push(t);
      }
      this._rotateTweens = remainingR;
    }

    // update editor camera to follow player, using a safe non-zero zoom to avoid Infinity/NaN offsets
    const safeZoom = Math.max(0.2, Number(this.editor.zoom) || 1);
    const targetX = - (this.player.x - 160) / safeZoom;
    const targetY = - (this.player.y - 220) / safeZoom;
    // initialize cam pos on first frame
    if(isNaN(this._camPos.x) || isNaN(this._camPos.y) || (this._camPos.x === 0 && this._camPos.y === 0 && this._last === this.startTime)){
      this._camPos.x = targetX;
      this._camPos.y = targetY;
    }
    // ease toward target to reduce instantaneous small movements (less shaking)
    const s = Math.max(0.02, Math.min(0.5, this._camSmooth));
    this._camPos.x += (targetX - this._camPos.x) * s;
    this._camPos.y += (targetY - this._camPos.y) * s;
    this.editor.offset.x = this._camPos.x;
    this.editor.offset.y = this._camPos.y;

    // enforce infinite ground (world-level floor) — match editor ground moved down by half a grid cell
    // Only enforce the infinite ground collision when the editor is configured to show a ground.
    // If editor.noGround is true, skip applying the ground hitbox so the player can fall freely.
    if(!this.editor.noGround){
      const GROUND_Y = 560 + (Math.max(4, this.editor.gridSize|0) / 2);
      if(this.player.y + this.player.h >= GROUND_Y){
        this.player.y = GROUND_Y - this.player.h;
        this.player.vy = 0;
        this.player.grounded = true;
      }
    }

    // clear jump request at the end of the frame if it wasn't consumed by an orb (prevents persistent requests)
    this.jumpRequested = false;
  }

  // helper: returns true if player is standing on a surface (floor when gravity>0) or touching ceiling (when gravity<0)
  _isOnSurface(){
    // ground Y used by editor (matches enforcement)
    const g = Math.max(4, this.editor.gridSize|0);
    const GROUND_Y = 560 + (g / 2);
    // use a slightly looser tolerance (4px) so a first click is not missed due to tiny float differences.
    if(this.gravity >= 0){
      return (this.player.grounded) || (Math.abs((this.player.y + this.player.h) - GROUND_Y) < 4);
    } else {
      return (this.player.grounded) || (Math.abs(this.player.y - 0) < 4);
    }
  }

  // start a background fade tween (adds to _bgTweens)
  _startBgFade(targetHex, duration){
    // capture current editor.bgColor as start
    const from = this.editor.bgColor || "#ffffff";
    const to = targetHex || "#ffffff";
    // ensure duration is a finite number
    duration = Number(duration) || 0;
    if(duration <= 0){
      // immediate apply only to in-game/editor background color
      this.editor.bgColor = to;
      return;
    }
    this._bgTweens.push({ from, to, duration, elapsed: 0 });
  }

  // start a ground fade tween (adds to _groundTweens)
  _startGroundFade(prop, targetHex, duration){
    const from = (prop === "outline" ? (this.editor.groundOutlineColor || "#d0d0d0") : (this.editor.groundColor || "#e6e6e6"));
    const to = targetHex || from;
    duration = Number(duration) || 0;
    if(duration <= 0){
      if(prop === "outline") this.editor.groundOutlineColor = to;
      else this.editor.groundColor = to;
      return;
    }
    this._groundTweens.push({ prop: prop === "outline" ? "outline" : "ground", from, to, duration, elapsed: 0 });
  }

  // start a grid line color fade (adds to _gridTweens)
  _startGridFade(targetColor, duration){
    const from = this.editor.gridLineColor || "#d0d0d0";
    const to = targetColor || from;
    duration = Number(duration) || 0;
    if(duration <= 0){
      this.editor.gridLineColor = to;
      return;
    }
    this._gridTweens.push({ from, to, duration, elapsed: 0 });
  }

  // start a move tween for a specific object
  _startMove(targetObj, toPos, duration){
    if(!targetObj) return;
    const from = { x: Number(targetObj.x) || 0, y: Number(targetObj.y) || 0 };
    if(!duration || duration <= 0){
      targetObj.x = toPos.x;
      targetObj.y = toPos.y;
      const running = this.level && Array.isArray(this.level) ? this.level.find(x => x.id === targetObj.id) : null;
      if(running){ running.x = toPos.x; running.y = toPos.y; }
      return;
    }
    this._moveTweens.push({ objId: targetObj.id, from, to: { x: toPos.x, y: toPos.y }, duration, elapsed: 0 });
  }

  // start a color fade tween for a specific object (applies to editor.objects)
  _startColorChange(targetObj, toHex, duration){
    if(!targetObj) return;
    const from = targetObj.color || "#ffffff";
    // immediate apply when duration <=0
    if(!duration || duration <= 0){
      targetObj.color = toHex;
      // also ensure running level copy gets updated immediately if a run is active
      const running = this.level && Array.isArray(this.level) ? this.level.find(x => x.id === targetObj.id) : null;
      if(running) running.color = toHex;
      return;
    }
    this._colorTweens.push({ objId: targetObj.id, from, to: toHex, duration, elapsed: 0 });
  }

  // start an alpha fade tween for a specific object (applies to meta.alpha)
  _startAlphaChange(targetObj, toAlpha, duration){
    if(!targetObj) return;
    const from = (targetObj.meta && typeof targetObj.meta.alpha === "number") ? targetObj.meta.alpha : 1;
    if(!duration || duration <= 0){
      targetObj.meta = targetObj.meta || {};
      targetObj.meta.alpha = toAlpha;
      const running = this.level && Array.isArray(this.level) ? this.level.find(x => x.id === targetObj.id) : null;
      if(running){ running.meta = running.meta || {}; running.meta.alpha = toAlpha; }
      return;
    }
    this._alphaTweens.push({ objId: targetObj.id, from, to: toAlpha, duration, elapsed: 0 });
  }

  // start a rotate tween for a specific object (degrees absolute relative add)
  _startRotate(targetObj, centerObj, degrees, duration){
    if(!targetObj) return;
    const from = Number(targetObj.rotation || 0);
    const to = from + Number(degrees || 0);
    // If a center object is provided, capture pivot and original offsets so the tween can rotate position around pivot
    const pivot = centerObj ? { x: Number(centerObj.x) || 0, y: Number(centerObj.y) || 0 } : null;
    const orig = { x: Number(targetObj.x) || 0, y: Number(targetObj.y) || 0 };
    if(!duration || duration <= 0){
      targetObj.rotation = to;
      if(pivot){
        // apply final rotated position around pivot immediately
        const angleRad = (to * Math.PI) / 180;
        const cx = pivot.x + (centerObj.w ? centerObj.w/2 : 0);
        const cy = pivot.y + (centerObj.h ? centerObj.h/2 : 0);
        const ox = orig.x + (targetObj.w ? targetObj.w/2 : 0);
        const oy = orig.y + (targetObj.h ? targetObj.h/2 : 0);
        const dx = ox - cx, dy = oy - cy;
        const nx = cx + (dx * Math.cos(angleRad) - dy * Math.sin(angleRad));
        const ny = cy + (dx * Math.sin(angleRad) + dy * Math.cos(angleRad));
        // set object's top-left to keep same relative centering
        targetObj.x = nx - (targetObj.w ? targetObj.w/2 : 0);
        targetObj.y = ny - (targetObj.h ? targetObj.h/2 : 0);
      }
      const running = this.level && Array.isArray(this.level) ? this.level.find(x => x.id === targetObj.id) : null;
      if(running) running.rotation = to;
      return;
    }
    this._rotateTweens.push({
      objId: targetObj.id,
      from, to,
      duration, elapsed: 0,
      centerId: centerObj ? centerObj.id : null,
      // store pivot and original center positions for the tween
      pivot,
      origCenter: { x: orig.x + (targetObj.w ? targetObj.w/2 : 0), y: orig.y + (targetObj.h ? targetObj.h/2 : 0) }
    });
  }

  // NEW: start a lock that keeps an object following player's x/y for duration seconds
  _startLock(targetObj, opts = {}){
    if(!targetObj) return;
    const lockX = !!opts.lockX;
    const lockY = !!opts.lockY;
    const duration = Math.max(0, Number(opts.duration) || 0);
    // compute pixel offsets if offsets provided in grid units
    const g = Math.max(4, this.editor.gridSize|0);
    const offsetX = (Number(opts.offsetGridX) || 0) * g;
    const offsetY = (Number(opts.offsetGridY) || 0) * g;
    // capture initial relationship between object and player so the lock can preserve offset
    const initial = { x: Number(targetObj.x) || 0, y: Number(targetObj.y) || 0 };
    const rel = { x: initial.x - this.player.x, y: initial.y - this.player.y };
    // enqueue a special moveTween with lock flags
    this._moveTweens.push({
      objId: targetObj.id,
      lockX,
      lockY,
      rel,
      offset: { x: offsetX, y: offsetY },
      duration,
      elapsed: 0,
      // from/to not used for lock tween
    });
  }

  // helper: linear interpolate two hex colors, returns hex string
  _lerpColor(aHex, bHex, t){
    // parse hex like #rrggbb
    const pa = this._hexToRgb(aHex || "#ffffff");
    const pb = this._hexToRgb(bHex || "#ffffff");
    // use parsed colors pa / pb (previously referenced undefined variable -> crash)
    const r = Math.round(pa.r + (pb.r - pa.r) * t);
    const g = Math.round(pa.g + (pb.g - pa.g) * t);
    const b = Math.round(pa.b + (pb.b - pa.b) * t);
    return "#" + ((1<<24) + (r<<16) + (g<<8) + b).toString(16).slice(1);
  }
  _hexToRgb(hex){
    hex = (hex || "#ffffff").replace("#","");
    if(hex.length === 3) hex = hex.split("").map(c=>c+c).join("");
    const n = parseInt(hex,16);
    return { r: (n>>16)&255, g: (n>>8)&255, b: n&255 };
  }
  _hexToRgba(hex, a){
    const c = this._hexToRgb(hex || "#ffffff");
    return `rgba(${c.r},${c.g},${c.b},${a})`;
  }

  _draw(){
    // reuse editor rendering (render uses editor.objects; temporarily swap)
    const ctx = this.ctx;
    const savedObjects = this.editor.objects;
    this.editor.objects = this.level;
    this.editor._render();

    // draw player on top
    ctx.save();
    // use safe zoom to avoid invalid transforms
    const safeZoom = Math.max(0.2, Number(this.editor.zoom) || 1);
    ctx.translate(this.editor.offset.x * safeZoom, this.editor.offset.y * safeZoom);
    ctx.scale(safeZoom, safeZoom);
    ctx.fillStyle = "#ffb100";
    ctx.fillRect(this.player.x, this.player.y, this.player.w, this.player.h);
    ctx.restore();

    // If dark mode is enabled on the editor, apply a darkness mask that only reveals a light area around the player.
    // This uses a destination-out radial gradient to punch a hole in a fullscreen black overlay at the player's screen position.
    try{
      if(this.editor.darkMode){
        const canvas = this.canvas;
        // compute player center in screen space and light radius
        const safeZ = Math.max(0.2, Number(this.editor.zoom) || 1);
        const playerCenterX = ( (this.player.x + this.player.w/2) + this.editor.offset.x ) * safeZ;
        const playerCenterY = ( (this.player.y + this.player.h/2) + this.editor.offset.y ) * safeZ;
        const lightRadiusWorld = 160; // world pixels radius of light
        const lightRadius = lightRadiusWorld * safeZ;

        // Use an offscreen canvas to create the darkness with a clean cutout.
        const off = document.createElement("canvas");
        off.width = canvas.width;
        off.height = canvas.height;
        const oc = off.getContext("2d");

        // 1) Fill full-screen darkness (fully opaque black)
        oc.save();
        oc.fillStyle = "rgba(0,0,0,1)";
        oc.fillRect(0,0,off.width,off.height);

        // 2) Carve out a soft hole for player using destination-out with a radial gradient
        oc.globalCompositeOperation = "destination-out";
        const carve = (cx, cy, radius) => {
          const cutGrad = oc.createRadialGradient(cx, cy, Math.max(4, radius * 0.2), cx, cy, Math.max(8, radius));
          cutGrad.addColorStop(0, "rgba(0,0,0,1)");
          cutGrad.addColorStop(0.7, "rgba(0,0,0,0.85)");
          cutGrad.addColorStop(1, "rgba(0,0,0,0)");
          oc.fillStyle = cutGrad;
          oc.beginPath();
          oc.arc(cx, cy, Math.max(6, radius), 0, Math.PI*2);
          oc.closePath();
          oc.fill();
        };
        carve(playerCenterX, playerCenterY, lightRadius);

        // 3) Carve out holes for any flashlights in the running level (they follow their object positions)
        if(this.level && Array.isArray(this.level)){
          for(const fo of this.level){
            if(fo.type === "flashlight"){
              // compute flashlight center in screen space and use slightly smaller radius
              const fx = ((fo.x + (fo.w/2)) + this.editor.offset.x) * safeZ;
              const fy = ((fo.y + (fo.h/2)) + this.editor.offset.y) * safeZ;
              const fr = (Math.max(64, fo.w * 2)) * safeZ * 0.9; // flashlight reveals a modest radius
              carve(fx, fy, fr);
            }
            // Dark crystal: reveal an area equal to player's light radius (match player's light)
            if(fo.type === "dark-crystal"){
              const fx = ((fo.x + (fo.w/2)) + this.editor.offset.x) * safeZ;
              const fy = ((fo.y + (fo.h/2)) + this.editor.offset.y) * safeZ;
              // player's light radius in world pixels (same as used for player)
              const lightRadiusWorld = 160;
              const fr = lightRadiusWorld * safeZ;
              carve(fx, fy, fr);
            }
            // Diamond Disc: decorative spinning disc emits a larger light than dark-crystal (uses meta.range or default 240)
            if(fo.type === "diamond-disc"){
              const fx = ((fo.x + (fo.w/2)) + this.editor.offset.x) * safeZ;
              const fy = ((fo.y + (fo.h/2)) + this.editor.offset.y) * safeZ;
              const meta = fo.meta || {};
              const rangeWorld = (typeof meta.range === "number") ? Math.max(8, meta.range) : 240;
              const fr = rangeWorld * safeZ;
              carve(fx, fy, fr);
            }
            // Star Light: carve a tinted-sized hole (uses meta.range or default 120)
            if(fo.type === "star-light"){
              const fx = ((fo.x + (fo.w/2)) + this.editor.offset.x) * safeZ;
              const fy = ((fo.y + (fo.h/2)) + this.editor.offset.y) * safeZ;
              const meta = fo.meta || {};
              const rangeWorld = (typeof meta.range === "number") ? Math.max(8, meta.range) : 120;
              const fr = rangeWorld * safeZ;
              carve(fx, fy, fr);
            }
          }
        }

        oc.restore();

        // 4) Draw the offscreen result onto main canvas (darkness with cutouts).
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(off, 0, 0);
        ctx.restore();
      }
    }catch(e){}

    // Always render Star Light tint overlays so Star Lights visually tint their radius even when darkMode is off.
    try{
      const safeZ = Math.max(0.2, Number(this.editor.zoom) || 1);
      if(this.level && Array.isArray(this.level)){
        for(const fo of this.level){
          // diamond-disc: no tinted light overlay anymore (visual only; darkness carve still applies)
          if(fo.type === "star-light"){
            const fx = ((fo.x + (fo.w/2)) + this.editor.offset.x) * safeZ;
            const fy = ((fo.y + (fo.h/2)) + this.editor.offset.y) * safeZ;
            const meta = fo.meta || {};
            const rangeWorld = (typeof meta.range === "number") ? Math.max(8, meta.range) : 120;
            const fr = rangeWorld * safeZ;
            const tint = (meta.tintColor) ? meta.tintColor : "#cfe9ff";
            const strength = (typeof meta.tintStrength === "number") ? Math.max(0, Math.min(1, meta.tintStrength)) : 0.6;
            // stronger tint stops so star lights are visibly tinted (not extremely faint)
            const tg = ctx.createRadialGradient(fx, fy, Math.max(4, fr*0.08), fx, fy, Math.max(8, fr));
            // center stronger: up to ~0.6 * strength, mid ~0.25 * strength, edge fades out
            tg.addColorStop(0, this._hexToRgba(tint, 0.60 * strength));
            tg.addColorStop(0.5, this._hexToRgba(tint, 0.25 * strength));
            tg.addColorStop(1, this._hexToRgba(tint, 0.00));
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = tg;
            ctx.beginPath(); ctx.arc(fx, fy, Math.max(8, fr), 0, Math.PI*2); ctx.closePath(); ctx.fill();
            ctx.restore();
          }
        }
      }
    }catch(e){}
    
    this.editor.objects = savedObjects;
  }
}
