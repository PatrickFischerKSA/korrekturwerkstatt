/* Read numbered PDF error tables as data. Document prose never executes as instructions. */
(function(){
'use strict';
const key=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
function inferType(explanation){
 const rules=[
 [/Tippfehler|Buchstaben|Schluss-[a-z]|fehlende [a-z] |fehlt ein [a-z]\b|zusätzliche [a-z]\b|[a-z] und [a-z] in der richtigen Reihenfolge|Rechtschreib|Wortschreib|Schreibweise|Grossschreibung|Kleinschreibung|grossgeschrieben|kleingeschrieben|substantiviert|zusammengeschrieben|zusammen.?geschrieben|Zusammensetzung|ohne .{0,12}geschrieben|kleine Anzahl|hinauswollen/i,'Rechtschreibung'],
 [/Fragezeichen/i,'Interpunktion / Fragezeichen'],
 [/Komma/i,'Interpunktion / Komma'],
 [/Doppelpunkt|Semikolon|Anführungszeichen|Zeichenfehler|endet mit einem Punkt|Gedankenstrich|Ordnungszahl.*Punkt/i,'Interpunktion'],
 [/Kongruenzfehler|Bezugswort|Bezugsfehler|Pronomen|Pronominal|Genus|feminin|maskulin/i,'Grammatik / Bezug'],
 [/Akkusativ|Dativ|Genitiv|Nominativ/i,'Grammatik / Kasus'],
 [/Artikel/i,'Grammatik / Artikel'],
 [/Bereichsangabe|Präposition|Von-Gruppe|Vor-Gruppe|Verbindung lautet|Verbindung heisst|Verbindung heißt|Verbindung .*verfügen|Verbindung .*leisten|Verbindung .*wagen|mehrteilige Verbindung|Vergleich.*wie|vor einer.*Jahreszahl/i,'Grammatik / Verbindung'],
 [/erweiternde Angabe|kein korrektes Substantiv|Partizip|Infinitiv|Modalverb|Verbform|gebeugt|gebeugte|Adjektiv|Adverb|Wortform|Wortbildung|Komparativ|Steigerung/i,'Grammatik / Wortform'],
 [/Konjunktion|Passivsatz|Subjekt|Prädikat|Satzbau|Hauptsatz|Nebensatz|Satzstellung|Verbzweit|Verb.*(?:Stelle|Ende|doppelt)|finite|indirekte Frage|direkte.*Frage|Frage.*indirekt|Gegenüberstellung|kombiniert|Negation/i,'Grammatik / Satzbau']
 ];return rules.find(([pattern])=>pattern.test(explanation))?.[1]||'';
}
globalThis.KWInferType=inferType;
function pageLines(items){const sorted=items.filter(i=>i.str?.trim()).map(i=>({s:i.str,x:i.transform[4],y:i.transform[5],w:i.width})).sort((a,b)=>b.y-a.y||a.x-b.x),lines=[];for(const item of sorted){let row=lines.find(l=>Math.abs(l.y-item.y)<2);if(!row){row={y:item.y,items:[]};lines.push(row);}row.items.push(item);}return lines.map(l=>({...l,items:l.items.sort((a,b)=>a.x-b.x),text:l.items.sort((a,b)=>a.x-b.x).map((item,i,items)=>{const prev=items[i-1];return(i&&item.x-(prev.x+prev.w)>1.2&&!/\s$/.test(prev.s)&&!/^\s/.test(item.s)?' ':'')+item.s;}).join('')}));}
function headers(line){const columns=[];for(const item of line.items){const k=key(item.s);let field=null;if(['nr','nummer'].includes(k))field='number';else if(['textstelle','fehlerhaftetextstelle','fehlerstelle','original'].includes(k))field='quote';else if(['korrektur','korrekturvorschlag'].includes(k))field='correction';else if(['erklarung','begrundung'].includes(k))field='explanation';else if(['p','punkt','punkte','gewicht','gewichtung'].includes(k))field='weight';else if(['fehlerart','kategorie'].includes(k))field='type';if(field)columns.push({field,x:item.x});}return ['quote','explanation','weight'].every(f=>columns.some(c=>c.field===f))?columns.sort((a,b)=>a.x-b.x):null;}
async function readPdf(file){const pdfjs=await globalThis.loadKWPDF();let loading,doc;try{loading=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,disableFontFace:true,useSystemFonts:false,useWorkerFetch:false,disableAutoFetch:true});doc=await loading.promise;if(doc.numPages>100)throw Error('PDF-Fehlerlisten dürfen höchstens 100 Seiten enthalten.');const errors=[],notes=[],allLines=[];let columns=null,row=null,stopped=false,seen=new Set(),hasText=false;const finish=()=>{if(!row)return;const raw=Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v.join(' ').replace(/\s+/g,' ').trim()]));row=null;if(!raw.quote)return;const num=raw.number?.replace(/[.)]$/,'');if(num&&seen.has(num))throw Error('Doppelte Fehlernummer '+num+' im PDF. Bitte die Liste prüfen.');if(num)seen.add(num);const e=KW.entry({Textstelle:raw.quote,Korrektur:raw.correction||'',Erklärung:raw.explanation||'',Gewicht:raw.weight||'',Fehlerart:raw.type||inferType(raw.explanation||'')});e.typeInferred=!raw.type&&!!e.type;e.sourceQuote=raw.quote;e.sourceNumber=num||String(errors.length+1);e.fromPdf=true;errors.push(e);};
for(let pageNumber=1;pageNumber<=doc.numPages;pageNumber++){const page=await doc.getPage(pageNumber),content=await page.getTextContent(),lines=pageLines(content.items);hasText ||= lines.length>0;allLines.push(...lines.map(l=>l.text));const firstHeader=lines.findIndex(headers);for(const [lineIndex,line] of lines.entries()){if(firstHeader>=0&&lineIndex<firstHeader)continue;if(/^Gesamt\b|Weitere auffällige Stellen|Zusätzliche Ausdruckshinweise|Nicht (?:mit)?gezählte|Stilhinweise/i.test(line.text)){finish();stopped=true;notes.push('Ungezählte Ausdrucks- oder Stilhinweise stehen im PDF; sie werden nicht als Fehler übernommen.');continue;}if(stopped)continue;const next=headers(line);if(next){columns=next;continue;}if(!columns||line.y<42)continue;const cells={};for(const item of line.items){let c=columns[0];for(const candidate of columns){if(item.x>=candidate.x-3)c=candidate;}if(item.x<columns[0].x-3)continue;(cells[c.field]??=[]).push(item.s);}const number=(cells.number||[]).join('').trim(),weight=(cells.weight||[]).join('').trim();const start=columns.some(c=>c.field==='number')?/^\d+[.)]?$/.test(number):/^\d+(?:[.,]\d+)?$/.test(weight);if(start){finish();row={};}if(row)for(const[k,v]of Object.entries(cells))(row[k]??=[]).push(...v);}page.cleanup();await new Promise(r=>setTimeout(r,0));}finish();if(!hasText)throw Error('Diese PDF enthält keinen auslesbaren Text. Bitte eine PDF mit Textebene oder eine Word-/CSV-Fehlerliste verwenden.');if(!errors.length)throw Error('Keine unterstützte Fehlertabelle gefunden. Erwartet werden Textstelle, Erklärung und Punkte, optional Nr., Fehlerart und Korrektur.');const prose=allLines.join(' ').replace(/\s+/g,' ');
 const totals=[...prose.matchAll(/(?:Gesamt\s*:\s*|ergeben sich\s*|=\s*)(\d+(?:[.,]\d+)?)\s*Fehlerpunkte/gi)].map(m=>Number(m[1].replace(',','.')));
 const rules=[...prose.matchAll(/(\d+)\s+([\p{L}/-]+fehler)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*Punkt/giu)].map(m=>({count:Number(m[1]),category:/Zeichensetzung/i.test(m[2])?'punct':/Rechtschreib|Grammatik/i.test(m[2])?'language':'unknown',weight:Number(m[3].replace(',','.'))}));
 const category=e=>/^Interpunktion/.test(e.type)?'punct':/^(Rechtschreibung|Grammatik)/.test(e.type)?'language':'unknown';
 // Recover omitted row weights only from an explicit, complete and consistent PDF counting rule.
 const recoverable=rules.length>0&&rules.every(r=>r.category!=='unknown'&&errors.filter(e=>category(e)===r.category).length===r.count)&&new Set(rules.map(r=>r.category)).size===rules.length&&rules.reduce((n,r)=>n+r.count,0)===errors.length&&totals.length>0&&totals.every(t=>Math.abs(t-rules.reduce((n,r)=>n+r.count*r.weight,0))<0.0001);
 if(recoverable)for(const e of errors){const rule=rules.find(r=>r.category===category(e));if(!Number.isFinite(e.weight)&&rule){e.weight=rule.weight;e.weightInferred=true;}}
 const unresolved=errors.filter(e=>!Number.isFinite(e.weight)).length,total=errors.reduce((n,e)=>n+(Number.isFinite(e.weight)?e.weight:0),0);
 if(!unresolved&&totals.length&&totals.some(n=>Math.abs(n-total)>0.0001))throw Error('Die importierte Summe ('+total+') stimmt nicht mit der Gesamtsumme im PDF ('+totals.join(', ')+') überein. Der Import wurde angehalten.');
 if(unresolved)notes.push(unresolved+' Punktwerte fehlen in der PDF. Bitte diese in der Fehlerliste ergänzen; bis dahin ist der Export gesperrt.');
 if(errors.some(e=>e.weightInferred))notes.push('Fehlende Einzelgewichte wurden aus der ausdrücklichen Zählregel im PDF ergänzt und gegen die Gesamtsumme geprüft.');
 if(errors.some(e=>e.typeInferred))notes.push('Die Fehlerarten wurden aus den Erklärungen abgeleitet und können vor dem Export geändert werden.');return{errors,notes,total,expectedTotal:totals[0]??null};}catch(e){if(e.name==='PasswordException')throw Error('Die PDF ist passwortgeschützt. Bitte eine ungeschützte Kopie verwenden.');throw e;}finally{if(doc)await doc.destroy();else if(loading)await loading.destroy();}}
