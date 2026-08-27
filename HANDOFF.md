# Handoff — Stand 25.08.2026

Arbeitsstand am Ende der Session: Metriken-Umbau ist gebaut und deployed, die
Health-Anbindung ist halb fertig. Schritte laufen automatisch, Ernährung und
Schlaf sind erkundet aber noch nicht implementiert.

---

## 1. Was live ist

Deployed auf dem Pi, Commit `0ec9a44` auf `origin/main`.

**Charts und Metriken**
- Eine Chart-Komponente (`frontend/src/components/charts/Chart.tsx`): Linien,
  Balken, Ziel-Linie mit Toleranzband, gleitender Schnitt über Rohdaten,
  Tap-Readout. Dazu `Sparkline`, `StatTile`, `BarRow`, `MacroSplit`.
- Alle Rechnerei in `frontend/src/lib/stats.ts` (unit-getestet): gleitender
  Schnitt mit Lücken, Regressionssteigung pro Kalendertag, Pearson-Korrelation,
  Schlafschuld, Adherence, Wochen-/Wochentag-Buckets, Nacht-Achse für Uhrzeiten.
- `MetricsPage`: Tab pro Bereich, Bereichswahl als Dropdown im Header,
  Zeitraum-Umschaltung kompakt daneben (7/30/90/1J), beides in localStorage.
- Ab 45 Punkten rollen Balkencharts auf Wochen um.

**Backend**
- `GET /api/workouts/analytics` — Wochenlast, Sätze pro Muskelgruppe gegen die
  4 Wochen davor, e1RM-Progression je Übung (Epley, ≤12 Wdh.), Stagnations-Flag.
  Muskelgruppen aus Hevys `exercise_templates`, 24 h gecacht, Fallback über
  Namensmuster.
- `GET /api/habits/overview` — fällig vs. erledigt pro Tag, Rate je Wochentag.
- `POST /api/ingest/activity` — Schritte ohne Session, Token im Header.

**Schlaf mit Uhrzeiten**
- `SleepEntry.BedTime` / `WakeTime` (`TimeOnly`). Werden beide Zeiten ohne Dauer
  geschickt, rechnet der Server `time_in_bed_minutes` daraus (über Mitternacht).
  Explizit gesendete Dauer gewinnt.
- Metrik **Regelmäßigkeit** = Streuung der Nachtmitte, nicht der Dauer.
  Uhrzeit-Arithmetik auf einer bei 12:00 verankerten Achse (`clockToNightAxis`),
  sonst wären 23:50 und 00:10 zwanzig Stunden auseinander.

**Erhaltungsbedarf**
- Nur noch **gemessen**: Ø Zufuhr gegen die Steigung des Gewichtstrends.
  Braucht 14 kcal-Tage und 8 Wiegungen, zählt bis dahin sichtbar runter.
- Eine Formel-Variante (Mifflin + Aktivitätsfaktor + Schritte + Trainingsminuten)
  war gebaut und wurde auf Wunsch wieder entfernt — zwei Zahlen für eine Frage.
  Die Spalten `birth_date`, `height_cm`, `sex`, `activity_level` stehen noch am
  User, werden aber nicht gelesen. **Nicht ohne Rückfrage wieder anschließen.**

**Wochenziel aus dem Tempo**
- `weekly_rate_percent` am User: 0,35 / 0,6 / 0,9 % Körpergewicht pro Woche,
  wählbar unter Profil → Tempo. Hintergrund war diese Tabelle:
  unter 0,4 % → fettfreie Masse leicht positiv möglich; 0,5–0,7 % → stabil;
  über 0,8 % → fallend.
- **Bezugsgewicht: Trendgewicht (7-Tage-Schnitt), eingefroren am Montag der
  laufenden Woche** (`anchorWeight` in `lib/energy.ts`). Nicht die letzte
  Wiegung — die schwankt um ±1 kg, das wären ±60 kcal Ziel pro Tag.
- Ziel erscheint unter Zahlen → Körper mit Knopf „Als Kalorienziel übernehmen".
  Es wird **nichts automatisch** geschrieben.

