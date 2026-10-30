const $=id=>document.getElementById(id);
const V=location.search.includes('v');
const W=V?1080:1920,H=V?1920:1080;
document.documentElement.style.cssText=`width:${W}px;height:${H}px;overflow:hidden`;
document.body.style.cssText=`width:${W}px;height:${H}px`;
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const ease=x=>1-Math.pow(1-clamp(x),3);
const easeIn=x=>{x=clamp(x);return x*x*x;};
const back=x=>{x=clamp(x);const c=2.70158;return 1+c*Math.pow(x-1,3)+1.70158*Math.pow(x-1,2);};
const eIO=x=>{x=clamp(x);return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;};
const within=(t,a,b)=>t>=a&&t<b;
const BEAT=.5, CH=['FAMILY','BIKE CLUB','CAMPING'];
const CIPH='abcdefghijklmnopqrstuvwxyz0123456789+/=#%&';
const hash=(i,f)=>Math.abs(((i+1)*7919+(f+3)*104729+((i*31)^f)*13)|0)%CIPH.length;
function scramble(text,f,resolveAt,t,rate){let o='';for(let i=0;i<text.length;i++){if(text[i]===' ')o+=' ';else if(resolveAt!=null&&t>=resolveAt+i*rate)o+=text[i];else o+=CIPH[hash(i,f)];}return o;}
const LAY=V?{A:{x:252,y:1130,s:.86},B:{x:828,y:1130,s:.86},cap:{top:70,left:20,w:1040,fs:112},chipX:70,chipY:1650,chipW:940,pathY:1000,arc:110,mid:540,midY:1500}
          :{A:{x:560,y:685,s:.72},B:{x:1360,y:685,s:.72},cap:{top:30,left:110,w:1700,fs:100},chipX:750,chipY:850,chipW:420,pathY:520,arc:130,mid:960,midY:760};
