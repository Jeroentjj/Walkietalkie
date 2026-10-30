const {chromium}=require('playwright');const fs=require('fs');
(async()=>{fs.mkdirSync('frames',{recursive:true});
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+__dirname+'/stage.html');await p.evaluate(()=>document.fonts.ready);
for(let i=0;i<600;i++){await p.evaluate(t=>window.render(t),i/30);
 await p.screenshot({path:`frames/f${String(i).padStart(4,'0')}.jpg`,type:'jpeg',quality:93});}
await b.close();console.log('frames done');})();
