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
