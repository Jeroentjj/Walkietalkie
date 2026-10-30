import numpy as np, wave
SR=44100; DUR=20.0; N=int(SR*DUR); B=0.5
rng=np.random.default_rng(7)
L=np.zeros(N); R=np.zeros(N)
def add(buf,t,x,g=1.0):
    i=int(t*SR); 
    if i>=N: return
    x=x[:N-i]; buf[i:i+len(x)]+=x*g
def env(n,a=.003,d=.2):
    t=np.arange(n)/SR; e=np.minimum(1,t/a)*np.exp(-t/d); return e
def tone(f,dur,a=.004,d=.15,harm=(1,.3,.1),vib=0):
    n=int(dur*SR); t=np.arange(n)/SR
    x=sum(h*np.sin(2*np.pi*f*(k+1)*t) for k,h in enumerate(harm)); return x*env(n,a,d)
def lp(x,fc):
    a=np.exp(-2*np.pi*fc/SR); y=np.zeros_like(x); s=0
    for i in range(len(x)): s=(1-a)*x[i]+a*s; y[i]=s
    return y
def hp(x,fc): return x-lp(x,fc)
mtof=lambda m:440*2**((m-69)/12)
def both(t,x,g=1,pan=0):
    add(L,t,x,g*(1-max(0,pan))); add(R,t,x,g*(1+min(0,pan)))
# chords per bar (2s): Am F C G, A-minor
chords=[[57,60,64],[53,57,60],[48,55,64],[55,59,62]]
roots=[45,41,36,43]
for bar in range(10):
    c=chords[bar%4]; t0=bar*2.0
    for m in c:
        for det in (-.15,.15):
            n=int(2.2*SR); t=np.arange(n)/SR
            x=np.sin(2*np.pi*mtof(m+det*0.1)*t)*.5+np.sin(4*np.pi*mtof(m)*t)*.12
            x*=np.minimum(1,t/.25)*np.minimum(1,(2.2-t)/.4)
            both(t0,x,.045,pan=.2*det*3)
    # bass: beat 1, and of 2, beat 3
    for off,dur in ((0,.45),(1.0,.45),(1.5,.45)):
        if t0+off>=2.0: both(t0+off,tone(mtof(roots[bar%4]),dur,a=.005,d=.18,harm=(1,.25)),.30)
    # arp pluck 8th notes
    pat=[0,1,2,1,2,1,0,2]
    for k in range(4):
        m=c[pat[k%8]]+12+(12 if k%4==2 else 0)
        both(t0+k*.5, tone(mtof(m),.45,a=.003,d=.12,harm=(1,.35,.12)),.07,pan=-.25+.2*(k%2))
        both(t0+k*.5+.25, tone(mtof(c[(pat[k]+1)%3]+24),.3,a=.003,d=.08,harm=(1,.2)),.035,pan=.3)
# drums from t=2.0
def kick():
    n=int(.32*SR); t=np.arange(n)/SR; f=48+90*np.exp(-t*30)
    ph=2*np.pi*np.cumsum(f)/SR; return np.sin(ph)*np.exp(-t*11)
def hat():
    n=int(.06*SR); x=hp(rng.standard_normal(n),6000)[:n]; return x*np.exp(-np.arange(n)/SR*90)
def snare():
    n=int(.18*SR); t=np.arange(n)/SR; x=hp(rng.standard_normal(n),1500)*np.exp(-t*28)+np.sin(2*np.pi*190*t)*np.exp(-t*30)*.4; return x
K=kick();H=hat();S=snare()
t=2.0
while t<17.5-1e-6:
    both(t,K,.55)
    beat=int(round(t/B))
    if beat%2==1 and t>=4: both(t,S,.16)
    both(t+.25,H,.06,pan=.2); 
    t+=B*1.0
    if t<17.5: pass