**Sonstiges**
- Dashboard-Widgets ein-/ausblendbar und sortierbar (localStorage).
- Gewichts-Delta auf dem Dashboard: Trend gegen Trend, nicht Wiegung gegen Wiegung.
- HabitDetailPage vollständig i18n.
- Ziele erweitert: Schlaf, Zielgewicht, Einheiten/Woche, Sätze/Woche.

Tests: 66 Backend (`dotnet test`), 46 Frontend (`npx vitest run`), Lint sauber.

---

## 2. Infrastruktur

- **Pi**: `ssh pi` (100.112.146.39, User `n8n`), Repo unter
  `~/dev/repos/jinsei`, Remote `github.com/shiraayuki/jinsei`.
- **Deploy**: lokal committen und pushen, dann auf dem Pi
  ```
  cd ~/dev/repos/jinsei && git pull --ff-only
  docker compose --env-file .env -f docker/docker-compose.yml up -d --build
  ```
  Nur Frontend geändert? `... up -d --build frontend` reicht.
- **Vor jedem Deploy mit Migration**: Dump ziehen.
  ```
  docker exec docker-postgres-1 pg_dump -U jinsei -d jinsei | gzip \
    > ~/backups/jinsei/jinsei-predeploy-$(date +%Y%m%d-%H%M).sql.gz
  ```
  Nächtliches Backup läuft ohnehin um 03:00 nach `~/backups/jinsei/`.
- **Erreichbar** über `tailscale serve`: `https://pi.tail3e1947.ts.net:9443`
  → `127.0.0.1:8092`. Nur im Tailnet.
- **Account auf dem Pi**: `wegerernikolas@gmail.com` (Shirayuki), der einzige.
  Registrierung ist in Prod aus.
- **Achtung lokal**: `docker-compose.dev.yml` und `docker-compose.yml` liegen
  beide in `docker/`, teilen sich also Projektnamen und Volume
  `docker_postgres_data`. Die lokale Dev-DB ist dieselbe Datenbank wie die,
  die `./dev.sh` startet — ein `down -v` würde echte Daten löschen. Getrennt
  wurde das bewusst noch nicht.
- Im Backend-Log steht `Cannot load library libgssapi_krb5.so.2`. Harmlos,
  Npgsqls optionale Kerberos-Prüfung im schlanken Container, bestand vorher.

---

## 3. Health-Anbindung

### Fertig: Schritte

`POST /api/ingest/activity`, Auth über Token im Header, kein Cookie.

```
Header:  X-Ingest-Token: <token>      (Authorization: Bearer <token> geht auch)
Body:    {"entries":[{"date":"2026-08-25","steps":10432}]}
Antwort: {"written":1,"days":1}
```

- Token unter Profil → Automatisch erfassen. Wird **einmal** angezeigt, in der
  DB liegt nur der SHA-256-Hash (`IngestTokens`). Neu erzeugen entwertet den alten.
- Schreibt ausschließlich Schritte, fasst die Cardio-Antwort nie an.
- Bis zu 400 Tage pro Request, gleicher Tag überschreibt.
- Auth wird **vor** der Body-Prüfung gemacht, damit ohne Token 401 kommt und
  nicht 400.

**Funktionierender Kurzbefehl** (iOS 26, deutsche Namen):

1. **Health-Messungen suchen** — Typ *Steps*, Startdatum *ist heute*,
   Einheit *Anzahl*, **Gruppieren nach *Tag***, **Beschränken aus**
2. **Details von Health-Messungen abrufen** → *Wert*
3. **Statistik berechnen** → *Summe*
4. **Zahl runden** → Ganzzahl
5. **Aktuelles Datum abrufen**
6. **Datum formatieren** → Benutzerdefiniert `yyyy-MM-dd`
7. **Inhalte von URL abrufen** → POST, Header, Anfragetext **JSON**
   (`entries` → Array → Wörterbuch mit `date` Text und `steps` Zahl)

Fallstricke, die es tatsächlich gab:
- „Beschränken: 1" liefert **ein rohes Häppchen** (kam als 116 an), nicht die
  Tagessumme. Muss aus.
