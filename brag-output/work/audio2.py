import numpy as np, wave
SR=44100; DUR=20.0; N=int(SR*DUR)
rng=np.random.default_rng(21)
M=[np.zeros(N),np.zeros(N)]; S=[np.zeros(N),np.zeros(N)]
def put(bus,t,x,g=1.0,pan=0.0):
    i=int(round(t*SR))
    if i<0 or i>=N: return
    x=x[:N-i]; bus[0][i:i+len(x)]+=x*g*(1-max(0,pan)); bus[1][i:i+len(x)]+=x*g*(1+min(0,pan))
mtof=lambda m:440*2**((m-69)/12)
def lp(x,fc):
    a=np.exp(-2*np.pi*fc/SR); y=np.empty_like(x); s=0.0
    for i in range(len(x)): s=(1-a)*x[i]+a*s; y[i]=s
    return y
hp=lambda x,fc:x-lp(x,fc)
def adsr(n,a,rel):
    t=np.arange(n)/SR; return np.minimum(1,t/a)*np.minimum(1,(n/SR-t)/rel)
def brass(m,dur,a=.045,rel=.12):
    n=int((dur+rel)*SR); t=np.arange(n)/SR
    f=mtof(m)*(1+.004*np.sin(2*np.pi*5.6*t)*np.minimum(1,t/.35))
    ph=2*np.pi*np.cumsum(f)/SR
    x=sum(np.sin(k*ph)/k**.8 for k in range(1,11))*.32
    return x*adsr(n,a,rel)
def pluck(m,dur,d=.09):
    n=int(dur*SR); t=np.arange(n)/SR; ph=2*np.pi*mtof(m)*t
    return sum(np.sin(k*ph)/k for k in range(1,8))*.45*np.exp(-t/d)*np.minimum(1,t/.004)
def pad(m,dur):
    n=int((dur+.4)*SR); t=np.arange(n)/SR; x=0
    for det in (-.12,.12):
        ph=2*np.pi*mtof(m+det*.1)*t; x=x+np.sin(ph)+.45*np.sin(2*ph)+.2*np.sin(3*ph)
    return x*.25*adsr(n,.3,.4)
def sub(m,dur,d=.2):
    n=int(dur*SR); t=np.arange(n)/SR; ph=2*np.pi*mtof(m)*t
    return (np.sin(ph)+.3*np.sin(2*ph))*np.exp(-t/d)*np.minimum(1,t/.004)
def timp(scale=1.0):
    n=int(.55*SR); t=np.arange(n)/SR; f=52+85*np.exp(-t*26); ph=2*np.pi*np.cumsum(f)/SR
    x=np.sin(ph)*np.exp(-t*6.5)+.35*np.sin(2*ph)*np.exp(-t*11)
    nz=hp(rng.standard_normal(n),900)*np.exp(-t*90)*.5
    return (x+nz)*scale
def snare(v=1.0):
    n=int(.2*SR); t=np.arange(n)/SR
    return (hp(rng.standard_normal(n),1800)*np.exp(-t*24)+np.sin(2*np.pi*200*t)*np.exp(-t*30)*.35)*v
def crash(dur=1.4):
    n=int(dur*SR); t=np.arange(n)/SR
    return hp(rng.standard_normal(n),4500)*np.exp(-t*(3.2 if dur<2 else 1.6))*np.minimum(1,t/.004)
def shaker():
    n=int(.05*SR); return hp(rng.standard_normal(n),7000)*np.exp(-np.arange(n)/SR*110)
# ---------- adventure score: D major / mixolydian, 120 BPM, 8 bars + build + final hit
CH_=[(50,[50,57,62,66]),(48,[48,55,60,64]),(43,[43,55,59,62]),(50,[50,57,62,66]),(47,[47,54,59,62]),(43,[43,55,59,62]),(45,[45,57,61,64]),(45,[45,57,61,64])]
for bar,(root,ch) in enumerate(CH_):
    t0=bar*2.0
    for m in ch: put(M,t0,pad(m,2.0),.05,pan=((m%5)-2)*.08)
    if bar>=1:
        # galloping string ostinato: long-short-short on every beat
        for b in range(4):
            tb=t0+b*.5
            for off,note in ((0,root+12),(.25,root+19),(.375,root+24)):
                put(M,tb+off,pluck(note,.2,.07),.11,pan=-.15+.1*((b+int(off*8))%3))
        for b in range(8): put(M,t0+b*.25,sub(root-12,.22),.30)   # driving 8th-note bass
# melody: heroic brass motif (midi, start, dur)
MEL=[(0,62,.45),(.5,69,.45),(1,74,.95),
     (2,72,.45),(2.5,67,.45),(3,72,.45),(3.5,76,.45),
     (4,71,.45),(4.5,74,.45),(5,79,.95),
     (6,78,.45),(6.5,76,.45),(7,74,.45),(7.5,69,.45),
     (8,74,.45),(8.5,78,.45),(9,83,.95),
     (10,81,.45),(10.5,79,.45),(11,78,.45),(11.5,76,.45),
     (12,76,.45),(12.5,81,.45),(13,85,.95),
     (14,83,.45),(14.5,81,.45),(15,80,.45),(15.5,81,.45),
     (16,81,.45),(16.5,85,.45),(17,88,.45)]
for t,m,d in MEL:
    put(M,t,brass(m,d),.20,pan=.1)
    if t>=2: put(M,t,brass(m-12,d),.07,pan=-.15)
