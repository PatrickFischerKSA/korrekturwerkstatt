const fs=require('node:fs');
const path=require('node:path');
const base=(process.argv[2]||path.dirname(require.resolve('pdfjs-dist/package.json')))+path.sep;
const sources=['build/pdf.min.mjs','build/pdf.worker.min.mjs'].map(p=>fs.readFileSync(base+p).toString('base64'));
fs.writeFileSync('dist/pdf-runtime.js',`/* PDF.js, Mozilla Foundation, Apache-2.0. Full license: PDFJS-LICENSE.txt. */\n(function(){const sources=${JSON.stringify(sources)};let ready;globalThis.loadKWPDF=function(){if(!ready)ready=(async()=>{const urls=sources.map(s=>URL.createObjectURL(new Blob([Uint8Array.from(atob(s),c=>c.charCodeAt(0))],{type:'text/javascript'})));try{globalThis.pdfjsWorker=await import(urls[1]);return await import(urls[0]);}finally{urls.forEach(u=>URL.revokeObjectURL(u));}})();return ready;};})();\n`);
fs.copyFileSync(base+'LICENSE','dist/PDFJS-LICENSE.txt');