- Anfragetext „Text" schickt `text/plain` → 415. JSON-Modus nehmen, sonst
  zusätzlich `Content-Type: application/json` setzen.
- Ohne `yyyy-MM-dd` schickt iOS `25.08.2026`, das nimmt der Server nicht.
- Aktionen gibt es erst **im Editor** (+ oben rechts), nicht in der
  Kurzbefehl-Liste. Suchfeld unten, Suchwort „Health".

Geprüft: 2026-08-25 stand mit 2.999 Schritten in der DB, überschrieb die
vorherigen 116 korrekt.

### Erkundet, noch nicht gebaut: Ernährung und Schlaf

**FatSecret → Health: funktioniert.** Verbinden über *Mehr → Apps & Geräte →
Apple Health*. Es kommen Kalorien, Makros, Wasser und Gewicht an; keine
Mahlzeitennamen, keine Kaffee-Uhrzeit. Der Prüf-Kurzbefehl (Typ
*Nahrungsenergie*, heute, kcal, gruppiert nach Tag, Beschränken aus →
Details *Wert* → *Ergebnis anzeigen*) liefert die richtige Tagessumme.
**Bestätigt vom Nutzer.**

**Sleep Cycle → Health: funktioniert ebenfalls.** Health → Durchsuchen → Schlaf
zeigt für 24.–25. Aug.:

```
Im Bett   1 Intervall  (8 Std. 45 Min.)   ← deckt sich mit 20:15–05:00
Wach     34 Intervalle (1 Std. 19 Min.)
REM      13 Intervalle (1 Std. 50 Min.)
Kern     42 Intervalle (4 Std. 48 Min.)
Tief      6 Intervalle (47 Min.)
```

Wichtigste Erkenntnis: **„Im Bett" ist genau ein Intervall pro Nacht.** Dessen
Startdatum ist die Zubettgehzeit, dessen Enddatum die Aufstehzeit — kein
Summieren nötig. Die Schlafqualität in Prozent schreibt Sleep Cycle **nicht**
nach Health, dafür gibt es keinen HealthKit-Typ; die bleibt bei Handeingabe
oder Screenshot-Import.

Der Typ heißt in iOS 26 schlicht **„Schlaf"**, nicht „Schlafanalyse".
Bei diesem Typ gibt es **kein** „Gruppieren nach" und keine „Einheit".

---

## 4. Wo es stehen geblieben ist

Offener Punkt, direkt zum Weitermachen: Der Schlaf-Kurzbefehl zeigte **00:00**
statt 20:15. Konfiguration der Suche war korrekt (Typ *Schlaf*, Startdatum
*innerhalb der letzten 1 Tag*, Sortieren *Startdatum*, *Älteste zuerst*,
Beschränken 1). Verdacht liegt auf der Aktion **„Datum formatieren"** — wenn
dort das *Zeitformat* auf „Ohne" steht, kommt Mitternacht raus.

**Zwei Fragen sind noch offen an den Nutzer:**

1. Was zeigt „Startdatum abrufen" **ohne** nachfolgende Formatierung? Steht dort
   20:15, war es das Format; steht dort 00:00, kommen die Daten woanders her
   (iPhone-Schlafplan statt Sleep Cycle — der Schlaffokus war aktiv).
2. Bietet *Filter hinzufügen* in der Schlaf-Suche einen **Wert-** oder
   **Kategorie-Filter**? Wenn ja: *Wert ist „Im Bett"* — dann braucht es weder
   Sortierung noch Beschränkung, weil genau eine Messung übrig bleibt.

---

## 5. Nächste Schritte, geplant

**a) Endpoints für Ernährung und Schlaf** — bewusst getrennt, damit ein
ausgefallener Sync den anderen nicht mitnimmt:

```
POST /api/ingest/nutrition
{"entries":[{"date":"2026-08-25","kcal":2310,"proteinG":194,
             "carbsG":197,"fatG":71,"waterL":3.0}]}

POST /api/ingest/sleep
{"entries":[{"date":"2026-08-25","bedTime":"20:15","wakeTime":"05:00"}]}
```