const world=$('world');
const rings={A:[],B:[]};
['A','B'].forEach(k=>{for(let i=0;i<3;i++){const r=document.createElement('div');r.className='ring';world.appendChild(r);rings[k].push(r);}});
const tpl=$('tpl').innerHTML;
const droid='<svg class="logo" viewBox="0 0 100 100"><defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4a52"/><stop offset=".35" stop-color="#101012"/><stop offset=".7" stop-color="#000"/><stop offset="1" stop-color="#16161a"/></linearGradient><linearGradient id="gh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".45" stop-color="#fff" stop-opacity=".1"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset=".62" stop-color="#fff" stop-opacity=".4"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient><clipPath id="dc"><path d="M20 40A30 30 0 0 1 80 40Z"/><rect x="20" y="44" width="60" height="32" rx="7"/><rect x="8" y="44" width="9" height="26" rx="4.5"/><rect x="83" y="44" width="9" height="26" rx="4.5"/><rect x="34" y="70" width="10" height="20" rx="5"/><rect x="56" y="70" width="10" height="20" rx="5"/></clipPath></defs><g fill="url(#gg)"><path d="M20 40A30 30 0 0 1 80 40Z"/><rect x="20" y="44" width="60" height="32" rx="7"/><rect x="8" y="44" width="9" height="26" rx="4.5"/><rect x="83" y="44" width="9" height="26" rx="4.5"/><rect x="34" y="70" width="10" height="20" rx="5"/><rect x="56" y="70" width="10" height="20" rx="5"/></g><g stroke="#0c0c0e" stroke-width="2.8" stroke-linecap="round"><path d="M32 12L26 3M68 12L74 3"/></g><rect x="0" y="0" width="100" height="100" fill="url(#gh)" clip-path="url(#dc)"/><circle cx="38" cy="27" r="3" fill="#2a2a2d"/><circle cx="62" cy="27" r="3" fill="#2a2a2d"/></svg>';
function mk(){
  const p=document.createElement('div');p.className='phone';p.innerHTML=tpl;world.appendChild(p);
  const q=s=>p.querySelector(s);
  p.querySelectorAll('.k small').forEach(s=>{if(s.textContent==='KANAAL')s.textContent='CHANNEL';});
  q('#muteBtn').innerHTML='<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg><small>SOUND</small>';
  q('#ptt').disabled=false;q('#whoN').textContent='4';q('#chatRowT').textContent='Tap to chat';
  const wave=document.createElement('div');wave.className='wave';for(let i=0;i<21;i++)wave.appendChild(document.createElement('i'));
  q('#scr').insertBefore(wave,q('#chatRow'));
  [['right',-6,220,110],['left',-6,190,70],['left',-6,285,70]].forEach(([sd,o,top,h])=>{const d=document.createElement('div');d.className='side';d.style[sd]=o+'px';d.style.top=top+'px';d.style.height=h+'px';p.appendChild(d);});
  const bp=document.createElement('div');bp.className='back';bp.innerHTML='<div class="cam"><i></i><i></i><i></i></div>'+droid;p.appendChild(bp);
  return {el:p,led:q('#led'),num:q('#chNum'),sub:q('#chSub'),st:q('#status'),mini:q('#mini'),ptt:q('#ptt'),next:q('#nextBtn'),wave,bars:[...wave.children]};
}
const PH={A:mk(),B:mk()};
// packets, chip, link, offline icon
const pool=[];for(let i=0;i<16;i++){const d=document.createElement('div');d.className='pk';if(V)d.style.fontSize='15px';world.appendChild(d);pool.push(d);}
const chip=document.createElement('div');chip.className='chip';chip.style.cssText=`left:${LAY.chipX}px;top:${LAY.chipY}px;width:${LAY.chipW}px;box-sizing:border-box;font-size:19px;padding:16px 20px;`;
chip.innerHTML='<h4>What the server sees</h4><div id="sv"></div>';world.appendChild(chip);
const link=document.createElement('div');link.id='link';const lx0=LAY.A.x+LAY.A.s*235*.8,lx1=LAY.B.x-LAY.A.s*235*.8;link.style.cssText=`left:${lx0}px;top:${LAY.pathY-3}px;width:${lx1-lx0}px;`;world.appendChild(link);
const off=document.createElement('div');off.style.cssText=`position:absolute;left:${LAY.mid-80}px;top:${LAY.midY-80}px;width:160px;text-align:center;`;
off.innerHTML='<svg viewBox="0 0 24 24" width="160" height="160" fill="none" stroke="#f6a21a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M12 20h.01"/><path d="M3 3l18 18" stroke="#fff"/></svg>';world.appendChild(off);
const SEG=[['A','B',3,5.5,0],['B','A',6,8,0],['A','B',8,9,0],['A','B',11.5,12.5,0],['A','B',12.75,13.25,0],['B','A',13.75,14.25,0],['A','B',16,17.2,1]];
const CAPS=[{s:0,e:3,w:['Your','phone','is','a','*walkie-talkie.*']},{s:3,e:6,w:['Hold','*PTT.*','They','hear','you.']},{s:6,e:9.5,w:['Someone','talking?','*You','queue.*']},{s:9.5,e:12.5,w:['*Every*','channel.','At','once.']},{s:12.5,e:15.5,w:['*Encrypted.*','The','server','hears','nothing.']},{s:15.5,e:17.5,w:['No','internet?','*Still','works.*']}];
CAPS.forEach(c=>{const d=document.createElement('div');d.className='cap';d.style.cssText=`top:${LAY.cap.top}px;left:${LAY.cap.left}px;width:${LAY.cap.w}px;font-size:${LAY.cap.fs}px`;
  d.innerHTML=c.w.map(w=>{const em=w[0]==='*';const tx=w.replace(/\*/g,'');return `<span class="w">${em?'<em>'+tx+'</em>':tx}</span>`}).join(' ');c.el=d;c.ws=[...d.querySelectorAll('.w')];$('caps').appendChild(d);});
