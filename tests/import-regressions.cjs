const assert = require('node:assert/strict');
require('../dist/engine.js');
require('../dist/pdf-import.js');
const text = 'Heute sind persönliche Dienste einer alten Idee ähnlich. Die neue Technik hilft, weil sie verfügbar ist.';
for (const quote of ['… Die neue Technik', 'Die neue Technik […] weil sie verfügbar ist', 'persönliche Dienste [sind] einer alten Idee']) {
  const hits = KW.candidates(text, quote);
  assert.equal(hits.length, 1, quote);
  assert(hits[0].start >= 0 && hits[0].end <= text.length);
}
assert.equal(KW.candidates('Dienste sind wichtig. Dienste wichtig.', 'Dienste [sind] wichtig').length, 2, 'Ambiguous editorial insertions must remain ambiguous');
assert.equal(KW.candidates(text, '… eine erfundene Stelle').length, 0);
const cases = [
  ['Nach dem Doppelpunkt wird grossgeschrieben.', 'Rechtschreibung'],
  ['Das Partizip ist falsch.', 'Grammatik / Wortform'],
  ['Die feminine Form ist nötig.', 'Grammatik / Bezug'],
  ['Hier steht keine Steigerung.', 'Grammatik / Wortform'],
  ['Ein Rechtschreibfehler: Es fehlt ein Buchstabe.', 'Rechtschreibung'],
  ['Vor der Präzisierung steht ein Doppelpunkt.', 'Interpunktion'],
  ['Das finite Verb steht am Ende.', 'Grammatik / Satzbau'],
  ['Keine bestimmbare Kategorie.', '']
];
const item=(str,x,y)=>({str,transform:[1,0,0,12,x,y],width:str.length*2});
globalThis.loadKWPDF=async()=>({getDocument:()=>({promise:Promise.resolve({numPages:1,getPage:async()=>({getTextContent:async()=>({items:[item('Nr.',20,700),item('Textstelle',60,700),item('Erklärung',200,700),item('Punkte',600,700),...cases.flatMap(([e],i)=>[item(String(i+1),20,670-i*30),item('Beispiel',60,670-i*30),item(e,200,670-i*30),item('1',600,670-i*30)])]}),cleanup(){}}),destroy:async()=>{}})})});
(async()=>{const result=await KWReadPdf({arrayBuffer:async()=>new ArrayBuffer(0)});assert.deepEqual(result.errors.map(e=>e.type),cases.map(c=>c[1]));assert(result.errors.every(e=>e.weight===1));console.log('PASS: quote omissions, editorial insertions, ambiguity, inferred types, unknown type remains open');})().catch(e=>{console.error(e);process.exitCode=1;});

const wordRow=KW.entry({'Fehlerhafte Textstelle':'ein Beispiel','P.':'0,5','Erklärung':'Vor dem Nebensatz fehlt ein Komma.'});
assert.equal(wordRow.quote,'ein Beispiel');assert.equal(wordRow.weight,0.5);
assert.equal(KWInferType('Der Bezugsausdruck steht im Singular. Ein Kongruenzfehler.'),'Grammatik / Bezug');

// Format variants are independent of the real classroom files.
for(const label of ['Textstelle (Original)','Originaltext','Zitat','Textauszug','Textstlle'])assert.equal(KW.fieldFor(label),'quote');
assert.equal(KW.fieldFor('Xyz unbekannt'),null);
const header=['Nr.','Zitat','Erläuterung','Abzug (Punkte)'];
const parsed=KW.parseTable([['Fehlerübersicht'],header,['1','ein Fehler','Ein Tippfehler.','½'],header,['2','noch einer','Eine Erklärung.','1/2'],['Gesamt','','','1 Pkt.']]);
assert.equal(parsed.entries.length,2);assert.equal(parsed.entries[0].weight,0.5);
assert.equal(KW.parseTable([['3','Fortsetzung','Erklärung','1']],parsed.header).entries.length,1);
assert.equal(KW.labeled('Zitat: falsch\nKategorie: Rechtschreibung\nErläuterung: Tippfehler\nAbzug: 0,5 Pkt.')[0].weight,0.5);
assert(Number.isNaN(KW.entry({'Zitat':'Text','Abzug':'0,5 oder 1'}).weight));
assert.throws(()=>KW.parseTable([['Zitat','Original','Punkte'],['a','b','1']]),/Mehrere Spalten/);
assert.throws(()=>KW.parseTable([header,['1','Fehler','Grund','1'],['Gesamt','','','2']]),/Tabellensumme/);
assert.throws(()=>KW.parseTable([header,['1','Fehler','1']]),/Anzahl der Zellen/);
console.log('PASS: synonyms, header typos, title rows, repeated headers, continuations, fractions, totals and ambiguous input');

for(const name of ['Fehler'])assert.equal(KW.fieldFor(name),'quote');
for(const name of ['Korrektur / Begründung','Verbesserung / Begründung'])assert.equal(KW.fieldFor(name),'correction');
assert.equal(KW.parseTable([['Nr.','Kapitel','Fehler','Korrektur'],['1','Vorwort','große','grosse']]).entries[0].quote,'große');