Zwei Regeln, die beide einhalten müssen:
- **Weggelassene Felder werden nicht angefasst.** Nur Kalorien schicken lässt
  Wasser und Notizen stehen.
- **Handeingaben gewinnen nie verloren.** Schlafqualität, Cardio-Antwort und
  Notizen rührt kein Ingest an. Beim Schlaf reicht es, `bedTime`/`wakeTime` zu
  schicken — `time_in_bed_minutes` rechnet der Controller schon daraus.

Auth genauso wie bei `activity`: Token-Header, erst Auth, dann Body.

**b) Drei Automationen auf dem iPhone**

| Kurzbefehl | Wann | Schickt |
|---|---|---|
| Schritte | 23:50 | steps *(läuft)* |
| Ernährung | 23:55 | kcal, Protein, KH, Fett, Wasser |
| Schlaf | 09:00 | bedTime, wakeTime der Nacht davor |

Automation anlegen unter *Kurzbefehle → Automation → Tageszeit*, dabei
**„Vor dem Ausführen fragen" ausschalten**.

Fallback, falls der Schlaf-Kurzbefehl zu fummelig wird: die App
**Health Auto Export**, die von sich aus JSON per POST an eine eigene URL
schickt, inklusive Zeitplan und Nachholen. Dann müsste nur ihr Format
angenommen werden.

---

## 6. Ideen-Backlog

Aus der Runde „was machen beliebte Fitness-Apps", nach Erkenntnis pro Aufwand.
Jede Metrik muss die Frage beantworten: *welche Entscheidung treffe ich damit?*

1. **Selbstnachführende Ziele** — teilweise erledigt (Wochenziel steht). Fehlt:
   Protein-Ziel aus Körpergewicht, automatische Anpassung ohne Knopfdruck.
2. **Wochen-Check-in** (Sonntag): Ziel getroffen, Trend im Plan, Vorschlag zum
   Anpassen mit einem Tap.
3. **Trainingslast / ACWR**: letzte 7 Tage gegen letzte 28 bei Sätzen und
   Volumen. Über ~1,5 Sprung, unter 0,8 Abbau. Daten liegen im Analytics-Endpoint.
4. **Readiness-Score** aus Schlafdauer, Regelmäßigkeit, Schlafschuld,
   Trainingslast und Energie-Rating. Muss offenlegen, woraus er besteht.
5. **Übungs-Detailseite**: Tap auf eine Übung → e1RM-Verlauf, Volumen, alle
   Sätze. Daten sind da, es fehlt nur die Seite.
6. **Rekord-Erkennung** nach jedem Sync: neues bestes e1RM, Satzgewicht, Volumen.
7. **Session-Spickzettel**: „Beim letzten Push: Bankdrücken 4×8 @ 80".
8. **Abend-Push**, wenn der Tag noch unvollständig ist. PWA-Push geht auf iOS,
   wenn die App auf dem Homescreen liegt.
9. **Fortschrittsfotos** — braucht Datei-Storage, einziger echt neuer Baustein.
10. **Monats-/Jahresrückblick** als Textreport.

Bewusst verworfen: Social-Feed, Übungsbibliothek mit Videos, Wasser-Erinnerungen
im Stundentakt, Barcode-Scanner, KI-Coach-Chat.

---

## 7. Datenstand auf dem Pi (25.08.2026)

- Schlaf: 9 Nächte ab 17.08., davon 8 mit Uhrzeiten nachgetragen
  (17.–18. bis 24.–25. Aug.). Die gemessenen Dauern aus Sleep Cycle wurden
  bewusst **nicht** durch die aus den Uhrzeiten gerechneten ersetzt.
- Kalorien: 8 Tage — der gemessene Bedarf braucht 14, also noch ~6 Tage.
- Wiegungen: 8, damit erfüllt.
- Schritte: 8 Tage plus die automatisch geschriebenen. Der Kurzbefehl schließt
  diese Lücke ab jetzt selbst.
- Workouts: 44 Einheiten, letzter Sync 25.08. Trainingspause 13.–16.08. ist
  echt, keine Sync-Lücke.
