(function () {
  const DATA = window.BERSERK2DLE_DATA;
  const CHARACTERS = DATA.characters;
  const SIZE_ORDER = DATA.rankings.size;
  const DEBUT_ORDER = DATA.rankings.debut;
  const EPOCH_UTC = new Date(DATA.meta.seedEpochUtc + "T00:00:00Z");

  const TRAITS = [
    { key: "species", label: "Species" },
    { key: "affiliation", label: "Affiliation" },
    { key: "role", label: "Role" },
    { key: "size", label: "Size", ordered: true, ranking: SIZE_ORDER },
    { key: "debut", label: "Debut", ordered: true, ranking: DEBUT_ORDER },
    { key: "combatStyle", label: "Combat Style" }
  ];

  const boardEl = document.getElementById("board");
  const inputEl = document.getElementById("guessInput");
  const buttonEl = document.getElementById("guessButton");
  const statusEl = document.getElementById("status");
  const datalistEl = document.getElementById("characterList");

  const charactersByName = new Map();
  CHARACTERS.forEach((character) => {
    charactersByName.set(normalizeName(character.name), character);
    const option = document.createElement("option");
    option.value = character.name;
    datalistEl.appendChild(option);
  });

  const dateKey = getUtcDateKey();
  const puzzleNumber = getPuzzleNumber();
  const target = getDailyCharacter();

  const storageKey = "berserk2dle-state-" + dateKey;
  const state = loadState();

  renderHeader();
  restoreGuesses();

  buttonEl.addEventListener("click", submitGuess);
  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      submitGuess();
    }
  });

  if (state.completed) {
    setStatus("Solved. The daily character was " + target.name + ".", false);
    disableInput();
  } else {
    setStatus("Puzzle #" + puzzleNumber + " • " + dateKey + " UTC", false);
  }

  function getDailyCharacter() {
    const today = new Date();
    const utcMidnight = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate()
    );
    const dayOffset = Math.floor((utcMidnight - EPOCH_UTC.getTime()) / 86400000);
    const index = ((dayOffset % CHARACTERS.length) + CHARACTERS.length) % CHARACTERS.length;
    return CHARACTERS[index];
  }

  function getPuzzleNumber() {
    const today = new Date();
    const utcMidnight = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate()
    );
    return Math.floor((utcMidnight - EPOCH_UTC.getTime()) / 86400000) + 1;
  }

  function getUtcDateKey() {
    const now = new Date();
    return [
      now.getUTCFullYear(),
      String(now.getUTCMonth() + 1).padStart(2, "0"),
      String(now.getUTCDate()).padStart(2, "0")
    ].join("-");
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        return { guesses: [], completed: false };
      }
      const parsed = JSON.parse(raw);
      return {
        guesses: Array.isArray(parsed.guesses) ? parsed.guesses : [],
        completed: Boolean(parsed.completed)
      };
    } catch (error) {
      return { guesses: [], completed: false };
    }
  }

  function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function restoreGuesses() {
    state.guesses.forEach((name) => {
      const character = charactersByName.get(normalizeName(name));
      if (character) {
        appendGuessRow(character);
      }
    });
  }

  function submitGuess() {
    if (state.completed) {
      return;
    }

    const guessText = inputEl.value.trim();
    if (!guessText) {
      setStatus("Enter a character name.", true);
      return;
    }

    const character = charactersByName.get(normalizeName(guessText));
    if (!character) {
      setStatus("That character is not in the current roster.", true);
      return;
    }

    if (state.guesses.some((name) => normalizeName(name) === normalizeName(character.name))) {
      setStatus("You already guessed " + character.name + ".", true);
      return;
    }

    appendGuessRow(character);
    state.guesses.push(character.name);

    if (normalizeName(character.name) === normalizeName(target.name)) {
      state.completed = true;
      setStatus(
        "Correct. " + target.name + " was the answer. Solved in " + state.guesses.length + " guess" + (state.guesses.length === 1 ? "" : "es") + ".",
        false
      );
      disableInput();
    } else {
      setStatus("Not correct yet.", false);
    }

    saveState();
    inputEl.value = "";
    inputEl.focus();
  }

  function disableInput() {
    inputEl.disabled = true;
    buttonEl.disabled = true;
  }

  function renderHeader() {
    const row = document.createElement("div");
    row.className = "board-row header";

    const nameCell = document.createElement("div");
    nameCell.className = "cell";
    nameCell.textContent = "Guess";
    row.appendChild(nameCell);

    TRAITS.forEach((trait) => {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.textContent = trait.label;
      row.appendChild(cell);
    });

    boardEl.appendChild(row);
  }

  function appendGuessRow(character) {
    const row = document.createElement("div");
    row.className = "board-row";

    const nameCell = document.createElement("div");
    nameCell.className = "cell";
    nameCell.textContent = character.name;
    row.appendChild(nameCell);

    TRAITS.forEach((trait) => {
      const guessedValue = character[trait.key];
      const targetValue = target[trait.key];
      const result = compareTrait(guessedValue, targetValue, trait);

      const cell = document.createElement("div");
      cell.className = "cell " + result.state;
      cell.innerHTML = escapeHtml(guessedValue) + (result.arrow ? '<span class="arrow">' + result.arrow + '</span>' : "");
      row.appendChild(cell);
    });

    const firstGuessRow = boardEl.children[1];
    boardEl.insertBefore(row, firstGuessRow || null);
  }

  function compareTrait(guessValue, targetValue, trait) {
    const guessNorm = normalizeValue(guessValue);
    const targetNorm = normalizeValue(targetValue);

    if (guessNorm === targetNorm) {
      return { state: "exact", arrow: "" };
    }

    const guessVariants = splitVariants(guessValue);
    const targetVariants = splitVariants(targetValue);
    const hasPartial = guessVariants.some((guessPart) =>
      targetVariants.some((targetPart) =>
        guessPart === targetPart ||
        guessPart.includes(targetPart) ||
        targetPart.includes(guessPart)
      )
    );

    let arrow = "";
    if (trait.ordered) {
      arrow = getArrow(guessValue, targetValue, trait.ranking);
    }

    if (hasPartial) {
      return { state: "partial", arrow: arrow };
    }

    return { state: "none", arrow: arrow };
  }

  function getArrow(guessValue, targetValue, rankingMap) {
    const guessRank = rankingMap[guessValue];
    const targetRank = rankingMap[targetValue];

    if (typeof guessRank !== "number" || typeof targetRank !== "number" || guessRank === targetRank) {
      return "";
    }

    return guessRank < targetRank ? "↑" : "↓";
  }

  function splitVariants(value) {
    return String(value)
      .split("/")
      .map((part) => normalizeValue(part))
      .filter(Boolean);
  }

  function normalizeValue(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[?]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeName(value) {
    return normalizeValue(value);
  }

  function setStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.style.color = isError ? "#a30000" : "#111";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
