/* =========================================================
   CyberSafe — main.js
   1. Плавен скрол + навигация
   2. 3D катинар с комбинация (Three.js) — върти се с мишката,
      а при скрол набира комбинацията 3-7-1-9-4 и се заключва
   3. Анимации при скрол
   4. Проверка на парола + генератор
   5. Тест с три нива
   6. Библиотека с измами (страничен панел)
   7. Симулатор на фишинг
   8. Речник
   9. Център за реакция (чеклисти)
   ========================================================= */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { questionBank, scamData, glossaryTerms, incidentCases } from './data.js';

const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (RM) document.documentElement.classList.add('rm');
const isMobile = () => window.innerWidth <= 640;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

gsap.registerPlugin(ScrollTrigger);

/* =========================================================
   1. ПЛАВЕН СКРОЛ + НАВИГАЦИЯ
   ========================================================= */
let lenis = null;
if (!RM) {
  lenis = new Lenis({ lerp: 0.11 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
function scrollToTarget(target) {
  if (!target) return;
  if (lenis) lenis.scrollTo(target, { offset: -70, duration: 1.4 });
  else target.scrollIntoView({ behavior: 'smooth' });
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.hasAttribute('data-open-scam') || a.hasAttribute('data-open-incident')) return;
  const id = a.getAttribute('href');
  const target = id === '#top' ? document.body : $(id);
  if (!target) return;
  e.preventDefault();
  closeMenu();
  if (id === '#top') { lenis ? lenis.scrollTo(0, { duration: 1.6 }) : window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  scrollToTarget(target);
});

const nav = $('#nav');
const menuBtn = $('#menuBtn');
const navLinks = $('#navLinks');
function closeMenu() { navLinks.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
menuBtn.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  menuBtn.setAttribute('aria-expanded', String(open));
});
ScrollTrigger.create({ start: 40, end: 'max', onToggle: (s) => nav.classList.toggle('scrolled', s.isActive) });

/* =========================================================
   2. 3D КАТИНАР С КОМБИНАЦИЯ
   ========================================================= */
const COMBO = [3, 7, 1, 9, 4];
const SEG0 = 0.1, SEG = 0.15;              // всеки навик заема 15% от закачения скрол
const DEG = Math.PI / 180;

// Предварително изчисляваме ъглите на диска за всяка цифра (редуваме посоката, като истински катинар)
const comboAngles = [0];
COMBO.forEach((d, i) => {
  const prev = comboAngles[comboAngles.length - 1];
  const dir = i % 2 === 0 ? -1 : 1;
  const target = d * 36;
  let delta = (((dir > 0 ? target - prev : prev - target) % 360) + 360) % 360;
  if (delta < 150) delta += 360;
  comboAngles.push(prev + dir * delta);
});
function scriptedAngle(p) {              // ъгъл на диска (градуси) за даден прогрес на скрола
  for (let i = 0; i < COMBO.length; i++) {
    const a = SEG0 + i * SEG, b = a + SEG * 0.62;
    if (p < a) return comboAngles[i];
    if (p < b) { const t = smooth(a, b, p); return comboAngles[i] + (comboAngles[i + 1] - comboAngles[i]) * t; }
  }
  return comboAngles[COMBO.length];
}

const L = { p: 0, free: 0, freeVel: 0, dragging: false, tiltX: 0, tiltY: 0, px: 0, py: 0, lockAmt: 0 };
let lock3d = null;
try { lock3d = await initLock(); } catch (err) { console.warn('3D не е наличен:', err); $('#lockCanvas').style.display = 'none'; }

async function initLock() {
  const canvas = $('#lockCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 14);
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-4, 6, 8);
  const fill = new THREE.DirectionalLight(0xc8f03c, 0.5); fill.position.set(6, -3, 4);
  scene.add(new THREE.AmbientLight(0xffffff, 0.45), key, fill);

  const root = new THREE.Group();    // позиция/мащаб според екрана
  const tilt = new THREE.Group();    // накланяне към мишката
  root.add(tilt); scene.add(root);

  /* --- Материали --- */
  const graphite = new THREE.MeshPhysicalMaterial({ color: 0x24272a, roughness: 0.42, metalness: 0.25, clearcoat: 0.7, clearcoatRoughness: 0.3 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd9d9d6, metalness: 1, roughness: 0.14 });
  const lime = new THREE.MeshStandardMaterial({ color: 0xc8f03c, roughness: 0.35, emissive: 0x3a4a00, emissiveIntensity: 0.4 });

  /* --- Тяло --- */
  const R = 2, DEPTH = 0.8, BEVEL = 0.28;
  const circle = new THREE.Shape(); circle.absarc(0, 0, R, 0, Math.PI * 2);
  const bodyGeo = new THREE.ExtrudeGeometry(circle, { depth: DEPTH, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 8, curveSegments: 96 });
  bodyGeo.translate(0, 0, -DEPTH / 2);
  const body = new THREE.Mesh(bodyGeo, graphite);
  tilt.add(body);
  const FRONT = DEPTH / 2 + BEVEL;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.78, 0.07, 16, 120), chrome);
  ring.position.z = FRONT - 0.02; tilt.add(ring);

  // маркер (лаймов триъгълник) отгоре
  const marker = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 3), lime);
  marker.rotation.z = Math.PI; marker.position.set(0, 1.62, FRONT + 0.08); tilt.add(marker);

  /* --- Диск с цифри --- */
  await document.fonts.ready;
  const tex = dialTexture();
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const dial = new THREE.Group();
  dial.position.z = FRONT + 0.02;
  tilt.add(dial);
  const dialGeo = new THREE.CylinderGeometry(1.45, 1.5, 0.28, 120);
  dialGeo.rotateX(Math.PI / 2);
  const face = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.5, clearcoat: 0.4 });
  const dialMesh = new THREE.Mesh(dialGeo, graphite);
  dialMesh.position.z = 0.14; dial.add(dialMesh);
  const faceMesh = new THREE.Mesh(new THREE.CircleGeometry(1.44, 120), face);   // лицевата страна с цифрите
  faceMesh.position.z = 0.285; dial.add(faceMesh);
  // назъбен ръб
  const knurl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.13, 0.26), graphite, 90);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    v.set(Math.sin(a) * 1.52, Math.cos(a) * 1.52, 0.14);
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -a);
    knurl.setMatrixAt(i, m4.compose(v, q, s1));
  }
  dial.add(knurl);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 0.36, 48).rotateX(Math.PI / 2), chrome);
  knob.position.z = 0.42; dial.add(knob);
  const knobDot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), lime);
  knobDot.position.set(0, 0.24, 0.6); dial.add(knobDot);

  /* --- Скоба (шакъл) --- */
  const LEG = 1.05, ARC_Y = 1.45;
  class Shackle extends THREE.Curve {      // U-образна крива; лявото рамо е по-дълго
    getPoint(t, out = new THREE.Vector3()) {
      const a = 0.38, b = 0.62;              // лявo рамо / дъга / дясно рамо
      if (t < a) { const k = t / a; return out.set(0, -0.8 + k * (ARC_Y + 0.8), 0); }
      if (t < b) { const k = (t - a) / (b - a); const th = Math.PI - k * Math.PI; return out.set(LEG + Math.cos(th) * LEG, ARC_Y + Math.sin(th) * LEG, 0); }
      const k = (t - b) / (1 - b); return out.set(2 * LEG, ARC_Y - k * ARC_Y, 0);
    }
  }
  const shackle = new THREE.Mesh(new THREE.TubeGeometry(new Shackle(), 160, 0.26, 24, false), chrome);
  const shPivot = new THREE.Group();
  shPivot.position.set(-LEG, 1.4, 0);
  shPivot.add(shackle);
  tilt.add(shPivot);

  /* --- Мека сянка под катинара --- */
  const sc = document.createElement('canvas'); sc.width = sc.height = 128;
  const sg = sc.getContext('2d');
  const grd = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(22,24,26,0.32)'); grd.addColorStop(1, 'rgba(22,24,26,0)');
  sg.fillStyle = grd; sg.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 1.3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.position.set(0, -2.9, -0.5);
  root.add(shadow);

  function dialTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 1024;
    const g = c.getContext('2d');
    g.fillStyle = '#f6f2ea'; g.fillRect(0, 0, 1024, 1024);
    g.translate(512, 512);
    g.strokeStyle = '#16181a'; g.fillStyle = '#16181a';
    for (let i = 0; i < 50; i++) {                 // деления
      const a = (i / 50) * Math.PI * 2, major = i % 5 === 0;
      g.lineWidth = major ? 9 : 4;
      const r1 = major ? 400 : 430, r2 = 480;
      g.beginPath(); g.moveTo(Math.sin(a) * r1, -Math.cos(a) * r1); g.lineTo(Math.sin(a) * r2, -Math.cos(a) * r2); g.stroke();
    }
    g.font = '800 92px Manrope, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let d = 0; d < 10; d++) {                 // цифрите вървят по часовниковата стрелка
      const a = d * 36 * DEG;
      g.save(); g.rotate(a); g.translate(0, -325);
      g.fillStyle = '#16181a'; g.fillText(String(d), 0, 4); g.restore();
    }
    g.fillStyle = '#c8f03c'; g.beginPath(); g.arc(0, 0, 200, 0, Math.PI * 2); g.fill();
    g.lineWidth = 6; g.strokeStyle = '#16181a'; g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* --- Подредба според екрана --- */
  function layout() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (isMobile()) { root.position.set(0.45, 1.3, 0); root.scale.setScalar(0.4); }
    else if (w < 1100) { root.position.set(2.2, -0.55, 0); root.scale.setScalar(0.64); }
    else { root.position.set(2.75, -0.55, 0); root.scale.setScalar(0.74); }
  }
  layout();
  window.addEventListener('resize', layout);

  /* --- Кадър --- */
  let t = 0;
  const center = new THREE.Vector3();
  function frame(dt) {
    t += dt;
    // свободно въртене (влачене) — снапва към най-близката цифра
    if (!L.dragging) {
      const snap = Math.round(L.free / 36) * 36;
      L.freeVel += (snap - L.free) * 0.08;
      L.freeVel *= 0.78;
      L.free += L.freeVel;
    }
    const k = smooth(0, SEG0, L.p);
    const angle = L.free * (1 - k) + scriptedAngle(L.p) * k;
    dial.rotation.z = angle * DEG;

    // скобата: отключено (вдигната + завъртяна) → заключено
    const lk = L.lockAmt;
    const swing = 1 - smooth(0, 0.55, lk), drop = 1 - smooth(0.45, 1, lk);
    shPivot.rotation.y = swing * Math.PI;      // отворено: скобата е завъртяна навън
    shPivot.position.y = 1.4 + drop * 0.85;

    L.tiltX += ((-L.py * 0.18) - L.tiltX) * 0.06;
    L.tiltY += ((L.px * 0.28) - L.tiltY) * 0.06;
    tilt.rotation.set(L.tiltX, L.tiltY - 0.18, 0);
    tilt.position.y = Math.sin(t * 1.1) * 0.06;
    lime.emissiveIntensity = 0.4 + lk * 0.8;
    renderer.render(scene, camera);
  }
  function dialScreenCenter() {
    dial.getWorldPosition(center).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (center.x + 1) / 2 * r.width, y: r.top + (1 - center.y) / 2 * r.height };
  }
  function topDigit() {
    const a = ((Math.round((L.free) / 36) % 10) + 10) % 10;
    return a;
  }
  return { frame, dialScreenCenter, topDigit, canvas };
}

