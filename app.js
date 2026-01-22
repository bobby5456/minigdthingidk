import { Editor } from "./editor.js";
import { Player } from "./game.js";

const canvas = document.getElementById("world");
canvas.width = 1280;
canvas.height = 720;

const modeToggle = document.getElementById("mode-toggle");
const settingsBtn = document.getElementById("settings-btn");
const playBtn = document.getElementById("play-btn");
const saveBtn = document.getElementById("save-btn");
const loadBtn = document.getElementById("load-btn");
const fileInput = document.getElementById("file-input");
const modeLabel = document.getElementById("mode-label");
const zoomLabel = document.getElementById("zoom-label");
const cursorPos = document.getElementById("cursor-pos");
const toolbar = document.getElementById("object-toolbar");
const zoomInBtn = document.getElementById("zoom-in");
const zoomOutBtn = document.getElementById("zoom-out");
const snapToggle = document.getElementById("snap-toggle");
const gridSizeInput = document.getElementById("grid-size");
const undoBtn = document.getElementById("undo-btn");
const redoBtn = document.getElementById("redo-btn");
const pauseBtn = document.getElementById("pause-btn");
// NEW: top-left header delete button
const headerDeleteBtn = document.getElementById("header-delete-btn");

// new UI elements for tabs and object container
const tabObjects = document.getElementById("tab-objects");
const tabTools = document.getElementById("tab-tools");
const objectsPanel = document.getElementById("objects-panel");
const toolbarPanels = document.getElementById("toolbar-panels");

// Fullscreen button reference
const fullscreenBtn = document.getElementById("fullscreen-btn");

// Create Clear Level button in Tools panel area (will be inserted into the Tools panel)
const toolsPanel = document.getElementById("tools-panel");
const clearLevelBtn = document.createElement("button");
clearLevelBtn.id = "clear-level-btn";
clearLevelBtn.className = "btn small";
clearLevelBtn.textContent = "Clear Level";
clearLevelBtn.style.marginLeft = "8px";
clearLevelBtn.title = "Clear entire level (requires confirmation)";
toolsPanel.appendChild(clearLevelBtn);

// Add: Clear Clipboard button in Tools panel
const clearClipboardBtn = document.createElement("button");
clearClipboardBtn.id = "clear-clipboard-btn";
clearClipboardBtn.className = "btn small";
clearClipboardBtn.textContent = "Clear Clipboard";
clearClipboardBtn.style.marginLeft = "8px";
clearClipboardBtn.title = "Clear the copy/paste clipboard";
toolsPanel.appendChild(clearClipboardBtn);

// AI Level Generate button (calls AI to produce a JSON level and imports it)
const aiGenBtn = document.createElement("button");
aiGenBtn.id = "ai-gen-btn";
aiGenBtn.className = "btn small";
aiGenBtn.textContent = "AI Level Generate";
aiGenBtn.style.marginLeft = "8px";
aiGenBtn.title = "Generate a level using AI and import it";
toolsPanel.appendChild(aiGenBtn);

// Clear Level confirmation modal HTML (appended to body)
// Clear Clipboard button behavior: empty clipboard and update UI
clearClipboardBtn.addEventListener("click", ()=>{
  _clipboard = [];
  requestAnimationFrame(updateEditButtonVisibility);
});

 // Clear Level confirmation modal HTML (appended to body)
const clearModalHtml = `
  <div id="clear-level-backdrop" class="edit-object-backdrop" style="display:none"></div>
  <div id="clear-level-modal" class="edit-object-modal" style="display:none; width:420px; max-width:94%; padding:14px;">
    <h4 style="margin-top:0">Confirm Clear Level</h4>
    <div style="margin-bottom:8px;color:#666">Type the code below into the textbox to confirm clearing the entire level. This action cannot be undone.</div>
    <div style="display:flex;align-items:center;gap:8px;margin:8px 0">
      <div id="clear-code-display" style="font-weight:700;padding:8px 12px;border-radius:6px;background:#f4f4f4;border:1px solid #e6e6e6;letter-spacing:4px"></div>
      <input id="clear-code-input" type="text" placeholder="Enter code" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:6px" />
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
      <button id="clear-cancel" class="btn small">No</button>
      <button id="clear-yes" class="btn small" style="background:#b22">Yes</button>
    </div>
  </div>
`;
document.body.insertAdjacentHTML("beforeend", clearModalHtml);
const clearBackdrop = document.getElementById("clear-level-backdrop");
const clearModal = document.getElementById("clear-level-modal");
const clearCodeDisplay = document.getElementById("clear-code-display");
const clearCodeInput = document.getElementById("clear-code-input");
const clearCancel = document.getElementById("clear-cancel");
const clearYes = document.getElementById("clear-yes");

// AI Level generation modal (loading + result)
const aiModalHtml = `
  <div id="ai-gen-backdrop" class="edit-object-backdrop" style="display:none"></div>
  <div id="ai-gen-modal" class="edit-object-modal" style="display:none; width:520px; max-width:94%; padding:14px;">
    <h4 style="margin-top:0">AI Level Generate</h4>
    <div style="margin-bottom:8px;color:#666">Request the AI to generate a level JSON that matches this game's mechanics: solid blocks, hazards (deadly on side collision), and jump orbs; horizontal hazard gaps max 3, vertical solid stacks max 2.</div>
    <div style="display:flex;gap:8px;align-items:center;margin:8px 0">
      <label style="flex:1">Brief theme / seed <input id="ai-gen-prompt" type="text" placeholder="e.g. " + "spooky forest" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px" /></label>
    </div>
    <div id="ai-gen-status" style="margin:6px 0;color:#333;font-size:13px"></div>
    <div class="edit-object-actions">
      <button id="ai-gen-cancel" class="btn small">Close</button>
      <button id="ai-gen-run" class="btn small" style="background:#198754">Generate & Import</button>
    </div>
  </div>
`;
document.body.insertAdjacentHTML("beforeend", aiModalHtml);
const aiBackdrop = document.getElementById("ai-gen-backdrop");
const aiModal = document.getElementById("ai-gen-modal");
const aiPromptInput = document.getElementById("ai-gen-prompt");
const aiStatus = document.getElementById("ai-gen-status");
const aiCancel = document.getElementById("ai-gen-cancel");
const aiRun = document.getElementById("ai-gen-run");

