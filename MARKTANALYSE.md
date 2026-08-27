# Marktanalyse & Roadmap — Stand 27.08.2026

Was jinsei gegenüber dem Markt kann, was fehlt, und in welcher Reihenfolge das
zu bauen wäre. Momentaufnahme, kein Beschluss.

---

## 1. Wo jinsei steht

| Kategorie | Marktführer | jinsei |
|---|---|---|
| Health-Hub | Apple Health, Whoop, Oura, Garmin | Aggregiert Hevy + Sleep Cycle + Apple Health, ohne Wearable-Tiefe |
| Ernährung | MyFitnessPal, MacroFactor, Cronometer | Handeingabe + Health-Ingest, keine Lebensmitteldatenbank, kein Barcode |
| Training | Hevy, Strong, Boostcamp | Read-only-Sync plus eigene Analytics (e1RM, Muskelgruppen, Stagnation) |
| Schlaf | Sleep Cycle, AutoSleep, Rise | Phasen, Regelmäßigkeit, sozialer Jetlag — auf Augenhöhe |
| Habits | Streaks, Loop, Finch | Streaks + Overview, **keine Erinnerungen** |
| Quantified Self | Exist.io, Bearable, Gyroscope | Zusammenhänge am 27.08. entfernt — genau deren Kernversprechen |

**Vorteil:** Ein Ort für Training, Essen, Schlaf, Körper und Habits — ohne Abo,
ohne fremde Cloud, Daten in der eigenen Postgres. Kein Wettbewerber bietet das.
Zum Vergleich: MacroFactor ~12 $/Monat, Exist.io ~6 $, Whoop ~30 $ — alle mit
den Daten auf fremden Servern.

**Nachteil:** kein Wearable-Ökosystem, kein Herzdaten-Kanal, die höchste
Eingabereibung im Feld bei Ernährung, und erreichbar nur solange das Tailnet
steht.

---

## 2. Die Lücken

### 2.1 Datenzufluss zu schmal
Gezogen werden Schritte, Ernährung, Schlaf. Apple Health hält außerdem
**Ruhepuls, HRV, VO2max, Cardio-Einheiten mit Distanz und Puls, Waagengewicht**.
Die Ingest-Struktur steht (Token, per Quelle getrennte Endpunkte, feldweises
Verwerfen) — jeder weitere Typ ist ein Endpunkt nach demselben Muster.
Ohne HRV und Ruhepuls fehlt die einzige objektive Größe für Erholung.

### 2.2 Keine Erinnerungen
Habits ohne Push ist gegen Streaks nicht konkurrenzfähig. Die Zeitsteuerung
existiert bereits (`HevySyncScheduler`, täglich 19:30). Es fehlt Web Push
(Service Worker + VAPID). Größte Verhaltenslücke der App.

### 2.3 Kein Wochenrückblick
Whoop, Strava und Oura leben davon. Der Wochenbericht existiert als Text
(`GET /api/summary/week/{date}`), der Scheduler existiert — es fehlt der
Auslöser, der ihn Sonntagabend selbst erzeugt und zustellt.

### 2.4 Kalorienziel wird nicht nachgeführt
Alle Bausteine sind da: gemessener Energiebedarf (`lib/energy.ts`),
Ankergewicht, Pace in `weekly_rate_percent`. MacroFactors ganzes Produkt ist
diese Schleife — wöchentlich Bedarf neu schätzen, Ziel nachziehen. Hier muss
man den Knopf drücken.

### 2.5 Trainingsbelastung ohne Verhältnis
Wochenlast wird berechnet, aber nicht **akute gegen chronische Last** (ACWR) —
die Zahl, die sagt, ob eine Woche ein Sprung oder ein Trend ist. Aus
vorhandenen Daten baubar. Ebenso: **PRs werden nicht erkannt**, obwohl
`WorkoutLog.PayloadJson` jeden Satz enthält.

### 2.6 Zusammenhänge fehlen ganz
Am 27.08. entfernt, zu Recht: zwei der vier Zeilen hingen an gelöschten Feldern
(Energie/Hunger, Schlafqualität). Mit **Einschlafdauer, Kaffeezeit, Phasen,
Trainingslast und Schritten** gäbe es jetzt bessere Paare als vorher. Das ist
der Teil, für den Exist.io Geld nimmt.

### 2.7 Kein Datenexport
Bei einer selbstgehosteten App ist „meine Daten gehören mir" das
Verkaufsargument — aktuell kommt man nur per `pg_dump` über SSH heran.
CSV/JSON je Bereich ist ein Nachmittag.

### 2.8 Erscheinungsbild folgt nicht dem System
Hell/Dunkel ist ein manueller Schalter, `prefers-color-scheme` wird ignoriert.
Jede iOS-App kann das.

### 2.9 Ernährungseingabe
Ohne Datenbank, Favoriten oder „gestern wiederholen" bleibt es die mühsamste
Stelle. Open Food Facts ist frei und barcodefähig; Favoriten und Wiederholen
wären schon ohne externe API die halbe Miete. (Der Screenshot-Import für
Ernährung wurde am 27.08. aus der UI entfernt, der Endpunkt versteht
`kind: "nutrition"` weiterhin.)

---

## 3. Reihenfolge

### Sofort — hoher Hebel, billig
1. System-Erscheinungsbild automatisch folgen (`prefers-color-scheme`)
2. Datenexport CSV/JSON je Bereich
3. Ingest erweitern: Ruhepuls, HRV, Cardio-Einheiten, Waagengewicht
4. Kalorienziel wöchentlich automatisch nachführen

### Als Nächstes — echter Produktzuwachs
5. Web Push → Habit-Erinnerungen, Abendcheck „Tag noch nicht eingetragen"
6. Automatischer Wochenrückblick
7. ACWR + PR-Erkennung aus dem vorhandenen Payload
8. Zusammenhänge neu, mit Lag und Mindestanzahl an Paaren

### Später
9. Bereitschafts-Score (Schlaf + Regelmäßigkeit + Last + HRV)
10. Ernährung: Favoriten, Wiederholen, Barcode
11. Verlaufsansicht Monat/Kalender

### Bewusst nicht
- Zyklus, Medikamente, Stimmung — Befinden wurde am 27.08. entfernt
- Watch-App, Complications — mit einer PWA nicht erreichbar
- Mehrbenutzer, Coach-Sicht — widerspricht dem Zweck

---

## 4. Risiken, die keine Features sind

- **Gemini-Freikontingent** trägt den Screenshot-Import. Kein Fallback, wenn
  Google das Modell abkündigt.
- **Hevy-API** ist die einzige Trainingsquelle; ein manueller Pfad wurde
  bewusst entfernt.
- **Ein Pi, ein Tailnet.** Nächtliche Dumps laufen nach `~/backups/jinsei/`,
  ein Restore wurde nie geprobt. Ein ungetestetes Backup ist eine Vermutung.
- **Der Sleep-Ingest liegt uncommitted** im Arbeitsverzeichnis
  (`backend/Controllers/IngestController.cs`, `backend.Tests/Day/IngestTests.cs`,
  eine Zeile in `CLAUDE.md`). Ein `git checkout` an der falschen Stelle und er
  ist weg.
