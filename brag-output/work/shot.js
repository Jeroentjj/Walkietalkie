const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+__dirname+'/stage.html');await p.evaluate(()=>document.fonts.ready);
for(const t of process.argv.slice(2)){await p.evaluate(t=>window.render(t),+t);await p.waitForTimeout(80);await p.screenshot({path:`still-${t}.png`});}
await b.close();})();