// helper to generate random 4-letter uppercase string
function _rand4(){
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let s = "";
  for(let i=0;i<4;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

let _currentClearCode = "";

clearLevelBtn.addEventListener("click", ()=>{
  _currentClearCode = _rand4();
  clearCodeDisplay.textContent = _currentClearCode;
  clearCodeInput.value = "";
  clearBackdrop.style.display = "";
  clearModal.style.display = "";
  clearCodeInput.focus();
});

// AI modal open handler
aiGenBtn.addEventListener("click", ()=>{
  aiPromptInput.value = "";
  aiStatus.textContent = "";
  aiBackdrop.style.display = "";
  aiModal.style.display = "";
  aiPromptInput.focus();
});
aiCancel.addEventListener("click", ()=>{
  aiBackdrop.style.display = "none";
  aiModal.style.display = "none";
});
aiBackdrop.addEventListener("click", ()=>{
  aiBackdrop.style.display = "none";
  aiModal.style.display = "none";
});

// Handler to call AI and import generated JSON level
aiRun.addEventListener("click", async ()=>{
  // guard UI
  aiRun.disabled = true;
  aiRun.textContent = "Generating…";
  aiStatus.textContent = "Requesting AI level (this may take ~10s)…";
  try{
    // Compose a clear system + user prompt that instructs the AI to return only valid JSON (the level object).
    // The AI must acknowledge game mechanics and then return a JSON object with a top-level `objects` array and optional level settings.
    const userPrompt = `You are an assistant that outputs a single JSON object describing a level for "Mini Geometry Dash" editor. First, include a short (1-2 sentence) acknowledgement of the game's mechanics and constraints as comments (in plain text) EXPLAINING: solids (blocks) are solid and side collisions with blocks are deadly, hazards kill on contact, the normal jump orb is the only jump pickup, the max horizontal hazard gap the player can jump over is 3 tiles, and the max vertical stacked solids the player can jump onto/over is 2. Then output ONLY valid JSON (no extra text) with this schema: { "objects": [ { "type": "<type id>", "x": <number>, "y": <number>, "w": <number>, "h": <number>, "meta": { ... } }, ... ], "bgColor": "#rrggbb", "groundColor":"#rrggbb" } . Use object type ids that this editor recognizes (e.g. block, hazard, orb, platform, jump, start, saw, wheel, move-trigger, rotate-trigger, spawn-trigger, etc.). Place a single 'start' object near x=64. Ensure any horizontal gaps of sequential hazards that the player must jump have width at most 3 grid units (gridSize default 32 => max 3 * 32 px), and any vertical stacked solids (blocks/platforms) reachable/jumpable do not exceed 2 tiles vertically. Theme hint: "${(aiPromptInput.value||'').trim() || 'default'}". Return JSON only.`;
    // call the websim chat completion
    const completion = await websim.chat.completions.create({
      messages: [
        { role: "system", content: "You are a level designer assistant for a 2D platformer with strict output requirements." },
        { role: "user", content: userPrompt }
      ],
    });
    const content = completion.content || completion;
    // Attempt to locate the first JSON object in the returned text
    const text = (typeof content === "string") ? content : (content[0] && content[0].content) || JSON.stringify(content);
    // Find JSON substring: look for first '{' and last '}' and parse
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if(firstBrace === -1 || lastBrace === -1){
      throw new Error("AI response did not contain JSON.");
    }
    const jsonText = text.slice(firstBrace, lastBrace + 1);
    let levelObj = null;
    try{
      levelObj = JSON.parse(jsonText);
    }catch(err){
      // fallback: if AI returned JSON array only, try to parse the whole text
      levelObj = JSON.parse(text);
    }
    // Basic validation: must have objects array
    if(!levelObj || !Array.isArray(levelObj.objects)){
      throw new Error("AI returned JSON but it did not include an objects array.");
    }
    // Ensure start object exists; if not, add one near x=64
    if(!levelObj.objects.find(x=>x.type === "start")){
      levelObj.objects.unshift({ type: "start", x: 64, y: 300, w:32, h:32, meta:{} });
    }
    // Import into editor (editor.import expects top-level fields like objects and settings)
    // Normalize objects to editor internal shape: ensure id is present (editor.import will accept objects as-is)
    for(const obj of levelObj.objects){
      // ensure numeric fields
      obj.x = Number(obj.x || 0);
      obj.y = Number(obj.y || 0);
      obj.w = Number(obj.w || 32);
      obj.h = Number(obj.h || 32);
      if(!obj.meta) obj.meta = {};
    }
    // Apply imported level to editor
    editor.import({ objects: levelObj.objects, bgColor: levelObj.bgColor || editor.bgColor, groundColor: levelObj.groundColor || editor.groundColor, startGamemode: levelObj.startGamemode || editor.startGamemode });
    // update UI controls to reflect imported set
    try{ editor._render(); }catch(e){}
    requestAnimationFrame(updateEditButtonVisibility);
    aiStatus.textContent = "AI level imported successfully.";
  }catch(err){
    console.error("AI level generation failed:", err);
    aiStatus.textContent = "Failed to generate level: " + (err.message || String(err));
  } finally {
    aiRun.disabled = false;
    aiRun.textContent = "Generate & Import";
    setTimeout(()=>{ aiBackdrop.style.display = "none"; aiModal.style.display = "none"; }, 1400);
  }
});

// Cancel / No
clearCancel.addEventListener("click", ()=>{
  clearBackdrop.style.display = "none";
  clearModal.style.display = "none";
});
clearBackdrop.addEventListener("click", ()=>{
  clearBackdrop.style.display = "none";
  clearModal.style.display = "none";
});

// Yes: validate and clear
clearYes.addEventListener("click", ()=>{
  const v = (clearCodeInput.value || "").trim().toUpperCase();
  if(v === _currentClearCode){
    // clear editor objects and selection, save state and re-render
    editor.objects = [];
    editor.selectedIds = [];
    try{ editor._saveState(); }catch(e){}
    try{ editor._render(); }catch(e){}
    // update edit-related buttons visibility
    requestAnimationFrame(updateEditButtonVisibility);
    clearBackdrop.style.display = "none";
    clearModal.style.display = "none";
  } else {
    // brief shake feedback: add a quick animation via inline style
    clearCodeInput.style.borderColor = "#b22";
    setTimeout(()=>{ clearCodeInput.style.borderColor = ""; }, 900);
  }
});

// new tab for Edit
const tabEdit = document.createElement("button");
tabEdit.id = "tab-edit";
tabEdit.className = "tab-btn";
tabEdit.textContent = "Edit";
const toolbarTabs = document.getElementById("toolbar-tabs");
// insert the Edit tab between Objects and Tools (not appended at end)
toolbarTabs.insertBefore(tabEdit, tabTools);

// references to edit panel controls
const editPanel = document.getElementById("edit-panel");
const moveUpBtn = document.getElementById("move-up");
const moveDownBtn = document.getElementById("move-down");
const moveLeftBtn = document.getElementById("move-left");
const moveRightBtn = document.getElementById("move-right");
const moveUpHalfBtn = document.getElementById("move-up-half");
const moveDownHalfBtn = document.getElementById("move-down-half");
const moveLeftHalfBtn = document.getElementById("move-left-half");
const moveRightHalfBtn = document.getElementById("move-right-half");
const deselectBtn = document.getElementById("deselect-btn");
const deleteBtn = document.getElementById("delete-btn");
const multiSelectBtn = document.getElementById("multi-select-btn");
const scaleBtn = document.getElementById("scale-btn");

// --- after other modals inserted (place near other modal code insertions) ---
const editScaleHtml = `
  <div id="edit-scale-backdrop" class="edit-object-backdrop" style="display:none"></div>
  <div id="edit-scale-modal" class="edit-object-modal" style="display:none">
    <h4>Scale Selected Object(s)</h4>
    <div class="edit-object-row">
      <label style="flex:1">Width (px) <input id="scale-width" type="number" min="1" step="1" value="32" /></label>
    </div>
    <div class="edit-object-row">
      <label style="flex:1">Height (px) <input id="scale-height" type="number" min="1" step="1" value="32" /></label>
    </div>
    <div style="font-size:13px;color:#666">Set the width and/or height (in pixels) for all selected objects; leave blank to keep a dimension unchanged.</div>
    <div class="edit-object-actions">
      <button id="edit-scale-cancel" class="btn small">Cancel</button>
      <button id="edit-scale-apply" class="btn small">Apply</button>
    </div>
  </div>
`;
document.body.insertAdjacentHTML("beforeend", editScaleHtml);
const editScaleModal = document.getElementById("edit-scale-modal");
const editScaleBackdrop = document.getElementById("edit-scale-backdrop");
const scaleWidthInput = document.getElementById("scale-width");
const scaleHeightInput = document.getElementById("scale-height");
const editScaleCancel = document.getElementById("edit-scale-cancel");
const editScaleApply = document.getElementById("edit-scale-apply");

// open scale modal
if(scaleBtn){
  scaleBtn.classList.add("disabled");
  scaleBtn.setAttribute("disabled","true");
  scaleBtn.title = "Select object(s) to scale";
  scaleBtn.addEventListener("click", ()=>{
    if(scaleBtn.hasAttribute("disabled")) return;
    // prefill with first selected object's size or defaults
    let pick = null;
    for(const id of editor.selectedIds || []){
      const o = editor.objects.find(x=>x.id === id);
      if(o){ pick = o; break; }
    }
    if(pick){
      scaleWidthInput.value = Number(pick.w) || 32;
      scaleHeightInput.value = Number(pick.h) || 32;
    } else {
      scaleWidthInput.value = 32;
      scaleHeightInput.value = 32;
    }
    editScaleBackdrop.style.display = "";
    editScaleModal.style.display = "";
  });
}

// cancel handlers
editScaleCancel.addEventListener("click", ()=>{
  editScaleBackdrop.style.display = "none";
  editScaleModal.style.display = "none";
});
editScaleBackdrop.addEventListener("click", ()=>{
  editScaleBackdrop.style.display = "none";
  editScaleModal.style.display = "none";
});

// apply: set width/height for selected objects (if provided) then save state and render
editScaleApply.addEventListener("click", ()=>{
  const wv = Number(scaleWidthInput.value);
  const hv = Number(scaleHeightInput.value);
  const setW = Number.isFinite(wv) && wv > 0;
  const setH = Number.isFinite(hv) && hv > 0;
  if(editor.selectedIds && editor.selectedIds.length){
    for(const id of editor.selectedIds){
      const o = editor.objects.find(x=>x.id === id);
      if(!o) continue;
      if(setW) o.w = Math.max(1, Math.round(wv));
      if(setH) o.h = Math.max(1, Math.round(hv));
    }
    try{ editor._saveState(); }catch(e){}
    try{ editor._render(); }catch(e){}
  }
  editScaleBackdrop.style.display = "none";
  editScaleModal.style.display = "none";
  requestAnimationFrame(updateEditButtonVisibility);
});

// move multi-select button to far right of object-toolbar for clearer placement
// ensure multi-select button visibility is managed by tab switching (keep it in the Edit panel in HTML)
if(multiSelectBtn){
  multiSelectBtn.style.display = "none"; // hidden by default until Edit tab is shown
}

// create settings modal DOM (hidden by default)
const settingsModalHtml = ` 
  <div id="settings-backdrop" class="settings-backdrop" style="display:none"></div>
  <div id="settings-modal" class="settings-modal" style="display:none">
    <div class="settings-top">
      <h3 style="margin:0 0 8px 0">Settings</h3>
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px">
        <label style="flex:1">Background color<input id="bg-color" type="color" value="#ffffff" /></label>
        <label style="flex:1">Ground color<input id="ground-color" type="color" value="#e6e6e6" /></label>
        <label style="flex:1">Grid line color<input id="grid-line-color" type="color" value="#d0d0d0" /></label>
        <label style="flex:1">Ground outline color<input id="ground-outline-color" type="color" value="#d0d0d0" /></label>
      </div>
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px">
        <label style="flex:1">Background texture
          <select id="bg-texture">
            <option value="default">Default</option>
            <option value="bobby">Bobby Background (20x20 tiles)</option>
            <option value="striped">Striped</option>
          </select>
        </label>
        <label style="flex:1">Ground texture
          <select id="ground-texture">
            <option value="default">Default</option>
            <option value="bobby">Bobby Ground (5x5 tiles)</option>
            <option value="no-outline">No Outline (ground without top outline)</option>
          </select>
        </label>
      </div>
    </div>

    <div class="settings-scroll">
      <div class="settings-row">
        <label>Start gamemode
          <select id="start-gamemode">
            <option value="cube">Cube (default)</option>
            <option value="ship">Ship</option>
            <option value="ball">Ball</option>
            <option value="ufo">UFO</option>
            <option value="wave">Wave</option>
          </select>
        </label>
      </div>

      <div class="settings-row"><label><input id="no-ground" type="checkbox" /> No ground (remove visual ground)</label></div>
      <div class="settings-row"><label>Gravity (px/s²) <input id="gravity-input" type="number" step="10" min="0" value="1400" /></label></div>
      <div class="settings-row"><label><input id="disable-grid-play" type="checkbox" /> Disable grid while playing</label></div>
      <div class="settings-row"><label><input id="dark-mode" type="checkbox" /> Dark mode (limited vision around player)</label></div>

      <!-- Moved Platformer Mode up for visibility -->
      <div class="settings-row"><label><input id="platformer-mode" type="checkbox" /> Platformer mode (free horizontal movement)</label></div>

      <div style="font-size:13px;color:#ccc;padding:8px 0">Other settings below</div>
    </div>

    <div class="settings-actions settings-actions-fixed">
      <button id="settings-cancel" class="btn small">Cancel</button>
      <button id="settings-save" class="btn small">Apply</button>
    </div>
  </div>
`;
document.body.insertAdjacentHTML("beforeend", settingsModalHtml);

const settingsBackdrop = document.getElementById("settings-backdrop");
const settingsModal = document.getElementById("settings-modal");
const bgColorInput = document.getElementById("bg-color");
const groundColorInput = document.getElementById("ground-color");
const noGroundInput = document.getElementById("no-ground");
const groundGridColorInput = document.getElementById("ground-grid-color");
const groundTextureSelect = document.getElementById("ground-texture");
const bgTextureSelect = document.getElementById("bg-texture");
const settingsCancel = document.getElementById("settings-cancel");
const settingsSave = document.getElementById("settings-save");
const gridLineColorInput = document.getElementById("grid-line-color");
const groundOutlineColorInput = document.getElementById("ground-outline-color");
const disableGridPlayInput = document.getElementById("disable-grid-play");
const darkModeInput = document.getElementById("dark-mode");
const startGamemodeSelect = document.getElementById("start-gamemode");
const gravityInput = document.getElementById("gravity-input");
// new tools-panel editor grid toggle element
const editorHideGridToggle = document.getElementById("editor-hide-grid");
// NEW: top-right side-toggle button reference (toggles half-height <-> half-width for platforms/half-hazards)
const sideToggleBtn = document.getElementById("side-toggle-btn");
const platformerModeInput = document.getElementById("platformer-mode");

function openSettings(){
  // populate with current editor values
  bgColorInput.value = editor.bgColor || "#ffffff";
  groundColorInput.value = editor.groundColor || "#e6e6e6";
  // populate the two separate color pickers
  gridLineColorInput.value = editor.gridLineColor || "#d0d0d0";
  groundOutlineColorInput.value = editor.groundOutlineColor || "#d0d0d0";
  // this setting now controls only play-time grid disabling
  disableGridPlayInput.checked = !!editor.disableGridWhilePlaying;
  // no-ground toggle
  noGroundInput.checked = !!editor.noGround;
  // start gamemode select
  startGamemodeSelect.value = editor.startGamemode || "cube";
  groundTextureSelect.value = editor.groundTexture || "default";
  bgTextureSelect.value = editor.bgTexture || "default";
  // populate gravity from player if available
  gravityInput.value = (typeof player?.gravity === "number") ? String(player.gravity) : String(gravityInput.value || 1400);
  darkModeInput.checked = !!editor.darkMode;
  platformerModeInput.checked = !!editor.platformerMode;
  settingsBackdrop.style.display = "";
  settingsModal.style.display = "";
}
function closeSettings(){ settingsBackdrop.style.display = "none"; settingsModal.style.display = "none"; }

settingsBtn.addEventListener("click", openSettings);
settingsCancel.addEventListener("click", closeSettings);
settingsBackdrop.addEventListener("click", closeSettings);

settingsSave.addEventListener("click", ()=>{
  editor.bgColor = bgColorInput.value;
  editor.groundColor = groundColorInput.value;
  // apply no-ground and start-as-ship flags
  editor.noGround = !!noGroundInput.checked;
  editor.startGamemode = startGamemodeSelect.value || "cube";
  // save separate color values
  editor.gridLineColor = gridLineColorInput.value;
  editor.groundOutlineColor = groundOutlineColorInput.value;
  // grid visibility toggle (checkbox labeled Disable grid) -- now only for play
  editor.disableGridWhilePlaying = !!disableGridPlayInput.checked;
  // dark mode toggle
  editor.darkMode = !!darkModeInput.checked;
  editor.groundTexture = groundTextureSelect.value;
  editor.bgTexture = bgTextureSelect.value;
  // apply gravity setting to the Player (if player exists)
  const gVal = Number(gravityInput.value);
  if(!Number.isNaN(gVal) && player && typeof player === "object"){
    player.gravity = gVal;
  }
  editor.platformerMode = !!platformerModeInput.checked;
  // force a render
  editor._render();
  closeSettings();
});

const editor = new Editor(canvas, {
  onZoomChange(z){ zoomLabel.textContent = z.toFixed(2)+"x"; }, 
  onCursor(pos){ cursorPos.textContent = Math.round(pos.x)+","+Math.round(pos.y); },
});
const player = new Player(canvas, editor);

const OBJECTS = [
  { id:"block", name:"Block", color:"#111", w:32,h:32 },
  { id:"hazard", name:"Hazard", color:"#b22", w:32,h:32 },
  { id:"half-hazard", name:"Half-Hazard", color:"#b22", w:32, h:16 },
  { id:"platform", name:"Platform", color:"#000", w:32, h:16 },
  { id:"start", name:"Start", color:"#0a84ff", w:32, h:32 },
  { id:"jump", name:"JumpPad", color:"#2ad", w:32,h:16 },
  { id:"weak-jump", name:"Weak JumpPad", color:"#22AA88", w:32, h:16 },
  { id:"strong-jump", name:"Strong JumpPad", color:"#ffb100", w:32, h:16 },
  { id:"orb", name:"Orb", color:"#2ad", w:32,h:32 },
  { id:"weak-orb", name:"Weak Orb", color:"#22AA88", w:32, h:32 },
  { id:"strong-orb", name:"Strong Orb", color:"#ffb100", w:32, h:32 },
  { id:"bobby", name:"Bobby", color:"#fff", w:32, h:32 },
  // Physics Block: falls, moves and rotates during play (editable color/size)
  { id:"physics-block", name:"Physics Block", color:"#8866ff", w:32, h:32, meta:{ vx:0, vy:0, angVel:0 } },
  { id:"decoration", name:"Decoration", color:"#888", w:32, h:32 },
  { id:"half-decoration", name:"Half Decoration", color:"#888", w:32, h:16, meta: {} },
  // Custom object: acts like decoration but can carry an uploaded image and chosen collision type
  { id:"custom", name:"Custom", color:"#ccc", w:32, h:32, meta: { collision: "decoration", imageSrc: "" } },
  // Ship Portal: non-colliding portal that switches the player to ship mode on touch
  // make ship portal 1x3 (taller) and preview uses IMG_2808.png texture
  { id:"ship-portal", name:"Ship Portal", color:"#00aaff", w:48, h:96 },
  // Cube Portal: square portal that switches player back to normal cube mode; preview uses IMG_2809
  { id:"cube-portal", name:"Cube Portal", color:"#3ae", w:48, h:96 },
  // Ball Portal: switches player to ball gamemode (uses IMG_2880 texture)
  { id:"ball-portal", name:"Ball Portal", color:"#8f8", w:48, h:96 },
  // UFO Portal: acts like cube but allows jumping in air; preview uses IMG_3040
  { id:"ufo-portal", name:"UFO Portal", color:"#ffee66", w:48, h:96 },
  // Wave Portal: toggles Wave gamemode (diagonal movement) and uses IMG_3129.webp
  { id:"wave-portal", name:"Wave Portal", color:"#66ccff", w:48, h:96 },
  // Saw: 3x3 grid hazard using IMG_3078 rotating texture
  { id:"saw", name:"Saw", color:"#ccc", w:96, h:96 },
  { id:"saw-2", name:"Saw 2", color:"#ccc", w:96, h:96 },
  { id:"saw-3", name:"Saw 3", color:"#ccc", w:96, h:96 },
  // Wheel: 2x2 rotating hazard using IMG_3119 texture
  { id:"wheel", name:"Wheel", color:"#ccc", w:64, h:64 },
  // Wheel 2: 2x2 rotating hazard using IMG_3120 texture
  { id:"wheel-2", name:"Wheel 2", color:"#ccc", w:64, h:64 },
  // BG Trigger object (transparent background, uses IMG_2806.png and shows "BG")
  { id:"bg-trigger", name:"BG Trigger", color:"#000000", w:32, h:32, meta: { bgColor:"#ffffff", fadeTime:0.6 } },
  // G Trigger object (transparent background, uses IMG_2806.png and shows "G")
  { id:"g-trigger", name:"G Trigger", color:"#000000", w:32, h:32, meta: { target:"ground", color:"#e6e6e6", fadeTime:0.6 } },
  // Add GR Trigger object (changes grid line color)
  { id:"gr-trigger", name:"GR Trigger", color:"#000000", w:32, h:32, meta: { targetGridColor:"#d0d0d0", fadeTime:0.6 } },
  // Color Trigger: changes the color of an object with a matching group id
  { id:"color-trigger", name:"Color Trigger", color:"#000000", w:32, h:32, meta: { targetGroup:"", color:"#ffffff", fadeTime:0.6 } },
  // Spawn Trigger: when passed, re-enables all triggers that belong to a group so they can fire again
  { id:"spawn-trigger", name:"Spawn Trigger", color:"#00cc44", w:32, h:32, meta: { targetGroup:"" } },
  // Move Trigger: uses IMG_2815 texture (pink hue applied in renderer)
  { id:"move-trigger", name:"Move Trigger", color:"#000000", w:32, h:32, meta: { targetGroup:"", moveX:0, moveY:0, moveTime:0.6 } },
  // Rotate Trigger: behaves like Move Trigger but rotates target objects
  { id:"rotate-trigger", name:"Rotate Trigger", color:"#000000", w:32, h:32, meta: { targetGroup:"", centerGroup:"", degrees:90, spins:0, rotateTime:0.6 } },
  // Nudge Block: non-colliding block that pushes the player when touched; meta.direction = "right" or "left", meta.strength = grid units
  { id:"nudge", name:"Nudge Block", color:"#88aaff", w:32, h:32, meta: { direction: "right", strength: 1 } },
  // Add alpha-trigger to OBJECTS list
  { id:"alpha-trigger", name:"Alpha Trigger", color:"#00ffff", w:32, h:32, meta: { targetGroup:"", alpha:1, fadeTime:0.6 } },
  // Edit-Group Trigger: modifies group tags on matching objects when passed (violet trigger)
  { id:"edit-group-trigger", name:"Edit-Group Trigger", color:"#b066ff", w:32, h:32, meta: { targetGroup:"", addGroups:[], removeGroups:[] } },
  // Flashlight: non-colliding decorative object that emits a local light while playing (uses IMG_3133 texture)
  { id:"flashlight", name:"Flashlight", color:"#ffffff", w:32, h:32 },
  // Dark Crystal: decorative non-colliding object that emits a player-sized light while playing (uses IMG_3136 texture)
  { id:"dark-crystal", name:"Dark Crystal", color:"#0fa84a", w:32, h:32 },

  // Diamond Disc: decorative spinning disc (non-lethal) 5x5 using IMG_3518.png, emits large light in dark mode
  { id:"diamond-disc", name:"Diamond Disc", color:"#fff8e6", w:32*5, h:32*5, meta: { range: 240, tintColor: "#fff8e6", tintStrength: 0.9 } },
  // Y Holder: 3x3 cyan block that holds player's Y when hitting side/bottom; top behaves as normal solid
  { id:"y-holder", name:"Y Holder", color:"#00ffff", w:32*3, h:32*3, meta: {} },


  // Flower: decorative non-colliding object using IMG_3494 texture
  { id:"flower", name:"Flower", color:"#ffdede", w:32, h:32, meta: {} },
  // Flower Field: decorative 2x1 non-colliding object using IMG_3495.webp (same collision as flower)
  { id:"flower-field", name:"Flower Field", color:"#ffdede", w:64, h:32, meta: {} },
  // Purple Flower: decorative 1x3 non-colliding object using IMG_3496.png (tall single-column flower)
  { id:"purple-flower", name:"Purple Flower", color:"#e8d6ff", w:32, h:64, meta: {} },

  // NEW: Star Light object (between flashlight and dark-crystal lighting, tinted blue default)
  { id:"star-light", name:"Star Light", color:"#e6f4ff", w:32, h:32, meta: { range: 120, tintColor: "#cfe9ff", tintStrength: 0.6 } },

  // NEW: Christmas Tree object (3x5 grid) using IMG_3142.jpeg
  { id:"christmas-tree", name:"Christmas Tree", color:"#ffffff", w:32*3, h:32*5, meta: {} },
];

function buildToolbar(){
  // clear object container (keep tools panels intact)
  objectsPanel.innerHTML = "";
  OBJECTS.forEach(o=>{
    const btn = document.createElement("button");
    btn.className = "object-btn";
    btn.title = o.name;
    btn.dataset.id = o.id;
    // Christmas tree preview: use the provided IMG_3142.jpeg texture
    if(o.id === "christmas-tree"){
      // Use relative asset path in toolbar preview (consistent with other toolbar previews)
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(48, Math.min(144,o.w/2))}px;height:${Math.max(80, Math.min(240,o.h/2))}px;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative"><img src="IMG_3143.png" style="width:100%;height:100%;object-fit:cover;display:block" /><div style="position:absolute;pointer-events:none;font-size:11px;color:#fff;text-shadow:0 0 4px rgba(0,0,0,0.6);padding:2px 6px">${o.name}</div></div><div class="hint">${o.name}</div>`;
    } else {
    // dark-crystal preview using IMG_3136
    if(o.id === "dark-crystal"){
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(24, Math.min(48,o.w))}px;height:${Math.max(18,Math.min(48,o.h))}px;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative"><img src="IMG_3136.png" style="width:100%;height:100%;object-fit:cover;display:block" /><div style="position:absolute;pointer-events:none;font-size:11px;color:#fff;text-shadow:0 0 4px rgba(0,0,0,0.6)">${o.name}</div></div><div class="hint">${o.name}</div>`;
    }
    // Diamond Disc preview: spinning decorative disc (larger 5x5 preview) using IMG_3518.png
    if(o.id === "diamond-disc"){
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(80, Math.min(180, o.w/2))}px;height:${Math.max(80, Math.min(180, o.h/2))}px;border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative"><img src="IMG_3518.png" style="width:100%;height:100%;object-fit:cover;display:block" /><div style="position:absolute;pointer-events:none;font-size:11px;color:#111;text-shadow:0 0 4px rgba(255,255,255,0.6);padding:2px 6px">${o.name}</div></div><div class="hint">${o.name}</div>`;
    }
    // Half Decoration: render preview the same way as a generic decoration (no flower texture)
    if(o.id === "half-decoration"){
      btn.innerHTML = `<div class="obj-preview" style="background:${o.color};width:${Math.max(36, Math.min(64, o.w))}px;height:${Math.max(12, Math.min(24, o.h))}px;border-radius:6px;display:flex;align-items:center;justify-content:center;position:relative"><div style="position:absolute;pointer-events:none;font-size:11px;color:#fff;text-shadow:0 0 4px rgba(0,0,0,0.6)">${o.name}</div></div><div class="hint">${o.name}</div>`;
    }
    // flower preview using IMG_3494 (decorative)
    if(o.id === "flower"){
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(24, Math.min(48,o.w))}px;height:${Math.max(24,Math.min(48,o.h))}px;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative"><img src="IMG_3494.png" style="width:100%;height:100%;object-fit:cover;display:block" /><div style="position:absolute;pointer-events:none;font-size:11px;color:#fff;text-shadow:0 0 4px rgba(0,0,0,0.6)">${o.name}</div></div><div class="hint">${o.name}</div>`;
    }
    // Flower Field: wider decorative preview using IMG_3495.webp (2x1)
    if(o.id === "flower-field"){
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(36, Math.min(96, o.w))}px;height:${Math.max(18, Math.min(48, o.h))}px;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative"><img src="IMG_3495.webp" style="width:100%;height:100%;object-fit:cover;display:block" /><div style="position:absolute;pointer-events:none;font-size:11px;color:#fff;text-shadow:0 0 4px rgba(0,0,0,0.6)">${o.name}</div></div><div class="hint">${o.name}</div>`;
    }
    // Purple Flower: tall 1x3 decorative preview using IMG_3496.png
    if(o.id === "purple-flower"){
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(24, Math.min(48,o.w))}px;height:${Math.max(72, Math.min(192,o.h))}px;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative"><img src="IMG_3496.png" style="width:100%;height:100%;object-fit:cover;display:block" /><div style="position:absolute;pointer-events:none;font-size:11px;color:#fff;text-shadow:0 0 4px rgba(0,0,0,0.6)">${o.name}</div></div><div class="hint">${o.name}</div>`;
    }
    // special preview for bobby to show image texture
    if(o.id === "bobby"){
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(18, Math.min(48,o.w))}px;height:${Math.max(12,Math.min(48,o.h))}px;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center"><img src="IMG_7541.png" style="width:100%;height:100%;object-fit:cover;display:block" /></div><div class="hint">${o.name}</div>`;
    } else if(o.id === "bg-trigger"){
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(18, Math.min(48,o.w))}px;height:${Math.max(12,Math.min(48,o.h))}px;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:transparent;position:relative"><img src="IMG_2806.png" style="width:100%;height:100%;object-fit:cover;display:block" /><div style="position:absolute;pointer-events:none;font-size:11px;color:#fff;-webkit-text-stroke:0.7px #000;text-shadow:0 0 1px rgba(0,0,0,0.6);background:transparent">BG</div></div><div class="hint">${o.name}</div>`;
    } else if(o.id === "g-trigger"){
      // G trigger preview: same image but "G" label
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(18, Math.min(48,o.w))}px;height:${Math.max(12,Math.min(48,o.h))}px;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:transparent;position:relative"><img src="IMG_2806.png" style="width:100%;height:100%;object-fit:cover;display:block" /><div style="position:absolute;pointer-events:none;font-size:11px;color:#fff;-webkit-text-stroke:0.7px #000;text-shadow:0 0 1px rgba(0,0,0,0.6);background:transparent">G</div></div><div class="hint">${o.name}</div>`;
    } else if(o.id === "gr-trigger"){
      // GR trigger preview: same image but "GR" label
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(18, Math.min(48,o.w))}px;height:${Math.max(12,Math.min(48,o.h))}px;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:transparent;position:relative"><img src="IMG_2806.png" style="width:100%;height:100%;object-fit:cover;display:block" /><div style="position:absolute;pointer-events:none;font-size:11px;color:#fff;-webkit-text-stroke:0.7px #000;text-shadow:0 0 1px rgba(0,0,0,0.6);background:transparent">GR</div></div><div class="hint">${o.name}</div>`;
    } else if(o.id === "color-trigger"){
      // Color trigger preview: same icon but "C" label
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(18, Math.min(48,o.w))}px;height:${Math.max(12,Math.min(48,o.h))}px;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:transparent;position:relative"><img src="IMG_2806.png" style="width:100%;height:100%;object-fit:cover;display:block" /><div style="position:absolute;pointer-events:none;font-size:11px;color:#fff;-webkit-text-stroke:0.7px #000;text-shadow:0 0 1px rgba(0,0,0,0.6);background:transparent">C</div></div><div class="hint">${o.name}</div>`;
    } else if(o.id === "ship-portal"){
      // taller preview for ship portal using the new portal texture
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(18, Math.min(48,o.w))}px;height:${Math.max(36,Math.min(96,o.h))}px;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative"><img src="IMG_2808.png" style="width:100%;height:100%;object-fit:cover;display:block" /><div style="position:absolute;pointer-events:none;font-size:11px;color:#fff;-webkit-text-stroke:0.7px #000;text-shadow:0 0 1px rgba(0,0,0,0.6);background:transparent">Ship</div></div><div class="hint">${o.name}</div>`;
    } else if(o.id === "cube-portal"){
      // cube portal preview: square portal using IMG_2809
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(18, Math.min(48,o.w))}px;height:${Math.max(12,Math.min(48,o.h))}px;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative"><img src="IMG_2809.png" style="width:100%;height:100%;object-fit:cover;display:block" /><div style="position:absolute;pointer-events:none;font-size:11px;color:#fff;-webkit-text-stroke:0.7px #000;text-shadow:0 0 1px rgba(0,0,0,0.6);background:transparent">Cube</div></div><div class="hint">${o.name}</div>`;
    } else if(o.id === "move-trigger"){
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(18, Math.min(48,o.w))}px;height:${Math.max(12,Math.min(48,o.h))}px;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative"><img src="IMG_2815.png" style="width:100%;height:100%;object-fit:cover;display:block;filter:hue-rotate(-10deg) saturate(1.6) brightness(1.15)" /><div style="position:absolute;pointer-events:none;font-size:11px;color:#fff;-webkit-text-stroke:0.7px #000;text-shadow:0 0 1px rgba(0,0,0,0.6);background:transparent">Move</div></div><div class="hint">${o.name}</div>`;
    } else if(o.id === "rotate-trigger"){
      // rotate trigger preview: blue-tinted version of Move preview
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(18, Math.min(48,o.w))}px;height:${Math.max(12,Math.min(48,o.h))}px;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative"><img src="IMG_2815.png" style="width:100%;height:100%;object-fit:cover;display:block;filter:hue-rotate(180deg) saturate(1.3) brightness(1.05)" /><div style="position:absolute;pointer-events:none;font-size:11px;color:#fff;-webkit-text-stroke:0.7px #000;text-shadow:0 0 1px rgba(0,0,0,0.6);background:transparent">Rotate</div></div><div class="hint">${o.name}</div>`;
    } else if(o.id === "nudge"){
      // nudge block preview: small arrow showing facing direction
      const dir = (o.meta && o.meta.direction) ? o.meta.direction : "right";
      const arrow = dir === "left" ? "◀" : "▶";
      btn.innerHTML = `<div class="obj-preview" style="width:36px;height:24px;display:flex;align-items:center;justify-content:center;background:${o.color};border-radius:4px;font-size:18px;color:#fff">${arrow}</div><div class="hint">${o.name}</div>`;
    } else if(o.id === "strong-jump"){
      // strong jump pad preview: same shape as jump but colored like strong orb
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(18, Math.min(48,o.w))}px;height:${Math.max(8,Math.min(24,o.h))}px;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:${o.color};box-shadow:0 4px 12px rgba(255,160,40,0.12)"></div><div class="hint">${o.name}</div>`;
    } else if(o.id === "weak-jump"){
      // weak jump pad preview: same shape as jump but colored like weak orb (teal)
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(18, Math.min(48,o.w))}px;height:${Math.max(8,Math.min(24,o.h))}px;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:${o.color};box-shadow:0 4px 12px rgba(34,170,136,0.10)"></div><div class="hint">${o.name}</div>`;
    } else if(o.id === "weak-orb"){
      // weak orb preview: circular teal-green orb with subtle glow matching in-game look
      const wsize = Math.max(24, Math.min(40, o.h || o.w || 32));
      btn.innerHTML = `<div class="obj-preview" style="width:${wsize}px;height:${wsize}px;border-radius:50%;overflow:visible;display:flex;align-items:center;justify-content:center"><div style="width:${Math.round(wsize*0.85)}px;height:${Math.round(wsize*0.85)}px;border-radius:50%;background:radial-gradient(circle at 30% 30%, #eafff7, ${o.color}); box-shadow: 0 8px 22px rgba(34,170,136,0.16), 0 0 10px rgba(34,170,136,0.10);display:flex;align-items:center;justify-content:center"><div style="width:46%;height:46%;border-radius:50%;background:rgba(255,255,255,0.28)"></div></div></div><div class="hint">${o.name}</div>`;
    } else if(o.id === "strong-orb"){
      // strong orb preview: circular orange orb similar to in-game appearance
      const wsize = Math.max(24, Math.min(40, o.h || o.w || 32));
      btn.innerHTML = `<div class="obj-preview" style="width:${wsize}px;height:${wsize}px;border-radius:50%;overflow:visible;display:flex;align-items:center;justify-content:center"><div style="width:${Math.round(wsize*0.85)}px;height:${Math.round(wsize*0.85)}px;border-radius:50%;background:radial-gradient(circle at 30% 30%, #fff8e6, ${o.color}); box-shadow: 0 6px 14px rgba(255,160,40,0.10);display:flex;align-items:center;justify-content:center"><div style="width:48%;height:48%;border-radius:50%;background:rgba(255,255,255,0.22)"></div></div></div><div class="hint">${o.name}</div>`;
    } else if(o.id === "edit-group-trigger"){
      // edit-group-trigger preview: violet-tinted textured tile similar to move/rotate/alpha but violet
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(18, Math.min(48,o.w))}px;height:${Math.max(12,Math.min(48,o.h))}px;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative">
          <img src="IMG_2815.png" style="width:100%;height:100%;object-fit:cover;display:block;filter:hue-rotate(260deg) saturate(1.6) brightness(1.05)" />
          <div style="position:absolute;pointer-events:none;font-size:11px;padding:2px 4px;border-radius:4px;color:#fff;-webkit-text-stroke:0.7px #000;text-shadow:0 0 1px rgba(0,0,0,0.6);background:transparent">Group</div>
        </div><div class="hint">${o.name}</div>`;
    } else if(o.id === "ufo-portal"){
      // UFO portal preview: use provided IMG_3040 texture for a distinct UFO portal preview
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(18, Math.min(48,o.w))}px;height:${Math.max(36,Math.min(96,o.h))}px;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative"><img src="IMG_3040.png" style="width:100%;height:100%;object-fit:cover;display:block" /><div style="position:absolute;pointer-events:none;font-size:11px;color:#111;padding:2px 6px;border-radius:6px;background:rgba(255,255,255,0.9);">UFO</div></div><div class="hint">${o.name}</div>`;
    } else if(o.id === "alpha-trigger"){
      // alpha trigger preview: textured tile with cyan tint similar to move/rotate previews
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(18, Math.min(48,o.w))}px;height:${Math.max(12,Math.min(48,o.h))}px;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative">
          <img src="IMG_2815.png" style="width:100%;height:100%;object-fit:cover;display:block;filter:hue-rotate(120deg) saturate(1.4) brightness(1.05)" />
          <div style="position:absolute;pointer-events:none;font-size:11px;padding:2px 4px;border-radius:4px;color:#fff;-webkit-text-stroke:0.7px #000;text-shadow:0 0 1px rgba(0,0,0,0.6);background:transparent">Alpha</div>
        </div><div class="hint">${o.name}</div>`;
    } else if(o.id === "saw"){
      // saw preview: show the saw texture scaled to preview area
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(24, Math.min(72,o.w/1.5))}px;height:${Math.max(24, Math.min(72,o.h/1.5))}px;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative"><img src="IMG_3078.png" style="width:100%;height:100%;object-fit:cover;display:block" /><div style="position:absolute;pointer-events:none;font-size:11px;color:#fff;-webkit-text-stroke:0.6px #000;text-shadow:0 0 1px rgba(0,0,0,0.6)">Saw</div></div><div class="hint">${o.name}</div>`;
    } else if(o.id === "saw-2"){
      // saw-2 preview: show the alternate saw texture
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(24, Math.min(72,o.w/1.5))}px;height:${Math.max(24, Math.min(72,o.h/1.5))}px;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative"><img src="IMG_3128.png" style="width:100%;height:100%;object-fit:cover;display:block" /><div style="position:absolute;pointer-events:none;font-size:11px;color:#fff;-webkit-text-stroke:0.6px #000;text-shadow:0 0 1px rgba(0,0,0,0.6)">Saw 2</div></div><div class="hint">${o.name}</div>`;
    } else if(o.id === "saw-3"){
      // saw-3 preview: show the saw 3 texture (IMG_3139)
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(24, Math.min(72,o.w/1.5))}px;height:${Math.max(24, Math.min(72,o.h/1.5))}px;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative"><img src="IMG_3139.png" style="width:100%;height:100%;object-fit:cover;display:block" /><div style="position:absolute;pointer-events:none;font-size:11px;color:#fff;-webkit-text-stroke:0.6px #000;text-shadow:0 0 1px rgba(0,0,0,0.6)">Saw 3</div></div><div class="hint">${o.name}</div>`;
    } else if(o.id === "wheel"){
      // wheel preview: show the wheel texture scaled to preview area (2x2)
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(24, Math.min(64,o.w))}px;height:${Math.max(24, Math.min(64,o.h))}px;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative"><img src="IMG_3119.png" style="width:100%;height:100%;object-fit:cover;display:block" /><div style="position:absolute;pointer-events:none;font-size:11px;color:#fff;-webkit-text-stroke:0.6px #000;text-shadow:0 0 1px rgba(0,0,0,0.6)">Wheel</div></div><div class="hint">${o.name}</div>`;
    } else if(o.id === "wheel-2"){
      // wheel-2 preview: use IMG_3120 texture
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(24, Math.min(64,o.w))}px;height:${Math.max(24, Math.min(64,o.h))}px;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative"><img src="IMG_3120.png" style="width:100%;height:100%;object-fit:cover;display:block" /><div style="position:absolute;pointer-events:none;font-size:11px;color:#fff;-webkit-text-stroke:0.6px #000;text-shadow:0 0 1px rgba(0,0,0,0.6)">Wheel 2</div></div><div class="hint">${o.name}</div>`;
    } else if(o.id === "physics-block"){
      // physics block preview: show a slightly purple-tinted block indicating it's dynamic in play
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(24, Math.min(48,o.w))}px;height:${Math.max(24,Math.min(48,o.h))}px;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#8866ff;box-shadow:0 6px 18px rgba(136,102,255,0.12)"></div><div class="hint">${o.name}</div>`;
    } else if(o.id === "platform"){
      // platform preview: half-height solid block (platform)
      btn.innerHTML = `<div class="obj-preview" style="width:36px;height:12px;display:flex;align-items:center;justify-content:center;background:${o.color};border-radius:4px"></div><div class="hint">${o.name}</div>`;
    } else {
      btn.innerHTML = `<div class="obj-preview" style="background:${o.color};width:${Math.max(18, Math.min(48,o.w))}px;height:${Math.max(12,Math.min(48,o.h))}px;border-radius:4px"></div><div class="hint">${o.name}</div>`;
    }
    }
    // Ball portal preview: use IMG_2880 texture
    if(o.id === "ball-portal"){
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(18, Math.min(48,o.w))}px;height:${Math.max(36,Math.min(96,o.h))}px;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative"><img src="IMG_2880.png" style="width:100%;height:100%;object-fit:cover;display:block" /><div style="position:absolute;pointer-events:none;font-size:11px;color:#fff;-webkit-text-stroke:0.7px #000;text-shadow:0 0 1px rgba(0,0,0,0.6);background:transparent">Ball</div></div><div class="hint">${o.name}</div>`;
    }
    // Wave portal preview: use IMG_3129.webp when present
    if(o.id === "wave-portal"){
      // use absolute-root path for consistent loading
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(18, Math.min(48,o.w))}px;height:${Math.max(36,Math.min(96,o.h))}px;border-radius:4px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative"><img src="/IMG_3129.webp" style="width:100%;height:100%;object-fit:cover;display:block" /><div style="position:absolute;pointer-events:none;font-size:11px;color:#fff;-webkit-text-stroke:0.7px #000;text-shadow:0 0 1px rgba(0,0,0,0.6);background:transparent">Wave</div></div><div class="hint">${o.name}</div>`;
    }
    btn.addEventListener("click", ()=>{
      const currentlySelected = objectsPanel.querySelector(".object-btn.selected");
      if(btn.classList.contains("selected")){
        // clicking the already-selected button will deselect
        btn.classList.remove("selected");
        editor.setTool(null);
      } else {
        // select this one
        objectsPanel.querySelectorAll(".object-btn").forEach(x=>x.classList.remove("selected"));
        btn.classList.add("selected");
        editor.setTool(o);
      }
    });
    objectsPanel.appendChild(btn);
  });
  // select first by default
  const first = objectsPanel.querySelector(".object-btn");
  if(first) first.click();
}
buildToolbar();

