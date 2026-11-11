// Rök och konfetti på en egen canvas över hela skärmen.

/* ---------- Rök och konfetti på en egen canvas ---------- */
const fx = $("fx"), fctx = fx.getContext("2d");
let particles = [], fxOn = false;
function fxSize() { const d = devicePixelRatio || 1; fx.width = innerWidth * d; fx.height = innerHeight * d; fctx.setTransform(d, 0, 0, d, 0, 0); }
fxSize(); addEventListener("resize", fxSize);
function smoke() {
  const w = innerWidth, h = innerHeight;
  for (let i = 0; i < 70; i++) particles.push({ k: "s", x: Math.random() * w, y: h + Math.random() * 80, r: 50 + Math.random() * 70, vx: (Math.random() - .5) * .5, vy: -(0.5 + Math.random() * 1.3), life: 0, max: 240 + Math.random() * 160 });
}
function confetti() {
  const w = innerWidth, h = innerHeight, cols = ["#e2481e", "#c19c61", "#ffffff", "#e86d4b", "#f2c12e"];
  for (const side of [0, 1]) for (let i = 0; i < 130; i++) particles.push({
    k: "c", x: side ? w - 10 : 10, y: h - 10, vx: (side ? -1 : 1) * (3 + Math.random() * 9), vy: -(11 + Math.random() * 11),
    rot: Math.random() * 6, vr: (Math.random() - .5) * .4, w: 6 + Math.random() * 6, h: 9 + Math.random() * 9, col: cols[i % cols.length], life: 0, max: 320
  });
  for (let i = 0; i < 80; i++) particles.push({ k: "c", x: Math.random() * w, y: -20 - Math.random() * 200, vx: (Math.random() - .5) * 2, vy: 2 + Math.random() * 2,
    rot: Math.random() * 6, vr: (Math.random() - .5) * .3, w: 6 + Math.random() * 6, h: 9 + Math.random() * 9, col: cols[i % cols.length], life: 0, max: 360 });
}
function fxLoop() {
  fctx.clearRect(0, 0, innerWidth, innerHeight);
  particles = particles.filter(p => p.life < p.max);
  for (const p of particles) {
    p.life++;
    if (p.k === "s") {
      p.x += p.vx; p.y += p.vy; p.r += .35;
      const a = Math.min(1, p.life / 40) * Math.max(0, 1 - p.life / p.max) * .32;
      const g = fctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g.addColorStop(0, `rgba(225,220,235,${a})`); g.addColorStop(1, "rgba(225,220,235,0)");
      fctx.fillStyle = g; fctx.beginPath(); fctx.arc(p.x, p.y, p.r, 0, 7); fctx.fill();
    } else {
      p.vy += .22; p.vx *= .99; p.vy = Math.min(p.vy, 4.5); p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      fctx.save(); fctx.translate(p.x, p.y); fctx.rotate(p.rot); fctx.scale(1, Math.cos(p.life * .15));
      fctx.fillStyle = p.col; fctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); fctx.restore();
    }
  }
  if (particles.length) requestAnimationFrame(fxLoop); else { fxOn = false; fctx.clearRect(0, 0, innerWidth, innerHeight); }
}
function fxStart() { if (reduceMotion) { particles = []; return; } if (!fxOn) { fxOn = true; requestAnimationFrame(fxLoop); } }