// Chapter metadata resolves repeated words without asking the user to pick identical labels.
const chapterText='Vorwort\ngroße Freude. große Hilfe.\nEinleitung\nBewegungs-geschichte.\nErgebnisse\nBewegungs-geschichte.\n';
const sections=[{title:'Vorwort',number:'2',start:0,end:chapterText.indexOf('Einleitung'),path:['Vorwort']},{title:'Einleitung',number:'3',start:chapterText.indexOf('Einleitung'),end:chapterText.indexOf('Ergebnisse'),path:['Einleitung']},{title:'Ergebnisse',number:'5',start:chapterText.indexOf('Ergebnisse'),end:chapterText.length,path:['Ergebnisse']}];
const row=(quote,chapter,correction)=>({...KW.entry({Fehler:quote,Kapitel:chapter,Korrektur:correction,Fehlerart:'Rechtschreibung',Gewicht:'1'}),fromTable:true});
assert.equal(KW.fieldFor('Kapitel'),'chapter');
const scoped=KW.prepareErrors(chapterText,[row('große','Vorwort','grosse'),row('große','Vorwort','grosse'),row('Bewegungs-geschichte','Einleitung','Bewegungsgeschichte'),row('Bewegungs-geschichte','5','Bewegungsgeschichte')],sections);
assert(KW.resolve(chapterText,scoped).every(e=>!e.issue));
assert.notDeepEqual(scoped[0].anchor,scoped[1].anchor);
assert(scoped[2].anchor.start<sections[2].start);
assert(scoped[3].anchor.start>=sections[2].start);
assert.equal(KW.resolve(chapterText,KW.prepareErrors(chapterText,[row('große','Vorwort','grosse')],sections))[0].issue,'2 mögliche Stellen');
assert.equal(KW.candidates('anschließend ließen schließen','ließen').length,1,'Whole words take precedence over embedded word fragments');
assert.equal(KW.candidates('Bewegungs- geschichte','Bewegungs-geschichte').length,1,'PDF line breaks after hyphens');
const mixed='auf den Fußballen laufen, wurden notiert';
const mixedResult=KW.prepareErrors(mixed,[row('auf den Fussballen laufen, wurden notiert','','auf den Fussballen laufen wurden notiert')]);
assert.equal(KW.resolve(mixed,mixedResult)[0].issue,'','Swiss spelling in a quote must still find an original ß');
const omitted='Dies war für Kinder ansprech- ender und abwechslungsreicher.';
assert.equal(KW.resolve(omitted,KW.prepareErrors(omitted,[row('Dies war […] ansprechender […] abwechslungsreicher.','','Dies wirkte ansprechender.')]))[0].issue,'');
const combined=KW.entry({'Original':'falsch','Korrektur / Begründung':'richtig — Ein Tippfehler.'});
assert.equal(combined.correction,'richtig');assert.equal(combined.explanation,'Ein Tippfehler.');
console.log('PASS: chapter ranges, repeated occurrences, word boundaries, PDF hyphens, overlapping spelling variants and combined explanations');
// A tab stop in paragraph formatting is not a text tab (and must never be exported as a run).
const namespace='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const element=(localName,childNodes=[],textContent='',attributes={})=>({nodeType:1,namespaceURI:namespace,localName,childNodes,children:childNodes,textContent,getAttributeNS(ns,key){return attributes[key]??null;},getElementsByTagNameNS(ns,name){return childNodes.flatMap(c=>[...(c.namespaceURI===ns&&c.localName===name?[c]:[]),...c.getElementsByTagNameNS(ns,name)]);}});
const formattedDoc=element('document',[element('body',[element('p',[element('pPr',[element('tabs',[element('tab')])]),element('r',[element('t',[],'Ein Wort'),element('tab'),element('t',[],'danach')])])])]);
assert.equal(KW.indexDoc(formattedDoc).text,'Ein Wort\tdanach\n');
console.log('PASS: Word formatting tab stops are excluded from document text');
const value=(name,val)=>element(name,[],'',{val:String(val)});
const heading=(title,level)=>element('p',[element('pPr',[value('pStyle','Heading'+(level+1)),element('numPr',[value('numId',1),value('ilvl',level)])]),element('r',[element('t',[],title)])]);
const numbered=element('document',[element('body',[heading('Inhaltsverzeichnis',0),heading('Vorwort',0),heading('Einleitung',0),heading('Vorgehen',0),heading('Geschichten',1),heading('Gewöhnliche Geschichte',2),heading('Bewegungsgeschichte',2)])]);
const numbering=element('numbering',[element('num',[value('abstractNumId',0)],'',{numId:'1'}),element('abstractNum',[0,1,2].map(i=>element('lvl',[value('start',1)],'',{ilvl:String(i)})),'',{abstractNumId:'0'})]);
const numberedSections=KW.documentSections(KW.indexDoc(numbered),numbering);
assert.equal(numberedSections.find(s=>s.title==='Bewegungsgeschichte').number,'4.1.2');
assert(KW.chapterRange(numberedSections,'4.1.2'));
const pdfParagraph=s=>element('p',[element('r',[element('t',[],s)])]);
const pdfDoc=element('document',[element('body',['3 Einleitung','Text davor.','1 Kindes positiv beitragen.','Text danach.','4 Vorgehen','10Anhang','10.1 Gewöhnliche Geschichte'].map(pdfParagraph))]);
const pdfSections=KW.documentSections(KW.indexDoc(pdfDoc),null);
assert(!pdfSections.some(s=>s.title==='Kindes positiv beitragen.'));
assert(KW.chapterRange(pdfSections,'Anhang – gewöhnliche Geschichte'));
assert.equal(pdfSections[0].end,pdfSections[1].start);
console.log('PASS: automatic Word chapter numbering, PDF continuation lines and appendix paths');
