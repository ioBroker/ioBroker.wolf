# iobroker.wolf
## Areas of application: heating / solar / domestic ventilation
The adapter can evaluate a maximum of 4 of the following heaters via the ISM8i:
   * Gas condensing unit: CGB-2 (includes: CGW-2, CGS-2, CSZ-2), MGK-2
   * Oil condensing boiler: TOB
   * Split heat pump: BWL-1-S
   * Living room ventilation CWL Excellent
   A system control module BM-2 or display module AM is always required.
   Furthermore, additional components such as mixer module MM, cascade module KM, solar module SM1 or SM2, may be present in the eBus system.
   
Maximum number of individual modules:
   * Max. 4 heaters hg (1) -hg (4)
   * Max. 3 mixers mm (1) - mm (3)
   * Max. 4 operator panels (BM-2) bm (1) -bm (4)
   * Max. 1 cascade module km (1)
   * Max. 1 solar module (SM1 or SM2) sm (1)
   * Max. 1 Split air/water heatpump (BWL-1-S) hg (0)
   A residential ventilation unit of the CWL Excellent series can also be evaluated and operated with the ISM8i.

## Writing values
Writable datapoints are sent to the ISM8i when their value is set without acknowledge (`ack = false`).
The adapter limits and rounds the value to the allowed range (ISM8i manual, chapter 8.8) and acknowledges the state with the sent value.
Invalid values are not sent, an error is logged instead.

| Datapoint                          | Values                                                                        |
|------------------------------------|-------------------------------------------------------------------------------|
| Programmwahl Heizkreis / Mischer   | `0` / `Standby`, `1` / `Automatikbetrieb`, `2` / `Heizbetrieb`, `3` / `Sparbetrieb` |
| Programmwahl Warmwasser            | `0` / `Standby`, `1` / `Automatikbetrieb`, `2` / `Dauerbetrieb`               |
| Programmwahl CWL                   | `0` / `Automatikbetrieb`, `1` / `Nennlüftung`, `3` / `Reduzierte Lüftung`, `4` / `Feuchteschutz` |
| Warmwassersolltemperatur           | 20...80 °C in steps of 1 °C                                                   |
| Sollwertkorrektur                  | -4...4 K in steps of 0.5 K                                                    |
| Sparfaktor                         | 0...10 K in steps of 0.5 K                                                    |
| Leistungsvorgabe, Gesamtmodulationsgradvorgabe | 0...100 %                                                         |
| Kessel-/Sammlersolltemperaturvorgabe | 0...90 °C (the device limits it to TKmin/TKmax)                             |
| Date (Intensivlüftung, Feuchteschutz) | `YYYY-MM-DD`, `DD.MM.YYYY` or any format that JavaScript `Date` can parse   |
| Time (Intensivlüftung, Feuchteschutz) | `HH:MM`, `HH:MM:SS` or any format that JavaScript `Date` can parse          |
| Switches (Zeitprogramme etc.)      | `On`, `1`, `true` = on, everything else = off                                 |

The numbers of Programmwahl Heizkreis/Mischer/Warmwasser are the numbering of the Wolf control unit (ISM8i manual, chapter 8.7), not the KNX values.

## Connection
The adapter is a TCP server, the ISM8i connects to it (default port 12004).
`info.connection` shows whether an ISM8i is connected.
If the ISM8i connects again, the old connection from this address is closed.
