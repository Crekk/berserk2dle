# Berserk2dle

Minimal daily character guessing game built from the uploaded spreadsheet.

## Files
- `index.html` — main page
- `app.js` — game logic
- `styles.css` — minimal styling
- `characters.json` — spreadsheet reformatted to JSON
- `data.js` — same JSON embedded for easy local loading

## How it works
- Picks one character per UTC day.
- Every player gets the same daily answer.
- Guess rows compare:
  - Species
  - Affiliation
  - Role
  - Size
  - Debut
  - Combat Style
- Green = exact match
- Yellow = partial match
- Gray = no match
- Size and Debut show arrows toward the target when rank data exists.

## Notes
- State is saved in browser localStorage by date.
- `data.js` is used so the page works when opened directly as a local file.
