# iobroker.wolf

## Einsatzbereiche: Heizung / Solar / Wohnraumlüftung
Der Adapter kann über das ISM8i maximal 4  von den nachfolgenden Heizgeräten auswerten:
  * Gasbrennwertgerät: CGB-2 (beinhaltet: CGW-2, CGS-2, CSZ-2), MGK-2 
  * Öl Brennwertkessel:   TOB 
  * Split-Wärmepumpe:  BWL-1-S 
  * Wohnraumlüftung CWL Excellent
  Es ist immer ein System-Bedienmodul BM-2 oder Anzeigemodul AM erforderlich. 
  Weiterhin können zusätzliche Komponenten wie Mischermodul MM, Kaskadenmodul KM, Solarmodul SM1 oder SM2, im eBusSystem vorhanden sein. 
  
  Maximale Anzahl der einzelnen Module: 
  * max. 4 Heizgeräte hg(1)-hg(4)
  * max. 3 Mischer mm(1)- mm(3)
  * max. 4 Bediengeräte (BM-2) bm(1) -bm(4)
  * max. 1 Kaskadenmodul km(1) 
  * max. 1 Solarmodul (SM1 oder SM2) sm(1)
  * max. 1 Split-Luft/Wasser-Wärmepumpe (BWL-1-S) hg(0)
  Ein Wohnraumlüftungsgerät der Baureihe CWL Excellent kann mit dem ISM8i ebenfalls ausgewertet und bedient werden.

## Werte schreiben
Schreibbare Datenpunkte werden an das ISM8i gesendet, wenn ihr Wert ohne Bestätigung (`ack = false`) gesetzt wird.
Der Adapter begrenzt und rundet den Wert auf den erlaubten Bereich (ISM8i-Handbuch, Kapitel 8.8) und bestätigt den State mit dem gesendeten Wert.
Ungültige Werte werden nicht gesendet, sondern als Fehler geloggt.

| Datenpunkt                         | Werte                                                                         |
|------------------------------------|-------------------------------------------------------------------------------|
| Programmwahl Heizkreis / Mischer   | `0` / `Standby`, `1` / `Automatikbetrieb`, `2` / `Heizbetrieb`, `3` / `Sparbetrieb` |
| Programmwahl Warmwasser            | `0` / `Standby`, `1` / `Automatikbetrieb`, `2` / `Dauerbetrieb`               |
| Programmwahl CWL                   | `0` / `Automatikbetrieb`, `1` / `Nennlüftung`, `3` / `Reduzierte Lüftung`, `4` / `Feuchteschutz` |
| Warmwassersolltemperatur           | 20...80 °C in Schritten von 1 °C                                              |
| Sollwertkorrektur                  | -4...4 K in Schritten von 0,5 K                                               |
| Sparfaktor                         | 0...10 K in Schritten von 0,5 K                                               |
| Leistungsvorgabe, Gesamtmodulationsgradvorgabe | 0...100 %                                                         |
| Kessel-/Sammlersolltemperaturvorgabe | 0...90 °C (das Gerät begrenzt auf TKmin/TKmax)                              |
| Datum (Intensivlüftung, Feuchteschutz) | `JJJJ-MM-TT`, `TT.MM.JJJJ` oder jedes Format, das JavaScript `Date` lesen kann |
| Uhrzeit (Intensivlüftung, Feuchteschutz) | `HH:MM`, `HH:MM:SS` oder jedes Format, das JavaScript `Date` lesen kann     |
| Schalter (Zeitprogramme usw.)      | `On`, `1`, `true` = ein, alles andere = aus                                   |

Die Zahlen der Programmwahl Heizkreis/Mischer/Warmwasser entsprechen der Nummerierung am Wolf-Bediengerät (ISM8i-Handbuch, Kapitel 8.7), nicht den KNX-Werten.

## Verbindung
Der Adapter ist ein TCP-Server, das ISM8i verbindet sich mit ihm (Standard-Port 12004).
`info.connection` zeigt, ob ein ISM8i verbunden ist.
Verbindet sich das ISM8i neu, wird die alte Verbindung von dieser Adresse geschlossen.
