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

// 2. BACKGROUND MUSIC (YT API)
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

var player;
function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '0',
    width: '0',
    videoId: 'KuBCTi6NnNM',
    playerVars: { 'autoplay': 1, 'loop': 1, 'playlist': 'KuBCTi6NnNM' },
    events: {
      'onReady': (event) => {
        // Play on first interaction to bypass browser blocks
        document.body.addEventListener('click', () => {
          event.target.playVideo();
        }, { once: true });
      }
    }
  });
}