function idle(ch){return{led:'on',num:'0'+(ch+1),sub:CH[ch],status:'HOLD PTT TO TALK',ptt:0,next:0,amp:0,msgs:null};}
const tx=(o,st='YOU TALKING')=>{o.led='tx';o.status=st;o.ptt=1;o.amp=1;};
const rx=(o,st,a=.7)=>{o.led='rx';o.status=st;o.amp=a;};
function states(t){
  const A=idle(0),B=idle(0);
  const chB=t>=11&&t<12.5?2:t>=10&&t<11?1:0;Object.assign(B,{num:'0'+(chB+1),sub:CH[chB]});
  if(within(t,10,10.18)||within(t,11,11.18))B.next=1;
  if(within(t,3,5.5)){tx(A);rx(B,'MIA TALKING');}
  if(within(t,6,8)){tx(B);rx(A,'LUCA TALKING');}
  if(within(t,7,8)){A.ptt=1;A.led=(Math.floor(t*4)%2)?'wait':'on';A.status='WAIT 1ST IN LINE';}
  if(within(t,8,9)){tx(A,'YOUR TURN');rx(B,'MIA TALKING');}
  if(within(t,11.5,12.5)){tx(A);rx(B,'MIA FAMILY',.6);}
  if(t>=12.5&&t<15.5){
    const f=Math.floor(t*24);A.status=B.status='PRIVATE CHANNEL';
    if(t>=12.75){A.msgs=[{who:'YOU',txt:'on my way, 5 min',me:1}];B.msgs=[{who:'MIA',txt:scramble('on my way, 5 min',f,13.25,t,.04)}];}
    if(t>=13.75){A.msgs.push({who:'LUCA',txt:scramble('see you there',f+5,14.25,t,.04)});B.msgs.push({who:'YOU',txt:'see you there',me:1});}
  }
  if(t>=15.5&&t<17.5){for(const o of [A,B]){o.num='--';o.sub='OFFLINE';o.status='NEARBY 1 PHONE';}
    if(within(t,16,17.2)){tx(A);A.status='YOU TALKING';rx(B,'MIA TALKING');}}
  return{A,B};
}
function setText(el,v){if(el.dataset.v!==v){el.dataset.v=v;el.textContent=v;}}
function apply(o,s,t,ph){
  o.led.className='led '+s.led;setText(o.num,s.num);setText(o.sub,s.sub);setText(o.st,s.status);
  o.ptt.classList.toggle('down',!!s.ptt);o.next.classList.toggle('on',!!s.next);
  const w=s.amp>0;o.wave.style.display=w?'flex':'none';o.mini.style.display=w?'none':'flex';
  if(w)o.bars.forEach((b,i)=>{const h=6+s.amp*(70*Math.abs(Math.sin(t*9+i*.9+ph)*Math.sin(t*3.7+i*.31+ph))+14*Math.abs(Math.sin(t*17+i+ph)));b.style.height=h.toFixed(1)+'px';});
  o.mini.innerHTML=s.msgs?s.msgs.map(m=>`<div class="ml ${m.me?'me':''}"><b>${m.who}</b>${m.txt}</div>`).join(''):'';
}
const CUTS=[.5,3,6,9.5,12.5,15.5,17.5];
function render(t){
  const bump=Math.exp(-7*((t/BEAT)%1));
  let punch=0,fl=0;CUTS.forEach(ti=>{if(t>=ti){const d=t-ti;punch+=Math.exp(-10*d);fl+=Math.exp(-18*d);}});
  world.style.transform=`scale(${1+.035*punch+.004*bump})`;
  $('flash').style.opacity=clamp(fl*.16,0,.2).toFixed(3);
  $('glow').style.opacity=(.5+.5*bump).toFixed(3);$('glow').style.transform=`scale(${1+.04*bump})`;
  const S=states(t);
  // emphasis: speaker leans in, listener eases back (box-filtered so it is smooth)
  const emOf=who=>{let a=0;for(let j=0;j<6;j++){const s=states(t-.04*j)[who];a+=s.led==='tx'?.07:s.led==='rx'?-.035:0;}return 1+a/6;};
  ['A','B'].forEach(who=>{
    const o=PH[who],sg=who==='A'?1:-1,L=LAY[who],ph=who==='A'?0:1.7;
    let x=L.x,y=L.y+Math.sin(t*1.7+ph)*8;
    x+=-sg*(1-back(t/.6))*(V?800:1300);
    if(t>=17.5)x+=-sg*1500*easeIn((t-17.5)/.55);
    const ry=sg*17+sg*(-40)*0*1+sg*360*eIO((t-12)/1.0)*1;
    const rx_=Math.sin(t*1.3+ph)*1.6,rz=Math.sin(t*1.1+ph)*1.4+(t>=17.5?sg*10*easeIn((t-17.5)/.55):0);
    o.el.style.transform=`translate(${x}px,${y}px) perspective(2200px) rotateY(${ry}deg) rotateX(${rx_}deg) rotateZ(${rz}deg) scale(${L.s*emOf(who)*(1+.012*bump)})`;
    apply(o,S[who],t,ph);
    // rings from a transmitting phone
    let env=0;for(let j=0;j<5;j++)env+=states(t-.04*j)[who].led==='tx'?1:0;env/=5;
    rings[who].forEach((r,k)=>{const p=((t*1.0+k/3)%1),d=(260+p*820)*L.s/.76*(V?.9:1);
      r.style.borderColor='#f6a21a';r.style.width=r.style.height=d+'px';r.style.left=(L.x-d/2)+'px';r.style.top=(L.y-d/2)+'px';r.style.opacity=((1-p)*.5*env).toFixed(3);});
  });
  // packets
  let n=0;const off0=235*LAY.A.s*.8;
  SEG.forEach(([f,to,a,b,dir])=>{for(let k=0;;k++){const ts=a+k*.125;if(ts>=b)break;const p=(t-ts)/.5;if(p<0||p>1||n>=pool.length)continue;
    const sg=f==='A'?1:-1,x0=LAY[f].x+sg*off0,x1=LAY[to].x-sg*off0;
    const x=x0+(x1-x0)*p,y=LAY.pathY-(dir?0:LAY.arc*Math.sin(Math.PI*p));
    const e=pool[n++];e.style.display='block';e.style.transform=`translate(${x-40}px,${y-16}px) scale(${.85+.3*Math.sin(Math.PI*p)})`;
    e.style.opacity=Math.min(1,p*8,(1-p)*8).toFixed(3);e.textContent=scramble('xxxxxxx',Math.floor(t*18)+k*5,null,t);
    e.style.borderColor=dir?'#ffd23f':'#f6a21a';e.style.color=dir?'#ffd23f':'#f6a21a';}});
  for(;n<pool.length;n++)pool[n].style.display='none';
  // server chip (S5)
  const sv=clamp((t-12.9)/.35)*clamp((15.5-t)/.3);
  chip.style.display=sv>0?'block':'none';chip.style.opacity=sv;chip.style.transform=`translateY(${(1-ease((t-12.9)/.5))*40}px)`;
  if(sv>0){const f=Math.floor(t*14),X='xxxxxxxxxxxxxxxx';$('sv').innerHTML=`<div>channel&nbsp; 9f3a41c7...e10b</div><div>audio&nbsp;&nbsp;&nbsp; ${scramble(X,f,null,t)}</div><div>names&nbsp;&nbsp;&nbsp; ${scramble(X,f+3,null,t)}</div><div>chat&nbsp;&nbsp;&nbsp;&nbsp; ${scramble(X,f+9,null,t)}</div>`;}
  // offline link (S6)
  const of=clamp((t-15.5)/.3)*clamp((17.5-t)/.2);
  link.style.opacity=of;link.style.backgroundImage='repeating-linear-gradient(90deg,#f6a21a 0 22px,transparent 22px 42px)';link.style.backgroundPositionX=(t*260)+'px';
  off.style.display=of>0?'block':'none';off.style.opacity=of;off.style.transform=`scale(${.7+.3*back((t-15.5)/.45)})`;
  // captions (hard cuts on the beat, words pop)
  CAPS.forEach(c=>{const out=clamp((t-(c.e-.1))/.1);
    c.ws.forEach((w,i)=>{const p=clamp((t-c.s-i*.09)/.28);w.style.opacity=(Math.min(1,p*4)*(1-out)).toFixed(3);w.style.transform=`scale(${1+.5*(1-back(p))})`;});
    c.el.style.display=(t>=c.s&&t<c.e)?'block':'none';});
  // outro
  const wr=ease((t-17.5)/.6)*1700;$('wipe').style.display=t>=17.5?'block':'none';$('wipe').style.clipPath=`circle(${wr}px at 50% 50%)`;
  const o=$('outro');o.style.display=t>=17.5?'flex':'none';
  const im=o.querySelector('img'),h1=o.querySelector('h1'),pp=o.querySelector('p'),sm=o.querySelector('small');
  const a=back((t-17.8)/.5);im.style.transform=`scale(${a})`;im.style.opacity=clamp((t-17.8)/.15);
  const b=ease((t-18)/.4);h1.style.opacity=b;h1.style.transform=`translateY(${(1-b)*40}px)`;
  const c=ease((t-18.5)/.4);pp.style.opacity=c;pp.style.transform=`translateY(${(1-c)*24}px)`;
  sm.style.opacity=ease((t-19)/.4);
}
window.render=render;render(0);
