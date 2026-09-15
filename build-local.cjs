const fs=require('node:fs');
let html=fs.readFileSync('dist/index.html','utf8');
html=html.replace('<link rel="stylesheet" href="style.css">',()=>'<style>'+fs.readFileSync('dist/style.css','utf8')+'</style>');
for(const name of ['jszip.min.js','engine.js','pdf-runtime.js','pdf-import.js','app.js'])html=html.replace('<script src="'+name+'"></script>',()=>'<script>'+fs.readFileSync('dist/'+name,'utf8').replace(/<\/script/gi,'<\\/script')+'</script>');
html=html.replace('</head>',()=>'<script type="text/plain" id="pdfjs-license">'+fs.readFileSync('dist/PDFJS-LICENSE.txt','utf8')+'</script></head>');
fs.writeFileSync('Korrekturwerkstatt.html',html);
console.log('Korrekturwerkstatt.html: '+Buffer.byteLength(html)+' bytes, vollständig lokal.');
