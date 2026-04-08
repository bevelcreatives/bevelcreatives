/* ── AUDIO ENGINE ── */
const AC=new(window.AudioContext||window.webkitAudioContext)();
function sfx(type){
  if(AC.state==='suspended')AC.resume();
  const o=AC.createOscillator(),g=AC.createGain();
  o.connect(g);g.connect(AC.destination);
  if(type==='hover'){
    o.type='sine';o.frequency.setValueAtTime(880,AC.currentTime);
    o.frequency.exponentialRampToValueAtTime(1100,AC.currentTime+0.06);
    g.gain.setValueAtTime(0.04,AC.currentTime);g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+0.08);
    o.start();o.stop(AC.currentTime+0.08);
  } else if(type==='click'){
    o.type='square';o.frequency.setValueAtTime(440,AC.currentTime);
    o.frequency.exponentialRampToValueAtTime(220,AC.currentTime+0.12);
    g.gain.setValueAtTime(0.07,AC.currentTime);g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+0.14);
    o.start();o.stop(AC.currentTime+0.14);
  } else if(type==='open'){
    o.type='triangle';o.frequency.setValueAtTime(300,AC.currentTime);
    o.frequency.exponentialRampToValueAtTime(600,AC.currentTime+0.18);
    g.gain.setValueAtTime(0.06,AC.currentTime);g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+0.22);
    o.start();o.stop(AC.currentTime+0.22);
  }
}
/* attach sounds */
document.addEventListener('mouseover',e=>{
  const t=e.target.closest('button,a,[data-popup],[data-close],.snav,.hbtn,.blog-entry,.ld-play');
  if(t)sfx('hover');
},{passive:true});
document.addEventListener('click',e=>{
  const t=e.target.closest('button,a,[data-popup],[data-close],.snav,.hbtn,.blog-entry,.ld-play');
  if(t)sfx('click');
},{passive:true});

/* ── CUSTOM CURSOR ── */
const cur=document.getElementById('sci-cursor');
document.addEventListener('mousemove',e=>{
  cur.style.left=e.clientX+'px';cur.style.top=e.clientY+'px';
},{passive:true});

/* ── HEX BACKGROUND (interactive beehive) ── */
(function(){
  const cv=document.getElementById('hex-bg');
  const ctx=cv.getContext('2d');
  const R=28,mouse={x:-9999,y:-9999};
  let W,H,cols,rows;
  function resize(){
    W=cv.width=innerWidth;H=cv.height=innerHeight;
    cols=Math.ceil(W/(R*1.5))+2;
    rows=Math.ceil(H/(R*Math.sqrt(3)))+2;
  }
  window.addEventListener('resize',resize);
  window.addEventListener('mousemove',e=>{mouse.x=e.clientX;mouse.y=e.clientY;},{passive:true});
  function drawHex(x,y,op,col){
    ctx.beginPath();
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3;
      ctx[i?'lineTo':'moveTo'](x+R*Math.cos(a),y+R*Math.sin(a));
    }
    ctx.closePath();
    ctx.strokeStyle=col||`rgba(0,245,255,${op})`;
    ctx.lineWidth=1;ctx.stroke();
    if(op>0.12){
      ctx.fillStyle=`rgba(0,245,255,${op*0.07})`;ctx.fill();
    }
  }
  function frame(){
    ctx.clearRect(0,0,W,H);
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const x=c*R*1.5;
        const y=r*R*Math.sqrt(3)+(c%2?R*Math.sqrt(3)/2:0);
        const dist=Math.hypot(x-mouse.x,y-mouse.y);
        let op=0.04;
        let col=null;
        if(dist<120){
          const t=1-dist/120;
          op=0.04+t*0.45;
          /* color shifts from cyan to green/magenta based on distance */
          const g=Math.floor(t*255);
          col=`rgba(0,${200+g*0.2},${255-g*0.5},${op})`;
        }
        drawHex(x,y,op,col);
      }
    }
    requestAnimationFrame(frame);
  }
  resize();frame();
})();

