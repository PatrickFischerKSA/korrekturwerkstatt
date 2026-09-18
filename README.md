# Korrekturwerkstatt

Lokales Browser-Tool für bis zu 30 Originaltexte und zugehörige Fehlerlisten. Die Originale werden im Arbeitsspeicher verarbeitet und als neue Word-Dateien mit roten Fehlerstellen und echten Randkommentaren exportiert. Es werden keine Texte übertragen oder dauerhaft gespeichert.

## Starten

`Korrekturwerkstatt.html` per Doppelklick in Chrome, Edge, Firefox oder Safari öffnen. Keine Installation und kein Server nötig. Alternativ `dist/index.html` öffnen.

1. Originaltexte als PDF, DOCX oder TXT laden (maximal 30, je 20 MB).
2. Fehlerlisten als PDF, CSV, JSON, TXT oder Word-Tabelle laden (je 10 MB).
3. Zuordnung prüfen. Unklare Textstellen und fehlende Angaben bearbeiten.
4. Einzelne Word-Dateien oder alle Dateien als ZIP herunterladen.

Ein Beispiel und eine CSV-Vorlage sind im Tool enthalten. Dateien und Änderungen gehen beim Neuladen verloren. Vorher Ergebnisse herunterladen.

## Benennung und Fehlerlisten

Die automatische Zuordnung nutzt den gemeinsamen Dateinamen, z. B. `KS1_Beispiel.docx` und `KS1_Beispiel_Fehlerliste.csv`. Endungen wie `_Original`, `_Fehlerliste`, `_Korrektur` und `_rot_mit_Randbemerkungen` werden ignoriert. Andere Systeme lassen sich über die manuelle Zuordnung nutzen. Eine Fehlerliste kann mehrere Texte enthalten: Die optionale Spalte `Text-ID` benennt den jeweiligen Text ohne Erweiterung. Einträge ohne Text-ID gelten für den manuell zugeordneten Text.

CSV und Word-Tabellen verwenden folgende Kopfzeile:

`Text-ID;Textstelle;Fehlerart;Erklärung;Gewicht;Vorkommen;Korrektur`

Pflichtangaben: Textstelle, Fehlerart, Erklärung und Gewicht. Eine Korrektur kann anstelle der Erklärung stehen; sie wird dann ausdrücklich als Korrektur bezeichnet. Erklärungen und Gewichte werden aus der Liste übernommen. Bei PDF-Tabellen ohne Fehlerart wird diese anhand eindeutiger Begriffe in der Erklärung abgeleitet und in der Prüfansicht kenntlich gemacht. Unklare Arten müssen von Hand ergänzt werden. Das Gewicht ist eine nicht negative Zahl; Dezimalkomma ist erlaubt.

Die Textstelle wird wörtlich gesucht, wobei Leerraum vereinheitlicht wird. Mehrdeutige Treffer verlangen eine Auswahl oder eine Vorkommen-Angabe (1, 2, …). Fehlende Kommas werden durch die umgebenden Wörter verankert. Überlappende Fehler sind möglich und erhalten separate Randkommentare.

TXT-Beispiel:

```
Textstelle: nach ob
Fehlerart: Interpunktion
Erklärung: Vor dem Nebensatz steht ein Komma.
Gewicht: 0,5
Vorkommen: 1
Korrektur: nach, ob
```

JSON-Beispiel:

```json
[{"Textstelle":"rufte","Fehlerart":"Grammatik","Erklärung":"Die Vergangenheitsform lautet «rief».","Gewicht":1}]
```

Word-Fehlerlisten: Tabellen mit den genannten Spalten oder beschriftete Absätze wie im TXT-Beispiel. Unstrukturierte freie Fehlerberichte werden nicht automatisch interpretiert.

## Randkommentare und Word-Export

Vorhandene Word-Randkommentare mit `Fehlerart`, `Erklärung` bzw. `Korrektur` und `Gewichtung` werden samt ihren verankerten Textbereichen importiert. Die Auswahl «Vorhandene Randkommentare» wandelt diese in aktualisierte Randkommentare um. Sonstige Kommentare bleiben bestehen.