/* Влачене на диска: ъгълът следва показалеца около центъра на диска */
if (lock3d) {
  const cv = lock3d.canvas;
  let lastA = 0;
  const angleAt = (e) => { const c = lock3d.dialScreenCenter(); return Math.atan2(e.clientY - c.y, e.clientX - c.x) / DEG; };
  cv.addEventListener('pointerdown', (e) => {
    if (L.p > 0.04) return;
    L.dragging = true; lastA = angleAt(e); cv.setPointerCapture(e.pointerId); cv.classList.add('dragging');
  });
  cv.addEventListener('pointermove', (e) => {
    const r = cv.getBoundingClientRect();
    L.px = ((e.clientX - r.left) / r.width) * 2 - 1;
    L.py = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (!L.dragging) return;
    const a = angleAt(e);
    let d = a - lastA; if (d > 180) d -= 360; if (d < -180) d += 360;
    L.free -= d; L.freeVel = -d; lastA = a;
    comboState.textContent = `Цифра ${lock3d.topDigit()}`;
  });
  const end = () => { L.dragging = false; cv.classList.remove('dragging'); setTimeout(() => { if (L.p < 0.04) comboState.textContent = 'Отключено'; }, 900); };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', () => { if (!L.dragging) { L.px = 0; L.py = 0; } });
}

