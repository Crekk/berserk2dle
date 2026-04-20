# Berserk2dle

Minimal daily character guessing game built from the uploaded spreadsheet.

## Files
- `berk2dle.html` - main page
- `js/berserk2dle.js` - game logic
- `css/berserk2dle.css` - minimal styling
- `js/berserk2dle-data.js` - character data embedded for easy local loading

## How it works
- Put character image files in `img/` using lowercase character names, like `img/crewmate.png`. You can override this with an `image` value like `img/guts-alt.png`.
- Picks separate Classic and Splash characters per day at midnight Warsaw time.
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
- `js/berserk2dle-data.js` is used so the page works when opened directly as a local file.