Bei DOCX-Originalen verändert der Export nur die notwendigen OOXML-Teile. Absatzformatierung, Run-Formatierung, Tabellen, Bilder, Seitenlayout und bestehende Fussnoten und sonstige Kommentare bleiben erhalten. Randkommentare sind mit der markierten Textstelle verknüpft und werden in Word im Kommentarbereich angezeigt. Rote Markierungen sind Schriftfarbe, keine ersetzten Wörter. Der gesamte indizierte Originaltext wird nach der Bearbeitung nochmals mit dem Eingabetext verglichen. Die Vorschau zeigt den Text und die Fehleranker, kein identisches Word-Seitenlayout.

Nachverfolgte Änderungen und Textfelder werden mit einer konkreten Meldung abgelehnt; diese müssen vorher in Word bereinigt werden. DOC-Originaltexte und passwortgeschützte Dateien werden nicht unterstützt. Fehlerstellen in Kopf- und Fusszeilen, Feldcodes und nicht textuellen Objekten werden nicht automatisch annotiert.

## Technik und Wartung

`dist/engine.js`: OOXML-Verarbeitung und Parser. `dist/app.js`: Oberfläche und Workflow. `dist/style.css`: Darstellung. `dist/jszip.min.js`: JSZip 3.10.1 (MIT, Copyright im Bibliothekskopf). PDF.js ist zusätzlich lokal eingebettet (Mozilla Foundation, Apache-2.0; vollständige Lizenz im Paket). Keine externen Skripte, Schriftarten oder APIs.

Die vollständige Anwendung und die Einzeldatei sind bereits enthalten. Zum Aktualisieren der Einzeldatei nach Änderungen an `dist/` genügt:

```sh
node build-local.cjs
```

Zum Neubündeln von PDF.js 5.6.205:

```sh
npm install --no-save pdfjs-dist@5.6.205
node bundle-pdf.cjs
node build-local.cjs
```

Persönliche Originaltexte, Fehlerlisten, exportierte Word-Dateien und lokale Prüfergebnisse werden nicht im Repository gespeichert.

## PDF-Fehlerlisten

Unterstützt werden auslesbare PDF-Tabellen mit den Spalten `Nr.`, `Fehlerhafte Textstelle`, `Korrektur`, `Erklärung` und `P.` bzw. `Punkt`, wie im bereitgestellten Beispiel `S4d_Beispiel_Fehlerliste.pdf`. Die Fehlerart ist optional. Die Zuordnung erfolgt zum gemeinsamen Dateinamen `S4d_Beispiel.docx`. Scans ohne Textebene und passwortgeschützte PDFs werden mit einer verständlichen Meldung abgelehnt; OCR ist nicht eingebaut.

PDF-Zeilenumbrüche werden zusammengeführt. Auslassungen `[…]` in Zitaten und typografische Anführungszeichen werden bei der Suche berücksichtigt. Aus dem Unterschied zwischen Fehlerstelle und Korrektur wird nach Möglichkeit der betroffene Ausschnitt bestimmt. Fehlende Satzzeichen werden an den angrenzenden Wörtern markiert. Der Originaltext selbst wird nicht korrigiert oder umgeschrieben.

Die Angaben unter «Zusätzliche Ausdruckshinweise» werden nicht in die Fehlerzählung oder Randkommentare übernommen. Eine erkennbare Angabe `Gesamt: … Fehlerpunkte` wird mit der importierten Summe verglichen; bei Abweichungen stoppt der Import. Pro PDF sind höchstens 100 Seiten erlaubt. Die Funktion ist für die beschriebene Tabellenstruktur ausgelegt, nicht für beliebige PDF-Layouts.

Die Prüfansicht zeigt den vollständigen PDF-Auszug und die Korrektur sowie gegebenenfalls den Hinweis «Fehlerart aus Erklärung abgeleitet». Die abgeleitete Fehlerart ist vor dem Export bearbeitbar. Das Original-PDF bleibt unverändert.

## PDF als Originaltext

PDF-Dateien können auch im Feld **Originaltexte** hochgeladen werden. Benennung und Zuordnung funktionieren wie bei Word: `S4d_Beispiel.pdf` und `S4d_Beispiel_Fehlerliste.pdf`. Bis zu 30 Originaldateien, je höchstens 20 MB und bei PDF höchstens 100 Seiten, sind möglich.