/* Скрол: закачаме сцената и набираме комбинацията */
const slots = $$('.combo-slot');
const comboState = $('#comboState');
const habits = $$('.habit');
let lockST = null;
if (!RM) {
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '#lockScene', start: 'top top', end: () => '+=' + (isMobile() ? 3200 : 4400),
      pin: true, scrub: true, anticipatePin: 1, invalidateOnRefresh: true,
      onUpdate: (s) => {
        L.p = s.progress;
        L.lockAmt = smooth(0.86, 0.94, s.progress);
        slots.forEach((slot, i) => {
          const on = s.progress > SEG0 + i * SEG + SEG * 0.62;
          if (slot.classList.contains('on') !== on) { slot.classList.toggle('on', on); slot.textContent = on ? COMBO[i] : '–'; }
        });
        const locked = L.lockAmt > 0.9;
        comboState.classList.toggle('locked', locked);
        if (!L.dragging) comboState.textContent = locked ? 'Заключено' : s.progress > SEG0 ? 'Набиране…' : 'Отключено';
      },
    },
  });
  tl.to('#heroCopy', { autoAlpha: 0, y: -40, duration: 0.06, ease: 'power2.in' }, 0.02)
    .to('.habits-kicker', { autoAlpha: 1, duration: 0.04 }, 0.08);
  habits.forEach((h, i) => {
    const a = SEG0 + i * SEG;
    tl.fromTo(h, { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.05, ease: 'power2.out' }, a);
    if (i < habits.length - 1) tl.to(h, { autoAlpha: 0, y: -50, duration: 0.04, ease: 'power2.in' }, a + SEG - 0.04);
  });
  tl.to('.habits-kicker', { autoAlpha: 0, duration: 0.03 }, SEG0 + 5 * SEG - 0.03);
  tl.set({}, {}, 1);
  lockST = tl.scrollTrigger;
} else {
  L.p = 1; L.lockAmt = 1;
  slots.forEach((s, i) => { s.classList.add('on'); s.textContent = COMBO[i]; });
  comboState.textContent = 'Заключено'; comboState.classList.add('locked');
}
// 3D рендерираме само когато сцената е видима (до края на закачането + един екран)
const lockIsVisible = () => {
  const y = lenis ? lenis.scroll : window.scrollY;
  const end = lockST ? lockST.end : 0;
  return y < end + window.innerHeight;
};

