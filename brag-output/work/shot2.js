const {chromium}=require('playwright');const V=process.env.V;
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:V?{width:1080,height:1920}:{width:1920,height:1080}});
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+__dirname+'/stage2.html'+(V?'?v=1':''));await p.evaluate(()=>document.fonts.ready);
for(const t of process.argv.slice(2)){await p.evaluate(t=>window.render(t),+t);await p.waitForTimeout(80);await p.screenshot({path:`s2${V?'v':''}-${t}.png`});}
await b.close();})();