Voraussetzung ist eine auslesbare Textebene. Eine Seite ohne auslesbaren Text stoppt den Import mit einem Hinweis auf die erforderliche Texterkennung (OCR); dadurch werden auch teilweise gescannte Dokumente nicht stillschweigend gekürzt. OCR und passwortgeschützte PDFs werden nicht unterstützt.

Der ausgelesene Text wird für den Word-Export neu gesetzt. Das PDF-Schriftbild, Bilder, Tabellenstruktur und ursprüngliche Seitenumbrüche werden nicht übernommen. Vor allem bei mehrspaltigen Dokumenten die Textreihenfolge in der Vorschau prüfen. Die roten Markierungen und echten Randkommentare werden im erzeugten Word-Dokument eingefügt. Die gesamte Verarbeitung bleibt lokal im Browser.

## Veröffentlichung mit GitHub Pages

Der Workflow **Publish Korrekturwerkstatt** veröffentlicht die Website sowie die Offline-Version und Anleitung. In den Repository-Einstellungen muss GitHub Pages mit der Quelle **GitHub Actions** aktiviert sein. Danach unter **Actions → Publish Korrekturwerkstatt → Run workflow** starten.

Der Workflow prüft die JavaScript-Dateien, baut die Offline-Version aus den Quellen und veröffentlicht ausschliesslich die Anwendung. Die Dateien `Korrekturwerkstatt.html`, `Korrekturwerkstatt.zip` und `Anleitung.md` sind danach zusätzlich unter der Website-Adresse abrufbar.

### Abweichende PDF-Tabellen und Importhinweise

Mehrseitige Tabellen mit wiederholter oder zweizeiliger Kopfzeile werden erkannt. Reine Zitatanführungszeichen werden bei der Textsuche als zweite Möglichkeit weggelassen, wenn das vollständige Zitat nicht im Original vorkommt.

Fehlen einzelne Punktwerte, ergänzt das Tool sie nur anhand einer ausdrücklich angegebenen Zählregel, wenn Fehlerarten, Anzahl und Gesamtsumme vollständig zusammenpassen. Die Herleitung bleibt am jeweiligen Fehlereintrag sichtbar. Ohne eine solche konsistente Regel bleibt das Gewicht offen und muss vor dem Export ergänzt werden.

Nach einem Stapelimport zeigt die Oberfläche die Anzahl geladener Dateien. Tatsächliche Importfehler stehen direkt darunter; wiederkehrende sachliche Hinweise werden gruppiert und eingeklappt angezeigt. Die Hinweise zur ausgewählten Fehlerliste bleiben in der Prüfansicht verfügbar.

### Word-Fehlerlisten

Tabellen unterstützen auch «Fehlerhafte Textstelle» und «P.». Fortsetzungstabellen werden zusammengeführt. Separate Tabellen mit «Mögliche Verbesserung» werden als ungezählte Stilhinweise ausgelassen. Fehlende Fehlerarten werden aus der Erklärung abgeleitet und bleiben editierbar. Eine ausdrückliche Tabellenzeile «Keine eindeutigen Fehler» mit 0 Punkten erlaubt den unveränderten Export. Erkannte Gesamtsummen werden gegen die importierten Gewichte geprüft.

### Flexible Erkennung

Word-, CSV-, JSON- und beschriftete Textlisten sowie PDF-Kopfzeilen verwenden gemeinsame Feldnamen. Synonyme wie «Zitat», «Originaltext», «Erläuterung» und «Abzug», Klammerzusätze und eindeutige einzelne Tippfehler in längeren Kopfzeilen werden erkannt. Word-/CSV-Tabellen dürfen Titelzeilen und wiederholte Kopfzeilen enthalten; nummerierte Word-Fortsetzungstabellen können die letzte Spaltenzuordnung übernehmen. Gewichte akzeptieren beispielsweise «0,5 Pkt.», «½» und «1/2». Mehrdeutige Spalten, widersprüchliche Summen und unpassende Zellenzahlen werden gemeldet; fehlende Angaben bleiben zur Prüfung offen. Beliebige Layouts und gescannte PDFs ohne Textebene werden weiterhin nicht automatisch interpretiert.
