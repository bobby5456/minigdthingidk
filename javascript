/* ...existing code... */
    } else if(o.id === "strong-orb"){
-      // strong orb preview: circular gold orb matching in-game appearance
-      btn.innerHTML = `<div class="obj-preview" style="width:${Math.max(24, Math.min(48,o.w))}px;height:${Math.max(24,Math.min(48,o.h))}px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 30% 30%, #fff6d6, ${o.color}); box-shadow: 0 6px 18px rgba(255,180,40,0.12), 0 0 18px rgba(255,180,40,0.08)"><div style="width:60%;height:60%;border-radius:50%;background:rgba(255,255,255,0.28)"></div></div><div class="hint">${o.name}</div>`;
+      // strong orb preview: render as a square container with a perfectly circular orb (prevents wide/flattened preview)
+      const size = Math.max(24, Math.min(40, o.h || o.w || 32));
+      btn.innerHTML = `<div class="obj-preview" style="width:${size}px;height:${size}px;border-radius:6px;overflow:visible;display:flex;align-items:center;justify-content:center"><div style="width:${Math.round(size*0.85)}px;height:${Math.round(size*0.85)}px;border-radius:50%;background:radial-gradient(circle at 30% 30%, #fff6d6, ${o.color}); box-shadow: 0 6px 18px rgba(255,180,40,0.12), 0 0 18px rgba(255,180,40,0.08);display:flex;align-items:center;justify-content:center"><div style="width:50%;height:50%;border-radius:50%;background:rgba(255,255,255,0.28)"></div></div></div><div class="hint">${o.name}</div>`;
/* ...existing code... */