// ensure Saw 3 is present (fallback) — create its toolbar button if missing
(function ensureSaw3Button(){
  // quick check: if saw-3 button not found, create it to ensure it's visible in toolbar
  if(!objectsPanel.querySelector('.object-btn[data-id="saw-3"]')){
    const o = OBJECTS.find(x=>x.id === "saw-3");
    if(o){
      const btn = document.createElement("button");
      btn.className = "object-btn";
      btn.title = o.name;
      btn.dataset.id = o.id;
      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(24, Math.min(72,o.w/1.5))}px;height:${Math.max(24, Math.min(72,o.h/1.5))}px;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative"><img src="/IMG_3139.png" style="width:100%;height:100%;object-fit:cover;display:block" /><div style="position:absolute;pointer-events:none;font-size:11px;color:#fff;-webkit-text-stroke:0.6px #000;text-shadow:0 0 1px rgba(0,0,0,0.6)">Saw 3</div></div><div class="hint">${o.name}</div>`;
      btn.addEventListener("click", ()=>{
        const currentlySelected = objectsPanel.querySelector(".object-btn.selected");
        if(btn.classList.contains("selected")){
          btn.classList.remove("selected");
          editor.setTool(null);
        } else {
          objectsPanel.querySelectorAll(".object-btn").forEach(x=>x.classList.remove("selected"));
          btn.classList.add("selected");
          editor.setTool(o);
        }
      });
      objectsPanel.appendChild(btn);
    }
  }
})();

