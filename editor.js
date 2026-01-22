export class Editor{
  constructor(canvas, opts = {}){
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.mode = "editor"; // editor | play-preview
    this.objects = []; // placed items
    // simple undo/redo stacks storing shallow snapshots of objects array
    this._undoStack = [];
    this._redoStack = [];
    // record initial state
    this._saveState();
    this.tool = null;
    this.zoom = 1;
    this.offset = {x:0,y:0}; // world offset (pan)
    this.isPanning = false;
    this.lastPointer = null;
    this.pointerDownInfo = null; // NEW: track pointerdown for drag detection
    this.onZoomChange = opts.onZoomChange || function(){
      // onZoomChange function
    };
    this.onCursor = opts.onCursor || function(){
      // onCursor function
    };
    this.snap = true;
    this.gridSize = 32;
    this.selectedIds = []; // NEW: array of selected object ids for edit mode (supports multi-select)
    this.multiSelect = false; // NEW: controlled by UI; default OFF
    this.allowSelect = false; // NEW: controlled by UI to enable click-to-select

    // load texture assets
    this._assets = {};
    this._assets.bobbyImg = new Image();
    this._assets.bobbyImg.src = "IMG_7541.png";
    // BG Trigger icon/texture
    this._assets.bgTriggerImg = new Image();
    this._assets.bgTriggerImg.src = "IMG_2806.png";
    // Ship portal texture (taller 1x3 portal)
    this._assets.shipImg = new Image();
    this._assets.shipImg.src = "IMG_2808.png";
    // Cube portal texture (square cube portal)
    this._assets.cubeImg = new Image();
    this._assets.cubeImg.src = "IMG_2809.png";
    // Ball portal texture
    this._assets.ballImg = new Image();
    this._assets.ballImg.src = "IMG_2880.png";
    // Move Trigger icon (pink-hued texture)
    this._assets.moveTriggerImg = new Image();
    this._assets.moveTriggerImg.src = "IMG_2815.png";
    // UFO portal texture
    this._assets.ufoImg = new Image();
    this._assets.ufoImg.src = "IMG_3040.png";
    // Saw texture (rotating hazard)
    this._assets.sawImg = new Image();
    this._assets.sawImg.src = "IMG_3078.png";
    // Saw 2 texture (rotating hazard variant)
    this._assets.saw2Img = new Image();
    this._assets.saw2Img.src = "IMG_3128.png";
    // Saw 3 texture (rotating hazard variant using IMG_3139)
    this._assets.saw3Img = new Image();
    this._assets.saw3Img.src = "IMG_3139.png";
    // Wheel texture (rotating hazard, 2x2)
    this._assets.wheelImg = new Image();
    this._assets.wheelImg.src = "IMG_3119.png";
    // Wheel 2 texture (rotating hazard variant using IMG_3120)
    this._assets.wheel2Img = new Image();
    this._assets.wheel2Img.src = "IMG_3120.png";
    // Flashlight texture
    this._assets.flashlightImg = new Image();
    this._assets.flashlightImg.src = "IMG_3133.png";
    // Dark crystal texture (large light source) — uses provided green crystals image
    this._assets.darkCrystalImg = new Image();
    this._assets.darkCrystalImg.src = "IMG_3136.png";
    // Christmas tree texture (3x5)
    this._assets.christmasImg = new Image();
    // Use the transparent PNG asset so the tree renders correctly in-game and in the toolbar
    this._assets.christmasImg.src = "IMG_3143.png";
    // Star Light texture (small illuminated star icon)
    this._assets.starImg = new Image();
    this._assets.starImg.src = "IMG_3146.png";
    // Flower texture (decoration) using provided IMG_3494
    this._assets.flowerImg = new Image();
    this._assets.flowerImg.src = "IMG_3494.png";
    // Flower Field texture (wider decorative banner) using provided IMG_3495.webp
    this._assets.flowerFieldImg = new Image();
    this._assets.flowerFieldImg.src = "IMG_3495.webp";
    // Purple Flower texture (tall 1x3) using provided IMG_3496.png
    this._assets.purpleFlowerImg = new Image();
    this._assets.purpleFlowerImg.src = "IMG_3496.png";
    // Diamond Disc texture (large decorative spinning disc)
    this._assets.diamondDiscImg = new Image();
    this._assets.diamondDiscImg.src = "IMG_3518.png";
    // Wave portal texture
    this._assets.waveImg = new Image();
    this._assets.waveImg.src = "/IMG_3129.webp";
    // custom images cache (per-object)
    this._assets.customImages = {};

    // visual settings
    this.bgColor = "#ffffff";
    this.groundColor = "#e6e6e6";
    // Separate colors: grid line color (grid lines) and ground outline color (top edge of ground)
    this.gridLineColor = "#d0d0d0";
    this.groundOutlineColor = "#d0d0d0";
    this.groundTexture = "default"; // "default" or "bobby"
    this.bgTexture = "default"; // "default" or "bobby" - NEW background texture option

    // NEW: control whether grid is visible
    this.showGrid = true;
    // NEW: dark mode: when enabled, level is covered in darkness and only a light around the player reveals objects while playing
    this.darkMode = false;
    // NEW: whether grid should be disabled while playing (play-only)
    this.disableGridWhilePlaying = false;
    // NEW: option to hide the ground entirely
    this.noGround = false;
    // NEW: start gamemode on level start: "cube" | "ship" | "ball" | "ufo" | "wave"
    this.startGamemode = "cube";
    // NEW: platformer mode boolean (free horizontal movement when playing)
    this.platformerMode = false;

    // input bindings
    this._bindEvents();
    this._raf = null;
  }

  setTool(obj){
    this.tool = obj;
  }

  setMode(m){
    this.mode = m;
  }

  resize(){
    // scale canvas to container size while keeping internal resolution
    const wrap = this.canvas.parentElement;
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(800, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(450, Math.floor(rect.height * dpr));
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  start(){
    const loop = ()=>{
      this._render();
      this._raf = requestAnimationFrame(loop);
    };
    loop();
  }
  stop(){
    cancelAnimationFrame(this._raf);
  }

  changeZoom(factor, center){ // zoom toward canvas center or provided point
    const prev = this.zoom;
    const newZoom = Math.max(0.2, Math.min(4, this.zoom * factor));
    if(center){
      // convert screen center to world before/after to keep focus
      const screen = center;
      const worldBefore = this.screenToWorld(screen);
      this.zoom = newZoom;
      const worldAfter = this.screenToWorld(screen);
      this.offset.x += (worldAfter.x - worldBefore.x);
      this.offset.y += (worldAfter.y - worldBefore.y);
    } else {
      this.zoom = newZoom;
    }
    this.onZoomChange(this.zoom);
  }

  setZoom(z){
    this.zoom = z;
    this.onZoomChange(this.zoom);
  }

  screenToWorld(pt){
    const rect = this.canvas.getBoundingClientRect();
    const cx = (pt.x - rect.left);
    const cy = (pt.y - rect.top);
    return {
      x: (cx / this.zoom) - this.offset.x,
      y: (cy / this.zoom) - this.offset.y
    };
  }

  worldToScreen(w){
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ( (w.x + this.offset.x) * this.zoom ) + rect.left,
      y: ( (w.y + this.offset.y) * this.zoom ) + rect.top
    };
  }

  snapToGrid(pt){
    if(!this.snap) return pt;
    const g = Math.max(4, this.gridSize|0);
    // Use floor so the object snaps to the top-left of the grid cell containing the point,
    // preventing placement on intersections between tiles.
    return { x: Math.floor(pt.x / g) * g, y: Math.floor(pt.y / g) * g };
  }

  // NEW helper: quantize a coordinate to either full-grid or half-grid steps so half-grid moves persist
  _quantizeToGrid(val, g){
    const eps = 1e-6;
    const half = g / 2;
    const qFull = Math.round(val / g) * g;
    const qHalf = Math.round(val / half) * half;
    return (Math.abs(val - qFull) <= Math.abs(val - qHalf) + eps) ? qFull : qHalf;
  }

  addObject(type, x, y, opts = {}){
    // copy default meta from tool definition and merge any provided options.meta
    const baseMeta = JSON.parse(JSON.stringify(type && type.meta ? type.meta : {}));
    const mergedMeta = Object.assign({}, baseMeta, opts.meta || {});
    const o = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2),
      type: type.id || type,
      x, y,
      w: type.w || 32,
      h: type.h || 32,
      // For Bobby textures ensure we store an explicit full white string so the renderer
      // recognizes pure white and does not apply a hue. Other types use their provided color.
      color: (type && type.id === "bobby") ? "#ffffff" : (type && type.color) ? type.color : (opts.color || "#111"),
      meta: mergedMeta
    };
    this.objects.push(o);
    this._saveState();
    return o;
  }

  removeAtWorld(pt){
    // remove topmost object under point
    for(let i=this.objects.length-1;i>=0;i--){
      const o = this.objects[i];
      if(pt.x >= o.x && pt.x <= o.x + o.w && pt.y >= o.y && pt.y <= o.y + o.h){
        this.objects.splice(i,1);
        // if removed was selected, clear selection
        if(this.selectedIds.includes(o.id)) this.selectedIds = this.selectedIds.filter(id => id !== o.id);
        this._saveState();
        return o;
      }
    }
  }

  import(data){
    this.objects = data.objects || [];
    // load persistent level settings with fallbacks for older saves
    // For backwards compatibility we treat "absent" fields as a request to reset to safe defaults
    // instead of preserving whatever was in memory. Use explicit presence checks.
    this.zoom = (typeof data.zoom === "number") ? data.zoom : 1;
    this.offset = (data.offset && typeof data.offset.x === "number" && typeof data.offset.y === "number") ? data.offset : { x:0, y:0 };
    this.bgColor = (typeof data.bgColor === "string") ? data.bgColor : "#ffffff";
    this.groundColor = (typeof data.groundColor === "string") ? data.groundColor : "#e6e6e6";
    this.gridLineColor = (typeof data.gridLineColor === "string") ? data.gridLineColor : "#d0d0d0";
    this.groundOutlineColor = (typeof data.groundOutlineColor === "string") ? data.groundOutlineColor : "#d0d0d0";
    this.bgTexture = (typeof data.bgTexture === "string") ? data.bgTexture : "default";
    this.groundTexture = (typeof data.groundTexture === "string") ? data.groundTexture : "default";
    this.darkMode = (typeof data.darkMode === "boolean") ? data.darkMode : false;
    this.showGrid = (typeof data.showGrid === "boolean") ? data.showGrid : true;
    this.disableGridWhilePlaying = (typeof data.disableGridWhilePlaying === "boolean") ? data.disableGridWhilePlaying : false;
    this.noGround = (typeof data.noGround === "boolean") ? data.noGround : false;
    // start gamemode on level start: "cube" | "ship" | "ball" | "ufo" | "wave"
    this.startGamemode = (typeof data.startGamemode === "string") ? data.startGamemode : "cube";
    // platformer mode import (backwards-compatible)
    this.platformerMode = (typeof data.platformerMode === "boolean") ? data.platformerMode : false;
    this._undoStack = [];
    this._redoStack = [];
    this._saveState();
  }

  export(){
    return {
      // objects plus editor-level visual and behavior settings to persist with the level
      objects: this.objects,
      zoom: this.zoom,
      offset: this.offset,
      bgColor: this.bgColor,
      groundColor: this.groundColor,
      gridLineColor: this.gridLineColor,
      groundOutlineColor: this.groundOutlineColor,
      bgTexture: this.bgTexture,
      groundTexture: this.groundTexture,
      darkMode: !!this.darkMode,
      showGrid: !!this.showGrid,
      disableGridWhilePlaying: !!this.disableGridWhilePlaying,
      noGround: !!this.noGround,
      startGamemode: (typeof this.startGamemode === "string") ? this.startGamemode : "cube",
      platformerMode: !!this.platformerMode
    };
  }

  _bindEvents(){
    const canvas = this.canvas;

    canvas.addEventListener("pointerdown", (e)=>{
      canvas.setPointerCapture(e.pointerId);
      const p = {x:e.clientX, y:e.clientY};
      this.lastPointer = p;

      // record pointer down for drag-vs-click detection
      this.pointerDownInfo = {start: p, button: e.button, pointerId: e.pointerId, ctrl: e.ctrlKey};

      if(e.button === 1 || e.ctrlKey){ // middle click or ctrl — start pan immediately
        this.isPanning = true;
        return;
      }

      if(this.mode !== "editor") return;

      // NOTE: Do not place on pointerdown for left button — wait until pointerup and only if no drag.
      // Right-click removal will also be handled on pointerup.
    });

    canvas.addEventListener("pointermove", (e)=>{
      const p = {x:e.clientX, y:e.clientY};
      this.onCursor(this.screenToWorld(p));

      // handle drag-to-pan for left-button drag
      if(this.pointerDownInfo && this.pointerDownInfo.button === 0){
        const dxScreen = p.x - this.pointerDownInfo.start.x;
        const dyScreen = p.y - this.pointerDownInfo.start.y;
        const distSq = dxScreen*dxScreen + dyScreen*dyScreen;
        const dragThreshold = 6 * 6; // 6px threshold squared

        if(!this.isPanning && distSq > dragThreshold){
          // begin panning due to left-button drag
          this.isPanning = true;
        }
      }

      if(this.isPanning && this.lastPointer){
        const dx = (p.x - this.lastPointer.x) / this.zoom;
        const dy = (p.y - this.lastPointer.y) / this.zoom;
        this.offset.x += dx;
        this.offset.y += dy;
      }

      this.lastPointer = p;
    });

    canvas.addEventListener("pointerup", (e)=>{
      // on pointerup decide whether to place/remove or stop panning
      const p = {x:e.clientX, y:e.clientY};

      // helper: select a single topmost object under world point
      const selectTopmost = (world) => {
        for(let i=this.objects.length-1;i>=0;i--){
          const o = this.objects[i];
          if(world.x >= o.x && world.x <= o.x + o.w && world.y >= o.y && world.y <= o.y + o.h){
            return o;
          }
        }
        return null;
      };

      // If in UI edit-select mode and left click (no drag), select topmost object
      if(this.allowSelect && this.mode === "editor" && this.pointerDownInfo && this.pointerDownInfo.button === 0 && e.button === 0){
        const dx = p.x - this.pointerDownInfo.start.x;
        const dy = p.y - this.pointerDownInfo.start.y;
        const distSq = dx*dx + dy*dy;
        const dragThreshold = 6 * 6;
        if(distSq <= dragThreshold && !this.isPanning){
          const world = this.screenToWorld(p);
          const hit = selectTopmost(world);
          if(hit){
            // respect multiSelect flag: if multiSelect is true, toggle membership; otherwise select single
            if(this.multiSelect){
              const idx = this.selectedIds.indexOf(hit.id);
              if(idx === -1) this.selectedIds.push(hit.id);
              else this.selectedIds.splice(idx,1);
            } else {
              this.selectedIds = [hit.id];
            }
          } else {
            // click empty space clears selection
            this.selectedIds = [];
          }
        }
      }
      
      // If left-click placement and NOT in select mode, behave as before
      if(!this.allowSelect && this.mode === "editor" && this.pointerDownInfo && this.pointerDownInfo.button === 0 && e.button === 0){
        const dx = p.x - this.pointerDownInfo.start.x;
        const dy = p.y - this.pointerDownInfo.start.y;
        const distSq = dx*dx + dy*dy;
        const dragThreshold = 6 * 6;
        if(distSq <= dragThreshold && !this.isPanning){
          // treat as click: place object
          const world = this.snapToGrid(this.screenToWorld(p));
          if(this.tool){
            // Special-case placement for jump pad: align to bottom half of the grid cell
            let placeX = world.x;
            let placeY = world.y;
            if(this.tool.id === "jump"){
              const g = Math.max(4, this.gridSize|0);
              // ensure jump pad fits inside the grid cell (32 width), and sits on bottom half
              placeX = Math.floor(placeX / g) * g;
              placeY = Math.floor(placeY / g) * g + (g - (this.tool.h || 16));
            }
            // Half-height hazards should be placed like jump pads (bottom-half of the grid cell)
            if(this.tool.id === "half-hazard"){
              const g = Math.max(4, this.gridSize|0);
              placeX = Math.floor(placeX / g) * g;
              placeY = Math.floor(placeY / g) * g + (g - (this.tool.h || 16));
            }
            // Strong jump pad should be aligned like the regular jump pad (bottom half of grid cell)
            if(this.tool.id === "strong-jump"){
              const g = Math.max(4, this.gridSize|0);
              placeX = Math.floor(placeX / g) * g;
              placeY = Math.floor(placeY / g) * g + (g - (this.tool.h || 16));
            }
            // Weak jump pad should be aligned like the regular jump pad (bottom half of grid cell)
            if(this.tool.id === "weak-jump"){
              const g = Math.max(4, this.gridSize|0);
              placeX = Math.floor(placeX / g) * g;
              placeY = Math.floor(placeY / g) * g + (g - (this.tool.h || 16));
            }
            // Platform (half block) should be placed on the bottom half of the grid cell like half-hazard
            if(this.tool.id === "platform"){
              const g = Math.max(4, this.gridSize|0);
              placeX = Math.floor(placeX / g) * g;
              placeY = Math.floor(placeY / g) * g;
            }
            // Ship portal: center at cursor (respect snap setting)
            if(this.tool.id === "ship-portal"){
              // compute the world-space cursor center and snap that center to the grid (so the portal is centered at cursor then snapped)
              const worldCenter = this.screenToWorld(p);
              if(this.snap){
                // Snap the portal's center to the center of a grid cell to avoid placement on tile intersections.
                const g = Math.max(4, this.gridSize|0);
                const cellX = Math.floor(worldCenter.x / g);
                const cellY = Math.floor(worldCenter.y / g);
                const snappedCenter = { x: cellX * g + g/2, y: cellY * g + g/2 };
                placeX = snappedCenter.x - (this.tool.w / 2);
                placeY = snappedCenter.y - (this.tool.h / 2);
              } else {
                placeX = worldCenter.x - (this.tool.w / 2);
                placeY = worldCenter.y - (this.tool.h / 2);
              }
            }
            // Cube portal: center at cursor (respect snap setting) — same behavior as ship portal
            if(this.tool.id === "cube-portal"){
              const worldCenter = this.screenToWorld(p);
              if(this.snap){
                const g = Math.max(4, this.gridSize|0);
                const cellX = Math.floor(worldCenter.x / g);
                const cellY = Math.floor(worldCenter.y / g);
                const snappedCenter = { x: cellX * g + g/2, y: cellY * g + g/2 };
                placeX = snappedCenter.x - (this.tool.w / 2);
                placeY = snappedCenter.y - (this.tool.h / 2);
              } else {
                placeX = worldCenter.x - (this.tool.w / 2);
                placeY = worldCenter.y - (this.tool.h / 2);
              }
            }
            // Ball portal: center at cursor with same snapping behavior as ship/cube portals
            if(this.tool.id === "ball-portal"){
              const worldCenter = this.screenToWorld(p);
              if(this.snap){
                const g = Math.max(4, this.gridSize|0);
                const cellX = Math.floor(worldCenter.x / g);
                const cellY = Math.floor(worldCenter.y / g);
                const snappedCenter = { x: cellX * g + g/2, y: cellY * g + g/2 };
                placeX = snappedCenter.x - (this.tool.w / 2);
                placeY = snappedCenter.y - (this.tool.h / 2);
              } else {
                placeX = worldCenter.x - (this.tool.w / 2);
                placeY = worldCenter.y - (this.tool.h / 2);
              }
            }
            // UFO portal: same center-snapping behavior as other portals
            if(this.tool.id === "ufo-portal"){
              const worldCenter = this.screenToWorld(p);
              if(this.snap){
                const g = Math.max(4, this.gridSize|0);
                const cellX = Math.floor(worldCenter.x / g);
                const cellY = Math.floor(worldCenter.y / g);
                const snappedCenter = { x: cellX * g + g/2, y: cellY * g + g/2 };
                placeX = snappedCenter.x - (this.tool.w / 2);
                placeY = snappedCenter.y - (this.tool.h / 2);
              } else {
                placeX = worldCenter.x - (this.tool.w / 2);
                placeY = worldCenter.y - (this.tool.h / 2);
              }
            }
            // Wave portal: center at cursor with same snapping behavior as other portals
            if(this.tool.id === "wave-portal"){
              const worldCenter = this.screenToWorld(p);
              if(this.snap){
                const g = Math.max(4, this.gridSize|0);
                const cellX = Math.floor(worldCenter.x / g);
                const cellY = Math.floor(worldCenter.y / g);
                const snappedCenter = { x: cellX * g + g/2, y: cellY * g + g/2 };
                placeX = snappedCenter.x - (this.tool.w / 2);
                placeY = snappedCenter.y - (this.tool.h / 2);
              } else {
                placeX = worldCenter.x - (this.tool.w / 2);
                placeY = worldCenter.y - (this.tool.h / 2);
              }
            }
            // Christmas Tree: snap to bottom-middle of a grid cell so it stands with its base on the grid line
            if(this.tool.id === "christmas-tree"){
              const worldCenter = this.screenToWorld(p);
              const g = Math.max(4, this.gridSize|0);
              if(this.snap){
                const cellX = Math.floor(worldCenter.x / g);
                const cellY = Math.floor(worldCenter.y / g);
                // center horizontally on the grid cell center, align bottom to the cell bottom
                const snappedCenterX = cellX * g + g/2;
                const snappedBottomY = cellY * g + g;
                placeX = snappedCenterX - (this.tool.w / 2);
                placeY = snappedBottomY - (this.tool.h);
              } else {
                // when not snapping, center horizontally at cursor and put bottom at cursor Y
                placeX = worldCenter.x - (this.tool.w / 2);
                placeY = worldCenter.y - (this.tool.h);
              }
            }
            // Saw / Diamond Disc: center at cursor and snap the object's center to the grid (so snapping uses the middle)
            if(this.tool.id === "saw" || this.tool.id === "saw-2" || this.tool.id === "saw-3" || this.tool.id === "diamond-disc"){
              const worldCenter = this.screenToWorld(p);
              if(this.snap){
                const g = Math.max(4, this.gridSize|0);
                const cellX = Math.floor(worldCenter.x / g);
                const cellY = Math.floor(worldCenter.y / g);
                const snappedCenter = { x: cellX * g + g/2, y: cellY * g + g/2 };
                placeX = snappedCenter.x - (this.tool.w / 2);
                placeY = snappedCenter.y - (this.tool.h / 2);
              } else {
                placeX = worldCenter.x - (this.tool.w / 2);
                placeY = worldCenter.y - (this.tool.h / 2);
              }
            }
            this.addObject(this.tool, placeX, placeY);
          }
        }
      }

      // Right-click removal on pointerup (if not dragged)
      if(this.mode === "editor" && this.pointerDownInfo && this.pointerDownInfo.button === 2 && e.button === 2){
        const dx = p.x - this.pointerDownInfo.start.x;
        const dy = p.y - this.pointerDownInfo.start.y;
        const distSq = dx*dx + dy*dy;
        const dragThreshold = 6 * 6;
        if(distSq <= dragThreshold && !this.isPanning){
          const world = this.screenToWorld(p);
          this.removeAtWorld(world);
        }
      }

      if(e.button === 1 || e.ctrlKey) this.isPanning = false;
      // also stop left-button panning after pointerup
      if(this.pointerDownInfo && this.pointerDownInfo.button === 0) this.isPanning = false;

      this.pointerDownInfo = null;
      this.lastPointer = null;
      try{ canvas.releasePointerCapture(e.pointerId); }catch(_){}
    });

    // wheel to zoom with ctrl, otherwise pan horizontally
    canvas.addEventListener("wheel", (e)=>{
      e.preventDefault();
      if(e.ctrlKey){
        const rect = canvas.getBoundingClientRect();
        const center = { x: e.clientX, y: e.clientY };
        const factor = e.deltaY < 0 ? 1.1 : 1/1.1;
        this.changeZoom(factor, center);
      } else {
        // pan horizontally/vertically
        this.offset.x -= (e.deltaX) / (this.zoom * 20) * 10;
        this.offset.y -= (e.deltaY) / (this.zoom * 20) * 10;
      }
    }, {passive:false});

    // keyboard: space to place at center (for quick testing), Esc to clear selection
    window.addEventListener("keydown", (e)=>{
      if(e.key === " " && this.mode === "editor"){
        const rect = canvas.getBoundingClientRect();
        const center = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
        const world = this.snapToGrid(this.screenToWorld(center));
        if(this.tool) this.addObject(this.tool, world.x, world.y);
      } else if(e.key === "Delete"){
        // delete object at center for quick removal
        const rect = canvas.getBoundingClientRect();
        const center = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
        const world = this.screenToWorld(center);
        this.removeAtWorld(world);
      }
    });

    // prevent context menu on canvas (right-click used for remove)
    canvas.addEventListener("contextmenu", (e)=>e.preventDefault());
  }

  _render(){
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    // clear
    ctx.clearRect(0,0,w,h);

    // fill base background with configured bgColor so play-time BG fades affect the canvas
    ctx.save();
    ctx.fillStyle = this.bgColor || "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // draw background texture if selected
    // Bobby background now tiles in world-space (20x20 tiles) so it behaves like Bobby ground tiles.
    if(this.bgTexture === "bobby" && this._assets.bobbyImg && this._assets.bobbyImg.complete){
      // compute world-space visible bounds (matching later world transform calculations)
      const grid = Math.max(8, this.gridSize|0);
      const tileSize = grid * 20; // 20x20 tiles for background
      // derive visible world rect considering current transform (tight bounds)
      const viewLeft = (-this.offset.x);
      const viewTop  = (-this.offset.y);
      const viewRight = viewLeft + (w / this.zoom);
      const viewBottom = viewTop + (h / this.zoom);

      // draw tiles in world space (only visible tiles)
      ctx.save();
      ctx.translate(this.offset.x * this.zoom, this.offset.y * this.zoom);
      ctx.scale(this.zoom, this.zoom);
      const img = this._assets.bobbyImg;
      const startTileX = Math.floor(viewLeft / tileSize) * tileSize;
      const startTileY = Math.floor(viewTop / tileSize) * tileSize;
      const endX = Math.ceil(viewRight / tileSize) * tileSize;
      const endY = Math.ceil(viewBottom / tileSize) * tileSize;
      for(let tx = startTileX; tx <= endX; tx += tileSize){
        for(let ty = startTileY; ty <= endY; ty += tileSize){
          ctx.drawImage(img, tx, ty, tileSize, tileSize);
        }
      }
      ctx.restore();
    }

    // Striped background: draw diagonal stripes slightly darker than bgColor
    if(this.bgTexture === "striped"){
      // Draw larger horizontal stripes in world-space (tile the stripes like Bobby background)
      // so stripes are anchored to world coordinates and do not move with the camera.
      if(true){
        const stripeColor = this._darkenHex(this.bgColor || "#ffffff", 0.06);
        // compute tile height in world pixels (bigger than grid)
        const g = Math.max(8, this.gridSize|0);
        const stripeTile = Math.max(32, Math.floor(g * 2));
        // determine visible world bounds (matching later world transform calculations)
        const viewLeft = (-this.offset.x);
        const viewTop  = (-this.offset.y);
        const viewRight = viewLeft + (w / this.zoom);
        const viewBottom = viewTop + (h / this.zoom);

        ctx.save();
        // apply world transform so we can draw in world coordinates easily
        ctx.translate(this.offset.x * this.zoom, this.offset.y * this.zoom);
        ctx.scale(this.zoom, this.zoom);

        // fill base background in world-space
        ctx.fillStyle = this.bgColor || "#ffffff";
        ctx.fillRect(viewLeft, viewTop, viewRight - viewLeft, viewBottom - viewTop);

        // draw alternating horizontal stripe bands across world-space
        ctx.fillStyle = stripeColor;
        const startY = Math.floor(viewTop / stripeTile) * stripeTile;
        const endY = Math.ceil(viewBottom / stripeTile) * stripeTile;
        for(let sy = startY; sy <= endY; sy += stripeTile){
          // draw half-height stripe for each tile (top half darkened)
          ctx.fillRect(viewLeft, sy, viewRight - viewLeft, Math.ceil(stripeTile / 2));
        }
        ctx.restore();
      }
    }

    ctx.save();
    // world transform
    ctx.translate(this.offset.x * this.zoom, this.offset.y * this.zoom);
    ctx.scale(this.zoom, this.zoom);

    // draw grid
    const grid = Math.max(8, this.gridSize|0);
    const left = (-this.offset.x);
    const top = (-this.offset.y);
    const right = left + (w / this.zoom);
    const bottom = top + (h / this.zoom);
    // Only draw the grid when showGrid is true.
    // If disableGridWhilePlaying is enabled, hide the grid only during play-preview mode.
    if(this.showGrid && !(this.disableGridWhilePlaying && this.mode === "play-preview")){
      ctx.lineWidth = 1/this.zoom;
      ctx.strokeStyle = this.gridLineColor || "#eee";
      const startX = Math.floor(left / grid) * grid;
      const startY = Math.floor(top / grid) * grid;
      const endX = Math.ceil(right / grid) * grid;
      const endY = Math.ceil(bottom / grid) * grid;
      for(let x = startX; x <= endX; x += grid){
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
      }
      for(let y = startY; y <= endY; y += grid){
        ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
      }
    }

    // draw infinite ground (visual only) at fixed world Y (moved down by half a grid cell)
    const GROUND_Y = 560 + (grid / 2); // world Y coordinate of the ground surface (matches game)
    // If noGround option is set, do not draw the ground at all
    if(!this.noGround){
      // use configured colors
      ctx.fillStyle = this.groundColor || "#e6e6e6";
      if(this.groundTexture === "bobby" && this._assets.bobbyImg && this._assets.bobbyImg.complete){
        // draw repeating 5x5 tiles (tile size = grid * 5)
        const tileSize = Math.max(4, this.gridSize|0) * 5;
        const img = this._assets.bobbyImg;
        const startTileX = Math.floor(left / tileSize) * tileSize;
        const endTileX = Math.ceil(right / tileSize) * tileSize;
        // shift Bobby ground tiles down by 3 grid squares so they sit lower relative to the ground surface
        const startTileY = Math.floor(GROUND_Y / tileSize) * tileSize + (grid * 3);
        const endTileY = Math.ceil(bottom / tileSize) * tileSize;
        for(let tx = startTileX; tx <= endTileX; tx += tileSize){
          for(let ty = startTileY; ty <= endTileY; ty += tileSize){
            ctx.drawImage(img, tx, ty, tileSize, tileSize);
          }
        }
      } else {
        ctx.fillRect(left, GROUND_Y, right - left, bottom - GROUND_Y);
      }
      // ground top edge using configurable grid color — omit when 'no-outline' texture selected
      if(this.groundTexture !== "no-outline"){
        ctx.fillStyle = this.groundOutlineColor || "#d0d0d0";
        ctx.fillRect(left, GROUND_Y, right - left, 4);
      }
    } // end if !noGround

    // draw objects
    for(const o of this.objects){
      // apply per-object alpha if provided in meta (default 1.0)
      const savedAlpha = ctx.globalAlpha;
      const objAlpha = (o.meta && typeof o.meta.alpha === "number") ? Math.max(0, Math.min(1, o.meta.alpha)) : 1;
      ctx.globalAlpha = objAlpha;
      
      // apply rotation if present: set up transform around object center
      const rot = Number(o.rotation || 0);
      const cx = o.x + o.w/2, cy = o.y + o.h/2;
      if(rot !== 0){
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((rot * Math.PI)/180);
        ctx.translate(-cx, -cy);
      }
      // draw orb as a circle filling its cell
      if(o.type === "orb" || o.type === "strong-orb" || o.type === "weak-orb"){
        const radius = Math.min(o.w, o.h) / 2;
        // color selection: strong-orb warmer, weak-orb uses its teal color, regular orb default blue
        ctx.fillStyle = (o.type === "strong-orb") ? (o.color || "#ffb100") : ((o.type === "weak-orb") ? (o.color || "#22AA88") : (o.color || "#2ad"));
        ctx.beginPath();
        ctx.arc(o.x + o.w/2, o.y + o.h/2, radius, 0, Math.PI*2);
        ctx.fill();
        // simple outline
        ctx.strokeStyle = o.type === "strong-orb" ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0.15)";
        ctx.lineWidth = 1/this.zoom;
        ctx.stroke();
        // small glow for strong orb
        if(o.type === "strong-orb"){
          ctx.save();
          ctx.globalAlpha = 0.18;
          ctx.fillStyle = ctx.strokeStyle = (o.color || "#ffb100");
          ctx.beginPath();
          ctx.arc(o.x + o.w/2, o.y + o.h/2, radius * 1.6, 0, Math.PI*2);
          ctx.fill();
          ctx.restore();
        }
      } else if(o.type === "bobby"){
        // textured Bobby block using loaded image
        const img = this._assets.bobbyImg;
        if(img && img.complete){
          // draw image to fill object rect (stretched to fit)
          ctx.drawImage(img, o.x, o.y, o.w, o.h);
          // apply color tint if object has a color set and it's not pure white (#ffffff)
          // pure white should not alter the texture (no hue)
          if(o.color && String(o.color).toLowerCase() !== "#ffffff"){
            ctx.save();
            // use source-atop so the color only affects the drawn image pixels
            ctx.globalCompositeOperation = "source-atop";
            ctx.globalAlpha = 0.6; // blend strength of the tint
            ctx.fillStyle = o.color;
            ctx.fillRect(o.x, o.y, o.w, o.h);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = "source-over";
            ctx.restore();
          }
        } else {
          // fallback to solid color if image not ready
          ctx.fillStyle = o.color || "#ccc";
          ctx.fillRect(o.x, o.y, o.w, o.h);
        }
        // outline
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.lineWidth = 1/this.zoom;
        ctx.strokeRect(o.x, o.y, o.w, o.h);
      } else if(o.type === "bg-trigger"){
        // BG Trigger: transparent box with image texture and "BG" label
        const img = this._assets.bgTriggerImg;
        // background intentionally transparent (no fill)
        ctx.save();
        // draw image centered inside object bounds if available
        if(img && img.complete){
          ctx.drawImage(img, o.x, o.y, o.w, o.h);
        } else {
          // placeholder outline if image not ready
          ctx.strokeStyle = "rgba(0,0,0,0.12)";
          ctx.lineWidth = 1/this.zoom;
          ctx.strokeRect(o.x, o.y, o.w, o.h);
        }
        // draw "BG" text overlay
        // white fill with thin black outline for high contrast
        ctx.font = `${12/this.zoom}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(0.5, 1/this.zoom);
        ctx.strokeStyle = "black";
        ctx.strokeText("BG", o.x + o.w/2, o.y + o.h/2);
        ctx.fillStyle = "white";
        ctx.fillText("BG", o.x + o.w/2, o.y + o.h/2);
        ctx.restore();
      } else if(o.type === "g-trigger"){
        // G Trigger: transparent box with image texture and "G" label (no solid fill)
        const img = this._assets.bgTriggerImg;
        ctx.save();
        if(img && img.complete){
          ctx.drawImage(img, o.x, o.y, o.w, o.h);
        } else {
          ctx.strokeStyle = "rgba(0,0,0,0.12)";
          ctx.lineWidth = 1/this.zoom;
          ctx.strokeRect(o.x, o.y, o.w, o.h);
        }
        // draw "G" text overlay (white with thin black outline)
        ctx.font = `${12/this.zoom}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(0.5, 1/this.zoom);
        ctx.strokeStyle = "black";
        ctx.strokeText("G", o.x + o.w/2, o.y + o.h/2);
        ctx.fillStyle = "white";
        ctx.fillText("G", o.x + o.w/2, o.y + o.h/2);
        ctx.restore();
      } else if(o.type === "gr-trigger"){
        // GR Trigger: similar to G trigger but labeled "GR" — render as textured/transparent trigger box
        const imgGR = this._assets.bgTriggerImg;
        ctx.save();
        if(imgGR && imgGR.complete){
          ctx.drawImage(imgGR, o.x, o.y, o.w, o.h);
        } else {
          ctx.strokeStyle = "rgba(0,0,0,0.12)";
          ctx.lineWidth = 1/this.zoom;
          ctx.strokeRect(o.x, o.y, o.w, o.h);
        }
        ctx.font = `${12/this.zoom}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(0.5, 1/this.zoom);
        ctx.strokeStyle = "black";
        ctx.strokeText("GR", o.x + o.w/2, o.y + o.h/2);
        ctx.fillStyle = "white";
        ctx.fillText("GR", o.x + o.w/2, o.y + o.h/2);
        ctx.restore();
      } else if(o.type === "color-trigger"){
        // Color Trigger: transparent box with image texture and "C" label
        const img = this._assets.bgTriggerImg;
        ctx.save();
        if(img && img.complete){
          ctx.drawImage(img, o.x, o.y, o.w, o.h);
        } else {
          ctx.strokeStyle = "rgba(0,0,0,0.12)";
          ctx.lineWidth = 1/this.zoom;
          ctx.strokeRect(o.x, o.y, o.w, o.h);
        }
        ctx.font = `${12/this.zoom}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(0.5, 1/this.zoom);
        ctx.strokeStyle = "black";
        // Color trigger shows "C"
        ctx.strokeText("C", o.x + o.w/2, o.y + o.h/2);
        ctx.fillStyle = "white";
        ctx.fillText("C", o.x + o.w/2, o.y + o.h/2);
        ctx.restore();
      } else if(o.type === "move-trigger"){
        // Move Trigger: textured box (pink-tinted) using IMG_2815 with "Move" label
        const imgM = this._assets.moveTriggerImg;
        ctx.save();
        if(imgM && imgM.complete){
          ctx.drawImage(imgM, o.x, o.y, o.w, o.h);
          ctx.globalCompositeOperation = "source-atop";
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = "#ff66aa"; // pink tint
          const cxm = o.x + o.w/2, cym = o.y + o.h/2, rm = Math.min(o.w,o.h)*0.45;
          ctx.beginPath(); ctx.arc(cxm, cym, rm, 0, Math.PI*2); ctx.fill();
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
        } else {
          ctx.strokeStyle = "rgba(0,0,0,0.12)";
          ctx.lineWidth = 1/this.zoom;
          ctx.strokeRect(o.x, o.y, o.w, o.h);
        }
        ctx.font = `${12/this.zoom}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(0.5, 1/this.zoom);
        ctx.strokeStyle = "black";
        ctx.strokeText("Move", o.x+o.w/2, o.y+o.h/2);
        ctx.fillStyle = "white";
        ctx.fillText("Move", o.x+o.w/2, o.y+o.h/2);
        ctx.restore();
      } else if(o.type === "alpha-trigger"){
        // Alpha Trigger: textured tile with cyan tint and "Alpha" label
        const imgA = this._assets.moveTriggerImg;
        ctx.save();
        if(imgA && imgA.complete){
          ctx.drawImage(imgA, o.x, o.y, o.w, o.h);
          ctx.globalCompositeOperation = "source-atop";
          ctx.globalAlpha = 0.8;
          ctx.fillStyle = "#00cccc"; // cyan tint
          const cxa = o.x + o.w/2, cya = o.y + o.h/2, ra = Math.min(o.w,o.h)*0.45;
          ctx.beginPath(); ctx.arc(cxa, cya, ra, 0, Math.PI*2); ctx.fill();
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
        } else {
          ctx.strokeStyle = "rgba(0,0,0,0.12)";
          ctx.lineWidth = 1/this.zoom;
          ctx.strokeRect(o.x, o.y, o.w, o.h);
        }
        ctx.font = `${11/this.zoom}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(0.5, 1/this.zoom);
        ctx.strokeStyle = "black";
        ctx.strokeText("Alpha", o.x+o.w/2, o.y+o.h/2);
        ctx.fillStyle = "white";
        ctx.fillText("Alpha", o.x+o.w/2, o.y+o.h/2);
        ctx.restore();
      } else if(o.type === "ship-portal"){
        // Ship portal: draw dedicated portal texture (IMG_2808) covering the 1x3 area,
        // visually distinct from trigger boxes and without the trigger label.
        const img = this._assets.shipImg;
        ctx.save();
        if(img && img.complete){
          ctx.drawImage(img, o.x, o.y, o.w, o.h);
        } else {
          ctx.strokeStyle = "rgba(0,0,0,0.12)";
          ctx.lineWidth = 1/this.zoom;
          ctx.strokeRect(o.x, o.y, o.w, o.h);
        }
        // subtle outline so it reads well on varied backgrounds
        ctx.strokeStyle = "rgba(0,0,0,0.12)";
        ctx.lineWidth = 1/this.zoom;
        ctx.strokeRect(o.x, o.y, o.w, o.h);
        ctx.restore();
      } else if(o.type === "ufo-portal"){
        // UFO portal: use provided IMG_3040 texture and a light outline
        const imgU = this._assets.ufoImg;
        ctx.save();
        if(imgU && imgU.complete){
          ctx.drawImage(imgU, o.x, o.y, o.w, o.h);
        } else {
          ctx.strokeStyle = "rgba(0,0,0,0.12)";
          ctx.lineWidth = 1/this.zoom;
          ctx.strokeRect(o.x, o.y, o.w, o.h);
        }
        ctx.strokeStyle = "rgba(0,0,0,0.10)";
        ctx.lineWidth = 1/this.zoom;
        ctx.strokeRect(o.x, o.y, o.w, o.h);
        ctx.restore();
      } else if(o.type === "saw"){
        // Saw hazard: rotating textured saw (clockwise)
        const imgS = this._assets.sawImg;
        ctx.save();
        // compute rotation based on time for continuous clockwise spin (deg/sec)
        const now = performance.now();
        const degPerSec = 180; // spin speed (degrees per second) - adjust if desired
        const angle = ((now / 1000) * degPerSec) * Math.PI / 180;
        const cxs = o.x + o.w/2, cys = o.y + o.h/2;
        ctx.translate(cxs, cys);
        ctx.rotate(angle);
        ctx.translate(-cxs, -cys);
        if(imgS && imgS.complete){
          // draw image centered to object's rect
          ctx.drawImage(imgS, o.x, o.y, o.w, o.h);
        } else {
          ctx.fillStyle = o.color || "#ccc";
          ctx.fillRect(o.x, o.y, o.w, o.h);
        }
        // NOTE: removed rectangular stroke outline so the saw texture renders without an extra border
        ctx.restore();
      } else if(o.type === "saw-2"){
        // Saw 2 hazard: rotating textured saw variant using IMG_3128
        const imgS2 = this._assets.saw2Img;
        ctx.save();
        // compute rotation based on time for continuous clockwise spin (deg/sec)
        const now2 = performance.now();
        const degPerSec2 = 180;
        const angle2 = ((now2 / 1000) * degPerSec2) * Math.PI / 180;
        const cxs2 = o.x + o.w/2, cys2 = o.y + o.h/2;
        ctx.translate(cxs2, cys2);
        ctx.rotate(angle2);
        ctx.translate(-cxs2, -cys2);
        if(imgS2 && imgS2.complete){
          ctx.drawImage(imgS2, o.x, o.y, o.w, o.h);
        } else {
          ctx.fillStyle = o.color || "#ccc";
          ctx.fillRect(o.x, o.y, o.w, o.h);
        }
        ctx.restore();
      } else if(o.type === "saw-3"){
        // Saw 3 hazard: rotating textured saw variant using IMG_3139
        const imgS3 = this._assets.saw3Img;
        ctx.save();
        // compute rotation based on time for continuous clockwise spin (deg/sec)
        const now3 = performance.now();
        const degPerSec3 = 180;
        const angle3 = ((now3 / 1000) * degPerSec3) * Math.PI / 180;
        const cxs3 = o.x + o.w/2, cys3 = o.y + o.h/2;
        ctx.translate(cxs3, cys3);
        ctx.rotate(angle3);
        ctx.translate(-cxs3, -cys3);
        if(imgS3 && imgS3.complete){
          ctx.drawImage(imgS3, o.x, o.y, o.w, o.h);
        } else {
          ctx.fillStyle = o.color || "#ccc";
          ctx.fillRect(o.x, o.y, o.w, o.h);
        }
        ctx.restore();
      } else if(o.type === "wheel"){
        // Wheel hazard: rotating textured wheel (clockwise) — smaller 2x2 version using IMG_3119
        const imgW = this._assets.wheelImg;
        ctx.save();
        const nowW = performance.now();
        const degPerSecW = 180;
        const angleW = ((nowW / 1000) * degPerSecW) * Math.PI / 180;
        const cwx = o.x + o.w/2, cwy = o.y + o.h/2;
        ctx.translate(cwx, cwy);
        ctx.rotate(angleW);
        ctx.translate(-cwx, -cwy);
        if(imgW && imgW.complete){
          ctx.drawImage(imgW, o.x, o.y, o.w, o.h);
        } else {
          ctx.fillStyle = o.color || "#ccc";
          ctx.fillRect(o.x, o.y, o.w, o.h);
        }
        ctx.restore();
      } else if(o.type === "wheel-2"){
        // Wheel 2 hazard: rotating textured wheel variant using IMG_3120
        const imgW2 = this._assets.wheel2Img;
        ctx.save();
        const nowW2 = performance.now();
        const degPerSecW2 = 180;
        const angleW2 = ((nowW2 / 1000) * degPerSecW2) * Math.PI / 180;
        const cwx2 = o.x + o.w/2, cwy2 = o.y + o.h/2;
        ctx.translate(cwx2, cwy2);
        ctx.rotate(angleW2);
        ctx.translate(-cwx2, -cwy2);
        if(imgW2 && imgW2.complete){
          ctx.drawImage(imgW2, o.x, o.y, o.w, o.h);
        } else {
          ctx.fillStyle = o.color || "#ccc";
          ctx.fillRect(o.x, o.y, o.w, o.h);
        }
        ctx.restore();
      } else if(o.type === "flashlight"){
        // Flashlight: decorative non-colliding object using IMG_3133
        const imgF = this._assets.flashlightImg;
        ctx.save();
        if(imgF && imgF.complete){
          ctx.drawImage(imgF, o.x, o.y, o.w, o.h);
        } else {
          // fallback: icon-shaped placeholder
          ctx.fillStyle = "#ddd";
          ctx.fillRect(o.x, o.y, o.w, o.h);
        }
        // small outline to help readability
        ctx.strokeStyle = "rgba(0,0,0,0.12)";
        ctx.lineWidth = 1/this.zoom;
        ctx.strokeRect(o.x, o.y, o.w, o.h);
        ctx.restore();
      } else if(o.type === "christmas-tree"){
        // Christmas Tree: decorative object using preloaded christmasImg asset
        const imgT = this._assets.christmasImg;
        ctx.save();
        if(imgT && imgT.complete){
          ctx.drawImage(imgT, o.x, o.y, o.w, o.h);
        } else {
          // fallback box while image loads
          ctx.fillStyle = o.color || "#0a8a3a";
          ctx.fillRect(o.x, o.y, o.w, o.h);
        }
        ctx.strokeStyle = "rgba(0,0,0,0.12)";
        ctx.lineWidth = 1/this.zoom;
        ctx.strokeRect(o.x, o.y, o.w, o.h);
        ctx.restore();
      } else if(o.type === "star-light"){
        // Star Light: decorative object using preloaded star image; emits a tinted light while playing
        const imgS = this._assets.starImg;
        ctx.save();
        if(imgS && imgS.complete){
          ctx.drawImage(imgS, o.x, o.y, o.w, o.h);
        } else {
          ctx.fillStyle = o.color || "#e6f4ff";
          ctx.fillRect(o.x, o.y, o.w, o.h);
        }
        ctx.strokeStyle = "rgba(0,0,0,0.12)";
        ctx.lineWidth = 1/this.zoom;
        ctx.strokeRect(o.x, o.y, o.w, o.h);
        ctx.restore();
      } else if(o.type === "dark-crystal"){
        // Dark Crystal: decorative non-colliding object using IMG_3136 (visual crystal)
        const imgD = this._assets.darkCrystalImg;
        ctx.save();
        if(imgD && imgD.complete){
          ctx.drawImage(imgD, o.x, o.y, o.w, o.h);
        } else {
          ctx.fillStyle = "#0a8a3a";
          ctx.fillRect(o.x, o.y, o.w, o.h);
        }
        ctx.strokeStyle = "rgba(0,0,0,0.12)";
        ctx.lineWidth = 1/this.zoom;
        ctx.strokeRect(o.x, o.y, o.w, o.h);
        ctx.restore();
      } else if(o.type === "half-decoration"){
        // Half Decoration: draw like a regular decoration (solid color + subtle stroke), no special texture
        ctx.save();
        ctx.fillStyle = o.color || "#ffdede";
        ctx.fillRect(o.x, o.y, o.w, o.h);
        // subtle stroke for readability
        ctx.strokeStyle = "rgba(0,0,0,0.10)";
        ctx.lineWidth = 1/this.zoom;
        ctx.strokeRect(o.x, o.y, o.w, o.h);
        ctx.restore();
      } else if(o.type === "flower"){
        // Flower: decorative object using provided IMG_3494 texture (non-colliding)
        const imgF = this._assets.flowerImg;
        ctx.save();
        if(imgF && imgF.complete){
          ctx.drawImage(imgF, o.x, o.y, o.w, o.h);
        } else {
          ctx.fillStyle = o.color || "#ffdede";
          ctx.fillRect(o.x, o.y, o.w, o.h);
        }
        ctx.strokeStyle = "rgba(0,0,0,0.12)";
        ctx.lineWidth = 1/this.zoom;
        ctx.strokeRect(o.x, o.y, o.w, o.h);
        ctx.restore();
      } else if(o.type === "flower-field"){
        // Flower Field: decorative 2x1 object using provided IMG_3495.webp (non-colliding)
        const imgFF = this._assets.flowerFieldImg;
        ctx.save();
        if(imgFF && imgFF.complete){
          ctx.drawImage(imgFF, o.x, o.y, o.w, o.h);
        } else {
          ctx.fillStyle = o.color || "#ffdede";
          ctx.fillRect(o.x, o.y, o.w, o.h);
        }
        ctx.strokeStyle = "rgba(0,0,0,0.12)";
        ctx.lineWidth = 1/this.zoom;
        ctx.strokeRect(o.x, o.y, o.w, o.h);
        ctx.restore();
      } else if(o.type === "purple-flower"){
        // Purple Flower: decorative tall object using provided IMG_3496.png (non-colliding)
        const imgPF = this._assets.purpleFlowerImg;
        ctx.save();
        if(imgPF && imgPF.complete){
          ctx.drawImage(imgPF, o.x, o.y, o.w, o.h);
        } else {
          ctx.fillStyle = o.color || "#e8d6ff";
          ctx.fillRect(o.x, o.y, o.w, o.h);
        }
        ctx.strokeStyle = "rgba(0,0,0,0.12)";
        ctx.lineWidth = 1/this.zoom;
        ctx.strokeRect(o.x, o.y, o.w, o.h);
        ctx.restore();
      } else if(o.type === "diamond-disc"){
        // Diamond Disc: decorative spinning disc (non-lethal) using IMG_3518.png, larger than dark crystal
        const imgD = this._assets.diamondDiscImg;
        ctx.save();
        // rotating visual like saws but decorative (non-lethal)
        const now = performance.now();
        const degPerSec = 160; // spin speed
        const angle = ((now / 1000) * degPerSec) * Math.PI / 180;
        const cxd = o.x + o.w/2, cyd = o.y + o.h/2;
        ctx.translate(cxd, cyd);
        ctx.rotate(angle);
        ctx.translate(-cxd, -cyd);
        if(imgD && imgD.complete){
          ctx.drawImage(imgD, o.x, o.y, o.w, o.h);
        } else {
          // fallback decorative diamond box
          ctx.fillStyle = o.color || "#fff8e6";
          ctx.fillRect(o.x, o.y, o.w, o.h);
        }
        ctx.restore();
      } else if(o.type === "cube-portal"){
        // Cube portal: draw cube portal texture (IMG_2809) - square portal that returns to cube mode
        const img = this._assets.cubeImg;
        ctx.save();
        if(img && img.complete){
          ctx.drawImage(img, o.x, o.y, o.w, o.h);
        } else {
          ctx.strokeStyle = "rgba(0,0,0,0.12)";
          ctx.lineWidth = 1/this.zoom;
          ctx.strokeRect(o.x, o.y, o.w, o.h);
        }
        ctx.strokeStyle = "rgba(0,0,0,0.12)";
        ctx.lineWidth = 1/this.zoom;
        ctx.strokeRect(o.x, o.y, o.w, o.h);
        ctx.restore();
      } else if(o.type === "ball-portal"){
        // Ball portal: draw dedicated ball portal texture (IMG_2880)
        const img = this._assets.ballImg;
        ctx.save();
        if(img && img.complete){ ctx.drawImage(img, o.x, o.y, o.w, o.h); }
        else { ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.lineWidth = 1/this.zoom; ctx.strokeRect(o.x,o.y,o.w,o.h); }
        ctx.restore();
      } else if(o.type === "wave-portal"){
        // Wave portal: draw dedicated wave portal texture (IMG_3129.webp)
        const img = this._assets.waveImg;
        ctx.save();
        if(img && img.complete){
          ctx.drawImage(img, o.x, o.y, o.w, o.h);
        } else {
          // fallback outlined box while texture loads
          ctx.strokeStyle = "rgba(0,0,0,0.12)";
          ctx.lineWidth = 1/this.zoom;
          ctx.strokeRect(o.x, o.y, o.w, o.h);
        }
        ctx.restore();
      } else if(o.type === "rotate-trigger"){
        // Rotate Trigger: textured box (blue-tinted) using IMG_2815 with "Rotate" label
        const img = this._assets.moveTriggerImg;
        ctx.save();
        if(img && img.complete){
          ctx.drawImage(img, o.x, o.y, o.w, o.h);
          ctx.globalCompositeOperation = "source-atop";
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = "#3399ff"; // blue tint
          const cxr = o.x + o.w/2, cyr = o.y + o.h/2, rr = Math.min(o.w,o.h)*0.45;
          ctx.beginPath(); ctx.arc(cxr, cyr, rr, 0, Math.PI*2); ctx.fill();
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
        } else {
          ctx.strokeStyle = "rgba(0,0,0,0.12)";
          ctx.lineWidth = 1/this.zoom;
          ctx.strokeRect(o.x, o.y, o.w, o.h);
        }
        ctx.font = `${12/this.zoom}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(0.5, 1/this.zoom);
        ctx.strokeStyle = "black";
        ctx.strokeText("Rotate", o.x+o.w/2, o.y+o.h/2);
        ctx.fillStyle = "white";
        ctx.fillText("Rotate", o.x+o.w/2, o.y+o.h/2);
        ctx.restore();
      } else if(o.type === "spawn-trigger"){
        // Spawn Trigger: green-tinted variant using same base texture as move/rotate triggers
        const imgS = this._assets.moveTriggerImg;
        ctx.save();
        if(imgS && imgS.complete){
          ctx.drawImage(imgS, o.x, o.y, o.w, o.h);
          ctx.globalCompositeOperation = "source-atop";
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = "#2ecc71"; // green tint
          const cxs = o.x + o.w/2, cys = o.y + o.h/2, rs = Math.min(o.w,o.h)*0.45;
          ctx.beginPath(); ctx.arc(cxs, cys, rs, 0, Math.PI*2); ctx.fill();
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
        } else {
          ctx.strokeStyle = "rgba(0,0,0,0.12)";
          ctx.lineWidth = 1/this.zoom;
          ctx.strokeRect(o.x, o.y, o.w, o.h);
        }
        ctx.font = `${12/this.zoom}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(0.5, 1/this.zoom);
        ctx.strokeStyle = "black";
        ctx.strokeText("Spawn", o.x+o.w/2, o.y+o.h/2);
        ctx.fillStyle = "white";
        ctx.fillText("Spawn", o.x+o.w/2, o.y+o.h/2);
        ctx.restore();
      } else if(o.type === "edit-group-trigger"){
        // Edit-Group Trigger: textured box (violet-tinted) using IMG_2815 with "Group" label (matches other trigger visuals)
        const imgG = this._assets.moveTriggerImg;
        ctx.save();
        if(imgG && imgG.complete){
          ctx.drawImage(imgG, o.x, o.y, o.w, o.h);
          ctx.globalCompositeOperation = "source-atop";
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = "#b066ff"; // violet tint
          const cxg = o.x + o.w/2, cyg = o.y + o.h/2, rg = Math.min(o.w,o.h)*0.45;
          ctx.beginPath(); ctx.arc(cxg, cyg, rg, 0, Math.PI*2); ctx.fill();
          ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
        } else {
          ctx.strokeStyle = "rgba(0,0,0,0.12)";
          ctx.lineWidth = 1/this.zoom;
          ctx.strokeRect(o.x, o.y, o.w, o.h);
        }
        ctx.font = `${12/this.zoom}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = Math.max(0.5, 1/this.zoom);
        ctx.strokeStyle = "black";
        ctx.strokeText("Group", o.x+o.w/2, o.y+o.h/2);
        ctx.fillStyle = "white";
        ctx.fillText("Group", o.x+o.w/2, o.y+o.h/2);
        ctx.restore();
      } else {
        ctx.fillStyle = o.color || "#111";
        ctx.fillRect(o.x, o.y, o.w, o.h);
        // simple outline
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.lineWidth = 1/this.zoom;
        ctx.strokeRect(o.x, o.y, o.w, o.h);
      }
      // draw an arrow overlay on top of nudge blocks to indicate direction & strength
      if(o.type === "nudge"){
        // compact white triangular indicator centered on the block, pointing in its direction
        try{
          const dir = (o.meta && o.meta.direction) ? String(o.meta.direction) : "right";
          const size = Math.min(12, Math.max(6, Math.floor(Math.min(o.w,o.h) * 0.45)));
          const cx = o.x + o.w/2, cy = o.y + o.h/2;
          ctx.save();
          ctx.fillStyle = "white";
          ctx.strokeStyle = "rgba(0,0,0,0.6)";
          ctx.lineWidth = Math.max(1, 1/this.zoom);
          ctx.beginPath();
          if(dir === "left"){ ctx.moveTo(cx - size, cy); ctx.lineTo(cx + size/2, cy - size); ctx.lineTo(cx + size/2, cy + size); }
          else if(dir === "right"){ ctx.moveTo(cx + size, cy); ctx.lineTo(cx - size/2, cy - size); ctx.lineTo(cx - size/2, cy + size); }
          else if(dir === "up"){ ctx.moveTo(cx, cy - size); ctx.lineTo(cx - size, cy + size/2); ctx.lineTo(cx + size, cy + size/2); }
          else { ctx.moveTo(cx, cy + size); ctx.lineTo(cx - size, cy - size/2); ctx.lineTo(cx + size, cy - size/2); }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }catch(e){}
      }
      if(rot !== 0){
        ctx.restore();
      }
      // highlight selected objects with green glow
      // only show selection highlights while in editor mode (hide during play-preview)
      if(this.mode === "editor" && this.selectedIds && this.selectedIds.includes(o.id)){
        ctx.save();
        // ensure selection outline is fully opaque even if the object had reduced alpha
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2/this.zoom;
        ctx.strokeStyle = "rgba(20,160,60,0.9)";
        if(o.type === "orb"){
          ctx.beginPath();
          ctx.arc(o.x + o.w/2, o.y + o.h/2, Math.min(o.w,o.h)/2 + 2/this.zoom, 0, Math.PI*2);
          ctx.stroke();
        } else {
          ctx.strokeRect(o.x-1, o.y-1, o.w+2, o.h+2);
        }
        ctx.restore();
      }
      // restore alpha to previous value so subsequent UI overlays are unaffected
      ctx.globalAlpha = savedAlpha;
    }

    // draw tool preview at pointer if present
    if(this.lastPointer && this.mode === "editor"){
      const world = this.screenToWorld(this.lastPointer);
      const snapped = this.snapToGrid(world);
      if(this.tool){
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = this.tool.color || "#000";
        // draw preview using the snapped top-left so preview matches placement
        const px = snapped.x;
        const py = snapped.y;
        ctx.fillRect(px, py, this.tool.w, this.tool.h);
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();
  }

  /* NEW: utility methods for external UI control */
  moveSelected(dx,dy){
    if(!this.selectedIds || this.selectedIds.length === 0) return;
    // apply move to all selected objects, then record the new state so undo reverts one move at a time
    // move all selected objects
    for(const id of this.selectedIds){
      const o = this.objects.find(x=>x.id === id);
      if(!o) continue;
      o.x += dx;
      o.y += dy;
      // if snap is enabled, snap to grid after move — now allow half-grid quantization so half moves persist
      if(this.snap){
        const g = Math.max(4, this.gridSize|0);
        o.x = this._quantizeToGrid(o.x, g);
        o.y = this._quantizeToGrid(o.y, g);
      }
    }
    // save snapshot after performing the move so each click is a distinct undoable action
    this._saveState();
  }

  deleteSelected(){
    if(!this.selectedIds || this.selectedIds.length === 0) return;
    for(let i=this.objects.length-1;i>=0;i--){
      if(this.selectedIds.includes(this.objects[i].id)){
        this.objects.splice(i,1);
      }
    }
    this.selectedIds = [];
    this._saveState();
  }

  deselect(){
    this.selectedIds = [];
  }

  /* NEW: simple undo/redo support */
  _snapshotObjects(){
    // deep clone minimal necessary data
    return this.objects.map(o => ({ id: o.id, type: o.type, x: o.x, y: o.y, w: o.w, h: o.h, color: o.color, rotation: Number(o.rotation || 0), meta: JSON.parse(JSON.stringify(o.meta || {})) }));
  }

  _saveState(){
    try{
      this._undoStack.push(this._snapshotObjects());
      if(this._undoStack.length > 100) this._undoStack.shift();
      // clear redo on new action
      this._redoStack = [];
    }catch(e){}
  }

  undo(){
    if(this._undoStack.length <= 1) return; // keep at least initial state
    // move current state to redo
    const current = this._undoStack.pop();
    this._redoStack.push(current);
    const prev = this._undoStack[this._undoStack.length - 1];
    if(prev){
      this.objects = JSON.parse(JSON.stringify(prev));
      this.selectedIds = [];
      this._render();
    }
  }

  redo(){
    if(this._redoStack.length === 0) return;
    const next = this._redoStack.pop();
    if(next){
      this._undoStack.push(next);
      this.objects = JSON.parse(JSON.stringify(next));
      this.selectedIds = [];
      this._render();
    }
  }

  _hexToRgb(hex){
    hex = (hex || "#ffffff").replace("#","");
    if(hex.length === 3) hex = hex.split("").map(c=>c+c).join("");
    const n = parseInt(hex,16);
    return { r: (n>>16)&255, g: (n>>8)&255, b: n&255 };
  }

  // return hex darkened by fraction (0..1)
  _darkenHex(hex, frac){
    const c = this._hexToRgb(hex);
    const r = Math.max(0, Math.round(c.r * (1 - frac)));
    const g = Math.max(0, Math.round(c.g * (1 - frac)));
    const b = Math.max(0, Math.round(c.b * (1 - frac)));
    return "#" + ((1<<24) + (r<<16) + (g<<8) + b).toString(16).slice(1);
  }
}
