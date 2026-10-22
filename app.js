// Walkie: P2P push-to-talk over WebRTC (DTLS-SRTP encrypted end-to-end).
// The PeerJS server is only used for signaling; it sees a hash of the channel code, never audio.
const $ = (id) => document.getElementById(id);
const led = $('led'), status = $('status'), ptt = $('ptt'), remoteAudio = $('remote'), dlg = $('dlg');

let peer, call, conn, mic, channel, retryTimer, audioCtx;

const setStatus = (t) => (status.textContent = t);

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('walkie:' + text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function beep(freqs) {
  audioCtx ||= new AudioContext();
  let t = audioCtx.currentTime;
  for (const f of freqs) {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = f; g.gain.value = 0.08;
    o.connect(g).connect(audioCtx.destination);
    o.start(t); o.stop(t + 0.07); t += 0.08;
  }
}

function genCode() {
  const words = ['vos', 'uil', 'das', 'reiger', 'otter', 'havik', 'eland', 'lynx', 'raaf', 'wolf'];
  const r = crypto.getRandomValues(new Uint32Array(3));
  return `${words[r[0] % words.length]}-${words[r[1] % words.length]}-${(r[2] % 1e6).toString().padStart(6, '0')}`;
}

function setLinked(on) {
  led.className = on ? 'led on' : 'led';
  ptt.disabled = !on;
  document.querySelectorAll('#bars i').forEach((b) => b.classList.toggle('a', on));
  setStatus(on ? 'Verbonden ✓' : channel ? 'Wachten op partner…' : 'Druk op CH');
}

function hangup() {
  clearTimeout(retryTimer);
  call?.close(); conn?.close(); peer?.destroy();
  call = conn = peer = null;
}

function wireConn(c) {
  conn = c;
  c.on('data', (d) => {
    if (d.talk) { led.className = 'led tx'; setStatus('◀ Ontvangen…'); }
    else { setLinked(true); beep([1200, 900]); }
  });
  c.on('close', reconnect);
}

function wireCall(c) {
  call = c;
  c.on('stream', (s) => { remoteAudio.srcObject = s; remoteAudio.play().catch(() => {}); setLinked(true); beep([900, 1200]); });
  c.on('close', reconnect);
  c.on('error', reconnect);
}

function reconnect() {
  if (!channel) return;
  setLinked(false);
  hangup();
  retryTimer = setTimeout(() => join(channel), 1500);
}

async function join(code) {
  hangup();
  channel = code;
  localStorage.setItem('walkie-ch', code);
  $('chName').textContent = 'CH ' + code;
  setStatus('Verbinden…');
  if (!mic) {
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch { setStatus('Microfoon geweigerd'); return; }
  }
  mic.getAudioTracks().forEach((t) => (t.enabled = false));

  const h = (await sha256(code)).slice(0, 40);
  const idA = `wt-${h}-a`, idB = `wt-${h}-b`;

  // First to arrive claims slot A and waits; the second takes slot B and calls A.
  const p = new Peer(idA);
  peer = p;
  p.on('open', () => setLinked(false));
  p.on('call', (c) => {
    if (c.peer !== idB) return c.close();
    call?.close();
    c.answer(mic);
    wireCall(c);
  });
  p.on('connection', (c) => { if (c.peer === idB) wireConn(c); else c.close(); });
  p.on('error', (e) => {
    if (e.type === 'unavailable-id' && peer === p) {
      p.destroy();
      const q = new Peer(idB);
      peer = q;
      q.on('open', () => { wireCall(q.call(idA, mic)); wireConn(q.connect(idA, { reliable: true })); });
      q.on('error', (e2) => {
        if (e2.type === 'unavailable-id') setStatus('Kanaal is vol (max 2)');
        else reconnect();
      });
    } else if (e.type !== 'peer-unavailable') {
      setStatus('Fout: ' + e.type);
      reconnect();
    }
  });
}

function talk(on) {
  if (ptt.disabled || !mic) return;
  mic.getAudioTracks().forEach((t) => (t.enabled = on));
  ptt.classList.toggle('down', on);
  led.className = on ? 'led tx' : 'led on';
  setStatus(on ? '▶ Zenden…' : 'Verbonden ✓');
  if (conn?.open) conn.send({ talk: on });
  if (on) navigator.vibrate?.(30); else beep([1500]);
}

ptt.addEventListener('pointerdown', (e) => { e.preventDefault(); ptt.setPointerCapture(e.pointerId); talk(true); });
['pointerup', 'pointercancel'].forEach((ev) => ptt.addEventListener(ev, () => talk(false)));
ptt.addEventListener('contextmenu', (e) => e.preventDefault());

$('chBtn').onclick = () => { $('code').value = channel || genCode(); dlg.showModal(); };
$('genBtn').onclick = () => ($('code').value = genCode());
$('shareBtn').onclick = () => {
  const text = `Mijn walkie-kanaal: ${$('code').value}`;
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else navigator.clipboard.writeText($('code').value).then(() => alert('Gekopieerd'));
};
$('joinBtn').onclick = () => {
  const c = $('code').value.trim();
  if (c.length < 6) return alert('Code moet minstens 6 tekens zijn');
  dlg.close();
  join(c);
};
$('offBtn').onclick = () => {
  channel = null; hangup(); localStorage.removeItem('walkie-ch');
  mic?.getTracks().forEach((t) => t.stop()); mic = null;
  $('chName').textContent = '— geen kanaal —'; setLinked(false);
};

const saved = localStorage.getItem('walkie-ch');
if (saved) join(saved);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