// Tab switching logic
function showTab(tab){
  const toolsPanel = document.getElementById("tools-panel");
  const gridPanel = document.getElementById("grid-panel");
  // hide everything by default
  objectsPanel.classList.add("hidden");
  toolbarPanels.classList.remove("hidden"); // we'll selectively show panels inside
  toolsPanel.classList.add("hidden");
  gridPanel.classList.add("hidden");
  editPanel.classList.add("hidden");

  tabObjects.classList.remove("selected");
  tabTools.classList.remove("selected");
  tabEdit.classList.remove("selected");

  if(tab === "objects"){
    // show only objects (hide toolbar panels entirely)
    objectsPanel.classList.remove("hidden");
    toolbarPanels.classList.add("hidden");
    tabObjects.classList.add("selected");
    editor.allowSelect = false;
    editPanel.classList.add("hidden");
  } else if(tab === "tools"){
    // show Tools and Grid panels
    toolsPanel.classList.remove("hidden");
    gridPanel.classList.remove("hidden");
    tabTools.classList.add("selected");
    editor.allowSelect = false;
    editPanel.classList.add("hidden");
  } else if(tab === "edit"){
    // show only Edit panel (hide Tools/Grid)
    editPanel.classList.remove("hidden");
    tabEdit.classList.add("selected");
    editor.allowSelect = true;

    // ensure multi-select button is visually off when entering Edit
    if(multiSelectBtn){
      multiSelectBtn.classList.remove("selected");
      multiSelectBtn.textContent = "Multi-select";
      multiSelectBtn.style.display = ""; // show the button when in Edit tab
    }
  } else {
    // hide multi-select button when not in Edit
    if(multiSelectBtn) multiSelectBtn.style.display = "none";
    tabObjects.classList.remove("selected");
    tabTools.classList.remove("selected");
    tabEdit.classList.remove("selected");
  }
}
// initialize to objects
showTab("objects");

tabObjects.addEventListener("click", ()=> showTab("objects"));
tabTools.addEventListener("click", ()=> showTab("tools"));
tabEdit.addEventListener("click", ()=> showTab("edit"));

modeToggle.addEventListener("click", ()=>{
  if(editor.mode === "editor"){
    editor.setMode("play-preview");
    modeToggle.textContent = "Editor";
    modeLabel.textContent = "Preview";
  } else {
    editor.setMode("editor");
    modeToggle.textContent = "Preview";
    modeLabel.textContent = "Editor";
  }
});

playBtn.addEventListener("click", ()=>{
  if(player.running) { player.stop(); playBtn.textContent = "Play"; return; }
  player.start();
  playBtn.textContent = "Stop";
  // show pause button when a run starts
  if(pauseBtn){
    pauseBtn.style.display = "";
    pauseBtn.textContent = "Pause";
  }
});

// NEW: Pause button toggles pause/resume and updates label
if(pauseBtn){
  pauseBtn.addEventListener("click", ()=>{
    if(!player.running) return;
    if(player.paused){
      player.resume();
      pauseBtn.textContent = "Pause";
    } else {
      player.pause();
      pauseBtn.textContent = "Resume";
    }
  });
  // hide pause when run stops (listen for play button click that stops)
  // also ensure pause button is hidden initially
  pauseBtn.style.display = "none";
  // keep pause button hidden when player stops via Play button
  const originalPlayHandler = playBtn.onclick;
  playBtn.onclick = function(...args){
    originalPlayHandler(...args);
    // When toggling off (stop), ensure pause button is hidden and reset label
    if(!player.running){
      if(pauseBtn){
        pauseBtn.style.display = "none";
        pauseBtn.textContent = "Pause";
      }
    }
  };
}

// Ensure pause button hides when player.stop() is called by intercepting playBtn and stop path
// Add an observer to toggle pause button when playing state changes via Play button click and stop
// We already show pause when starting; listen for the Play button to hide pause on stop:
playBtn.addEventListener("click", ()=>{
  // When toggling off (stop), ensure pause button is hidden and reset label
  if(!player.running){
    if(pauseBtn){
      pauseBtn.style.display = "none";
      pauseBtn.textContent = "Pause";
    }
  }
});

// wire undo/redo
if(undoBtn){
  undoBtn.addEventListener("click", ()=>{
    try{ editor.undo(); }catch(e){}
    requestAnimationFrame(updateEditButtonVisibility);
  });
}
if(redoBtn){
  redoBtn.addEventListener("click", ()=>{
    try{ editor.redo(); }catch(e){}
    requestAnimationFrame(updateEditButtonVisibility);
  });
}

// NEW: top-left header delete button should remove selected objects (mirrors edit-panel Delete)
if(headerDeleteBtn){
  headerDeleteBtn.addEventListener("click", ()=>{
    // If disabled, ignore
    if(headerDeleteBtn.hasAttribute && headerDeleteBtn.hasAttribute("disabled")) return;
    try{
      editor.deleteSelected();
    }catch(e){}
    // update UI state after deletion
    requestAnimationFrame(updateEditButtonVisibility);
  });
}

saveBtn.addEventListener("click", ()=>{
  const data = editor.export();
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "level.json"; a.click();
  URL.revokeObjectURL(url);
});

loadBtn.addEventListener("click", ()=>fileInput.click());
fileInput.addEventListener("change", async (e)=>{
  const file = e.target.files?.[0];
  if(!file) return;
  const txt = await file.text();
  try{
    const data = JSON.parse(txt);
    // Convert legacy "start-as" checkbox flags to the new startGamemode field if present
    // Legacy keys we tolerate: startAsShip, startAsBall, startAsUfo, startAsWave, startAsCube (booleans or strings)
    if(!data.startGamemode){
      try{
        if(data.startAsShip === true || String(data.startAsShip).toLowerCase() === "true") data.startGamemode = "ship";
        else if(data.startAsBall === true || String(data.startAsBall).toLowerCase() === "true") data.startGamemode = "ball";
        else if(data.startAsUfo === true || String(data.startAsUfo).toLowerCase() === "true") data.startGamemode = "ufo";
        else if(data.startAsWave === true || String(data.startAsWave).toLowerCase() === "true") data.startGamemode = "wave";
        else if(data.startAsCube === true || String(data.startAsCube).toLowerCase() === "true") data.startGamemode = "cube";
        // Also support older naming like gamemode_on_start_{ship,ball,ufo,wave} -> convert if found
        else if(data.gamemode_on_start_ship === true || String(data.gamemode_on_start_ship).toLowerCase() === "true") data.startGamemode = "ship";
        else if(data.gamemode_on_start_ball === true || String(data.gamemode_on_start_ball).toLowerCase() === "true") data.startGamemode = "ball";
        else if(data.gamemode_on_start_ufo === true || String(data.gamemode_on_start_ufo).toLowerCase() === "true") data.startGamemode = "ufo";
        else if(data.gamemode_on_start_wave === true || String(data.gamemode_on_start_wave).toLowerCase() === "true") data.startGamemode = "wave";
      }catch(_){}
    }

    editor.import(data);

    // Apply imported settings to UI controls and runtime so loaded saves reflect their stored visuals/options
    try{
      // Colors & textures
      bgColorInput.value = editor.bgColor || "#ffffff";
      groundColorInput.value = editor.groundColor || "#e6e6e6";
      gridLineColorInput.value = editor.gridLineColor || "#d0d0d0";
      groundOutlineColorInput.value = editor.groundOutlineColor || "#d0d0d0";
      bgTextureSelect.value = editor.bgTexture || "default";
      groundTextureSelect.value = editor.groundTexture || "default";
      // Grid / snap / grid size
      editor.showGrid = !!editor.showGrid;
      editorHideGridToggle.checked = !editor.showGrid; // checkbox is "Hide grid"
      snapToggle.checked = !!editor.snap;
      gridSizeInput.value = Number(editor.gridSize) || 32;
      // start gamemode
      // ensure any legacy conversion performed above is respected; default to cube
      startGamemodeSelect.value = editor.startGamemode || (data.startGamemode || "cube");
      // disable-grid-while-playing
      disableGridPlayInput.checked = !!editor.disableGridWhilePlaying;
      darkModeInput.checked = !!editor.darkMode;
      platformerModeInput.checked = !!editor.platformerMode;
      // refresh labels, editor render and toolbar state
      editor._render();
      editor.onZoomChange && editor.onZoomChange(editor.zoom);
      requestAnimationFrame(updateEditButtonVisibility);
    }catch(err){
      console.warn("Failed to apply imported UI settings:", err);
    }
  }catch(err){
    alert("Invalid file");
  }
});

zoomInBtn.addEventListener("click", ()=> {
  const rect = canvas.getBoundingClientRect();
  const center = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
  editor.changeZoom(1.2, center);
});
zoomOutBtn.addEventListener("click", ()=> {
  const rect = canvas.getBoundingClientRect();
  const center = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
  editor.changeZoom(1/1.2, center);
});
snapToggle.addEventListener("change", ()=>editor.snap = snapToggle.checked);
gridSizeInput.addEventListener("change", ()=>editor.gridSize = Number(gridSizeInput.value));

// keep labels updated
editor.onZoomChange = (z)=> zoomLabel.textContent = z.toFixed(2)+"x";
editor.onCursor = (p)=> cursorPos.textContent = Math.round(p.x)+","+Math.round(p.y);

// Edit panel button hookups
moveUpBtn.addEventListener("click", ()=> { editor.moveSelected(0, - (editor.gridSize || 8)); });
moveDownBtn.addEventListener("click", ()=> { editor.moveSelected(0, (editor.gridSize || 8)); });
moveLeftBtn.addEventListener("click", ()=> { editor.moveSelected(- (editor.gridSize || 8), 0); });
moveRightBtn.addEventListener("click", ()=> { editor.moveSelected((editor.gridSize || 8), 0); });

// half-grid movement: moves by half the current grid size (rounded)
if(moveUpHalfBtn){
  moveUpHalfBtn.addEventListener("click", ()=> {
    const g = Math.max(4, editor.gridSize|0);
    editor.moveSelected(0, - Math.round(g/2));
  });
  moveDownHalfBtn.addEventListener("click", ()=> {
    const g = Math.max(4, editor.gridSize|0);
    editor.moveSelected(0, Math.round(g/2));
  });
  moveLeftHalfBtn.addEventListener("click", ()=> {
    const g = Math.max(4, editor.gridSize|0);
    editor.moveSelected(- Math.round(g/2), 0);
  });
  moveRightHalfBtn.addEventListener("click", ()=> {
    const g = Math.max(4, editor.gridSize|0);
    editor.moveSelected(Math.round(g/2), 0);
  });
}

deselectBtn.addEventListener("click", ()=> { editor.deselect(); });
deleteBtn.addEventListener("click", ()=> { editor.deleteSelected(); });

// Multi-select toggle: when enabled, clicks add/remove to selection; when disabled, single-toggle behavior preserved
if(multiSelectBtn){
  // ensure multi-select is off by default on load
  let multiActive = false;
  multiSelectBtn.classList.remove("selected");
  multiSelectBtn.textContent = "Multi-select";
  // force editor multi-select OFF (defensive)
  editor.multiSelect = false;

  multiSelectBtn.addEventListener("click", ()=>{
    multiActive = !multiActive;
    multiSelectBtn.classList.toggle("selected", multiActive);
    multiSelectBtn.textContent = multiActive ? "Multi-select ✓" : "Multi-select";
    // when turning off, if multiple selected keep the last only
    if(!multiActive && editor.selectedIds && editor.selectedIds.length > 1){
      editor.selectedIds = [editor.selectedIds[editor.selectedIds.length-1]];
    }
    // update editor property
    editor.multiSelect = multiActive;
  });

  // ensure Edit tab resets multi-select to off when switching into Edit (prevents it being on by default)
  tabEdit.addEventListener("click", ()=>{
    multiActive = false;
    multiSelectBtn.classList.remove("selected");
    multiSelectBtn.textContent = "Multi-select";
    editor.multiSelect = false;
  });
}

