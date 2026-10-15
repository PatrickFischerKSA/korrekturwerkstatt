/* Layout-independent recovery for the five supported containers. Files stay local. */
(function(global){
'use strict';
const fields=['quote','correction','explanation','type','weight','chapter','location','number','occurrence','textId'];
const labels={quote:'Fehlerhafte Textstelle',correction:'Korrektur',explanation:'Erklärung',type:'Fehlerart',weight:'Gewicht / Punkte',chapter:'Kapitel',location:'Nummer und Fundstelle',number:'Fehlernummer',occurrence:'Vorkommen',textId:'Text-ID'};
const string=value=>typeof value==='string'?value:value==null?'':typeof value==='object'?JSON.stringify(value):String(value);
function parseRows(text,delimiter='auto'){
 text=String(text).replace(/^\uFEFF/,'');
 if(delimiter==='auto'){const sample=text.split(/\r?\n/).filter(s=>s.trim()).slice(0,30);delimiter=['\t',';',',','|'].map(d=>({d,n:sample.reduce((sum,line)=>sum+line.split(d).length-1,0)})).sort((a,b)=>b.n-a.n)[0];delimiter=delimiter.n?delimiter.d:'none';}
 if(delimiter==='none')return text.split(/\r?\n/).map(line=>[line]);
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'&&(quoted||!cell)){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&c===delimiter){row.push(cell);cell='';}else if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}else cell+=c;}
 row.push(cell);if(row.some(s=>s)||!rows.length)rows.push(row);return rows;
}
const serializeRows=rows=>rows.map(row=>row.map(cell=>'"'+string(cell).replace(/"/g,'""')+'"').join('\t')).join('\n');
function makeSource(title,rows,kind='table'){
 rows=rows.map(row=>row.map(string));let header=-1,best=1,mapping=[];
 for(let i=0;i<Math.min(rows.length,30);i++){const mapped=rows[i].map(KW.fieldFor),score=new Set(mapped.filter(Boolean)).size;if(score>best){best=score;header=i;mapping=mapped;}}
 const width=rows.reduce((width,row)=>Math.max(width,row.length),1);mapping=Array.from({length:width},(_,i)=>mapping[i]||'');
 const duplicate=new Set(mapping.filter((field,i)=>field&&mapping.indexOf(field)!==i));mapping=mapping.map(field=>duplicate.has(field)?'':field);
 let summary=null;try{summary=KW.summaryTable(rows);}catch{/* Retain unreadable totals in the source for review. */}
 const role=summary?'reference':mapping.includes('quote')&&mapping.some(f=>['correction','explanation','type','weight'].includes(f))?'entries':'unresolved';
 return{title,kind,rows,originalRows:structuredClone(rows),startRow:header+1,mapping,role,excluded:[],defaultType:'',defaultWeight:'',summary};
}
function transpose(rows){const width=rows.reduce((n,row)=>Math.max(n,row.length),0);return Array.from({length:width},(_,column)=>rows.map(row=>row[column]||''));}
function groupRows(rows,count){if(!Number.isInteger(count)||count<1||count>100)throw Error('Bitte 1 bis 100 Zeilen pro Eintrag wählen.');const out=[];for(let i=0;i<rows.length;i+=count)out.push(rows.slice(i,i+count).flat());return out;}
function jsonSources(value,path='$',out=[]){
 if(Array.isArray(value)){
  if(value.every(row=>row&&typeof row==='object'&&!Array.isArray(row))){const keys=[...new Set(value.flatMap(row=>Object.keys(row)))];out.push(makeSource(path,[keys,...value.map(row=>keys.map(key=>string(row[key])))]));}
  else if(value.every(Array.isArray))out.push(makeSource(path,value));
  else if(value.every(row=>row===null||typeof row!=='object'))out.push(makeSource(path,value.map(row=>[string(row)])));
  else value.forEach((row,i)=>jsonSources(row,path+'['+i+']',out));
 }else if(value&&typeof value==='object'){
  const children=Object.entries(value).filter(([,v])=>v&&typeof v==='object');
  if(children.length)for(const[key,v]of children)jsonSources(v,path+'.'+key,out);
  else out.push(makeSource(path,[Object.keys(value),Object.values(value).map(string)]));
 }else out.push(makeSource(path,[[string(value)]],'text'));
 return out;
}
async function inspect(file,reason){
 const extension=file.name.split('.').pop().toLowerCase();const sources=[];
 if(extension==='docx'){
  const zip=await JSZip.loadAsync(await file.arrayBuffer());if(Object.values(zip.files).reduce((sum,item)=>sum+(item._data?.uncompressedSize||0),0)>100*1024*1024)throw Error('Die entpackte Word-Datei ist grösser als 100 MB.');const part=zip.file('word/document.xml');if(!part)throw Error('Diese Datei enthält keinen lesbaren Word-Haupttext.');
  const doc=KW.xml(await part.async('string')),ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main',all=(node,name)=>Array.from(node.getElementsByTagNameNS(ns,name)),text=node=>all(node,'t').map(n=>n.textContent).join('');
  let paragraphs=[];const flush=()=>{if(paragraphs.some(s=>s.trim()))sources.push(makeSource('Textabschnitt '+(sources.length+1),paragraphs.map(s=>[s]),'prose'));paragraphs=[];};
  const visit=node=>{if(node.namespaceURI===ns&&node.localName==='tbl'){flush();const rows=Array.from(node.children).filter(n=>n.localName==='tr').map(row=>Array.from(row.children).filter(n=>n.localName==='tc').map(cell=>all(cell,'p').map(text).join('\n')));sources.push(makeSource('Tabelle '+(sources.filter(s=>s.kind==='table').length+1),rows));return;}if(node.namespaceURI===ns&&node.localName==='p'){paragraphs.push(text(node));return;}for(const child of node.children||[])visit(child);};
  visit(all(doc,'body')[0]);flush();for(const name of Object.keys(zip.files).filter(name=>/^word\/(?:footnotes|endnotes|comments|header\d+|footer\d+)\.xml$/.test(name)).sort()){const extra=KW.xml(await zip.file(name).async('string')),first=sources.length;visit(extra.documentElement);flush();for(const source of sources.slice(first))source.title=name.replace(/^word\//,'')+' · '+source.title;}
 }else if(extension==='pdf'){
  const pdfjs=await global.loadKWPDF();let task,doc;try{task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,disableFontFace:true,useWorkerFetch:false});doc=await task.promise;if(doc.numPages>100)throw Error('Die PDF umfasst mehr als 100 Seiten.');for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i),content=await page.getTextContent();let line='',lines=[];for(const item of content.items){if(!('str'in item)||!item.str.trim())continue;line+=(line?'\t':'')+item.str;if(item.hasEOL){lines.push(line);line='';}}if(line)lines.push(line);sources.push(makeSource('PDF-Seite '+i,parseRows(lines.join('\n'),'\t'),'text'));page.cleanup();}}finally{if(doc)await doc.destroy();else if(task)await task.destroy();}
 }else{const text=await file.text();if(extension==='json'){try{jsonSources(JSON.parse(text),'$',sources);}catch{sources.push(makeSource('JSON-Inhalt',parseRows(text,'none'),'text'));}}else sources.push(makeSource('Dateiinhalt',parseRows(text),extension==='txt'?'text':'table'));}
 if(!sources.length)sources.push(makeSource('Dateiinhalt',[['']],'text'));
 return{sources,reason:String(reason?.message||reason||''),expectedTotal:sources.find(s=>s.summary?.total!==null&&s.summary?.total!==undefined)?.summary.total??'',originalName:file.name};
}
function compile(draft){
 const entries=[];for(const source of draft.sources){if(source.draftText!==undefined&&source.draftText!==serializeRows(source.rows))throw Error('Die bearbeiteten Zeilen in «'+source.title+'» bitte zuerst mit «Zeilen aktualisieren» anwenden.');if(source.role==='unresolved')throw Error('Bitte für «'+source.title+'» auswählen, ob der Inhalt Fehler oder Begleittext ist.');if(source.role!=='entries')continue;
  const mapped=source.mapping.filter(Boolean);if(new Set(mapped).size!==mapped.length)throw Error('Jede Bedeutung darf pro Tabelle nur einer Spalte zugeordnet werden.');if(!mapped.includes('quote'))throw Error('Für «'+source.title+'» bitte die Spalte mit der fehlerhaften Textstelle wählen.');
  for(let i=source.startRow;i<source.rows.length;i++){const row=source.rows[i];if(source.excluded.includes(i)||!row.some(cell=>cell.trim()))continue;const raw={},extra=[];row.forEach((cell,j)=>{const field=source.mapping[j];if(field)raw[field]=cell;else extra.push({column:j+1,value:cell});});if(!raw.type&&source.defaultType)raw.type=source.defaultType;if(!raw.weight&&source.defaultWeight!=='')raw.weight=source.defaultWeight;
   const entry=KW.entry(raw);entry.sourceQuote=entry.quote;entry.sourceNumber ||= String(entries.length+1);entry.fromTable=true;entry.sourceCells=structuredClone(row);entry.sourceTitle=source.title;entry.extra=extra;entries.push(entry);
  }
 }
 if(!entries.length)throw Error('Es wurden noch keine Fehlerzeilen ausgewählt. Die Quelldaten bleiben erhalten.');if(entries.length>3000)throw Error('Bitte höchstens 3000 Fehlerzeilen auswählen.');
 const total=draft.expectedTotal===''?null:Number(String(draft.expectedTotal).replace(',','.'));if(total!==null&&(!Number.isFinite(total)||total<0))throw Error('Bitte eine gültige erwartete Punktesumme eintragen oder das Feld leeren.');
 if(total!==null&&entries.every(e=>Number.isFinite(e.weight))&&Math.abs(entries.reduce((sum,e)=>sum+e.weight,0)-total)>0.0001)throw Error('Die ausgewählten Gewichte ergeben '+entries.reduce((sum,e)=>sum+e.weight,0)+' Punkte. Die erwartete Summe ist '+total+'. Bitte Zuordnung oder Gewichte prüfen.');
 return{errors:entries,reviewedTotal:total};
}
const strictRead=KW.readList;
KW.readList=async file=>{try{const result=await strictRead(file);if(result.errors.some(e=>!e.quote.trim()||!e.type.trim()||!e.explanation.trim()||!Number.isFinite(e.weight)||e.weight<0))throw Error('Die Inhalte sind lesbar; ihre Spalten oder Felder sind noch nicht eindeutig zugeordnet.');return{...result,sourceFile:file,canReview:true};}catch(reason){const ext=file.name.split('.').pop().toLowerCase();if(!['docx','pdf','csv','json','txt'].includes(ext)||file.size>10*1024*1024)throw reason;const draft=await inspect(file,reason);return{name:file.name,id:KW.fileId(file.name),errors:[],importDraft:draft,sourceFile:file,canReview:true,notes:['Die Datei ist geladen. Bitte die Struktur im Importbereich zuordnen; alle ausgelesenen Quelldaten bleiben erhalten.']};}};
function mount(hooks){
 const root=document.getElementById('import-review');let selected='',failure='';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const choices=(values,current)=>values.map(([value,label])=>'<option value="'+esc(value)+'"'+(value===String(current)?' selected':'')+'>'+esc(label)+'</option>').join('');
 const active=()=>hooks.lists().find(list=>list.uid===selected);
 function render(lists,busy){
  const pending=lists.filter(list=>list.importDraft),archived=lists.filter(list=>(list.importSource||list.canReview)&&!list.importDraft);if(!pending.some(list=>list.uid===selected))selected=pending[0]?.uid||'';
  root.hidden=!pending.length&&!archived.length;if(root.hidden)return;
  let html='<h2>Importzuordnung</h2>';
  if(archived.length)html+='<details><summary>Gespeicherte Quelldaten und Zuordnungen</summary>'+archived.map(list=>'<button class="text-button" data-reopen="'+esc(list.uid)+'"'+(busy?' disabled':'')+'>'+esc(list.name)+' erneut zuordnen</button>').join('<br>')+'</details>';
  const list=active();if(!list){root.innerHTML=html;return;}const draft=list.importDraft;
  html+='<p><strong>Die Datei ist geladen.</strong> Wähle aus, welche Inhalte Fehlereinträge sind und welche Bedeutung ihre Spalten haben. Die Originaldaten bleiben erhalten.</p>';
  if(pending.length>1)html+='<label>Datei <select id="draft-file">'+choices(pending.map(l=>[l.uid,l.name]),selected)+'</select></label>';else html+='<h3>'+esc(list.name)+'</h3>';
  html+='<details><summary>Hinweis der automatischen Erkennung</summary><p>'+esc(draft.reason)+'</p></details><p id="draft-message" role="status">'+esc(failure)+'</p>';
  html+=draft.sources.map((source,i)=>{
   const header=source.rows[source.startRow-1]||[],count=source.rows.slice(source.startRow).filter((row,j)=>!source.excluded.includes(j+source.startRow)&&row.some(cell=>cell.trim())).length;
   let card='<details class="import-source"'+(source.role!=='reference'?' open':'')+'><summary>'+esc(source.title)+' · '+source.rows.length+' Zeilen</summary><label>Inhalt <select data-source="'+i+'" data-prop="role">'+choices([['unresolved','Bitte zuordnen'],['entries','Fehlereinträge'],['reference','Begleittext / Übersicht – bleibt gespeichert']],source.role)+'</select></label>';
   if(source.role==='entries'){
    card+='<div class="import-defaults"><label>Erste Fehlerzeile (1–'+(source.rows.length+1)+')<input type="number" min="1" max="'+(source.rows.length+1)+'" value="'+(source.startRow+1)+'" data-source="'+i+'" data-prop="startRow"></label><label>Fehlerart für leere Felder<input value="'+esc(source.defaultType)+'" data-source="'+i+'" data-prop="defaultType"></label><label>Gewicht für leere Felder<input inputmode="decimal" value="'+esc(source.defaultWeight)+'" data-source="'+i+'" data-prop="defaultWeight"></label></div><p>'+count+' Zeilen ausgewählt. Leere Angaben kannst du später beim Fehler ergänzen.</p>';
    card+='<div class="mapping-columns">'+source.mapping.map((field,j)=>'<label>Spalte '+(j+1)+(header[j]?' · '+esc(header[j]):'')+'<select data-source="'+i+'" data-column="'+j+'">'+choices([['','Zusatzangabe – bleibt gespeichert'],...fields.map(f=>[f,labels[f]])],field)+'</select></label>').join('')+'</div>';
   }
   card+='<div class="import-actions"><button class="secondary" data-transpose="'+i+'">Zeilen und Spalten tauschen</button><label>Zeilen pro Eintrag<input type="number" min="1" max="100" value="2" id="draft-group-'+i+'"></label><button class="secondary" data-group="'+i+'">Zeilen zu Einträgen bündeln</button></div>';
   card+='<div class="import-table"><table><thead><tr><th>Zeile</th>'+(source.role==='entries'?'<th>Übernehmen</th>':'')+source.mapping.map((_,j)=>'<th>Spalte '+(j+1)+'</th>').join('')+'</tr></thead><tbody>'+source.rows.slice(0,100).map((row,j)=>'<tr><th>'+(j+1)+'</th>'+(source.role==='entries'?'<td><input type="checkbox" aria-label="Zeile '+(j+1)+' aus '+esc(source.title)+' übernehmen" data-source="'+i+'" data-row="'+j+'"'+(j<source.startRow?' disabled':!source.excluded.includes(j)?' checked':'')+'></td>':'')+source.mapping.map((_,k)=>'<td>'+esc(row[k]||'')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
   if(source.rows.length>100)card+='<p>Vorschau: erste 100 Zeilen. Alle '+source.rows.length+' Zeilen stehen im vollständigen Dateneditor darunter und werden entsprechend der Auswahl übernommen.</p>';
   card+='<details><summary>Alle Zeilen anzeigen und bearbeiten</summary><p>Spalten können durch Tabulator, Semikolon, Komma oder senkrechten Strich getrennt werden. Änderungen ersetzen nur die Arbeitskopie.</p><label>Trennzeichen <select id="draft-delimiter-'+i+'">'+choices([['\t','Tabulator'],['auto','Automatisch'],[';','Semikolon'],[',','Komma'],['|','Senkrechter Strich'],['none','Eine Spalte pro Zeile']],source.delimiter||'\t')+'</select></label><textarea id="draft-raw-'+i+'" aria-label="Alle Zeilen aus '+esc(source.title)+'">'+esc(source.draftText??serializeRows(source.rows))+'</textarea><button class="secondary" data-reparse="'+i+'">Zeilen aktualisieren</button></details></details>';
   return card;
  }).join('');
  html+='<div class="import-defaults"><label>Erwartete Punktesumme (optional)<input id="draft-total" inputmode="decimal" value="'+esc(draft.expectedTotal)+'"></label></div><div class="import-actions"><button id="draft-confirm" class="primary"'+(busy?' disabled':'')+'>Zuordnung übernehmen</button><button id="draft-source-download" class="secondary">Alle Quelldaten sichern</button>'+(list.errors.length?'<button id="draft-cancel" class="secondary">Bisherige Zuordnung beibehalten</button>':'')+'</div>';
  root.innerHTML=html;
 }
 root.addEventListener('input',event=>{const list=active();if(!list?.importDraft)return;const id=event.target.id;if(id.startsWith('draft-raw-'))list.importDraft.sources[Number(id.slice(10))].draftText=event.target.value;else if(id==='draft-total')list.importDraft.expectedTotal=event.target.value;});
 root.addEventListener('change',event=>{const el=event.target,list=active();if(el.id==='draft-file'){selected=el.value;failure='';render(hooks.lists(),false);return;}if(!list?.importDraft)return;const draft=list.importDraft;if(el.id.startsWith('draft-delimiter-')){draft.sources[Number(el.id.slice(16))].delimiter=el.value;return;}if(el.id==='draft-total'){draft.expectedTotal=el.value;return;}const source=draft.sources[Number(el.dataset.source)];if(!source)return;if(el.dataset.column!==undefined)source.mapping[Number(el.dataset.column)]=el.value;else if(el.dataset.row!==undefined){const row=Number(el.dataset.row);source.excluded=source.excluded.filter(i=>i!==row);if(!el.checked)source.excluded.push(row);}else if(el.dataset.prop){const prop=el.dataset.prop;source[prop]=prop==='startRow'?Math.max(0,Math.min(source.rows.length,Number(el.value)-1)):el.value;}failure='';render(hooks.lists(),false);});
 root.addEventListener('click',async event=>{
  const reopen=event.target.closest('[data-reopen]');if(reopen){const list=hooks.lists().find(l=>l.uid===reopen.dataset.reopen);try{render(hooks.lists(),true);list.importDraft=list.importSource?structuredClone(list.importSource):await inspect(list.sourceFile,'Du kannst die bisherige automatische Zuordnung hier prüfen oder ändern.');selected=list.uid;failure='';hooks.changed();}catch(error){hooks.notice(error.message);}return;}
  const list=active();if(!list?.importDraft)return;if(event.target.id==='draft-cancel'){delete list.importDraft;failure='';hooks.changed();return;}const transposeButton=event.target.closest('[data-transpose]'),groupButton=event.target.closest('[data-group]');if(transposeButton||groupButton){const i=Number(transposeButton?.dataset.transpose??groupButton.dataset.group),old=list.importDraft.sources[i];try{const rows=transposeButton?transpose(old.rows):groupRows(old.rows,Number(document.getElementById('draft-group-'+i).value)),source=makeSource(old.title,rows,old.kind);source.originalRows=old.originalRows;list.importDraft.sources[i]=source;failure='';render(hooks.lists(),false);}catch(error){document.getElementById('draft-message').textContent=error.message;}return;}const reparse=event.target.closest('[data-reparse]');if(reparse){const i=Number(reparse.dataset.reparse),old=list.importDraft.sources[i],text=document.getElementById('draft-raw-'+i).value,separator=document.getElementById('draft-delimiter-'+i).value;const source=makeSource(old.title,parseRows(text,separator),old.kind);source.originalRows=old.originalRows;list.importDraft.sources[i]=source;failure='';render(hooks.lists(),false);return;}
  if(event.target.id==='draft-source-download'){hooks.download(new Blob([JSON.stringify(list.importDraft,null,2)],{type:'application/json'}),list.name+'.import.json');return;}
  if(event.target.id==='draft-confirm'){try{const result=compile(list.importDraft);list.importSource=structuredClone(list.importDraft);Object.assign(list,result);delete list.importDraft;list.notes=['Die Spaltenzuordnung wurde bestätigt. Nicht zugeordnete Zusatzangaben und Originalzeilen bleiben in den Quelldaten gespeichert.'];failure='';hooks.applied(list);}catch(error){failure=error.message;document.getElementById('draft-message').textContent=failure;}}
 });
 return{render};
}

global.KWImport={mount,transpose,groupRows,fields,labels,parseRows,serializeRows,makeSource,jsonSources,inspect,compile};
})(globalThis);
