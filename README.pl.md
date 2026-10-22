# zse-timetable-card

[English](README.md)

Karta Lovelace pokazująca plan lekcji w układzie strony VULCAN Optivum (Nr | Godz | Poniedziałek … Piątek), z danych
`sensor.timetable_*` integracji [zse_timetable](https://github.com/achelminski/zse-timetable).
Komórka: przedmiot (pogrubiony) / klasa z grupą / sala, wyrównane do lewej; zastępstwa wyróżnione kolorem,
w pierwszej linii nieobecny nauczyciel („Zastępstwo za J. Kowalski”, wymaga zse_timetable ≥ 1.3.0)
(dymek: za kogo, uwagi). Pod tabelą cała linia „Obowiązuje od: …” ze strony szkoły.

## Instalacja

### HACS (zalecane)
1. HACS → ⋮ → **Własne repozytoria** → `https://github.com/achelminski/zse-timetable-card`, typ **Dashboard**.
2. Pobierz **ZSE Timetable card** — HACS sam doda zasób dashboardu.
3. Twarde odświeżenie przeglądarki / wyczyszczenie pamięci podręcznej aplikacji.

O każdym nowym wydaniu HACS informuje w **Ustawienia → Aktualizacje**.

### Ręcznie
1. Skopiuj `zse-timetable-card.js` do `/config/www/zse-timetable-card/zse-timetable-card.js`.
2. Dodaj zasób dashboardu `/local/zse-timetable-card/zse-timetable-card.js?v=1.3.0`, typ **Moduł JavaScript**;
   po każdej zmianie pliku podbij `?v=`, inaczej przeglądarki trzymają starą wersję.

## Konfiguracja
```yaml
type: custom:zse-timetable-card
entity: sensor.timetable_j_kowalski
title: Plan lekcji            # opcjonalnie; domyślnie atrybut `teacher`
substitution_color: "#e53935" # opcjonalnie
day_switch_hour: 16           # opcjonalnie; widok dzienny: od tej godziny pokazuj następny dzień
```
Edytor wizualny: encja (filtr: sensory zse_timetable), tytuł, kolor zastępstw, godzina przełączenia dnia.

## Zachowanie
- Poziomo (i na komputerze): tydzień, ‹ › przełączają między 2 tygodniami z sensora; w weekend start od następnego tygodnia.
- Pionowo na telefonie / tablecie (`(orientation: portrait) and (max-width: 900px)`): jedna kolumna dnia;
  dziś do `day_switch_hour` (16), potem następny dzień; dzień bez danych (weekend) → najbliższy z planu;
  ‹ › przewijają dni. Godzina liczona w strefie czasowej Home Assistant. Co minutę karta sprawdza, czy minęła godzina
  przełączenia / północ, i sama przeskakuje — o ile dzień nie był przewinięty ręcznie. Obrót ekranu przełącza od razu.
- Wiersze: `lesson_hours` + numery lekcji z pokazywanych dni (np. lekcja 9); lekcje bez numeru w wierszu „–”.
- Kolumny: Pn–Pt, So/Nd tylko gdy mają lekcje; dzisiejsza kolumna z podbarwionym tłem.
- Kolory jak na stronie szkoły (`plan.css`); w ciemnym motywie Home Assistant przygaszona paleta.
- Język według języka użytkownika Home Assistant: polski dla `pl`, angielski w pozostałych przypadkach.
- Bez zależności (czysty Web Component, bez Lit); przerysowanie tylko przy zmianie stanu encji lub motywu.