/* =========================================================
   3. АНИМАЦИИ ПРИ СКРОЛ
   ========================================================= */
// Подчертаване на „скъпо.“
gsap.to('#statement mark', { backgroundSize: '100% 100%', ease: 'none', scrollTrigger: { trigger: '#statement', start: 'top 75%', end: 'top 35%', scrub: true } });
// Лента с думи — скоростта следва скрола
const track = $('#marquee');
track.innerHTML += track.innerHTML;     // дублираме за безкраен цикъл
let mx = 0, vel = 0;
// Плавно появяване
const reveals = $$('.head, .threat, .pw-card, .pw-copy, .quiz-card, .mail-app, .sim-side, .help-top, .why-copy');
reveals.forEach((n) => n.classList.add('reveal'));
const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: 0.15 });
reveals.forEach((n) => io.observe(n));
// 3D наклон на картите със заплахи
if (matchMedia('(hover: hover)').matches && !RM) {
  $$('.tilt').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `rotateX(${-y * 8}deg) rotateY(${x * 10}deg) translateZ(0)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });
}
// Активен линк в менюто
$$('.nav-links a').forEach((a) => {
  const sec = $(a.getAttribute('href'));
  if (!sec) return;
  ScrollTrigger.create({ trigger: sec, start: 'top 45%', end: 'bottom 45%', onToggle: (s) => a.classList.toggle('active', s.isActive) });
});

/* Главен цикъл */
let last = performance.now();
gsap.ticker.add(() => {
  const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (lock3d && lockIsVisible()) lock3d.frame(dt);
  const v = lenis ? lenis.velocity : 0;
  vel += (v - vel) * 0.1;
  mx -= (0.6 + Math.abs(vel) * 0.25) * (RM ? 0 : 1);
  const half = track.scrollWidth / 2;
  if (half && -mx > half) mx += half;
  track.style.transform = `translateX(${mx}px)`;
});

/* =========================================================
   4. ПАРОЛА
   ========================================================= */
const COMMON = ['123456', '123456789', '12345678', 'password', 'qwerty', 'qwerty123', '111111', '123123', 'abc123', 'parola', 'parola123',
  'iloveyou', 'admin', 'admin123', 'letmein', 'welcome', 'monkey', 'dragon', 'football', 'sofia', 'bulgaria', 'password1', '1234567890', '000000', 'qwertyuiop'];
const pwInput = $('#pwInput'), pwFill = $('#pwFill'), pwVerdict = $('#pwVerdict'), pwTime = $('#pwTime');
const pwChecks = Object.fromEntries($$('#pwChecks li').map((li) => [li.dataset.check, li]));
const LEVELS = [
  { t: 'Оценката ще се появи тук', c: 'var(--alert)' },
  { t: 'Много слаба', c: '#e2502c' }, { t: 'Слаба', c: '#ef8a2c' }, { t: 'Средна', c: '#f2b630' },
  { t: 'Силна', c: '#9bd33c' }, { t: 'Много силна', c: '#c8f03c' },
];
function crackTime(sec) {
  if (sec < 1) return 'мигновено';
  const u = [['секунди', 60], ['минути', 60], ['часа', 24], ['дни', 365], ['години', 1000], ['хиляди години', 1000], ['милиона години', 1000]];
  let v = sec;
  for (const [n, step] of u) { if (v < step) return `≈ ${Math.max(1, Math.round(v))} ${n}`; v /= step; }
  return 'милиарди години';
}
function ratePassword(pw) {
  const checks = {
    len: pw.length >= 12, case: /[a-zа-я]/.test(pw) && /[A-ZА-Я]/.test(pw), num: /\d/.test(pw),
    sym: /[^A-Za-zА-Яа-я0-9]/.test(pw), common: pw.length > 0 && !COMMON.includes(pw.toLowerCase()),
  };
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26; if (/[A-Z]/.test(pw)) pool += 26; if (/[а-яА-Я]/.test(pw)) pool += 60;
  if (/\d/.test(pw)) pool += 10; if (/[^A-Za-zА-Яа-я0-9]/.test(pw)) pool += 33;
  let bits = pw.length * Math.log2(Math.max(pool, 1));
  if (/(.)\1{2,}/.test(pw)) bits *= 0.7;
  if (/(0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf)/i.test(pw)) bits *= 0.7;
  if (!checks.common) bits = 0;
  const score = !pw ? 0 : bits < 28 ? 1 : bits < 40 ? 2 : bits < 60 ? 3 : bits < 80 ? 4 : 5;
  return { checks, score, sec: Math.pow(2, bits) / 2 / 1e10 };   // 10 млрд. опита в секунда
}
function updatePassword() {
  const pw = pwInput.value, { checks, score, sec } = ratePassword(pw);
  Object.entries(checks).forEach(([k, ok]) => pwChecks[k].classList.toggle('ok', ok && !!pw));
  pwFill.style.width = `${score * 20}%`; pwFill.style.background = LEVELS[score].c;
  pwVerdict.textContent = LEVELS[score].t;
  pwTime.textContent = pw ? crackTime(sec) : '—';
}
pwInput.addEventListener('input', updatePassword);
$('#pwToggle').addEventListener('click', (e) => {
  const show = pwInput.type === 'password';
  pwInput.type = show ? 'text' : 'password';
  e.currentTarget.textContent = show ? 'Скрий' : 'Покажи';
});
const WORDS = ['Kotka', 'Zvezda', 'Reka', 'Planina', 'Limon', 'Oblak', 'Kafe', 'Gora', 'Mostra', 'Svetulka', 'Kamak', 'Vqtar', 'More', 'Pesen', 'Tigar', 'Kniga', 'Ogan', 'Lodka'];
$('#pwGenerate').addEventListener('click', () => {
  const r = new Uint32Array(6); crypto.getRandomValues(r);
  const w = [0, 1, 2, 3].map((i) => WORDS[r[i] % WORDS.length]);
  const syms = '!#$%&*?@';
  pwInput.value = `${w.join('-')}${10 + (r[4] % 90)}${syms[r[5] % syms.length]}`;
  pwInput.type = 'text'; $('#pwToggle').textContent = 'Скрий';
  updatePassword();
});

/* =========================================================
   5. ТЕСТ
   ========================================================= */
const PER_ROUND = 5;
const LEVEL_NAMES = { easy: 'Лесно', medium: 'Средно', hard: 'Трудно' };
const qz = { level: 'easy', list: [], i: 0, score: 0, chosen: false };
const qText = $('#qText'), qAnswers = $('#qAnswers'), qCount = $('#qCount'), qScore = $('#qScore'), qBar = $('#qBar'), qFeedback = $('#qFeedback'), qNext = $('#qNext'), bestEl = $('#bestScore');
const shuffle = (arr) => { const c = [...arr]; for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return c; };
const best = { get: () => { try { return +localStorage.getItem('cybersafe-best-' + qz.level) || 0; } catch { return 0; } }, set: (v) => { try { localStorage.setItem('cybersafe-best-' + qz.level, v); } catch {} } };
function startQuiz() {
  qz.list = shuffle(questionBank.filter((x) => x.level === qz.level)).slice(0, PER_ROUND).map((x) => {
    const ans = shuffle(x.a.map((t, i) => ({ t, ok: i === x.correct })));
    return { q: x.q, a: ans.map((y) => y.t), correct: ans.findIndex((y) => y.ok), why: x.why };
  });
  qz.i = 0; qz.score = 0;
  bestEl.textContent = `Рекорд (${LEVEL_NAMES[qz.level]}): ${best.get()} / ${PER_ROUND}`;
  renderQuestion();
}
function renderQuestion() {
  const item = qz.list[qz.i];
  qz.chosen = false;
  qCount.textContent = `Въпрос ${qz.i + 1} / ${PER_ROUND}`;
  qScore.textContent = `Точки: ${qz.score}`;
  qBar.style.width = `${((qz.i + 1) / PER_ROUND) * 100}%`;
  qText.textContent = item.q;
  qFeedback.textContent = 'Избери един отговор.';
  qNext.disabled = true;
  qNext.innerHTML = (qz.i === PER_ROUND - 1 ? 'Виж резултата' : 'Следващ въпрос') + ' <span class="arr">→</span>';
  qAnswers.replaceChildren(...item.a.map((t, idx) => {
    const b = el('button', 'answer', t); b.type = 'button';
    b.addEventListener('click', () => choose(idx));
    return b;
  }));
  if (!RM) gsap.from(qAnswers.children, { x: 20, autoAlpha: 0, stagger: 0.06, duration: 0.4, ease: 'power2.out' });
}
function choose(idx) {
  if (qz.chosen) return;
  qz.chosen = true;
  const item = qz.list[qz.i];
  [...qAnswers.children].forEach((b, i) => { b.disabled = true; if (i === item.correct) b.classList.add('correct'); else if (i === idx) b.classList.add('wrong'); });
  const ok = idx === item.correct;
  if (ok) qz.score++;
  qFeedback.textContent = (ok ? 'Правилно! ' : 'Не съвсем. ') + item.why;
  qScore.textContent = `Точки: ${qz.score}`;
  qNext.disabled = false;
}
qNext.addEventListener('click', () => {
  if (qz.i === PER_ROUND) return startQuiz();                  // „Нов тест“
  if (!qz.chosen) return;
  if (qz.i < PER_ROUND - 1) { qz.i++; return renderQuestion(); }
  qz.i = PER_ROUND;
  qCount.textContent = 'Тестът е завършен'; qBar.style.width = '100%';
  qText.textContent = `Твоят резултат: ${qz.score} от ${PER_ROUND}`;
  qAnswers.replaceChildren();
  const prev = best.get();
  if (qz.score > prev) { best.set(qz.score); qFeedback.textContent = 'Нов личен рекорд! ' + (qz.score === PER_ROUND ? 'Перфектно.' : 'Продължавай така.'); }
  else qFeedback.textContent = qz.score === PER_ROUND ? 'Отлично! Всички отговори са верни.' : qz.score >= 3 ? 'Добра работа! Опитай отново или избери по-трудно ниво.' : 'Продължавай да учиш и опитай пак.';
  bestEl.textContent = `Рекорд (${LEVEL_NAMES[qz.level]}): ${best.get()} / ${PER_ROUND}`;
  qNext.innerHTML = 'Нов тест <span class="arr">↻</span>';
});
$$('.level').forEach((b) => b.addEventListener('click', () => {
  qz.level = b.dataset.level;
  $$('.level').forEach((x) => x.classList.toggle('active', x === b));
  startQuiz();
}));
startQuiz();

/* =========================================================
   СТРАНИЧЕН ПАНЕЛ
   ========================================================= */
const drawer = $('#drawer'), drawerContent = $('#drawerContent'), drawerPanel = $('.drawer-panel');
drawerPanel.setAttribute('data-lenis-prevent', '');
let lastFocus = null;
function openDrawer(nodes) {
  lastFocus = document.activeElement;
  drawerContent.replaceChildren(...nodes);
  drawerPanel.scrollTop = 0;
  drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false');
  lenis?.stop(); document.documentElement.style.overflow = 'hidden';
  setTimeout(() => $('.drawer-close').focus(), 50);
}
function closeDrawer() {
  drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true');
  lenis?.start(); document.documentElement.style.overflow = '';
  lastFocus?.focus?.();
  renderIncidents();
}
drawer.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeDrawer(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer(); });
const list = (items, cls) => { const ul = el('ul', cls); items.forEach((t) => ul.append(el('li', '', t))); return ul; };
const block = (title, child, cls = '') => { const d = el('div', 'dr-block ' + cls); d.append(el('h3', '', title)); if (typeof child === 'string') d.append(el('p', '', child)); else d.append(child); return d; };

/* =========================================================
   6. ИЗМАМИ
   ========================================================= */
const ICONS = {
  phishing: '<path d="M3 6h18v12H3z"/><path d="m3 7 9 6 9-6"/>',
  smishing: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 6h4M9 11h6M9 14h4"/>',
  vishing: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  shops: '<path d="M4 7h16l-1.5 11h-13z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
  romance: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  investment: '<path d="M4 18 10 12l4 4 6-8"/><path d="M15 8h5v5"/>',
  support: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  sim: '<path d="M12 3 19 6v5c0 4.7-2.9 8-7 10-4.1-2-7-5.3-7-10V6z"/><path d="m9 12 2 2 4-4"/>',
};
const icon = (k) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;
const SCAM_SHORT = {
  phishing: 'Измамни имейли и фалшиви сайтове', smishing: 'Подвеждащи текстови съобщения', vishing: 'Измами чрез телефонни обаждания',
  shops: 'Фалшиви оферти и плащания', romance: 'Изграждане на фалшиво доверие', investment: 'Фалшиви обещания за печалба', support: 'Измамници, представящи се за специалисти',
};
const scamGrid = $('#scamGrid');
Object.entries(scamData).forEach(([key, d], i) => {
  const b = el('button', 'scam'); b.type = 'button';
  b.innerHTML = `<span class="scam-n">${String(i + 1).padStart(2, '0')}</span><span class="scam-ico">${icon(key)}</span><h3></h3><small></small><span class="go">Разгледай →</span>`;
  $('h3', b).textContent = d.title.replace(/\s*\(.*\)/, '');
  $('small', b).textContent = SCAM_SHORT[key] || '';
  b.addEventListener('click', () => openScam(key));
  scamGrid.append(b);
});
const simCard = el('a', 'scam scam-cta'); simCard.href = '#simulator';
simCard.innerHTML = `<span class="scam-n">08</span><span class="scam-ico">${icon('sim')}</span><h3>Тествай се</h3><small>Открий сигналите в истински изглеждащ имейл</small><span class="go">Към симулатора →</span>`;
scamGrid.append(simCard);
function openScam(key) {
  const d = scamData[key]; if (!d) return;
  const n = Object.keys(scamData).indexOf(key) + 1;
  const title = el('h2', 'dr-title', d.title); title.id = 'drawerTitle';
  openDrawer([
    el('p', 'tag', `Киберизмама / ${String(n).padStart(2, '0')}`), title, el('p', 'dr-intro', d.intro),
    block('Как да я разпознаеш', list(d.signs), 'signs'),
    block('Как да се предпазиш', list(d.safety), 'safe'),
    block('Пример от реалния живот', d.example, 'dr-example'),
  ]);
}

/* =========================================================
   7. СИМУЛАТОР
   ========================================================= */
const CORRECT = new Set(['sender', 'link', 'pressure']);
const picked = new Set();
const clues = $$('.clue'), simCount = $('#simCount'), simBar = $('#simBar'), simResult = $('#simResult'), simExplain = $('#simExplain');
let checked = false;
clues.forEach((c) => c.addEventListener('click', () => {
  if (checked) return;
  const k = c.dataset.clue;
  picked.has(k) ? picked.delete(k) : picked.add(k);
  c.classList.toggle('selected', picked.has(k));
  c.setAttribute('aria-pressed', String(picked.has(k)));
  simCount.textContent = picked.size;
  simBar.style.width = `${Math.min(picked.size, 3) / 3 * 100}%`;
}));
$('#simCheck').addEventListener('click', () => {
  checked = true;
  const hits = [...picked].filter((k) => CORRECT.has(k)).length, extra = picked.size - hits, missed = 3 - hits;
  clues.forEach((c) => {
    const k = c.dataset.clue, sel = picked.has(k);
    c.classList.remove('selected');
    c.classList.toggle('res-ok', CORRECT.has(k) && sel);
    c.classList.toggle('res-miss', CORRECT.has(k) && !sel);
    c.classList.toggle('res-wrong', !CORRECT.has(k) && sel);
  });
  const perfect = hits === 3 && extra === 0;
  simResult.className = 'sim-result' + (perfect ? '' : ' warn');
  simResult.innerHTML = '';
  simResult.append(el('strong', '', perfect ? 'Отлично! 3 от 3.' : `Откри ${hits} от 3.`),
    el('p', '', perfect ? 'Разпозна подателя, линка и натиска за бързо действие.'
      : `${missed ? `Пропусна ${missed}. ` : ''}${extra ? 'Поздравът „Здравейте“ е нормален и не е сигнал за измама. ' : ''}Виж обясненията отдолу.`));
  simExplain.hidden = false;
  $$('[data-explain]').forEach((a) => {
    const found = picked.has(a.dataset.explain), st = $('.ex-status', a);
    st.className = 'ex-status ' + (found ? 'ok' : 'miss');
    st.textContent = found ? '✓ Намерен' : '! Пропуснат';
  });
  ScrollTrigger.refresh();
});
$('#simReset').addEventListener('click', () => {
  checked = false; picked.clear();
  clues.forEach((c) => { c.className = c.className.replace(/\b(selected|res-ok|res-miss|res-wrong)\b/g, '').trim(); c.setAttribute('aria-pressed', 'false'); });
  simCount.textContent = '0'; simBar.style.width = '0%'; simResult.innerHTML = ''; simResult.className = 'sim-result';
  simExplain.hidden = true;
  ScrollTrigger.refresh();
});

/* =========================================================
   8. РЕЧНИК
   ========================================================= */
const glSearch = $('#glSearch'), glLetters = $('#glLetters'), glGrid = $('#glGrid'), glEmpty = $('#glEmpty'), glCount = $('#glCount');
let glLetter = '';
const LETTERS = ['', ...new Set(glossaryTerms.map((x) => x.term[0].toUpperCase()))].sort((a, b) => a.localeCompare(b, 'en'));
function renderLetters() {
  glLetters.replaceChildren(...LETTERS.map((l) => {
    const b = el('button', 'letter' + (l === glLetter ? ' active' : ''), l || 'Всички'); b.type = 'button';
    b.setAttribute('aria-pressed', String(l === glLetter));
    b.addEventListener('click', () => { glLetter = l; renderLetters(); renderTerms(); });
    return b;
  }));
}
function renderTerms() {
  const q = glSearch.value.trim().toLocaleLowerCase('bg');
  const res = glossaryTerms
    .filter((x) => !glLetter || x.term[0].toUpperCase() === glLetter)
    .filter((x) => !q || [x.term, x.translation, x.definition, x.example].some((v) => v.toLocaleLowerCase('bg').includes(q)))
    .sort((a, b) => a.term.localeCompare(b.term, 'en'));
  glGrid.replaceChildren(...res.map((x) => {
    const d = el('details', 'term'), s = el('summary');
    const w = el('div'); w.append(el('strong', '', x.term), el('span', '', x.translation)); s.append(w);
    const body = el('div', 'term-body');
    body.append(el('p', '', x.definition), el('p', 'tag', 'Пример'), el('p', 'term-ex', x.example));
    d.append(s, body);
    return d;
  }));
  glCount.textContent = `${res.length} ${res.length === 1 ? 'термин' : 'термина'}`;
  glEmpty.hidden = res.length > 0;
  ScrollTrigger.refresh();
}
glSearch.addEventListener('input', renderTerms);
renderLetters(); renderTerms();

/* =========================================================
   9. ЦЕНТЪР ЗА РЕАКЦИЯ
   ========================================================= */
const incState = (() => { try { return JSON.parse(localStorage.getItem('cybersafe-incidents')) || {}; } catch { return {}; } })();
incidentCases.forEach((x) => { if (!Array.isArray(incState[x.id]) || incState[x.id].length !== x.steps.length) incState[x.id] = x.steps.map(() => false); });
const saveInc = () => { try { localStorage.setItem('cybersafe-incidents', JSON.stringify(incState)); } catch {} };
const incSearch = $('#incSearch'), incGrid = $('#incGrid'), incEmpty = $('#incEmpty');
function renderIncidents() {
  const q = incSearch.value.trim().toLocaleLowerCase('bg');
  const res = incidentCases.filter((x) => [x.title, x.summary, x.explanation, x.keywords].some((v) => v.toLocaleLowerCase('bg').includes(q)));
  incGrid.replaceChildren(...res.map((x) => {
    const done = incState[x.id].filter(Boolean).length, total = x.steps.length;
    const b = el('button', 'inc'); b.type = 'button';
    b.append(el('p', 'tag', `Ситуация / ${String(incidentCases.indexOf(x) + 1).padStart(2, '0')}`), el('h3', '', x.title), el('p', '', x.summary));
    const pr = el('div', 'inc-progress'); const bar = el('i'); const fill = el('b'); fill.style.transform = `scaleX(${done / total})`; bar.append(fill);
    pr.append(bar, el('span', '', `${done}/${total}`));
    b.append(pr, el('span', 'go', 'Отвори стъпките →'));
    b.addEventListener('click', () => openIncident(x.id));
    return b;
  }));
  incEmpty.hidden = res.length > 0;
}
function openIncident(id) {
  const x = incidentCases.find((c) => c.id === id); if (!x) return;
  const title = el('h2', 'dr-title', x.title); title.id = 'drawerTitle';
  const prog = el('div', 'dr-progress'), track = el('i'), fill = el('b'), label = el('span');
  track.append(fill); prog.append(track, label);
  const update = () => {
    const done = incState[id].filter(Boolean).length;
    fill.style.width = `${done / x.steps.length * 100}%`;
    label.textContent = `${done} от ${x.steps.length}`;
  };
  const steps = el('div', 'steps');
  x.steps.forEach((s, i) => {
    const lab = el('label'), cb = el('input'); cb.type = 'checkbox'; cb.checked = incState[id][i];
    lab.classList.toggle('done', cb.checked);
    cb.addEventListener('change', () => { incState[id][i] = cb.checked; lab.classList.toggle('done', cb.checked); saveInc(); update(); });
    lab.append(cb, el('span', '', s)); steps.append(lab);
  });
  const reset = el('button', 'btn btn-line btn-sm', 'Нулирай отметките ↻'); reset.type = 'button';
  reset.addEventListener('click', () => { incState[id].fill(false); $$('input', steps).forEach((c) => { c.checked = false; c.parentElement.classList.remove('done'); }); saveInc(); update(); });
  const actions = el('div', 'dr-actions'); actions.append(reset);
  update();
  openDrawer([
    el('p', 'tag', 'Инструкции за реакция'), title, el('p', 'dr-intro', x.explanation),
    ...(x.warning ? [block('Важно действие', x.warning, 'dr-warn')] : []),
    prog, steps, actions,
  ]);
}
incSearch.addEventListener('input', renderIncidents);
renderIncidents();

// Линкове от картите със заплахи
document.addEventListener('click', (e) => {
  const s = e.target.closest('[data-open-scam]'); if (s) { e.preventDefault(); openScam(s.dataset.openScam); return; }
  const i = e.target.closest('[data-open-incident]'); if (i) { e.preventDefault(); openIncident(i.dataset.openIncident); }
});

window.addEventListener('load', () => ScrollTrigger.refresh());