// Fullscreen toggle behavior
if(fullscreenBtn){
  const updateLabel = ()=> {
    if(document.fullscreenElement){
      fullscreenBtn.textContent = "Exit Fullscreen";
      // prevent the page from scrolling while in fullscreen so canvas panning isn't interrupted
      try{ document.body.style.overflow = "hidden"; }catch(e){}
    } else {
      fullscreenBtn.textContent = "Fullscreen";
      try{ document.body.style.overflow = ""; }catch(e){}
    }
  };
  fullscreenBtn.addEventListener("click", async ()=> {
    try{
      if(!document.fullscreenElement){
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    }catch(err){}
    // updateLabel will also run on the fullscreenchange event, but call it here to be immediate
    updateLabel();
  });
  // keep label and overflow state in sync if user uses browser controls
  document.addEventListener("fullscreenchange", updateLabel);
  updateLabel();
}

// initialize editor grid toggle control in Tools panel (reflect current editor.showGrid)
if(editorHideGridToggle){
  editorHideGridToggle.checked = !("showGrid" in editor) ? true : !(!editor.showGrid) ? false : !editor.showGrid;
  // normalize to true/false
  editorHideGridToggle.checked = !!editor.showGrid ? false : true; // this line will be corrected below to simple mapping
  // set proper checked state matching editor.showGrid (checked = hide grid)
  editorHideGridToggle.checked = !editor.showGrid;
  editorHideGridToggle.addEventListener("change", ()=>{
    // when toggled, update editor.showGrid (checkbox is "Hide grid in editor")
    editor.showGrid = !editorHideGridToggle.checked;
    // immediate re-render
    editor._render();
  });
}

// --- Edit Object UI (color picker) ---------------------------------------
const editBtn = document.getElementById("edit-object-btn");
const editModalHtml = `
  <div id="edit-object-backdrop" class="edit-object-backdrop" style="display:none"></div>
  <div id="edit-object-modal" class="edit-object-modal" style="display:none">
    <h4>Edit Selected Object(s)</h4>
    <div class="edit-object-row">
      <label style="flex:1">Color <input id="edit-color-input" type="color" value="#ffffff" /></label>
    </div>
    <div id="edit-image-row" class="edit-object-row" style="display:none">
      <label style="flex:1">Image (upload) <input id="edit-image-input" type="file" accept="image/*" /></label>
    </div>
    <div id="edit-collision-row" class="edit-object-row" style="display:none">
      <label style="flex:1">Collision Type
        <select id="edit-collision-type">
          <option value="decoration">Decoration (non-solid)</option>
          <option value="block">Block (solid)</option>
          <option value="hazard">Hazard</option>
          <option value="half-hazard">Half-Hazard</option>
        </select>
      </label>
    </div>
    <div class="edit-object-actions">
      <button id="edit-cancel" class="btn small">Cancel</button>
      <button id="edit-apply" class="btn small">Apply</button>
    </div>
  </div>
`;
document.body.insertAdjacentHTML("beforeend", editModalHtml);
const editModal = document.getElementById("edit-object-modal");
const editBackdrop = document.getElementById("edit-object-backdrop");
const editColorInput = document.getElementById("edit-color-input");
const editImageInput = document.getElementById("edit-image-input");
const editImageRow = document.getElementById("edit-image-row"); // NEW: container for conditional visibility
const editCollisionSelect = document.getElementById("edit-collision-type");
const editCancel = document.getElementById("edit-cancel");
const editApply = document.getElementById("edit-apply");

// create BG Trigger edit modal DOM (hidden by default)
const editBgHtml = `
  <div id="edit-bg-backdrop" class="edit-object-backdrop" style="display:none"></div>
  <div id="edit-bg-modal" class="edit-object-modal" style="display:none">
    <h4>Edit BG Trigger</h4>
    <div class="edit-object-row">
      <label style="flex:1">Target Background Color <input id="bg-target-color" type="color" value="#ffffff" /></label>
    </div>
    <div class="edit-object-row">
      <label style="flex:1">Fade time (s) <input id="bg-fade-time" type="number" step="0.1" min="0" value="0.6" /></label>
    </div>
    <div style="font-size:13px;color:#666">When the player reaches the trigger's X, the level background will fade to the chosen color over the fade time.</div>
    <div class="edit-object-actions">
      <button id="edit-bg-cancel" class="btn small">Cancel</button>
      <button id="edit-bg-apply" class="btn small">Apply</button>
    </div>
  </div>
`;
document.body.insertAdjacentHTML("beforeend", editBgHtml);
const editBgModal = document.getElementById("edit-bg-modal");
const editBgBackdrop = document.getElementById("edit-bg-backdrop");
const bgTargetColorInput = document.getElementById("bg-target-color");
const bgFadeTimeInput = document.getElementById("bg-fade-time");
const editBgCancel = document.getElementById("edit-bg-cancel");
const editBgApply = document.getElementById("edit-bg-apply");

// create G Trigger edit modal DOM (hidden by default)
const editGHtml = `
  <div id="edit-g-backdrop" class="edit-object-backdrop" style="display:none"></div>
  <div id="edit-g-modal" class="edit-object-modal" style="display:none">
    <h4>Edit G Trigger</h4>
    <div class="edit-object-row">
      <label style="flex:1">Property
        <select id="g-target-prop">
          <option value="ground">Ground color</option>
          <option value="outline">Ground outline color</option>
        </select>
      </label>
    </div>
    <div class="edit-object-row">
      <label style="flex:1">Target Color <input id="g-target-color" type="color" value="#e6e6e6" /></label>
    </div>
    <div class="edit-object-row">
      <label style="flex:1">Fade time (s) <input id="g-fade-time" type="number" step="0.1" min="0" value="0.6" /></label>
    </div>
    <div style="font-size:13px;color:#666">When the player reaches the trigger's X, the level ground (or outline) will fade to the chosen color over the fade time.</div>
    <div class="edit-object-actions">
      <button id="edit-g-cancel" class="btn small">Cancel</button>
      <button id="edit-g-apply" class="btn small">Apply</button>
    </div>
  </div>
`;
document.body.insertAdjacentHTML("beforeend", editGHtml);
const editGModal = document.getElementById("edit-g-modal");
const editGBackdrop = document.getElementById("edit-g-backdrop");
const gTargetPropSelect = document.getElementById("g-target-prop");
const gTargetColorInput = document.getElementById("g-target-color");
const gFadeTimeInput = document.getElementById("g-fade-time");
const editGCancel = document.getElementById("edit-g-cancel");
const editGApply = document.getElementById("edit-g-apply");

// Insert new GR Trigger edit modal DOM (after G Trigger modal)
const editGrHtml = `
  <div id="edit-gr-backdrop" class="edit-object-backdrop" style="display:none"></div>
  <div id="edit-gr-modal" class="edit-object-modal" style="display:none">
    <h4>Edit GR Trigger</h4>
    <div class="edit-object-row">
      <label style="flex:1">Target Grid Color <input id="gr-target-color" type="color" value="#d0d0d0" /></label>
    </div>
    <div class="edit-object-row">
      <label style="flex:1">Fade time (s) <input id="gr-fade-time" type="number" step="0.1" min="0" value="0.6" /></label>
    </div>
    <div style="font-size:13px;color:#666">When the player reaches the trigger's X, the level grid lines will fade to the chosen color over the fade time.</div>
    <div class="edit-object-actions">
      <button id="edit-gr-cancel" class="btn small">Cancel</button>
      <button id="edit-gr-apply" class="btn small">Apply</button>
    </div>
  </div>
`;
document.body.insertAdjacentHTML("beforeend", editGrHtml);
const editGrModal = document.getElementById("edit-gr-modal");
const editGrBackdrop = document.getElementById("edit-gr-backdrop");
const grTargetColorInput = document.getElementById("gr-target-color");
const grFadeTimeInput = document.getElementById("gr-fade-time");
const editGrCancel = document.getElementById("edit-gr-cancel");
const editGrApply = document.getElementById("edit-gr-apply");

// NEW: Edit Group Trigger modal DOM (assign persistent group id / tag to selected objects)
const editEditGroupTriggerHtml = `
  <div id="edit-editgroup-trigger-backdrop" class="edit-object-backdrop" style="display:none"></div>
  <div id="edit-editgroup-trigger-modal" class="edit-object-modal" style="display:none; width:520px; max-width:94%; padding:14px;">
    <h4 style="margin-top:0">Edit Group Trigger</h4>
    <div style="display:grid;grid-template-columns:1fr;gap:8px;align-items:center">
      <label>Target Group ID <input id="editgroup-target-group" type="text" value="" placeholder="Match objects that contain this group" style="width:100%" /></label>
      <label>Add Groups (comma separated) <input id="editgroup-add" type="text" value="" placeholder="tag1, tag2" style="width:100%" /></label>
      <label>Remove Groups (comma separated) <input id="editgroup-remove" type="text" value="" placeholder="tagA, tagB" style="width:100%" /></label>
      <div style="font-size:13px;color:#666">When the player passes the trigger's X, objects with meta.groups including Target Group ID will have groups added/removed as specified.</div>
      <div class="edit-object-actions" style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px">
        <button id="edit-editgroup-trigger-cancel" class="btn small">Cancel</button>
        <button id="edit-editgroup-trigger-apply" class="btn small">Apply</button>
      </div>
    </div>
  </div>
`;
document.body.insertAdjacentHTML("beforeend", editEditGroupTriggerHtml);
const editEditGroupTriggerModal = document.getElementById("edit-editgroup-trigger-modal");
const editEditGroupTriggerBackdrop = document.getElementById("edit-editgroup-trigger-backdrop");
const editGroupTriggerTargetInput = document.getElementById("editgroup-target-group");
const editGroupTriggerAddInput = document.getElementById("editgroup-add");
const editGroupTriggerRemoveInput = document.getElementById("editgroup-remove");
const editEditGroupTriggerCancel = document.getElementById("edit-editgroup-trigger-cancel");
const editEditGroupTriggerApply = document.getElementById("edit-editgroup-trigger-apply");

// NEW: Edit Group button + modal (assign persistent group id / tag to selected objects)
const editGroupBtnHtml = `
  <div id="edit-group-backdrop" class="edit-object-backdrop" style="display:none"></div>
  <div id="edit-group-modal" class="edit-object-modal" style="display:none; width:420px; max-width:94%; padding:14px;">
    <h4>Edit Group Tags</h4>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <input id="group-id-input" type="text" placeholder="Enter group id" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:6px" />
      <button id="group-add-btn" class="btn small">Add</button>
      <button id="group-next-free" class="btn small" title="Pick next free numeric ID">Next Free</button>
    </div>
    <div id="group-list" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px"></div>
    <div style="font-size:13px;color:#666">Assign multiple group/tag strings to the selected objects; these are saved as object.meta.groups (array). Click the × to remove a tag from the list.</div>
    <div class="edit-object-actions" style="margin-top:10px">
      <button id="edit-group-cancel" class="btn small">Cancel</button>
      <button id="edit-group-apply" class="btn small">Apply</button>
    </div>
  </div>
`;
document.body.insertAdjacentHTML("beforeend", editGroupBtnHtml);
const editGroupModal = document.getElementById("edit-group-modal");
const editGroupBackdrop = document.getElementById("edit-group-backdrop");
const groupIdInput = document.getElementById("group-id-input");
const groupAddBtn = document.getElementById("group-add-btn");
const groupList = document.getElementById("group-list");
const editGroupCancel = document.getElementById("edit-group-cancel");
const editGroupApply = document.getElementById("edit-group-apply");
const groupNextFreeBtn = document.getElementById("group-next-free");

// NEW: Edit Group button + modal (assign persistent group id / tag to selected objects)
const editGroupBtn = document.getElementById("edit-group-btn");
const copyPasteBtn = document.getElementById("copy-paste-btn");
// NEW: top-right deselect button reference
const deselectToprightBtn = document.getElementById("deselect-topright-btn");
// NEW: alpha button reference
const alphaBtn = document.getElementById("alpha-btn");
// NEW: separate copy/paste button references
const copyBtn = document.getElementById("copy-btn");
const pasteBtn = document.getElementById("paste-btn");

// NEW: glue button reference (top-right additional column)
const glueBtn = document.getElementById("glue-btn");

// ensure editor has gluePhysics flag default
if(typeof editor.gluePhysics === "undefined") editor.gluePhysics = false;

// initialize glue button visual state
if(glueBtn){
  glueBtn.classList.remove("disabled");
  glueBtn.title = "Glue physics blocks (toggle)";
  glueBtn.addEventListener("click", ()=>{
    // toggle editor glue mode
    editor.gluePhysics = !editor.gluePhysics;
    // toggle selected visual like other toggle buttons
    glueBtn.classList.toggle("selected", !!editor.gluePhysics);
    // small accessibility text change
    glueBtn.title = editor.gluePhysics ? "Unglue physics blocks" : "Glue physics blocks";
    // ensure UI updates (mirror other buttons behavior)
    requestAnimationFrame(updateEditButtonVisibility);
  });
}

// clipboard for separate copy/paste buttons (stores shallow clones of objects)
let _clipboard = [];

// ensure Edit Group is disabled initially (no selection)
if(editGroupBtn){
  editGroupBtn.classList.add("disabled");
  editGroupBtn.setAttribute("disabled", "true");
  editGroupBtn.title = "Select object(s) to assign a group";
}

// show group modal when clicked (disabled if no selection)
editGroupBtn.addEventListener("click", ()=>{
  // defensive: require there to be at least one selected object
  if(!editor.selectedIds || editor.selectedIds.length === 0) return;
  // also respect explicit disabled attribute
  if(editGroupBtn.hasAttribute("disabled")) return;

  // Build combined group list from selected objects (union of their meta.groups / meta.group)
  const groups = new Set();
  for(const id of editor.selectedIds || []){
    const o = editor.objects.find(x=>x.id === id);
    if(!o || !o.meta) continue;
    // support both legacy meta.group (string) and new meta.groups (array)
    if(Array.isArray(o.meta.groups)){
      for(const g of o.meta.groups) if(g) groups.add(String(g));
    } else if(typeof o.meta.group === "string" && o.meta.group.trim() !== ""){
      groups.add(o.meta.group);
    }
  }

  // populate the input and list UI: show first group in the text input (if any)
  groupIdInput.value = groups.size ? Array.from(groups)[0] : "";
  // clear existing list UI then render each tag
  groupList.innerHTML = "";
  function renderTag(tag){
    const chip = document.createElement("div");
    chip.style.cssText = "background:#f4f4f4;padding:6px 8px;border-radius:8px;display:flex;align-items:center;gap:8px;font-size:13px";
    chip.textContent = tag;
    const x = document.createElement("button");
    x.textContent = "×";
    x.title = "Remove";
    x.style.cssText = "margin-left:8px;border:none;background:transparent;cursor:pointer;font-weight:700";
    x.addEventListener("click", ()=> chip.remove());
    chip.appendChild(x);
    groupList.appendChild(chip);
  }
  for(const g of groups) renderTag(g);

  editGroupBackdrop.style.display = "";
  editGroupModal.style.display = "";
});

// Add button to append tag to list
groupAddBtn.addEventListener("click", ()=>{
  const v = String(groupIdInput.value || "").trim();
  if(!v) return;
  // prevent duplicates in the list
  const existing = Array.from(groupList.children).some(ch => ch.firstChild && ch.firstChild.nodeType === Node.TEXT_NODE && ch.firstChild.textContent === v);
  if(existing) {
    // flash the input to indicate duplicate
    groupIdInput.style.borderColor = "#b22";
    setTimeout(()=> groupIdInput.style.borderColor = "", 700);
    return;
  }
  // create chip
  const chip = document.createElement("div");
  chip.style.cssText = "background:#f4f4f4;padding:6px 8px;border-radius:8px;display:flex;align-items:center;gap:8px;font-size:13px";
  const textNode = document.createTextNode(v);
  chip.appendChild(textNode);
  const x = document.createElement("button");
  x.textContent = "×";
  x.title = "Remove";
  x.style.cssText = "margin-left:8px;border:none;background:transparent;cursor:pointer;font-weight:700";
  x.addEventListener("click", ()=> chip.remove());
  chip.appendChild(x);
  groupList.appendChild(chip);
  groupIdInput.value = "";
  groupIdInput.focus();
});

// Allow Enter key in input to add tag
groupIdInput.addEventListener("keydown", (e)=>{
  if(e.key === "Enter"){ e.preventDefault(); groupAddBtn.click(); }
});

// NEW: implement Next Free numeric id finder for groupNextFreeBtn
groupNextFreeBtn.addEventListener("click", ()=>{
  // gather all existing numeric group ids from editor.objects (both meta.groups array and legacy meta.group)
  const used = new Set();
  for(const obj of editor.objects || []){
    if(!obj.meta) continue;
    if(Array.isArray(obj.meta.groups)){
      for(const g of obj.meta.groups){
        if(/^\d+$/.test(String(g))) used.add(Number(g));
      }
    } else if(obj.meta && obj.meta.group != null && /^\d+$/.test(String(obj.meta.group))){
      used.add(Number(obj.meta.group));
    }
  }
  // find smallest positive integer not used (starting from 1)
  let candidate = 1;
  while(used.has(candidate)) candidate++;
  groupIdInput.value = String(candidate);
  groupIdInput.focus();
});

// Apply: gather all tags from list and persist as meta.groups (array) on each selected object
editGroupApply.addEventListener("click", ()=>{
  // collect tags from groupList children (text of each chip)
  const tags = [];
  for(const child of Array.from(groupList.children)){
    // the text node is the first child (before the × button)
    if(child.firstChild && child.firstChild.nodeType === Node.TEXT_NODE){
      const txt = String(child.firstChild.nodeValue || "").trim();
      if(txt) tags.push(txt);
    } else {
      // fallback: textContent minus trailing × if present
      const txt = String(child.textContent || "").replace("×","").trim();
      if(txt) tags.push(txt);
    }
  }

  // apply to selected objects
  if(editor.selectedIds && editor.selectedIds.length){
    for(const id of editor.selectedIds){
      const o = editor.objects.find(x => x.id === id);
      if(!o) continue;
      if(!o.meta) o.meta = {};
      if(tags.length === 0){
        // remove group metadata entirely if no tags
        delete o.meta.groups;
        delete o.meta.group; // also remove legacy single-group if present
      } else {
        // persist as an array of unique tags
        o.meta.groups = Array.from(new Set(tags));
        // keep legacy single-group for compatibility by writing the first tag
        o.meta.group = o.meta.groups[0];
      }
    }
    // persist undo/redo and rerender
    try{ editor._saveState(); }catch(e){}
    try{ editor._render(); }catch(e){}
  }
  editGroupBackdrop.style.display = "none";
  editGroupModal.style.display = "none";
});

// BG modal DOM
const editAlphaHtml = `
  <div id="edit-alpha-backdrop" class="edit-object-backdrop" style="display:none"></div>
  <div id="edit-alpha-modal" class="edit-object-modal" style="display:none">
    <h4>Set Transparency</h4>
    <div class="edit-object-row">
      <label style="flex:1">Alpha (0.00 - 1.00) <input id="alpha-value" type="number" min="0" max="1" step="0.05" value="1" /></label>
    </div>
    <div style="font-size:13px;color:#666">Set transparency for the selected object(s). 0 = fully transparent, 1 = fully opaque.</div>
    <div class="edit-object-actions">
      <button id="edit-alpha-cancel" class="btn small">Cancel</button>
      <button id="edit-alpha-apply" class="btn small">Apply</button>
    </div>
  </div>
`;
document.body.insertAdjacentHTML("beforeend", editAlphaHtml);
const editAlphaModal = document.getElementById("edit-alpha-modal");
const editAlphaBackdrop = document.getElementById("edit-alpha-backdrop");
const alphaValueInput = document.getElementById("alpha-value");
const editAlphaCancel = document.getElementById("edit-alpha-cancel");
const editAlphaApply = document.getElementById("edit-alpha-apply");

// open alpha modal when alpha button clicked (only if enabled)
if(alphaBtn){
  alphaBtn.classList.add("disabled");
  alphaBtn.setAttribute("disabled","true");
  alphaBtn.title = "Select object(s) to set transparency";
  alphaBtn.addEventListener("click", ()=>{
    if(alphaBtn.hasAttribute("disabled")) return;
    // prefill with first selected object's alpha or 1
    let pick = null;
    for(const id of editor.selectedIds || []){
      const o = editor.objects.find(x=>x.id === id);
      if(o){ pick = o; break; }
    }
    const meta = (pick && pick.meta) || {};
    alphaValueInput.value = (typeof meta.alpha === "number") ? String(meta.alpha) : "1";
    editAlphaBackdrop.style.display = "";
    editAlphaModal.style.display = "";
  });
}

editAlphaCancel.addEventListener("click", ()=>{
  editAlphaBackdrop.style.display = "none";
  editAlphaModal.style.display = "none";
});
editAlphaBackdrop.addEventListener("click", ()=>{
  editAlphaBackdrop.style.display = "none";
  editAlphaModal.style.display = "none";
});

editAlphaApply.addEventListener("click", ()=>{
  const v = parseFloat(alphaValueInput.value);
  const alpha = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
  if(editor.selectedIds && editor.selectedIds.length){
    for(const id of editor.selectedIds){
      const o = editor.objects.find(x=>x.id === id);
      if(!o) continue;
      if(!o.meta) o.meta = {};
      o.meta.alpha = alpha;
    }
    editor._render();
    try{ editor._saveState(); }catch(e){}
  }
  editAlphaBackdrop.style.display = "none";
  editAlphaModal.style.display = "none";
});

// helper: determine if selection contains editable types (block or decoration)
function hasEditableSelection(){
  if(!editor.selectedIds || editor.selectedIds.length === 0) return false;
  for(const id of editor.selectedIds){
    const o = editor.objects.find(x=>x.id === id);
    // allow editing color for common solid/hazard/decoration types plus custom and bobby textures
    if(o && (
        o.type === "block" ||
        o.type === "decoration" ||
        o.type === "custom" ||
        o.type === "bobby" ||
        o.type === "hazard" ||
        o.type === "half-hazard" ||
        o.type === "platform"
      )){
      return true;
    }
  }
  return false;
}

// helper: determine if selection contains any bg-trigger
function hasBgTriggerSelection(){
  if(!editor.selectedIds || editor.selectedIds.length === 0) return false;
  for(const id of editor.selectedIds){
    const o = editor.objects.find(x=>x.id === id);
    if(o && o.type === "bg-trigger") return true;
  }
  return false;
}

// helper: determine if selection contains any g-trigger
function hasGTriggerSelection(){
  if(!editor.selectedIds || editor.selectedIds.length === 0) return false;
  for(const id of editor.selectedIds){
    const o = editor.objects.find(x=>x.id === id);
    if(o && o.type === "g-trigger") return true;
  }
  return false;
}

// helper: determine if selection contains any gr-trigger (grid color)
function hasGrTriggerSelection(){
  if(!editor.selectedIds || editor.selectedIds.length === 0) return false;
  for(const id of editor.selectedIds){
    const o = editor.objects.find(x=>x.id === id);
    if(o && o.type === "gr-trigger") return true;
  }
  return false;
}

// helper: determine if selection contains any color-trigger
function hasColorTriggerSelection(){
  if(!editor.selectedIds || editor.selectedIds.length === 0) return false;
  for(const id of editor.selectedIds){
    const o = editor.objects.find(x=>x.id === id);
    if(o && o.type === "color-trigger") return true;
  }
  return false;
}

// helper: determine if selection contains any nudge block
function hasNudgeSelection(){
  if(!editor.selectedIds || editor.selectedIds.length === 0) return false;
  for(const id of editor.selectedIds){
    const o = editor.objects.find(x=>x.id === id);
    if(o && o.type === "nudge") return true;
  }
  return false;
}

// helper: determine if selection contains any alpha-trigger
function hasAlphaTriggerSelection(){
  if(!editor.selectedIds || editor.selectedIds.length === 0) return false;
  for(const id of editor.selectedIds){
    const o = editor.objects.find(x=>x.id === id);
    if(o && o.type === "alpha-trigger") return true;
  }
  return false;
}

// NEW helper: determine if selection contains any edit-group-trigger
function hasEditGroupTriggerSelection(){
  if(!editor.selectedIds || editor.selectedIds.length === 0) return false;
  for(const id of editor.selectedIds){
    const o = editor.objects.find(x=>x.id === id);
    if(o && o.type === "edit-group-trigger") return true;
  }
  return false;
}

// Move Trigger edit modal DOM
const editMoveTriggerHtml = `
  <div id="edit-move-trigger-backdrop" class="edit-object-backdrop" style="display:none"></div>
  <div id="edit-move-trigger-modal" class="edit-object-modal" style="display:none; width:520px; max-width:94%; padding:14px;">
    <h4 style="margin-top:0">Edit Move Trigger</h4>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:center">
      <label style="grid-column:1 / span 2"><input id="move-target-group" type="text" value="" placeholder="Target Group ID" style="width:100%" /></label>

      <label>Move X (grid)<input id="move-x" type="number" value="0" step="1" style="width:100%" /></label>
      <label>Move Y (grid)<input id="move-y" type="number" value="0" step="1" style="width:100%" /></label>

      <label>Move time (s)<input id="move-time" type="number" value="0.6" step="0.1" min="0" style="width:100%" /></label>
      <label>Lock time (s)<input id="move-lock-time" type="number" value="0.6" step="0.1" min="0" style="width:100%" /></label>

      <label style="display:flex;align-items:center;gap:8px"><input id="move-lock-x" type="checkbox" /> Lock to player X</label>
      <label style="display:flex;align-items:center;gap:8px"><input id="move-lock-y" type="checkbox" /> Lock to player Y</label>

      <div style="grid-column:1 / span 2;font-size:13px;color:#666">When the player passes the trigger, the first object with meta.group matching Target Group ID will be moved by Move X/Y grid squares over Move time seconds, or optionally locked to the player's X/Y for Lock time seconds when lock options are enabled.</div>

      <div class="edit-object-actions" style="grid-column:1 / span 2;display:flex;justify-content:flex-end;gap:8px;margin-top:6px">
        <button id="edit-move-trigger-cancel" class="btn small">Cancel</button>
        <button id="edit-move-trigger-apply" class="btn small">Apply</button>
      </div>
    </div>
  </div>
`;
document.body.insertAdjacentHTML("beforeend", editMoveTriggerHtml);
const editMoveTriggerModal = document.getElementById("edit-move-trigger-modal");
const editMoveTriggerBackdrop = document.getElementById("edit-move-trigger-backdrop");
const moveTargetGroupInput = document.getElementById("move-target-group");
const moveXInput = document.getElementById("move-x");
const moveYInput = document.getElementById("move-y");
const moveTimeInput = document.getElementById("move-time");
const moveLockXInput = document.getElementById("move-lock-x");
const moveLockYInput = document.getElementById("move-lock-y");
const moveLockTimeInput = document.getElementById("move-lock-time");
const editMoveTriggerCancel = document.getElementById("edit-move-trigger-cancel");
const editMoveTriggerApply = document.getElementById("edit-move-trigger-apply");

// Rotate Trigger modal DOM
const editRotateTriggerHtml = `
  <div id="edit-rotate-trigger-backdrop" class="edit-object-backdrop" style="display:none"></div>
  <div id="edit-rotate-trigger-modal" class="edit-object-modal" style="display:none; width:520px; max-width:94%; padding:14px;">
    <h4 style="margin-top:0">Edit Rotate Trigger</h4>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:center">
      <label style="grid-column:1 / span 2"><input id="rotate-target-group" type="text" value="" placeholder="Target Group ID" style="width:100%" /></label>
      <label style="grid-column:1 / span 2"><input id="rotate-center-group" type="text" value="" placeholder="Center Group ID (optional)" style="width:100%" /></label>
      <label>Degrees <input id="rotate-degrees" type="number" value="90" step="1" style="width:100%" /></label>
      <label>Extra 360s <input id="rotate-spins" type="number" value="0" step="1" min="0" style="width:100%" /></label>
      <label style="grid-column:1 / span 2">Rotate time (s) <input id="rotate-time" type="number" value="0.6" step="0.1" min="0" style="width:100%" /></label>
      <div style="grid-column:1 / span 2;font-size:13px;color:#666">When the player passes the trigger's X, the first object with meta.group matching Target Group ID will be rotated by Degrees + (Spins*360) around the center object (if Center Group ID provided) or around its own center.</div>
      <div class="edit-object-actions" style="grid-column:1 / span 2;display:flex;justify-content:flex-end;gap:8px;margin-top:6px">
        <button id="edit-rotate-trigger-cancel" class="btn small">Cancel</button>
        <button id="edit-rotate-trigger-apply" class="btn small">Apply</button>
      </div>
    </div>
  </div>
`;
document.body.insertAdjacentHTML("beforeend", editRotateTriggerHtml);
const editRotateTriggerModal = document.getElementById("edit-rotate-trigger-modal");
const editRotateTriggerBackdrop = document.getElementById("edit-rotate-trigger-backdrop");
const rotateTargetGroupInput = document.getElementById("rotate-target-group");
const rotateCenterGroupInput = document.getElementById("rotate-center-group");
const rotateDegreesInput = document.getElementById("rotate-degrees");
const rotateSpinsInput = document.getElementById("rotate-spins");
const rotateTimeInput = document.getElementById("rotate-time");
const editRotateTriggerCancel = document.getElementById("edit-rotate-trigger-cancel");
const editRotateTriggerApply = document.getElementById("edit-rotate-trigger-apply");

// Color Trigger modal block exists — insert new Alpha Trigger modal DOM nearby (after color trigger modal)
const editAlphaTriggerHtml = `
  <div id="edit-alpha-trigger-backdrop" class="edit-object-backdrop" style="display:none"></div>
  <div id="edit-alpha-trigger-modal" class="edit-object-modal" style="display:none">
    <h4>Edit Alpha Trigger</h4>
    <div class="edit-object-row">
      <label style="flex:1">Target Group ID <input id="alpha-target-group" type="text" value="" /></label>
    </div>
    <div class="edit-object-row">
      <label style="flex:1">Opacity (0.00 - 1.00) <input id="alpha-target-opacity" type="number" min="0" max="1" step="0.05" value="1" /></label>
    </div>
    <div class="edit-object-row">
      <label style="flex:1">Fade time (s) <input id="alpha-fade-time" type="number" step="0.1" min="0" value="0.6" /></label>
    </div>
    <div style="font-size:13px;color:#666">When the player reaches the trigger's X, objects with meta.group matching Target Group ID will have their transparency (meta.alpha) changed.</div>
    <div class="edit-object-actions">
      <button id="edit-alpha-trigger-cancel" class="btn small">Cancel</button>
      <button id="edit-alpha-trigger-apply" class="btn small">Apply</button>
    </div>
  </div>
`;
document.body.insertAdjacentHTML("beforeend", editAlphaTriggerHtml);
const editAlphaTriggerModal = document.getElementById("edit-alpha-trigger-modal");
const editAlphaTriggerBackdrop = document.getElementById("edit-alpha-trigger-backdrop");
const alphaTargetGroupInput = document.getElementById("alpha-target-group");
const alphaTargetOpacityInput = document.getElementById("alpha-target-opacity");
const alphaFadeTimeInput = document.getElementById("alpha-fade-time");
const editAlphaTriggerCancel = document.getElementById("edit-alpha-trigger-cancel");
const editAlphaTriggerApply = document.getElementById("edit-alpha-trigger-apply");

// NEW: Insert Spawn Trigger edit modal DOM
const editSpawnHtml = `
  <div id="edit-spawn-backdrop" class="edit-object-backdrop" style="display:none"></div>
  <div id="edit-spawn-modal" class="edit-object-modal" style="display:none">
    <h4>Edit Spawn Trigger</h4>
    <div class="edit-object-row">
      <label style="flex:1">Target Group ID <input id="spawn-target-group" type="text" value="" placeholder="Group ID to re-enable" /></label>
    </div>
    <div style="font-size:13px;color:#666">When the player passes this trigger, triggers assigned to the Target Group will be re-enabled so they can fire again.</div>
    <div class="edit-object-actions">
      <button id="edit-spawn-cancel" class="btn small">Cancel</button>
      <button id="edit-spawn-apply" class="btn small">Apply</button>
    </div>
  </div>
`;
document.body.insertAdjacentHTML("beforeend", editSpawnHtml);
const editSpawnModal = document.getElementById("edit-spawn-modal");
const editSpawnBackdrop = document.getElementById("edit-spawn-backdrop");
const spawnTargetGroupInput = document.getElementById("spawn-target-group");
const editSpawnCancel = document.getElementById("edit-spawn-cancel");
const editSpawnApply = document.getElementById("edit-spawn-apply");

// cancel/backdrop handlers for spawn modal
editSpawnCancel.addEventListener("click", ()=>{
  editSpawnBackdrop.style.display = "none";
  editSpawnModal.style.display = "none";
});
editSpawnBackdrop.addEventListener("click", ()=>{
  editSpawnBackdrop.style.display = "none";
  editSpawnModal.style.display = "none";
});

// cancel/backdrop handlers
editAlphaTriggerCancel.addEventListener("click", ()=>{
  editAlphaTriggerBackdrop.style.display = "none";
  editAlphaTriggerModal.style.display = "none";
});
editAlphaTriggerBackdrop.addEventListener("click", ()=>{
  editAlphaTriggerBackdrop.style.display = "none";
  editAlphaTriggerModal.style.display = "none";
});

// apply: write meta to selected alpha-trigger objects
editAlphaTriggerApply.addEventListener("click", ()=>{
  const group = String(alphaTargetGroupInput.value || "").trim();
  const opacity = Number(alphaTargetOpacityInput.value);
  const alphaVal = Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1;
  const fade = Math.max(0, Number(alphaFadeTimeInput.value) || 0);
  if(editor.selectedIds && editor.selectedIds.length){
    for(const id of editor.selectedIds){
      const o = editor.objects.find(x=>x.id === id);
      if(o && o.type === "alpha-trigger"){
        if(!o.meta) o.meta = {};
        o.meta.targetGroup = group;
        o.meta.alpha = alphaVal;
        o.meta.fadeTime = fade;
      }
    }
    editor._render();
    try{ editor._saveState(); }catch(e){}
  }
  editAlphaTriggerBackdrop.style.display = "none";
  editAlphaTriggerModal.style.display = "none";
});

// NEW: cancel/backdrop handlers for Edit-Group-Trigger modal
editEditGroupTriggerCancel.addEventListener("click", ()=>{
  editEditGroupTriggerBackdrop.style.display = "none";
  editEditGroupTriggerModal.style.display = "none";
});
editEditGroupTriggerBackdrop.addEventListener("click", ()=>{
  editEditGroupTriggerBackdrop.style.display = "none";
  editEditGroupTriggerModal.style.display = "none";
});

// Rotate Trigger apply: write meta to selected rotate-trigger objects
editRotateTriggerApply.addEventListener("click", ()=>{
  const group = String(rotateTargetGroupInput.value || "");
  const centerGroup = String(rotateCenterGroupInput.value || "");
  const degrees = Number(rotateDegreesInput.value) || 0;
  const spins = Math.max(0, Number(rotateSpinsInput.value) || 0);
  const time = Math.max(0, Number(rotateTimeInput.value) || 0);
  if(editor.selectedIds && editor.selectedIds.length){
    for(const id of editor.selectedIds){
      const o = editor.objects.find(x=>x.id === id);
      if(o && o.type === "rotate-trigger"){
        if(!o.meta) o.meta = {};
        o.meta.targetGroup = group;
        o.meta.centerGroup = centerGroup;
        o.meta.degrees = degrees;
        o.meta.spins = spins;
        o.meta.rotateTime = time;
      }
    }
    editor._render();
    // record rotate-trigger meta change for undo/redo
    try{ editor._saveState(); }catch(e){}
  }
  editRotateTriggerBackdrop.style.display = "none";
  editRotateTriggerModal.style.display = "none";
});

// Move Trigger apply: write meta to selected move-trigger objects
editMoveTriggerApply.addEventListener("click", ()=>{
  const group = String(moveTargetGroupInput.value || "");
  const moveX = Number(moveXInput.value) || 0;
  const moveY = Number(moveYInput.value) || 0;
  const moveTime = Math.max(0, Number(moveTimeInput.value) || 0);
  // read lock options
  const lockX = !!moveLockXInput.checked;
  const lockY = !!moveLockYInput.checked;
  const lockTime = Math.max(0, Number(moveLockTimeInput.value) || 0);
  if(editor.selectedIds && editor.selectedIds.length){
    for(const id of editor.selectedIds){
      const o = editor.objects.find(x=>x.id === id);
      if(o && o.type === "move-trigger"){
        if(!o.meta) o.meta = {};
        o.meta.targetGroup = group;
        // store inverted Y so UI-positive means upward movement in world coords
        o.meta.moveY = -moveY;
        o.meta.moveTime = moveTime;
        // store lock flags and duration
        o.meta.lockToPlayerX = lockX;
        o.meta.lockToPlayerY = lockY;
        o.meta.lockDuration = lockTime;
      }
    }
    editor._render();
    // record move-trigger meta change for undo/redo
    try{ editor._saveState(); }catch(e){}
  }
  editMoveTriggerBackdrop.style.display = "none";
  editMoveTriggerModal.style.display = "none";
});

// Spawn modal apply: write meta to selected spawn-trigger objects
editSpawnApply.addEventListener("click", ()=>{
  const groupId = String(spawnTargetGroupInput.value || "").trim();
  if(editor.selectedIds && editor.selectedIds.length){
    for(const id of editor.selectedIds){
      const o = editor.objects.find(x=>x.id === id);
      if(o && o.type === "spawn-trigger"){
        if(!o.meta) o.meta = {};
        o.meta.targetGroup = groupId;
      }
    }
    // persist this change so it's undoable
    try{ editor._saveState(); }catch(e){}
    try{ editor._render(); }catch(e){}
  }
  editSpawnBackdrop.style.display = "none";
  editSpawnModal.style.display = "none";
});

// ------------------ Edit Nudge Modal UI ------------------
const editNudgeHtml = `
  <div id="edit-nudge-backdrop" class="edit-object-backdrop" style="display:none"></div>
  <div id="edit-nudge-modal" class="edit-object-modal" style="display:none">
    <h4>Edit Nudge Block</h4>
    <div class="edit-object-row">
      <label style="flex:1">Direction
        <select id="nudge-direction">
          <option value="right">Right ►</option>
          <option value="left">Left ◄</option>
          <option value="up">Up ▲</option>
          <option value="down">Down ▼</option>
        </select>
      </label>
    </div>
    <div class="edit-object-row">
      <label style="flex:1">Strength (grid squares) <input id="nudge-strength" type="number" min="0" step="1" value="1" /></label>
    </div>
    <div style="font-size:13px;color:#666">When the player touches the nudge block it will be shifted by Strength grid squares in the chosen direction; strength is measured in grid units.</div>
    <div class="edit-object-actions">
      <button id="edit-nudge-cancel" class="btn small">Cancel</button>
      <button id="edit-nudge-apply" class="btn small">Apply</button>
    </div>
  </div>
`;
document.body.insertAdjacentHTML("beforeend", editNudgeHtml);
const editNudgeModal = document.getElementById("edit-nudge-modal");
const editNudgeBackdrop = document.getElementById("edit-nudge-backdrop");
const nudgeDirection = document.getElementById("nudge-direction");
const nudgeStrength = document.getElementById("nudge-strength");
const editNudgeCancel = document.getElementById("edit-nudge-cancel");
const editNudgeApply = document.getElementById("edit-nudge-apply");

// extend the edit-button decision logic to include move-trigger
function hasMoveTriggerSelection(){
  if(!editor.selectedIds || editor.selectedIds.length === 0) return false;
  for(const id of editor.selectedIds){
    const o = editor.objects.find(x=>x.id === id);
    if(o && o.type === "move-trigger") return true;
  }
  return false;
}

function hasRotateTriggerSelection(){
  if(!editor.selectedIds || editor.selectedIds.length === 0) return false;
  for(const id of editor.selectedIds){
    const o = editor.objects.find(x=>x.id === id);
    if(o && o.type === "rotate-trigger") return true;
  }
  return false;
}

// NEW: helper: determine if selection contains any spawn-trigger
function hasSpawnTriggerSelection(){
  if(!editor.selectedIds || editor.selectedIds.length === 0) return false;
  for(const id of editor.selectedIds){
    const o = editor.objects.find(x=>x.id === id);
    if(o && o.type === "spawn-trigger") return true;
  }
  return false;
}

function updateEditButtonVisibility(){
  // show if there is at least one selected editable object
  editBtn.style.display = "";
  const enabled = hasEditableSelection() || hasBgTriggerSelection() || hasGTriggerSelection() || hasColorTriggerSelection() || hasMoveTriggerSelection() || hasRotateTriggerSelection() || hasNudgeSelection() || hasAlphaTriggerSelection() || hasGrTriggerSelection() || hasSpawnTriggerSelection() || (!!editor.selectedIds && editor.selectedIds.length>0);
  if(enabled){
    editBtn.classList.remove("disabled");
    editBtn.removeAttribute("disabled");
    editBtn.title = "Edit selected object(s)";
    editGroupBtn.classList.remove("disabled");
    editGroupBtn.removeAttribute("disabled");
    editGroupBtn.title = "Edit group for selected object(s)";
  } else {
    editBtn.classList.add("disabled");
    editBtn.setAttribute("disabled", "true");
    editBtn.title = "Select a Block, Decoration, BG Trigger or G Trigger to edit";
    editGroupBtn.classList.add("disabled");
    editGroupBtn.setAttribute("disabled","true");
    editGroupBtn.title = "Select object(s) to assign a group";
  }

  // Scale button enable/disable based on selection presence (allow scaling any selected)
  if(scaleBtn){
    if(editor.selectedIds && editor.selectedIds.length > 0){
      scaleBtn.classList.remove("disabled");
      scaleBtn.removeAttribute("disabled");
      scaleBtn.title = "Scale selected object(s)";
    } else {
      scaleBtn.classList.add("disabled");
      scaleBtn.setAttribute("disabled","true");
      scaleBtn.title = "Select object(s) to scale";
    }
  }

  // NEW: enable/disable the top-right deselect button to mirror Edit-panel deselect behavior
  if(deselectToprightBtn){
    if(editor.selectedIds && editor.selectedIds.length > 0){
      deselectToprightBtn.classList.remove("disabled");
      deselectToprightBtn.removeAttribute("disabled");
      deselectToprightBtn.title = "Deselect";
    } else {
      deselectToprightBtn.classList.add("disabled");
      deselectToprightBtn.setAttribute("disabled","true");
      deselectToprightBtn.title = "Nothing selected";
    }
  }

  // NEW: sync top-left header delete button enabled state with selection
  if(headerDeleteBtn){
    if(editor.selectedIds && editor.selectedIds.length > 0){
      headerDeleteBtn.classList.remove("disabled");
      headerDeleteBtn.removeAttribute("disabled");
      headerDeleteBtn.title = "Delete selected object(s)";
    } else {
      headerDeleteBtn.classList.add("disabled");
      headerDeleteBtn.setAttribute("disabled","true");
      headerDeleteBtn.title = "Nothing selected";
    }
  }
  
  // NEW: copy/paste button should only be usable when at least one object is selected
  if(copyPasteBtn){
    if(editor.selectedIds && editor.selectedIds.length > 0){
      copyPasteBtn.classList.remove("disabled");
      copyPasteBtn.removeAttribute("disabled");
      copyPasteBtn.title = "Copy/Paste selected object(s)";
    } else {
      copyPasteBtn.classList.add("disabled");
      copyPasteBtn.setAttribute("disabled","true");
      copyPasteBtn.title = "Select object(s) to duplicate";
    }
  }

  // NEW: alpha button enable/disable by selection presence (dim when none)
  if(alphaBtn){
    if(editor.selectedIds && editor.selectedIds.length > 0){
      alphaBtn.classList.remove("disabled");
      alphaBtn.removeAttribute("disabled");
      alphaBtn.title = "Set transparency for selected object(s)";
    } else {
      alphaBtn.classList.add("disabled");
      alphaBtn.setAttribute("disabled", "true");
      alphaBtn.title = "Select object(s) to set transparency";
    }
  }

  // NEW: separate copy & paste buttons state
  if(copyBtn){
    if(editor.selectedIds && editor.selectedIds.length > 0){
      copyBtn.classList.remove("disabled");
      copyBtn.removeAttribute("disabled");
      copyBtn.title = "Copy selected object(s)";
    } else {
      copyBtn.classList.add("disabled");
      copyBtn.setAttribute("disabled","true");
      copyBtn.title = "Select object(s) to copy";
    }
  }
  if(pasteBtn){
    if(_clipboard && _clipboard.length > 0){
      pasteBtn.classList.remove("disabled");
      pasteBtn.removeAttribute("disabled");
      pasteBtn.title = "Paste copied object(s)";
    } else {
      pasteBtn.classList.add("disabled");
      pasteBtn.setAttribute("disabled","true");
      pasteBtn.title = "Nothing in clipboard";
    }
  }

  // NEW: enable/disable the new side-toggle button when selection contains at least one half-hazard or platform
  if(sideToggleBtn){
    let hasTarget = false;
    if(editor.selectedIds && editor.selectedIds.length > 0){
      for(const id of editor.selectedIds){
        const o = editor.objects.find(x=>x.id === id);
        if(o && (o.type === "half-hazard" || o.type === "platform")) { hasTarget = true; break; }
      }
    }
    if(hasTarget){
      sideToggleBtn.classList.remove("disabled");
      sideToggleBtn.removeAttribute("disabled");
      sideToggleBtn.title = "Toggle selected half-hazard/platform between half-height and half-width";
      sideToggleBtn.style.opacity = ""; // fully visible
    } else {
      // disable the side-toggle button and make it visually transparent when unusable
      sideToggleBtn.classList.add("disabled");
      sideToggleBtn.setAttribute("disabled","true");
      sideToggleBtn.title = "Select half-hazard or platform to toggle shape";
      // make visually transparent when not usable
      sideToggleBtn.style.opacity = "0.45";
    }
  }

  // NEW: glue button should be usable only when two or more objects are selected; otherwise disable and make transparent
  if(glueBtn){
    const selCount = Array.isArray(editor.selectedIds) ? editor.selectedIds.length : 0;
    if(selCount >= 2){
      glueBtn.classList.remove("disabled");
      glueBtn.removeAttribute("disabled");
      glueBtn.title = "Glue physics blocks (toggle)";
      glueBtn.style.opacity = ""; // fully visible
    } else {
      // disable the glue button and make it visually transparent when unusable
      glueBtn.classList.add("disabled");
      glueBtn.setAttribute("disabled","true");
      glueBtn.title = "Select 2 or more objects to glue";
      glueBtn.style.opacity = "0.25";
      // Also ensure visual selected state is removed so it doesn't appear active when unusable
      glueBtn.classList.remove("selected");
      // make sure editor.gluePhysics is false when there's not enough selection to glue
      try{ editor.gluePhysics = false; }catch(e){}
    }
  }
}

// show modal prefilled with first selected editable object's color (or default)
editBtn.addEventListener("click", ()=>{
  if(editBtn.hasAttribute("disabled")) return;
  // if selection includes any edit-group-trigger, open its modal
  if(hasEditGroupTriggerSelection()){
    let pick = null;
    for(const id of editor.selectedIds || []){
      const o = editor.objects.find(x=>x.id === id);
      if(o && o.type === "edit-group-trigger"){ pick = o; break; }
    }
    const meta = (pick && pick.meta) || {};
    editGroupTriggerTargetInput.value = meta.targetGroup || "";
    editGroupTriggerAddInput.value = (Array.isArray(meta.addGroups) ? meta.addGroups.join(", ") : (meta.addGroups || ""));
    editGroupTriggerRemoveInput.value = (Array.isArray(meta.removeGroups) ? meta.removeGroups.join(", ") : (meta.removeGroups || ""));
    editEditGroupTriggerBackdrop.style.display = "";
    editEditGroupTriggerModal.style.display = "";
    return;
  }
  // if selection includes any bg-trigger, open BG modal
  if(hasBgTriggerSelection()){
    // pick first bg-trigger selected to prefill
    let pick = null;
    for(const id of editor.selectedIds || []){
      const o = editor.objects.find(x=>x.id === id);
      if(o && o.type === "bg-trigger"){ pick = o; break; }
    }
    const meta = (pick && pick.meta) || {};
    bgTargetColorInput.value = meta.bgColor || "#ffffff";
    bgFadeTimeInput.value = (typeof meta.fadeTime === "number") ? String(meta.fadeTime) : "0.6";
    editBgBackdrop.style.display = "";
    editBgModal.style.display = "";
    return;
  }

  // if selection includes any g-trigger, open G modal
  if(hasGTriggerSelection()){
    let pick = null;
    for(const id of editor.selectedIds || []){
      const o = editor.objects.find(x=>x.id === id);
      if(o && o.type === "g-trigger"){ pick = o; break; }
    }
    const meta = (pick && pick.meta) || {};
    gTargetPropSelect.value = meta.target || "ground";
    gTargetColorInput.value = meta.color || "#e6e6e6";
    gFadeTimeInput.value = (typeof meta.fadeTime === "number") ? String(meta.fadeTime) : "0.6";
    editGBackdrop.style.display = "";
    editGModal.style.display = "";
    return;
  }

  // if selection includes any gr-trigger, open GR modal
  if(hasGrTriggerSelection()){
    let pick = null;
    for(const id of editor.selectedIds || []){
      const o = editor.objects.find(x=>x.id === id);
      if(o && o.type === "gr-trigger"){ pick = o; break; }
    }
    const meta = (pick && pick.meta) || {};
    grTargetColorInput.value = meta.targetGridColor || "#d0d0d0";
    grFadeTimeInput.value = (typeof meta.fadeTime === "number") ? String(meta.fadeTime) : "0.6";
    editGrBackdrop.style.display = "";
    editGrModal.style.display = "";
    return;
  }

  // if selection includes any color-trigger, open Color Trigger modal
  if(hasColorTriggerSelection()){
    let pick = null;
    for(const id of editor.selectedIds || []){
      const o = editor.objects.find(x=>x.id === id);
      if(o && o.type === "color-trigger"){ pick = o; break; }
    }
    const meta = (pick && pick.meta) || {};
    colorTargetGroupInput.value = meta.targetGroup || "";
    colorTargetColorInput.value = meta.color || "#ffffff";
    colorFadeTimeInput.value = (typeof meta.fadeTime === "number") ? String(meta.fadeTime) : "0.6";
    editColorTriggerBackdrop.style.display = "";
    editColorTriggerModal.style.display = "";
    return;
  }

  // if includes alpha-trigger, open Alpha Trigger modal
  if(hasAlphaTriggerSelection()){
    let pick = null;
    for(const id of editor.selectedIds || []){
      const o = editor.objects.find(x=>x.id === id);
      if(o && o.type === "alpha-trigger"){ pick = o; break; }
    }
    const meta = (pick && pick.meta) || {};
    alphaTargetGroupInput.value = meta.targetGroup || "";
    alphaTargetOpacityInput.value = (typeof meta.alpha === "number") ? String(meta.alpha) : "1";
    alphaFadeTimeInput.value = (typeof meta.fadeTime === "number") ? String(meta.fadeTime) : "0.6";
    editAlphaTriggerBackdrop.style.display = "";
    editAlphaTriggerModal.style.display = "";
    return;
  }

  // if includes move-trigger, open Move Trigger modal
  if(hasMoveTriggerSelection()){
    let pick = null;
    for(const id of editor.selectedIds || []){
      const o = editor.objects.find(x=>x.id === id);
      if(o && o.type === "move-trigger"){ pick = o; break; }
    }
    const meta = (pick && pick.meta) || {};
    moveTargetGroupInput.value = meta.targetGroup || "";
    moveXInput.value = (typeof meta.moveX === "number") ? String(meta.moveX) : "0";
    moveYInput.value = (typeof meta.moveY === "number") ? String(meta.moveY) : "0";
    moveTimeInput.value = (typeof meta.moveTime === "number") ? String(meta.moveTime) : "0.6";
    editMoveTriggerBackdrop.style.display = "";
    editMoveTriggerModal.style.display = "";
    return;
  }

  // if includes rotate-trigger, open Rotate Trigger modal
  if(hasRotateTriggerSelection()){
    let pick = null;
    for(const id of editor.selectedIds || []){
      const o = editor.objects.find(x=>x.id === id);
      if(o && o.type === "rotate-trigger"){ pick = o; break; }
    }
    const meta = (pick && pick.meta) || {};
    rotateTargetGroupInput.value = meta.targetGroup || "";
    rotateCenterGroupInput.value = meta.centerGroup || "";
    rotateDegreesInput.value = (typeof meta.degrees === "number") ? String(meta.degrees) : "90";
    rotateSpinsInput.value = (typeof meta.spins === "number") ? String(meta.spins) : "0";
    rotateTimeInput.value = (typeof meta.rotateTime === "number") ? String(meta.rotateTime) : "0.6";
    editRotateTriggerBackdrop.style.display = "";
    editRotateTriggerModal.style.display = "";
    return;
  }

  // NEW: if selection includes any spawn-trigger, open Spawn Trigger modal
  if(hasSpawnTriggerSelection()){
    let pick = null;
    for(const id of editor.selectedIds || []){
      const o = editor.objects.find(x=>x.id === id);
      if(o && o.type === "spawn-trigger"){ pick = o; break; }
    }
    const meta = (pick && pick.meta) || {};
    spawnTargetGroupInput.value = meta.targetGroup || "";
    editSpawnBackdrop.style.display = "";
    editSpawnModal.style.display = "";
    return;
  }

  // if includes nudge, open Nudge modal
  if(hasNudgeSelection()){
    let pick = null;
    for(const id of editor.selectedIds || []){
      const o = editor.objects.find(x=>x.id === id);
      if(o && o.type === "nudge"){ pick = o; break; }
    }
    const meta = (pick && pick.meta) || {};
    nudgeDirection.value = meta.direction || "right";
    nudgeStrength.value = (typeof meta.strength === "number") ? String(meta.strength) : (meta.strength ? String(meta.strength) : "1");
    editNudgeBackdrop.style.display = "";
    editNudgeModal.style.display = "";
    return;
  }

  // NEW: if selection includes any star-light, open Star Light modal
  if(editor.selectedIds && editor.selectedIds.length){
    let pickStar = null;
    for(const id of editor.selectedIds || []){
      const o = editor.objects.find(x=>x.id === id);
      if(o && o.type === "star-light"){ pickStar = o; break; }
    }
    if(pickStar){
      const meta = pickStar.meta || {};
      starRangeInput.value = (typeof meta.range === "number") ? String(meta.range) : "120";
      starTintColorInput.value = meta.tintColor || "#cfe9ff";
      starTintStrengthInput.value = (typeof meta.tintStrength === "number") ? String(meta.tintStrength) : "0.6";
      editStarBackdrop.style.display = "";
      editStarModal.style.display = "";
      return;
    }
  }

  // otherwise fallback to original block/decoration color modal
  let pickColor = "#ffffff";
  let pickCollision = "decoration";
  let selectionHasCustom = false; // NEW: detect if any selected is custom
  for(const id of editor.selectedIds || []){
    const o = editor.objects.find(x=>x.id === id);
    if(o && (o.type === "block" || o.type === "decoration" || o.type === "custom" || o.type === "bobby")){
      pickColor = o.color || pickColor;
      if(o.meta && o.meta.collision) pickCollision = o.meta.collision;
      if(o.type === "custom") selectionHasCustom = true;
      break;
    }
  }
  editColorInput.value = pickColor;
  editCollisionSelect.value = pickCollision || "decoration";
  editImageInput.value = ""; // reset file input
  // show image upload only when the selection contains a custom object
  if(editImageRow) editImageRow.style.display = selectionHasCustom ? "" : "none";
  // show collision controls and info only when selection contains a custom object
  const collisionRow = document.getElementById("edit-collision-row");
  const collisionInfo = document.getElementById("edit-collision-info");
  if(collisionRow) collisionRow.style.display = selectionHasCustom ? "" : "none";
  if(collisionInfo) collisionInfo.style.display = selectionHasCustom ? "" : "none";
  editBackdrop.style.display = "";
  editModal.style.display = "";
});

editCancel.addEventListener("click", ()=>{
  editBackdrop.style.display = "none";
  editModal.style.display = "none";
});
editBackdrop.addEventListener("click", ()=>{
  editBackdrop.style.display = "none";
  editModal.style.display = "none";
});

editApply.addEventListener("click", async ()=>{
  const val = editColorInput.value;
  const collision = editCollisionSelect.value || "decoration";
  // read uploaded file (if any)
  const file = editImageInput.files && editImageInput.files[0];
  let dataUrl = null;
  if(file){
    dataUrl = await new Promise((res)=> {
      const r = new FileReader();
      r.onload = ()=>res(r.result);
      r.readAsDataURL(file);
    });
  }

  // apply to all selected objects that are block or decoration or custom
  if(editor.selectedIds && editor.selectedIds.length){
    for(const id of [...editor.selectedIds]){
      const o = editor.objects.find(x=>x.id === id);
      if(!o) continue;
      // apply solid color for blocks/decoration/hazards/platforms, and apply as tint for bobby textures
      if(o.type === "block" || o.type === "decoration" || o.type === "hazard" || o.type === "half-hazard" || o.type === "platform"){
        o.color = val;
        // NOTE: collision no longer applied to Block/Decoration/Hazard/Platform here (exclusive to Custom)
      } else if(o.type === "bobby"){
        // store color on Bobby object so renderer tints texture
        o.color = val;
        // don't set collision for Bobby
      } else if(o.type === "custom"){
        // custom: set color, collision and optionally apply uploaded image (stored in meta.imageSrc)
        o.color = val;
        o.meta = o.meta || {};
        o.meta.collision = collision;
        if(dataUrl){
          o.meta.imageSrc = dataUrl;
          // ensure renderer reloads the new image by clearing any cached Image for this object id
          if(editor && editor._assets && editor._assets.customImages) delete editor._assets.customImages[o.id];
        }
      }
    }
    // re-render
    editor._render();
    // record this change so undo/redo preserves the color/image/collision edits
    try{ editor._saveState(); }catch(e){}
  }
  editBackdrop.style.display = "none";
  editModal.style.display = "none";
  // hide image row after apply to keep modal consistent next time (it will be shown conditionally on open)
  if(editImageRow) editImageRow.style.display = "none";
  // refresh labels, editor render and toolbar state
  editor._render();
  editor.onZoomChange && editor.onZoomChange(editor.zoom);
  requestAnimationFrame(updateEditButtonVisibility);
});

// BG modal cancel handlers
editBgCancel.addEventListener("click", ()=>{
  editBgBackdrop.style.display = "none";
  editBgModal.style.display = "none";
});
editBgBackdrop.addEventListener("click", ()=>{
  editBgBackdrop.style.display = "none";
  editBgModal.style.display = "none";
});

// BG modal apply: write meta to selected bg-trigger objects
editBgApply.addEventListener("click", ()=>{
  const color = bgTargetColorInput.value;
  const fade = Math.max(0, Number(bgFadeTimeInput.value) || 0);
  if(editor.selectedIds && editor.selectedIds.length){
    for(const id of editor.selectedIds){
      const o = editor.objects.find(x=>x.id === id);
      if(o && o.type === "bg-trigger"){
        if(!o.meta) o.meta = {};
        o.meta.bgColor = color;
        o.meta.fadeTime = fade;
      }
    }
    editor._render();
    // save state so BG-trigger meta changes are undoable
    try{ editor._saveState(); }catch(e){}
    try{ editor._render(); }catch(e){}
  }
  editBgBackdrop.style.display = "none";
  editBgModal.style.display = "none";
});

// G modal cancel handlers
editGCancel.addEventListener("click", ()=>{
  editGBackdrop.style.display = "none";
  editGModal.style.display = "none";
});
editGBackdrop.addEventListener("click", ()=>{
  editGBackdrop.style.display = "none";
  editGModal.style.display = "none";
});

// G modal apply: write meta to selected g-trigger objects
editGApply.addEventListener("click", ()=>{
  const prop = gTargetPropSelect.value || "ground";
  const color = gTargetColorInput.value;
  const fade = Math.max(0, Number(gFadeTimeInput.value) || 0);
  if(editor.selectedIds && editor.selectedIds.length){
    for(const id of editor.selectedIds){
      const o = editor.objects.find(x=>x.id === id);
      if(o && o.type === "g-trigger"){
        if(!o.meta) o.meta = {};
        o.meta.target = prop; // "ground" or "outline"
        o.meta.color = color;
        o.meta.fadeTime = fade;
      }
    }
    // persist this change so it's undoable
    try{ editor._saveState(); }catch(e){}
    try{ editor._render(); }catch(e){}
  }
  editGBackdrop.style.display = "none";
  editGModal.style.display = "none";
});

// GR modal apply: write meta to selected gr-trigger objects
editGrApply.addEventListener("click", ()=>{
  const color = grTargetColorInput.value || "#d0d0d0";
  const fade = Math.max(0, Number(grFadeTimeInput.value) || 0);
  if(editor.selectedIds && editor.selectedIds.length){
    for(const id of editor.selectedIds){
      const o = editor.objects.find(x=>x.id === id);
      if(o && o.type === "gr-trigger"){
        if(!o.meta) o.meta = {};
        o.meta.targetGridColor = color;
        o.meta.fadeTime = fade;
      }
    }
    editor._render();
    try{ editor._saveState(); }catch(e){}
  }
  editGrBackdrop.style.display = "none";
  editGrModal.style.display = "none";
});

// NEW: cancel/backdrop handlers for Nudge modal
editNudgeCancel.addEventListener("click", ()=>{
  editNudgeBackdrop.style.display = "none";
  editNudgeModal.style.display = "none";
});
editNudgeBackdrop.addEventListener("click", ()=>{
  editNudgeBackdrop.style.display = "none";
  editNudgeModal.style.display = "none";
});

// NEW: apply handler for Nudge modal - persist meta to selected nudge objects
editNudgeApply.addEventListener("click", ()=>{
  const dir = String(nudgeDirection.value || "right");
  const strength = Math.max(0, Number(nudgeStrength.value) || 1);
  if(editor.selectedIds && editor.selectedIds.length){
    for(const id of editor.selectedIds){
      const o = editor.objects.find(x=>x.id === id);
      if(o && o.type === "nudge"){
        if(!o.meta) o.meta = {};
        o.meta.direction = dir;
        o.meta.strength = strength;
      }
    }
    // persist change and re-render
    try{ editor._saveState(); }catch(e){}
    try{ editor._render(); }catch(e){}
  }
  editNudgeBackdrop.style.display = "none";
  editNudgeModal.style.display = "none";
});

// Add handlers to make Edit Group modal Cancel and Apply buttons functional
editGroupCancel.addEventListener("click", ()=>{
  editGroupBackdrop.style.display = "none";
  editGroupModal.style.display = "none";
});
editGroupBackdrop.addEventListener("click", ()=>{
  editGroupBackdrop.style.display = "none";
  editGroupModal.style.display = "none";
});

editGroupApply.addEventListener("click", ()=>{
  const groupId = String(groupIdInput.value || "").trim();
  if(editor.selectedIds && editor.selectedIds.length){
    for(const id of editor.selectedIds){
      const o = editor.objects.find(x => x.id === id);
      if(!o) continue;
      if(!o.meta) o.meta = {};
      // Apply group id (empty string clears existing group)
      if(groupId === "") delete o.meta.group;
      else o.meta.group = groupId;
    }
    // persist this change so it's undoable
    try{ editor._saveState(); }catch(e){}
    try{ editor._render(); }catch(e){}
  }
  editGroupBackdrop.style.display = "none";
  editGroupModal.style.display = "none";
});

// keep the edit-button visibility in sync when selection changes.
// The editor selects objects internally on pointerup; listen for pointerup on canvas.
canvas.addEventListener("pointerup", ()=> requestAnimationFrame(updateEditButtonVisibility));
// also update when deletion/deselect operations run from UI
deselectBtn.addEventListener("click", ()=> requestAnimationFrame(updateEditButtonVisibility));
deleteBtn.addEventListener("click", ()=> requestAnimationFrame(updateEditButtonVisibility));
// also when multi-select toggled or edit tab opened (selection semantics may change)
if(multiSelectBtn){
  multiSelectBtn.addEventListener("click", ()=> requestAnimationFrame(updateEditButtonVisibility));
  tabEdit.addEventListener("click", ()=> requestAnimationFrame(updateEditButtonVisibility));
}
// initial check (ensure group button exists and is updated)
if(editGroupBtn) editGroupBtn.style.display = "";
updateEditButtonVisibility();

window.addEventListener("resize", ()=> editor.resize());
editor.resize();
editor.start();

// NEW: implement the side-toggle click behavior
if(sideToggleBtn){
  sideToggleBtn.addEventListener("click", ()=>{
    if(sideToggleBtn.hasAttribute("disabled")) return;
    if(!editor.selectedIds || editor.selectedIds.length === 0) return;
    let changed = false;
    for(const id of [...editor.selectedIds]){
      const o = editor.objects.find(x=>x.id === id);
      if(!o) continue;
      if(o.type === "half-hazard" || o.type === "platform"){
        // If currently half-width (w < h), convert to half-height (w=32,h=16); otherwise convert to half-width (w=16,h=32)
        if(Number(o.w) < Number(o.h)){
          o.w = 32;
          o.h = 16;
        } else {
          o.w = 16;
          o.h = 32;
        }
        changed = true;
      }
    }
    if(changed){
      try{ editor._saveState(); }catch(e){}
      try{ editor._render(); }catch(e){}
      requestAnimationFrame(updateEditButtonVisibility);
    }
  });
}

// NEW: make top-right deselect button functional
if(deselectToprightBtn){
  deselectToprightBtn.addEventListener("click", ()=>{
    if(deselectToprightBtn.hasAttribute("disabled")) return;
    editor.deselect();
    // update UI state to reflect no selection
    requestAnimationFrame(updateEditButtonVisibility);
  });
}

// After editor.start(); add creation of on-screen move buttons and wiring:
(function initPlatformerButtons(){
  const wrap = document.createElement("div");
  wrap.className = "platformer-move-wrap hidden";
  wrap.id = "platformer-move-wrap";
  wrap.innerHTML = `<button id="platformer-left" class="btn" title="Move Left">◀</button><button id="platformer-right" class="btn" title="Move Right">▶</button>`;
  const canvasWrap = document.getElementById("canvas-wrap");
  canvasWrap.appendChild(wrap);
  const left = document.getElementById("platformer-left");
  const right = document.getElementById("platformer-right");
  // helper to update visibility based on editor.platformerMode and player.running
  function updatePlatformerButtons(){
    if(editor.platformerMode && player.running){
      wrap.classList.remove("hidden");
    } else {
      wrap.classList.add("hidden");
    }
  }
  // pointer-down/up handlers for touch / mouse hold behaviour
  left.addEventListener("pointerdown", (e)=>{ e.preventDefault(); if(!player.running) return; player.moveLeft = true; });
  left.addEventListener("pointerup", (e)=>{ e.preventDefault(); player.moveLeft = false; });
  left.addEventListener("pointercancel", ()=>{ player.moveLeft = false; });
  left.addEventListener("pointerout", ()=>{ player.moveLeft = false; });
  right.addEventListener("pointerdown", (e)=>{ e.preventDefault(); if(!player.running) return; player.moveRight = true; });
  right.addEventListener("pointerup", (e)=>{ e.preventDefault(); player.moveRight = false; });
  right.addEventListener("pointercancel", ()=>{ player.moveRight = false; });
  right.addEventListener("pointerout", ()=>{ player.moveRight = false; });

  // update when run starts/stops or setting changes
  // show/hide when play toggles
  playBtn.addEventListener("click", ()=> setTimeout(updatePlatformerButtons, 10));
  // update when settings saved
  settingsSave.addEventListener("click", ()=> setTimeout(updatePlatformerButtons, 10));
  // also update on editor.import / load completion inside file-input handler after editor.import(...) call
  // we add a small observer here: poll editor.platformerMode on save/load or other UI events
  window.addEventListener("focus", updatePlatformerButtons);
  // make sure player stops movement when run stops
  const origPlayHandler = playBtn.onclick;
  playBtn.onclick = function(...args){
    if(origPlayHandler) origPlayHandler(...args);
    if(!player.running){
      player.moveLeft = false; player.moveRight = false;
      updatePlatformerButtons();
    }
  };
  // initial state
  updatePlatformerButtons();
})();

// helper: determine if selection contains any star-light
function hasStarLightSelection(){
  if(!editor.selectedIds || editor.selectedIds.length === 0) return false;
  for(const id of editor.selectedIds){
    const o = editor.objects.find(x=>x.id === id);
    if(o && o.type === "star-light") return true;
  }
  return false;
}

// Insert Star Light edit modal DOM
const editStarHtml = `
  <div id="edit-star-backdrop" class="edit-object-backdrop" style="display:none"></div>
  <div id="edit-star-modal" class="edit-object-modal" style="display:none">
    <h4>Edit Star Light</h4>
    <div class="edit-object-row">
      <label style="flex:1">Range (px) <input id="star-range" type="number" min="8" step="4" value="120" /></label>
    </div>
    <div class="edit-object-row">
      <label style="flex:1">Tint Color <input id="star-tint-color" type="color" value="#cfe9ff" /></label>
    </div>
    <div class="edit-object-row">
      <label style="flex:1">Tint Strength (0.0-1.0) <input id="star-tint-strength" type="number" min="0" max="1" step="0.05" value="0.6" /></label>
    </div>
    <div style="font-size:13px;color:#666">Star Light reveals a tinted area in-game; range is between flashlight and dark crystal by default.</div>
    <div class="edit-object-actions">
      <button id="edit-star-cancel" class="btn small">Cancel</button>
      <button id="edit-star-apply" class="btn small">Apply</button>
    </div>
  </div>
`;
document.body.insertAdjacentHTML("beforeend", editStarHtml);
const editStarModal = document.getElementById("edit-star-modal");
const editStarBackdrop = document.getElementById("edit-star-backdrop");
const starRangeInput = document.getElementById("star-range");
const starTintColorInput = document.getElementById("star-tint-color");
const starTintStrengthInput = document.getElementById("star-tint-strength");
const editStarCancel = document.getElementById("edit-star-cancel");
const editStarApply = document.getElementById("edit-star-apply");

editStarCancel.addEventListener("click", ()=>{
  editStarBackdrop.style.display = "none";
  editStarModal.style.display = "none";
});
editStarBackdrop.addEventListener("click", ()=>{
  editStarBackdrop.style.display = "none";
  editStarModal.style.display = "none";
});

// Edit button: open star-light modal when star-light selected (insert into editBtn click branch earlier)
/* locate in the large editBtn click handler: after other specific-type checks and before default color modal,
   add the following branch (we'll place it near alpha-trigger/move-trigger checks earlier). */

// apply: write meta to selected star-light objects
editStarApply.addEventListener("click", ()=>{
  const range = Math.max(8, Number(starRangeInput.value) || 120);
  const tint = String(starTintColorInput.value || "#cfe9ff");
  const strength = Math.max(0, Math.min(1, Number(starTintStrengthInput.value) || 0.6));
  if(editor.selectedIds && editor.selectedIds.length){
    for(const id of editor.selectedIds){
      const o = editor.objects.find(x=>x.id === id);
      if(o && o.type === "star-light"){
        if(!o.meta) o.meta = {};
        o.meta.range = range;
        o.meta.tintColor = tint;
        o.meta.tintStrength = strength;
      }
    }
    editor._render();
    try{ editor._saveState(); }catch(e){}
  }
  editStarBackdrop.style.display = "none";
  editStarModal.style.display = "none";
});