# offbeat hats at 8ths already via +.25; add 16th texture for 12.5+..
for tt in np.arange(10.0,17.5,.25): both(tt+.125,H,.022,pan=-.3)
# riser into outro 16.5-17.5
n=int(1.0*SR); nz=rng.standard_normal(n); sw=np.zeros(n)
for i,fc in enumerate(np.linspace(400,7000,10)):
    seg=slice(i*n//10,(i+1)*n//10); sw[seg]=hp(nz,fc)[seg]
sw*=np.linspace(0,1,n)**2; both(16.5,sw,.07)
# outro stab at 17.5 (A minor 9 -> A major-ish)
for m in (45,57,60,64,67,69): both(17.5,tone(mtof(m),2.4,a=.004,d=.9,harm=(1,.3,.1)),.10)
both(17.5,K,.7); both(17.5,tone(mtof(33),1.6,a=.005,d=.7,harm=(1,.2)),.35)
# whoosh at 0 (radio pop-in) low thump
both(0.02,tone(mtof(45),.5,a=.003,d=.15,harm=(1,.3)),.25)
n=int(.5*SR); w=hp(rng.standard_normal(n),800)*np.linspace(0,1,n)**2*np.exp(-np.linspace(0,1,n)*3); both(0,w,.05)
# SFX (soft, in key A minor; on the beat grid)
def click(t,g=.18):
    n=int(.02*SR); x=hp(rng.standard_normal(n),1500)*np.exp(-np.arange(n)/SR*250); both(t,x,g); both(t,tone(1400,.03,a=.001,d=.01,harm=(1,)),g*.5)
def roger(t,g=.14):
    both(t,tone(mtof(88),.07,a=.002,d=.05,harm=(1,.1)),g); both(t+.125,tone(mtof(81),.12,a=.002,d=.09,harm=(1,.1)),g)
def beep(t,g=.16):
    both(t,tone(880,.1,a=.002,d=.07,harm=(1,.15)),g); both(t+.25,tone(1318.5,.18,a=.002,d=.1,harm=(1,.15)),g)
def chirp(t,g=.10):
    both(t,tone(mtof(76),.08,a=.002,d=.05,harm=(1,)),g); both(t+.1,tone(mtof(83),.1,a=.002,d=.07,harm=(1,)),g)
def tick(t,g=.14): both(t,tone(mtof(88),.04,a=.001,d=.025,harm=(1,.3)),g)
click(3.0); roger(5.5)                   # you talk, release
click(6.0,.05); chirp(6.0)               # Mia starts
click(7.0)                               # you press: queue
beep(8.0); roger(9.0)                    # your turn; release
tick(10.0); tick(11.0)                   # channel taps
chirp(11.5)                              # Mia on ch 01
beep(12.5,.06)                           # message lands
for k,tt in enumerate((13.5,14.0)): tick(tt,.07)  # decrypt lands
tick(15.5,.10)                           # offline
# 360 spin: whoosh 12.0-13.0 and landing thud
n=int(1.0*SR); nz=rng.standard_normal(n); sp=np.zeros(n)
for i,fc in enumerate(np.concatenate([np.linspace(500,4200,5),np.linspace(4200,500,5)])):
    seg=slice(i*n//10,(i+1)*n//10); sp[seg]=hp(nz,fc)[seg]
sp*=np.sin(np.linspace(0,np.pi,n))**2; both(12.0,sp,.09)
both(13.0,tone(mtof(45),.5,a=.003,d=.14,harm=(1,.3)),.22)
# mix
mix=np.stack([L,R],1)
# gentle glue: lowpass-free soft clip + fades
mix=np.tanh(mix*1.4)/np.tanh(1.4)
fi=np.minimum(1,np.arange(N)/(SR*.05)); fo=np.minimum(1,(N-np.arange(N))/(SR*1.2))
mix*= (fi*fo)[:,None]
pk=np.abs(mix).max(); mix*=0.89/pk
pcm=(mix*32767).astype('<i2')
w=wave.open('audio.wav','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes()); w.close()
print('ok',pk)