/* ── LOADING SEQUENCE ── */
(function(){
  const SEGS=12,barOuter=document.getElementById('ld-bar-outer'),segs=[];
  for(let i=0;i<SEGS;i++){const s=document.createElement('div');s.className='ld-seg';barOuter.appendChild(s);segs.push(s);}
  const pctEl=document.getElementById('ld-pct'),statusEl=document.getElementById('ld-status'),
        ldTimeEl=document.getElementById('ld-time'),playBtn=document.getElementById('play-btn'),
        pressEl=document.getElementById('ld-press');
  const msgs=['INITIALIZING SYSTEMS','LOADING ASSETS','CALIBRATING HUD','SYNCING DATA','REVIVAL ENGINE ONLINE','SYSTEM READY'];
  let pct=0,seg=0,dotCount=0,msgIdx=0;
  function updateTime(){const n=new Date();ldTimeEl.textContent=n.getFullYear()+'.'+String(n.getMonth()+1).padStart(2,'0')+'.'+String(n.getDate()).padStart(2,'0')+' — '+String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0')+':'+String(n.getSeconds()).padStart(2,'0');}
  updateTime();setInterval(updateTime,1000);
  const dotIv=setInterval(()=>{dotCount=(dotCount+1)%8;statusEl.textContent=(msgs[msgIdx]||msgs[msgs.length-1])+' .'.repeat(dotCount);},220);
  const iv=setInterval(()=>{
    pct+=Math.floor(Math.random()*4)+1;if(pct>100)pct=100;
    pctEl.textContent=pct+'%';
    const ns=Math.floor(pct/100*SEGS);while(seg<ns&&seg<SEGS){segs[seg].classList.add('on');seg++;}
    msgIdx=Math.floor(pct/(100/(msgs.length-1)));
    if(pct>=100){clearInterval(iv);clearInterval(dotIv);statusEl.textContent='SYSTEM READY';
      setTimeout(()=>{const fl=document.getElementById('flash');fl.classList.add('on');setTimeout(()=>fl.classList.remove('on'),120);setTimeout(()=>{playBtn.classList.add('show');pressEl.classList.add('show');},200);},400);}
  },60);
  playBtn.addEventListener('click',()=>{
    sfx('open');
    const fl=document.getElementById('flash');fl.classList.add('on');
    setTimeout(()=>fl.classList.remove('on'),100);
    setTimeout(()=>{document.getElementById('loader').classList.add('out');document.getElementById('game-screen').classList.add('active');},120);
  });
})();

/* ── HUD FRAME ── */
(function(){
  const svg=document.getElementById('hud-frame'),W=innerWidth,H=innerHeight;
  const C='rgba(0,245,255,0.32)',C2='rgba(0,245,255,0.13)',L=48;
  const paths=[`M0,${L} L0,0 L${L},0`,`M0,${L+18} L0,${L+8}`,`M${L+18},0 L${L+8},0`,
    `M${W-L},0 L${W},0 L${W},${L}`,`M${W},${L+18} L${W},${L+8}`,`M${W-L-18},0 L${W-L-8},0`,
    `M0,${H-L} L0,${H} L${L},${H}`,`M0,${H-L-18} L0,${H-L-8}`,`M${L+18},${H} L${L+8},${H}`,
    `M${W-L},${H} L${W},${H} L${W},${H-L}`,`M${W},${H-L-18} L${W},${H-L-8}`,`M${W-L-18},${H} L${W-L-8},${H}`];
  const ticks=[`M${W/2-55},0 L${W/2-55},5`,`M${W/2+55},0 L${W/2+55},5`,`M${W/2-90},0 L${W/2-90},3`,`M${W/2+90},0 L${W/2+90},3`,`M${W/2-55},${H} L${W/2-55},${H-5}`,`M${W/2+55},${H} L${W/2+55},${H-5}`];
  let d='';
  paths.forEach((p,i)=>d+=`<path d="${p}" stroke="${i%3===0?C:C2}" stroke-width="${i%3===0?2:1}" fill="none"/>`);
  ticks.forEach(p=>d+=`<path d="${p}" stroke="${C2}" stroke-width="1" fill="none"/>`);
  d+=`<circle cx="0" cy="0" r="3" fill="${C}"/><circle cx="${W}" cy="0" r="3" fill="${C}"/><circle cx="0" cy="${H}" r="3" fill="${C}"/><circle cx="${W}" cy="${H}" r="3" fill="${C}"/>`;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.innerHTML=d;
})();

/* ── CLOCK ── */
setInterval(()=>{const n=new Date(),c=document.getElementById('bar-clock');if(c)c.textContent=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0')+':'+String(n.getSeconds()).padStart(2,'0');},1000);

/* ── POPUP SYSTEM ── */
function openPopup(id){
  document.querySelectorAll('.popup-overlay').forEach(p=>p.classList.remove('open'));
  const el=document.getElementById('popup-'+id);
  if(el){el.classList.add('open');sfx('open');}
  document.querySelectorAll('[data-popup]').forEach(a=>a.classList.toggle('active',a.dataset.popup===id));
}
function closePopup(id){const el=document.getElementById('popup-'+id);if(el)el.classList.remove('open');}
document.querySelectorAll('[data-popup]').forEach(btn=>{
  btn.addEventListener('click',e=>{
    e.preventDefault();openPopup(btn.dataset.popup);
    document.getElementById('mobile-menu').classList.remove('open');
    document.getElementById('hamburger').classList.remove('is-open');
  });
});
document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',()=>closePopup(btn.dataset.close)));
document.querySelectorAll('.popup-overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open');}));
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.popup-overlay').forEach(p=>p.classList.remove('open'));});

/* ── HAMBURGER ── */
const ham=document.getElementById('hamburger'),mm=document.getElementById('mobile-menu');
ham.addEventListener('click',()=>{const o=mm.classList.toggle('open');ham.classList.toggle('is-open',o);});

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

/* ── EMAIL ── */
function sendEmail(e){
  e.preventDefault();
  const inp=e.target.querySelectorAll('input,textarea');
  const sub=`Game Inquiry: ${inp[1].value}`;
  const body=`Name: ${inp[0].value}\nGame: ${inp[1].value}\n\nMessage:\n${inp[2].value}`;
  window.open('https://mail.google.com/mail/?view=cm&fs=1&to=bevelcreatives@gmail.com&su='+encodeURIComponent(sub)+'&body='+encodeURIComponent(body),'_blank');
}