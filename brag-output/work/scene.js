const $=id=>document.getElementById(id);
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const ease=x=>1-Math.pow(1-clamp(x),3);
const easeIn=x=>{x=clamp(x);return x*x*x;};
const back=x=>{x=clamp(x);const c=2.70158;return 1+c*Math.pow(x-1,3)+1.70158*Math.pow(x-1,2);};
const within=(t,a,b)=>t>=a&&t<b;
const BEAT=.5;
const CH=['FAMILY','BIKE CLUB','CAMPING'];
const CIPH='abcdefghijklmnopqrstuvwxyz0123456789+/=#%&';
const hash=(i,f)=>Math.abs(((i+1)*7919+(f+3)*104729+((i*31)^f)*13)|0)%CIPH.length;
function scramble(text,f,resolveAt,t,rate){
  let o='';for(let i=0;i<text.length;i++){
    if(text[i]===' ')o+=' ';
    else if(resolveAt!=null&&t>=resolveAt+i*rate)o+=text[i];
    else o+=CIPH[hash(i,f)];}
  return o;}
const CAPS=[
 {s:0,e:3.5,side:'L',top:330,w:['Your','phone','is','a','*walkie-talkie.*']},
 {s:3,e:6.5,side:'R',top:300,w:['Hold','*PTT.*','Everyone','in','the','channel','hears','you.']},
 {s:6,e:9.9,side:'L',top:300,w:['Someone','talking?','You','queue.','*Beep,*','*your','turn.*']},
 {s:9.5,e:13,side:'R',top:330,w:['Listen','to','*every','channel*','at','once.']},
 {s:12.5,e:16,side:'L',top:300,w:['*Encrypted*','on','your','phone.','The','server','hears','nothing.']},
 {s:15.5,e:17.7,side:'R',top:340,w:['No','internet?','*Still','works.*']},
];
const capsEl=$('caps');
CAPS.forEach(c=>{const d=document.createElement('div');d.className='cap';
  d.style.top=c.top+'px';d.style.left=(c.side==='L'?110:1290)+'px';d.style.width='520px';
  d.innerHTML=c.w.map(w=>{const em=w[0]==='*';const tx=w.replace(/\*/g,'');return `<span class="w">${em?'<em>'+tx+'</em>':tx}</span>`}).join(' ');
  c.el=d;c.ws=[...d.querySelectorAll('.w')];capsEl.appendChild(d);});
