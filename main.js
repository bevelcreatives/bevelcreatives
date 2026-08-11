/* ── NAV: scrolled state + active link tracking ── */
const nav = document.getElementById('nav');
const navLinks = document.querySelectorAll('[data-nav]');
const sections = [...navLinks].map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);

function onScroll(){
  nav.classList.toggle('scrolled', window.scrollY > 8);
}
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

if ('IntersectionObserver' in window && sections.length){
  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const id = '#' + entry.target.id;
      navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => navObserver.observe(s));
}

/* ── MOBILE MENU ── */
const hamburger = document.getElementById('hamburger');
const mobilePanel = document.getElementById('mobilePanel');
hamburger.addEventListener('click', () => {
  const open = mobilePanel.classList.toggle('open');
  hamburger.classList.toggle('open', open);
});
mobilePanel.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  mobilePanel.classList.remove('open');
  hamburger.classList.remove('open');
}));

/* ── REVEAL ON SCROLL ── */
if ('IntersectionObserver' in window){
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
} else {
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
}

/* ── COUNT-UP STATS ── */
function animateCount(el){
  const target = parseFloat(el.dataset.count);
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';
  const duration = 1200;
  const start = performance.now();
  function tick(now){
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = prefix + Math.round(target * eased) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
if ('IntersectionObserver' in window){
  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        animateCount(entry.target);
        countObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  document.querySelectorAll('[data-count]').forEach(el => countObserver.observe(el));
}

/* ── SERVICES ACCORDION ── */
document.querySelectorAll('.svc-row').forEach(row => {
  row.querySelector('.svc-head').addEventListener('click', () => {
    const wasOpen = row.classList.contains('open');
    document.querySelectorAll('.svc-row.open').forEach(r => r.classList.remove('open'));
    if (!wasOpen) row.classList.add('open');
  });
});

/* ── CLICKY BUTTONS: subtle magnetic pull toward the cursor ── */
document.querySelectorAll('.btn').forEach(btn => {
  btn.addEventListener('mousemove', (e) => {
    const r = btn.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const y = e.clientY - r.top - r.height / 2;
    btn.style.transform = `translate(${x * 0.12}px, ${y * 0.28}px)`;
  });
  btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
});

/* ── CONTACT FORM → opens a pre-filled Gmail compose window ── */
function sendEmail(e){
  e.preventDefault();
  const name = document.getElementById('cf-name').value;
  const game = document.getElementById('cf-game').value;
  const msg = document.getElementById('cf-msg').value;
  const subject = `Game Inquiry: ${game}`;
  const body = `Name: ${name}\nGame: ${game}\n\nMessage:\n${msg}`;
  window.open(
    'https://mail.google.com/mail/?view=cm&fs=1&to=bevelcreatives@gmail.com&su=' +
    encodeURIComponent(subject) + '&body=' + encodeURIComponent(body),
    '_blank'
  );
}
