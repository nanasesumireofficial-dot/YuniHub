/* Dehbify background: rotating green/purple 3D plexus (points + connecting wireframe lines). */
const GREEN = [57, 255, 150];
const PURPLE = [168, 85, 247];
const COUNT = 95;
const LINK = 0.34;      // link distance in normalized 3D space
const SPIN = 0.00018;   // radians per ms

let canvas = null, ctx = null, raf = 0, last = 0, angle = 0;
let pts = [], w = 0, h = 0, dpr = 1, reduced = false;
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

function seed() {
  pts = Array.from({ length: COUNT }, (_, i) => ({
    x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() * 2 - 1,
    vx: (Math.random() - .5) * .00006, vy: (Math.random() - .5) * .00006, vz: (Math.random() - .5) * .00006,
    c: i % 2 ? GREEN : PURPLE
  }));
}

function resize() {
  if (!canvas) return;
  dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  w = window.innerWidth; h = window.innerHeight;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (reduced) frame(0);
}

function onMove(e) {
  mouse.tx = (e.clientX / (window.innerWidth || 1) - .5) * 2;
  mouse.ty = (e.clientY / (window.innerHeight || 1) - .5) * 2;
}

function frame(dt) {
  if (!ctx) return;
  if (!reduced) {
    angle += SPIN * dt;
    mouse.x += (mouse.tx - mouse.x) * .04; mouse.y += (mouse.ty - mouse.y) * .04;
    for (const p of pts) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.x > 1 || p.x < -1) p.vx *= -1;
      if (p.y > 1 || p.y < -1) p.vy *= -1;
      if (p.z > 1 || p.z < -1) p.vz *= -1;
    }
  }
  const ay = angle + mouse.x * .25, ax = mouse.y * .18 + Math.sin(angle * 1.7) * .08;
  const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
  const scale = Math.min(w, h) * .62, fov = 2.6;
  const proj = pts.map((p) => {
    const x1 = p.x * cy + p.z * sy, z1 = -p.x * sy + p.z * cy;
    const y2 = p.y * cx - z1 * sx, z2 = p.y * sx + z1 * cx;
    const k = fov / (fov + z2 + 1.2);
    return { sx: w / 2 + x1 * scale * k * 1.45, sy: h / 2 + y2 * scale * k, x: x1, y: y2, z: z2, k, c: p.c };
  });

  ctx.clearRect(0, 0, w, h);
  ctx.lineWidth = 1;
  for (let i = 0; i < proj.length; i++) {
    const a = proj[i];
    for (let j = i + 1; j < proj.length; j++) {
      const b = proj[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      if (d > LINK) continue;
      const depth = Math.max(.18, Math.min(1, (a.k + b.k) / 2 * 1.1));
      const alpha = (1 - d / LINK) * .55 * depth;
      const g = ctx.createLinearGradient(a.sx, a.sy, b.sx, b.sy);
      g.addColorStop(0, `rgba(${a.c[0]},${a.c[1]},${a.c[2]},${alpha})`);
      g.addColorStop(1, `rgba(${b.c[0]},${b.c[1]},${b.c[2]},${alpha})`);
      ctx.strokeStyle = g;
      ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
    }
  }
  for (const p of proj) {
    const r = 1.2 + p.k * 1.9;
    const a = Math.max(.35, Math.min(1, p.k));
    ctx.fillStyle = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${a})`;
    ctx.shadowColor = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},.9)`;
    ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function loop(t) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min(64, t - (last || t));
  last = t;
  frame(dt);
}

function onVisibility() {
  if (!canvas || reduced) return;
  if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
  else if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
}

function stop() {
  cancelAnimationFrame(raf); raf = 0;
  window.removeEventListener('resize', resize);
  window.removeEventListener('mousemove', onMove);
  document.removeEventListener('visibilitychange', onVisibility);
  if (canvas) canvas.remove();
  canvas = null; ctx = null;
}

export function setPlexus(enabled, reduceMotion) {
  const wantReduced = !!reduceMotion;
  if (!enabled) { stop(); return; }
  if (canvas && wantReduced === reduced) return;
  stop();
  reduced = wantReduced;
  canvas = document.createElement('canvas');
  canvas.id = 'plexus';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  ctx = canvas.getContext('2d');
  if (!pts.length) seed();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibility);
  resize();
  if (reduced) { frame(0); return; }
  window.addEventListener('mousemove', onMove, { passive: true });
  raf = requestAnimationFrame(loop);
}