const scr=$('scr'),mini=$('mini');
const wave=document.createElement('div');wave.className='wave';
for(let i=0;i<21;i++)wave.appendChild(document.createElement('i'));
scr.insertBefore(wave,$('chatRow'));
const wbars=[...wave.children];
const ringsEl=$('rings');const rings=[];
for(let i=0;i<3;i++){const r=document.createElement('div');r.className='ring';ringsEl.appendChild(r);rings.push(r);}
document.querySelectorAll('.k small').forEach(s=>{if(s.textContent==='KANAAL')s.textContent='CHANNEL';});
$('muteBtn').innerHTML='<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg><small>SOUND</small>';
$('ptt').disabled=false;$('whoN').textContent='4';
$('chatRowT').textContent='Tap to chat';
const chip=document.createElement('div');chip.className='chip';chip.style.left='1290px';chip.style.top='360px';
chip.innerHTML='<h4>What the server sees</h4><div id="sv"></div>';document.body.appendChild(chip);
const tagL=document.createElement('div');tagL.className='tag';tagL.style.left='110px';tagL.style.top='250px';tagL.textContent='On your phone';document.body.appendChild(tagL);
const off=document.createElement('div');off.style.cssText='position:absolute;left:1290px;top:520px;width:200px;height:200px;';
off.innerHTML='<svg viewBox="0 0 24 24" width="200" height="200" fill="none" stroke="#f6a21a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M12 20h.01"/><path d="M3 3l18 18" stroke="#fff"/></svg>';
document.body.appendChild(off);
function setText(el,v){if(el.dataset.v!==v){el.dataset.v=v;el.innerHTML=v;}}
function render(t){
  const bump=Math.exp(-7*((t/BEAT)%1));
  $('glow').style.opacity=(.55+.45*bump).toFixed(3);
  $('glow').style.transform=`scale(${1+.04*bump})`;
  const x0=clamp(t/.6);let y=500*(1-back(x0)),op=clamp(t/.15),rot=0,sc=1+.01*bump;
  if(t>=17.5){const x=easeIn((t-17.5)/.55);y+=1300*x;rot=14*x;}
  $('rw').style.opacity=op;$('rw').style.transform=`translateY(${y}px) rotate(${rot}deg) scale(${sc})`;
  let led='on',num='01',sub=CH[0],status='HOLD PTT TO TALK',ptt=false,next=false,amp=0,ring=null,msgs=null;
  const chNum=t<10?0:t<11?1:2;
  if(t>=10&&t<12.5){num='0'+(chNum+1);sub=CH[chNum];}
  if(within(t,10,10.18)||within(t,11,11.18))next=true;
  if(within(t,3,5.5)){led='tx';status='YOU TALKING';ptt=true;amp=1;ring=['#f6a21a',3,5.5];}
  if(within(t,6,8)){led='rx';status='MIA TALKING';amp=.7;ring=['#ffd23f',6,8.5];}
  if(within(t,7,8)){ptt=true;led=(Math.floor(t*4)%2)?'wait':'on';status='WAIT 1ST IN LINE';}
  if(within(t,8,9)){led='tx';status='YOUR TURN';ptt=true;amp=1;ring=['#f6a21a',8,9.2];}
  if(within(t,11.5,12.5)){led='rx';status='MIA  FAMILY';amp=.6;ring=['#ffd23f',11.5,12.9];}
  if(t>=12.5&&t<15.5){
    const f=Math.floor(t*24);
    msgs=[{who:'MIA',txt:scramble('on my way, 5 min',f,13.25,t,.045),me:0},{who:'YOU',txt:scramble('perfect, see you there',f+7,14.0,t,.04),me:1}];
    status='PRIVATE CHANNEL';
  }
  if(t>=15.5&&t<17.5){num='--';sub='OFFLINE';status='NEARBY  3 PHONES';ring=['#f6a21a',16,17.6];}
  $('led').className='led '+led;
  setText($('chNum'),num);setText($('chSub'),sub);setText($('status'),status);
  $('ptt').classList.toggle('down',ptt);$('nextBtn').classList.toggle('on',next);
  const showWave=amp>0;
  wave.style.display=showWave?'flex':'none';
  mini.style.display=showWave?'none':'flex';
  if(showWave)wbars.forEach((b,i)=>{const h=6+amp*(70*Math.abs(Math.sin(t*9+i*.9)*Math.sin(t*3.7+i*.31))+14*Math.abs(Math.sin(t*17+i)));b.style.height=h.toFixed(1)+'px';});
  mini.innerHTML=msgs?msgs.map(m=>`<div class="ml ${m.me?'me':''}"><b>${m.who}</b>${m.txt}</div>`).join(''):'';
  rings.forEach((r,k)=>{
    if(!ring||t<ring[1]||t>=ring[2]){r.style.opacity=0;return;}
    const p=(((t-ring[1])*1.0+k/3)%1);
    const env=clamp((t-ring[1])/.2)*clamp((ring[2]-t)/.3);
    const d=380+p*1050;
    r.style.borderColor=ring[0];r.style.width=d+'px';r.style.height=d+'px';r.style.marginLeft=-d/2+'px';r.style.marginTop=-d/2+'px';
    r.style.opacity=((1-p)*.55*env).toFixed(3);});
  CAPS.forEach(c=>{
    const out=clamp((t-(c.e-.3))/.3);
    c.ws.forEach((w,i)=>{const e=ease((t-c.s-i*.12)/.28);w.style.opacity=(e*(1-out)).toFixed(3);
      w.style.transform=`translateY(${(1-e)*26+out*-10}px)`;});
    c.el.style.display=(t>=c.s&&t<c.e)?'block':'none';});
  const sv=clamp((t-12.5)/.4)*clamp((16-t)/.3);
  chip.style.opacity=sv;chip.style.transform=`translateY(${(1-ease((t-12.5)/.5))*30}px)`;
  tagL.style.opacity=sv;tagL.style.display=sv>0?'block':'none';
  if(sv>0){const f=Math.floor(t*14);const X='xxxxxxxxxxxxxxxxxxxxx';
    $('sv').innerHTML=`<div>channel&nbsp; 9f3a41c7...e10b</div><div>audio&nbsp;&nbsp;&nbsp; ${scramble(X,f,null,t)}</div><div>names&nbsp;&nbsp;&nbsp; ${scramble(X,f+3,null,t)}</div><div>chat&nbsp;&nbsp;&nbsp;&nbsp; ${scramble(X,f+9,null,t)}</div>`;}
  chip.style.display=sv>0?'block':'none';
  const of=clamp((t-15.5)/.4)*clamp((17.7-t)/.3);
  off.style.opacity=of;off.style.display=of>0?'block':'none';
  off.style.transform=`scale(${.8+.2*back((t-15.5)/.5)})`;
  const wr=ease((t-17.5)/.65)*1500;
  $('wipe').style.display=t>=17.5?'block':'none';
  $('wipe').style.clipPath=`circle(${wr}px at 50% 50%)`;
  const o=$('outro');o.style.display=t>=17.5?'flex':'none';
  const im=o.querySelector('img'),h1=o.querySelector('h1'),p=o.querySelector('p'),sm=o.querySelector('small');
  const a=back((t-17.8)/.5);im.style.transform=`scale(${a})`;im.style.opacity=clamp((t-17.8)/.15);
  const b=ease((t-18)/.4);h1.style.opacity=b;h1.style.transform=`translateY(${(1-b)*40}px)`;
  const c=ease((t-18.5)/.4);p.style.opacity=c;p.style.transform=`translateY(${(1-c)*24}px)`;
  const d=ease((t-19)/.4);sm.style.opacity=d;
}
window.render=render;render(0);
