// This tells the browser to remember your last scroll position
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'auto';
}

const YOUR_EMAIL = "bevelcreatives@gmail.com";
const YOUR_DISCORD = "@bevelededge";

// Prevent scroll jump on refresh (some browsers restore last scroll and can land at bottom).
// We still allow deep-linking to sections when a hash is present.
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

window.addEventListener("load", () => {
  if (!window.location.hash) {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }
});
// ====== Cursor aura follow ======
const aura = document.getElementById("aura");
let mx = -9999, my = -9999;
let ax = -9999, ay = -9999;

window.addEventListener("mousemove", (e) => {
  mx = e.clientX;
  my = e.clientY;
});

function lerp(a, b, t) { return a + (b - a) * t; }

function tick() {
  ax = lerp(ax, mx - 260, 0.12);
  ay = lerp(ay, my - 260, 0.12);
  aura.style.transform = `translate3d(${ax}px, ${ay}px, 0)`;
  requestAnimationFrame(tick);
}
tick();

// ====== Reveal on scroll ======
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add("on");
  });
}, { threshold: 0.12 });

document.querySelectorAll(".reveal").forEach(el => observer.observe(el));

// ====== Mobile menu ======
const hamburger = document.getElementById("hamburger");
const mobilePanel = document.getElementById("mobilePanel");
let menuOpen = false;

function setMenu(open) {
  menuOpen = open;
  mobilePanel.style.display = open ? "block" : "none";
  hamburger.textContent = open ? "✕" : "☰";
}
hamburger?.addEventListener("click", () => setMenu(!menuOpen));
mobilePanel?.querySelectorAll("a").forEach(a => a.addEventListener("click", () => setMenu(false)));

// ====== Footer year ======
document.getElementById("year").textContent = new Date().getFullYear();

// ====== Populate contact chip text ======
document.getElementById("emailText").textContent = YOUR_EMAIL;
document.getElementById("discordText").textContent = YOUR_DISCORD;

// ====== Copy helpers ======
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

document.getElementById("copyEmail")?.addEventListener("click", async () => {
  const ok = await copyText(YOUR_EMAIL);
  alert(ok ? "Email copied!" : "Could not copy email.");
});

document.getElementById("copyDiscord")?.addEventListener("click", async () => {
  const ok = await copyText(YOUR_DISCORD);
  alert(ok ? "Discord copied!" : "Could not copy Discord.");
});

// ====== Contact form -> mailto ======
document.getElementById("contactForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const msg = document.getElementById("message").value.trim();

  const subject = encodeURIComponent(`Project inquiry — ${name}`);
  const body = encodeURIComponent(
`Hi Bibidh,

My name: ${name}
My email: ${email}

Project details:
${msg}

— Sent from your portfolio site`
  );

  // Opens user's default mail client; replace with Gmail URL if you want web-Gmail specifically
  window.location.href = `mailto:${YOUR_EMAIL}?subject=${subject}&body=${body}`;
});

// Split EXPENSIVE. into animated RGB letters (wave + pulse)
(function makeRgbLetters() {
  const el = document.getElementById("rgbExpensive");
  if (!el) return;

  const text = el.textContent;
  el.textContent = "";

  const letters = [...text];
  const waveStep = 0.08; // delay between letters (controls "wave speed")

  letters.forEach((ch, i) => {
    const span = document.createElement("span");
    span.className = "rgb-letter";
    span.textContent = ch === " " ? "\u00A0" : ch;

    // Stagger BOTH animations so it looks like RGB light waves flowing
    span.style.animationDelay = `${i * waveStep}s, ${i * waveStep}s`;

    el.appendChild(span);
  });
})();

// 1. FORCE TOP ON LOAD
window.scrollTo(0, 0);
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// 2. BACKGROUND MUSIC (Local MP3)
window.addEventListener('load', () => {
  const audio = document.getElementById('bgm-audio');
  if (audio) {
    // Play on first user interaction to bypass browser autoplay restrictions
    document.body.addEventListener('click', () => {
      if (audio.paused) {
        audio.play().catch(e => console.log('Audio play failed:', e));
      }
    }, { once: true });
  }
});

