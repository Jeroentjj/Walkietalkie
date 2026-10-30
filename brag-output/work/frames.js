const V=process.argv[2]==='v';const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const D=V?'frames-v':'frames';fs.mkdirSync(D,{recursive:true});
const b=await chromium.launch();const p=await b.newPage({viewport:V?{width:1080,height:1920}:{width:1920,height:1080}});
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+__dirname+'/stage.html'+(V?'?v=1':''));await p.evaluate(()=>document.fonts.ready);
for(let i=0;i<600;i++){await p.evaluate(t=>window.render(t),i/30);
 await p.screenshot({path:`${D}/f${String(i).padStart(4,'0')}.jpg`,type:'jpeg',quality:93});}
await b.close();console.log('frames done');})();