# drums
put(M,0.5,timp(1.2),.9)                               # phones slam in
for k in range(int(2/.5),35):                          # timpani on every beat from bar 1
    t=k*.5
    if t<17.5: put(M,t,timp(.8 if k%2==0 else .45),.55)
for k in range(8,35):
    t=k*.5
    if t<16 and k%2==1: put(M,t,snare(.8),.20)         # marching snare on 2 and 4
    if t<16: put(M,t+.25,shaker(),.05,pan=.3)
for k in range(8,35):
    t=k*.5
    if t<16: put(M,t,shaker(),.035,pan=-.3)
# snare roll 16.0 -> 17.5 (crescendo), then the finale
for i,t in enumerate(np.arange(16.0,17.5,.125)): put(M,t,snare(.35+.65*i/12),.26)
put(M,17.5,timp(1.4),1.0); put(M,17.5,timp(1.2),.6,pan=.1)
for bar in (16.0,): 
    for m in (45,57,61,64): put(M,bar,pad(m,1.5),.06)
for m in (38,50,57,62,66,69): put(M,17.5,pad(m,2.5),.07)
put(M,17.5,brass(86,2.3,a=.03,rel=.5),.26); put(M,17.5,brass(74,2.3,a=.03,rel=.5),.16); put(M,17.5,brass(81,2.3,a=.03,rel=.5),.10)
put(M,17.5,sub(26,2.2,d=.8),.45)
# cymbal crashes on cuts
for t in (3,6,9.5,12.5,15.5): put(M,t,crash(1.3),.12)
put(M,.5,crash(1.3),.12); put(M,17.5,crash(2.6),.20)
# reverb on the music bus
irn=int(1.5*SR); ir=rng.standard_normal(irn)*np.exp(-np.arange(irn)/SR/.42); ir/=np.abs(ir).sum()**.5
def rev(x):
    n=len(x)+irn; X=np.fft.rfft(x,n); Y=np.fft.rfft(ir,n); return np.fft.irfft(X*Y,n)[:N]
mix=[M[0]+rev(M[0])*.16, M[1]+rev(M[1])*.16]
# ---------- SFX (soft, in key) ----------
def tone(f,dur,a=.002,d=.08):
    n=int(dur*SR); t=np.arange(n)/SR; return (np.sin(2*np.pi*f*t)+.12*np.sin(4*np.pi*f*t))*np.exp(-t/d)*np.minimum(1,t/a)
def click(t,g=.16):
    n=int(.02*SR); put(S,t,hp(rng.standard_normal(n),1500)*np.exp(-np.arange(n)/SR*250),g); put(S,t,tone(1400,.03,.001,.01),g*.5)
def roger(t,g=.13): put(S,t,tone(mtof(86),.07,.002,.05),g); put(S,t+.125,tone(mtof(81),.12,.002,.09),g)
def beep(t,g=.15): put(S,t,tone(880,.1,.002,.07),g); put(S,t+.25,tone(mtof(86),.18,.002,.1),g)
def chirp(t,g=.09): put(S,t,tone(mtof(78),.08,.002,.05),g); put(S,t+.1,tone(mtof(85),.1,.002,.07),g)
def tick(t,g=.12): put(S,t,tone(mtof(86),.04,.001,.025),g)
click(3.0); chirp(3.05); roger(5.5)
click(6.0); chirp(6.05); click(7.0); beep(8.0); roger(9.0)
tick(10.0); tick(11.0); click(11.5); chirp(11.55); roger(12.5,.10)
tick(13.25,.08); tick(14.25,.08); tick(15.5,.10); click(16.0); chirp(16.05); roger(17.2,.10)
# data blips while audio packets fly (soft pentatonic sparkle)
PENT=[74,76,78,81,83,86]
for a,b in ((3,5.5),(6,8),(8,9),(11.5,12.5),(12.75,13.25),(13.75,14.25),(16,17.2)):
    for k,t in enumerate(np.arange(a,b,.125)):
        put(S,t+.5,tone(mtof(PENT[(k*5)%6]),.06,.001,.03),.018,pan=(-.4 if k%2 else .4))
# 360 spin: whoosh 12.0-13.0 and landing thud
n=int(1.0*SR); nz=rng.standard_normal(n); sp=np.zeros(n)
for i,fc in enumerate(np.concatenate([np.linspace(500,4200,5),np.linspace(4200,500,5)])):
    seg=slice(i*n//10,(i+1)*n//10); sp[seg]=hp(nz,fc)[seg]
sp*=np.sin(np.linspace(0,np.pi,n))**2; put(S,12.0,sp,.10)
put(S,13.0,timp(.8),.45)
# riser 15.9-17.5 handled by snare roll; short whoosh as phones leave
n=int(.6*SR); w=hp(rng.standard_normal(n),600)*np.sin(np.linspace(0,np.pi,n))**2; put(S,17.5,w,.06)
out=np.stack([mix[0]*.9+S[0],mix[1]*.9+S[1]],1)
out=np.tanh(out*1.3)/np.tanh(1.3)
fi=np.minimum(1,np.arange(N)/(SR*.03)); fo=np.minimum(1,(N-np.arange(N))/(SR*1.3)); out*=(fi*fo)[:,None]
pk=np.abs(out).max(); out*=.89/pk
pcm=(out*32767).astype('<i2'); w=wave.open('audio2.wav','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes()); w.close(); print('ok',pk)