/* ── GLOBE (WebGL-lite canvas globe) ── */
(function(){
  const cv=document.getElementById('globe-canvas');
  if(!cv)return;
  const ctx=cv.getContext('2d');
  /* countries as lat/lng dots: [lat, lng, label] */
  const dots=[
    [28,84,'NP'],[37,127,'KR'],[35,139,'JP'],[51,-0.1,'GB'],[40,-74,'US'],
    [34,-118,'US'],[37,-122,'US'],[48,2,'FR'],[52,13,'DE'],[55,37,'RU'],
    [-33,151,'AU'],[-23,-46,'BR'],[19,72,'IN'],[31,121,'CN'],[1,104,'SG'],
    [45,-75,'CA'],[41,29,'TR'],[30,31,'EG'],[6,3,'NG'],[-26,28,'ZA'],
    [60,11,'NO'],[59,18,'SE'],[56,24,'LV'],[64,-22,'IS']
  ];
  const R_globe=()=>Math.min(cv.width,cv.height)*0.44;
  let angle=0;
  function toXY(lat,lng,R,cx,cy){
    const la=lat*Math.PI/180,lo=(lng+angle)*Math.PI/180;
    const x=R*Math.cos(la)*Math.sin(lo);
    const y=R*Math.sin(la);
    const z=R*Math.cos(la)*Math.cos(lo);
    return{x:cx+x,y:cy-y,z,vis:z>-R*0.1};
  }
  function resize(){cv.width=cv.offsetWidth;cv.height=cv.offsetHeight;}
  resize();new ResizeObserver(resize).observe(cv);
  function draw(){
    const W=cv.width,H=cv.height;
    ctx.clearRect(0,0,W,H);
    const cx=W/2,cy=H/2,R=R_globe();
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);
    ctx.fillStyle='rgba(0,245,255,0.02)';ctx.fill();
    ctx.strokeStyle='rgba(0,245,255,0.18)';ctx.lineWidth=1;ctx.stroke();
    ctx.strokeStyle='rgba(0,245,255,0.06)';ctx.lineWidth=0.5;
    for(let la=-60;la<=60;la+=30){
      ctx.beginPath();let first=true;
      for(let lo=0;lo<=360;lo+=5){
        const p=toXY(la,lo,R,cx,cy);
        if(p.vis){if(first){ctx.moveTo(p.x,p.y);first=false;}else ctx.lineTo(p.x,p.y);}
        else first=true;
      }ctx.stroke();
    }
    for(let lo=0;lo<360;lo+=30){
      ctx.beginPath();let first=true;
      for(let la=-80;la<=80;la+=5){
        const p=toXY(la,lo,R,cx,cy);
        if(p.vis){if(first){ctx.moveTo(p.x,p.y);first=false;}else ctx.lineTo(p.x,p.y);}
        else first=true;
      }ctx.stroke();
    }
    dots.forEach((d,i)=>{
      const p=toXY(d[0],d[1],R,cx,cy);
      if(!p.vis)return;
      const pulse=0.6+0.4*Math.sin(Date.now()*0.002+i*0.7);
      const gR=3.5*pulse;
      const grad=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,gR*3);
      grad.addColorStop(0,'rgba(0,245,255,0.9)');
      grad.addColorStop(0.4,'rgba(0,245,255,0.4)');
      grad.addColorStop(1,'rgba(0,245,255,0)');
      ctx.beginPath();ctx.arc(p.x,p.y,gR*3,0,Math.PI*2);
      ctx.fillStyle=grad;ctx.fill();
      ctx.beginPath();ctx.arc(p.x,p.y,gR*0.7,0,Math.PI*2);
      ctx.fillStyle='rgba(0,245,255,0.95)';ctx.fill();
    });
    angle+=0.18;
    requestAnimationFrame(draw);
  }
  draw();
  let drag=false,lastX=0;
  cv.addEventListener('mousedown',e=>{drag=true;lastX=e.clientX;});
  window.addEventListener('mouseup',()=>drag=false);
  window.addEventListener('mousemove',e=>{if(drag){angle+=(e.clientX-lastX)*0.5;lastX=e.clientX;}});
  cv.addEventListener('touchstart',e=>{drag=true;lastX=e.touches[0].clientX;},{passive:true});
  window.addEventListener('touchend',()=>drag=false);
  window.addEventListener('touchmove',e=>{if(drag){angle+=(e.touches[0].clientX-lastX)*0.5;lastX=e.touches[0].clientX;}},{passive:true});
})();