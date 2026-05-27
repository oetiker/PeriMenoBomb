# Roadmap

## v1.1 — bewusst aus dem MVP ausgeklammert

Vollständige Spezifikation in [docs/superpowers/specs/2026-05-27-perimenobomb-design.md](./superpowers/specs/2026-05-27-perimenobomb-design.md), Abschnitt 7.

- **Liste „Letzte N Tage"** — Verlaufsansicht unter `/verlauf` mit konfigurierbarem Zeitraum (7/14/30/90 Tage). Siehe Spec § 7.1.
- **Kalender-Heatmap pro Symptom** — `/verlauf/symptom/[id]` mit 12-Monats-Kalender und Farb-/Sättigungs-Codierung der Intensität. Siehe Spec § 7.2.
- **PDF-Export** — Zeitraum-Export für Arztbesuche, clientseitig via `pdf-lib`. Siehe Spec § 7.3.
- **CSV-Export** — UTF-8 mit BOM, Spalten `date, symptom_id, symptom_name, intensity, comment, tags`. Siehe Spec § 7.4.
- **Tag-Filter in der Verlaufsansicht** — Multi-Select Tag-Chips zum Eingrenzen der angezeigten Einträge. Siehe Spec § 7.1.
