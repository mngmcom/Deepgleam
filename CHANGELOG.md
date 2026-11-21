# Änderungen

Die Versionsnummer `v1.0.N` entsteht automatisch aus der Anzahl der Commits auf `main`. Jede Version gibt es als ZIP unter [Releases](https://github.com/mngmcom/Deepgleam/releases).

## v1.0.10

**8 Level in 4 Höhlenwelten**

- Jede Höhlenwelt hat jetzt zwei aufeinanderfolgende Level. Das zweite ist jeweils etwas schwerer.
  - Erde: Erdhöhle, **Alte Stollen** (neu)
  - Kristall: Kristallgrotte, **Kristallhallen** (neu)
  - Pilz: Pilzgrotte, **Sporenwald** (neu)
  - Lava: Lavahöhle, **Feuerschlund** (neu)
- Die Schatzkammer mit der Truhe liegt jetzt am Ende von Feuerschlund. Die Lavahöhle endet mit einem normalen Ausgang.
- Jedes Level führt in zwei Stufen nach unten, der Ausgang liegt 4 Kacheln tiefer als der Start. In `level.js` setzt `down(2, [ ... ])` einen Abschnitt samt allen folgenden 2 Kacheln tiefer.
- Auf dem Titelbild steht jetzt „8 LEVEL IN 4 HÖHLENWELTEN“ statt aller Levelnamen.
- In der Lavahöhle war eine Zeile 31 statt 30 Zeichen lang. Sie ist korrigiert.

## v1.0.9

**Spezial-Items**

- **Schild** (`S`): 8 Sekunden unverwundbar, Monster werden bei Berührung besiegt. Abgründe und Lava bleiben tödlich.
- **Doppelgold** (`D`): 12 Sekunden lang bringt jedes Goldnugget 100 statt 50 Punkte.
- Die Restzeit steht oben links im Bild und blinkt kurz vor dem Ende.
- Korrigiert: Der Edelstein im Abschnitt „Aufstieg“ von Erdhöhle und Lavahöhle war nicht erreichbar, weil die Decke jeden Sprung abgebrochen hat.

## Bis v1.0.8

- 4 Level (Erdhöhle, Kristallgrotte, Pilzgrotte, Lavahöhle) mit eigenen Farbwelten und Monstern
- Licht und Dunkelheit, Checkpoints, Highscore im Browser
- MIT-Lizenz, Link zum Online-Spiel, automatische ZIP-Releases über GitHub Actions
