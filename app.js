(function () {
  const DATA = window.BERSERK2DLE_DATA;
  const CHARACTERS = DATA.characters;
  const SIZE_ORDER = DATA.rankings.size;
  const DEBUT_ORDER = DATA.rankings.debut;

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
  const targetOverrideEl = document.getElementById("targetOverride");
  const statusEl = document.getElementById("status");
  const suggestionsEl = document.getElementById("suggestions");
  const storageKeyPrefix = "berserk2dle-state-";
  const targetOverrideKey = "berserk2dle-target-override";
  let activeSuggestionIndex = -1;
  let currentSuggestions = [];

  const charactersByName = new Map();
  CHARACTERS.forEach((character) => {
    charactersByName.set(normalizeName(character.name), character);
  });

  const dateKey = getUtcDateKey();
  const target = getTargetCharacter();

  const storageKey = storageKeyPrefix + dateKey + "-" + normalizeName(target.name);
  const state = loadState();

  renderTargetOverride();
  renderHeader();
  restoreGuesses();

  buttonEl.addEventListener("click", submitGuess);
  targetOverrideEl.addEventListener("change", setTargetOverride);
  inputEl.addEventListener("input", renderSuggestions);
  inputEl.addEventListener("focus", renderSuggestions);
  inputEl.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSuggestion(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSuggestion(-1);
      return;
    }

    if (event.key === "Escape") {
      hideSuggestions();
      return;
    }

    if (event.key === "Enter") {
      if (activeSuggestionIndex >= 0 && currentSuggestions[activeSuggestionIndex]) {
        event.preventDefault();
        chooseSuggestion(currentSuggestions[activeSuggestionIndex]);
        return;
      }

      submitGuess();
    }
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".guess-search")) {
      hideSuggestions();
    }
  });

  if (state.completed) {
    setStatus("Solved. The daily character was " + target.name + ".", false);
    disableInput();
  } else {
    setStatus(getPuzzleStatus(), false);
  }

  function getTargetCharacter() {
    const override = getTargetOverride();
    if (override) {
      return override;
    }

    return getRandomDailyCharacter();
  }

  function getTargetOverride() {
    const overrideName = localStorage.getItem(targetOverrideKey);
    return overrideName ? charactersByName.get(normalizeName(overrideName)) : null;
  }

  function getRandomDailyCharacter() {
    const seed = DATA.meta.seedEpochUtc + "-" + dateKey;
    const index = hashSeed(seed) % CHARACTERS.length;
    return CHARACTERS[index];
  }

  function hashSeed(seed) {
    let hash = 2166136261;
    String(seed).split("").forEach((char) => {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    });

    return hash >>> 0;
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

  function renderTargetOverride() {
    CHARACTERS.forEach((character) => {
      const option = document.createElement("option");
      option.value = character.name;
      option.textContent = character.name;
      targetOverrideEl.appendChild(option);
    });

    const override = getTargetOverride();
    targetOverrideEl.value = override ? override.name : "";
  }

  function setTargetOverride() {
    if (targetOverrideEl.value) {
      localStorage.setItem(targetOverrideKey, targetOverrideEl.value);
    } else {
      localStorage.removeItem(targetOverrideKey);
    }

    window.location.reload();
  }

  function getPuzzleStatus() {
    if (getTargetOverride()) {
      return "Dev target override: " + target.name;
    }

    return "Random daily puzzle: " + dateKey + " UTC";
  }

  function restoreGuesses() {
    state.guesses.forEach((name) => {
      const character = charactersByName.get(normalizeName(name));
      if (character) {
        appendGuessRow(character, false);
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

    appendGuessRow(character, true);
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
    hideSuggestions();
    inputEl.focus();
  }

  function disableInput() {
    inputEl.disabled = true;
    buttonEl.disabled = true;
    hideSuggestions();
  }

  function renderSuggestions() {
    if (inputEl.disabled) {
      hideSuggestions();
      return;
    }

    const query = normalizeName(inputEl.value);
    if (!query) {
      hideSuggestions();
      return;
    }

    currentSuggestions = CHARACTERS
      .filter((character) => !isAlreadyGuessed(character))
      .filter((character) => normalizeName(character.name).includes(query))
      .slice(0, 8);
    activeSuggestionIndex = -1;

    suggestionsEl.replaceChildren();
    if (currentSuggestions.length === 0) {
      hideSuggestions();
      return;
    }

    currentSuggestions.forEach((character, index) => {
      const item = document.createElement("button");
      item.className = "suggestion-item";
      item.type = "button";
      item.addEventListener("mousedown", (event) => event.preventDefault());
      item.addEventListener("click", () => chooseSuggestion(character));

      const image = createCharacterImage(character, "suggestion-image");
      item.appendChild(image);

      const name = document.createElement("span");
      name.textContent = character.name;
      item.appendChild(name);

      if (index === activeSuggestionIndex) {
        item.classList.add("active");
      }

      suggestionsEl.appendChild(item);
    });

    suggestionsEl.classList.remove("hidden");
  }

  function moveSuggestion(direction) {
    if (suggestionsEl.classList.contains("hidden")) {
      renderSuggestions();
    }

    if (currentSuggestions.length === 0) {
      return;
    }

    activeSuggestionIndex =
      (activeSuggestionIndex + direction + currentSuggestions.length) % currentSuggestions.length;

    Array.from(suggestionsEl.children).forEach((child, index) => {
      child.classList.toggle("active", index === activeSuggestionIndex);
    });
  }

  function chooseSuggestion(character) {
    inputEl.value = character.name;
    hideSuggestions();
    inputEl.focus();
  }

  function hideSuggestions() {
    currentSuggestions = [];
    activeSuggestionIndex = -1;
    suggestionsEl.replaceChildren();
    suggestionsEl.classList.add("hidden");
  }

  function isAlreadyGuessed(character) {
    return state.guesses.some((name) => normalizeName(name) === normalizeName(character.name));
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

  function appendGuessRow(character, shouldAnimate) {
    const row = document.createElement("div");
    row.className = "board-row";

    const nameCell = document.createElement("div");
    nameCell.className = "cell guess-name";

    const characterImage = createCharacterImage(character, "character-image");
    nameCell.appendChild(characterImage);

    const characterName = document.createElement("span");
    characterName.textContent = character.name;
    nameCell.appendChild(characterName);

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

    if (shouldAnimate) {
      animateGuessRow(row);
    }
  }

  function animateGuessRow(row) {
    Array.from(row.children).forEach((cell, index) => {
      cell.style.setProperty("--flip-delay", (index * 240) + "ms");
      cell.classList.add("flip-in");
    });
  }

  function createCharacterImage(character, className) {
    const image = document.createElement("img");
    image.className = className;
    image.src = getCharacterImagePath(character);
    image.alt = character.name;
    return image;
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

  function getCharacterImagePath(character) {
    return character.image || "img/" + slugifyImageName(character.name) + ".png";
  }

  function slugifyImageName(name) {
    return String(name)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
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