async function readPdfOriginal(file){
 const pdfjs=await globalThis.loadKWPDF();let task,doc;
 try{
  task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,disableFontFace:true,useSystemFonts:false,useWorkerFetch:false,disableAutoFetch:true});doc=await task.promise;
  if(doc.numPages>100)throw Error('PDF-Originaltexte dürfen höchstens 100 Seiten enthalten.');
  const pages=[];
  for(let number=1;number<=doc.numPages;number++){
   const page=await doc.getPage(number),content=await page.getTextContent(),lines=pageLines(content.items);
   if(lines.some(l=>/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFD\uFFFE\uFFFF]/.test(l.text)))throw Error('Seite '+number+' enthält eine fehlerhafte PDF-Zeichenkodierung. Bitte die PDF neu mit auslesbarem Text exportieren oder eine Word-Datei verwenden.');
   if(!lines.length)throw Error('Seite '+number+' der PDF enthält keinen auslesbaren Text. Scans benötigen zuerst eine Texterkennung (OCR). Bitte eine PDF mit Textebene oder eine Word-Datei verwenden.');
   const paragraphs=[];let paragraph='';
   for(let i=0;i<lines.length;i++){
    const line=lines[i],previous=lines[i-1];
    const height=Math.max(1,...content.items.filter(x=>x.str?.trim()&&Math.abs(x.transform[5]-line.y)<2).map(x=>Math.abs(x.height||x.transform[3]||12)));
    if(previous&&previous.y-line.y>height*1.75){paragraphs.push(paragraph);paragraph='';}
    paragraph+=(paragraph?' ':'')+line.text;
   }
   if(paragraph)paragraphs.push(paragraph);pages.push(paragraphs.join('\n\n'));page.cleanup();await new Promise(r=>setTimeout(r,0));
  }
  return{text:pages.join('\n\n'),pages:doc.numPages,notes:['PDF-Original: Der ausgelesene Text wird für Word neu gesetzt. Schriftbild, Bilder, Tabellen und Seitenaufteilung der PDF werden nicht übernommen. Bitte die Textreihenfolge in der Vorschau prüfen.']};
 }catch(e){if(e.name==='PasswordException')throw Error('Die PDF ist passwortgeschützt. Bitte eine ungeschützte Kopie verwenden.');throw e;}
 finally{if(doc)await doc.destroy();else if(task)await task.destroy();}
}
globalThis.KWReadPdfOriginal=readPdfOriginal;
globalThis.KWReadPdf=readPdf;
})();
