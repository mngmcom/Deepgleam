# Deepgleam

Ein kleines Side-Scrolling-Jump-and-Run im Pixel-Look, das direkt im Browser läuft.
Ein Abenteurer erkundet mit seiner Laterne eine dunkle Höhle und sucht einen verlorenen Goldschatz.

![Screenshot: Der Abenteurer mit Laterne in den Höhlenruinen, daneben eine Wandfackel, ein Edelstein und zwei Spinnen](docs/screenshot.png)

## Starten

`index.html` im Browser öffnen. Es braucht weder einen Server noch einen Build-Schritt oder Abhängigkeiten.

## Steuerung

| Taste | Aktion |
|---|---|
| Pfeil links / rechts, A / D | Laufen |
| Leertaste, W, Pfeil hoch | Springen (länger halten = höher) |
| Pfeil runter, S | Durch eine Holzplanke fallen |
| P, Esc | Pause |
| M | Ton an / aus |
| Enter | Start / Neustart |

## Spielprinzip

- Die Höhle ist dunkel, nur der Lichtkreis der Laterne, Fackeln und Checkpoint-Laternen zeigen den Weg.
- **Gold** bringt 50 Punkte, **Edelsteine** 250, ein besiegter Gegner 100.
- **Spinnen** und **Fledermäuse** besiegt man mit einem Sprung auf den Kopf. Seitliche Berührung kostet HP.
- **Stacheln** verletzen, **Stalaktiten** wackeln kurz und fallen dann herab.
- **Checkpoints** (Laternen am Pfahl) speichern den Wiedereinstieg und füllen die HP auf.
- Bei 0 HP oder einem Sturz in den Abgrund geht ein Leben verloren. Nach 3 Leben ist das Spiel vorbei.
- Ziel ist die **Schatztruhe** am Ende der Höhle. Übrige Leben und HP bringen Bonuspunkte.
- Der Highscore wird im Browser gespeichert (`localStorage`).

## Projektaufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Seite mit dem Canvas, skaliert pixelgenau auf die Fenstergröße |
| `level.js` | Leveldaten als Text, in Abschnitte gegliedert |
| `game.js` | Spiellogik, Grafik, Licht und Sound |

Technik: reines JavaScript mit HTML5 Canvas, interne Auflösung 320×180 Pixel bei 16×16-Kacheln. Alle Grafiken und Soundeffekte werden im Code erzeugt (Pixel-Sprites aus Zeichenketten, Töne über die Web Audio API).

## Level bearbeiten

Das Level steht in `level.js` als Liste von Abschnitten, die von links nach rechts aneinandergehängt werden. Jeder Abschnitt hat 12 Zeilen, ein Zeichen entspricht einer Kachel:

| Zeichen | Bedeutung | Zeichen | Bedeutung |
|---|---|---|---|
| `#` | Fels | `B` | Steinziegel |
| `=` | Holzplanke (von unten durchspringbar) | `^` | Stacheln |
| `\|` | Holzbalken (Deko) | `.` | Luft |
| `P` | Startpunkt | `C` | Checkpoint |
| `o` | Goldnugget | `*` | Edelstein |
| `s` | Spinne | `b` | Fledermaus |
| `v` | Stalaktit | `f` | Wandfackel |
| `T` | Schatztruhe (Ziel) | | |

Die Spielfigur springt etwa 3 Kacheln hoch und 3 bis 4 Kacheln weit.

Zum Testen kann man sich in der Browser-Konsole an eine Stelle versetzen, z. B. `caveRun.teleport(180, 9)` (Kachelspalte, Kachelzeile).

## Anpassen

Spielgefühl und Schwierigkeit lassen sich über die Konstanten am Anfang von `game.js` einstellen:
`RUN` (Laufgeschwindigkeit), `JUMP_V` (Sprungkraft), `GRAV` (Schwerkraft), `MAX_HP` und `START_LIVES`.
