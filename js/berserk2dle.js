(function () {
  const DATA = window.BERSERK2DLE_DATA;
  const CHARACTERS = DATA.characters;
  const SIZE_ORDER = DATA.rankings.size;
  const DEBUT_ORDER = DATA.rankings.debut;

  const TRAITS = [
    { key: "species", label: "Species" },
    { key: "gender", label: "Gender", exactOnly: true },
    { key: "affiliation", label: "Affiliation" },
    { key: "role", label: "Role" },
    { key: "size", label: "Size", ordered: true, ranking: SIZE_ORDER },
    { key: "debut", label: "Debut", ordered: true, ranking: DEBUT_ORDER },
    { key: "combatStyle", label: "Combat Style" }
  ];

  const boardEl = document.getElementById("board");
  const classicLegendEl = document.getElementById("classicLegend");
  const splashPanelEl = document.getElementById("splashPanel");
  const splashArtEl = document.getElementById("splashArt");
  const splashHintEl = document.getElementById("splashHint");
  const splashGuessesEl = document.getElementById("splashGuesses");
  const inputEl = document.getElementById("guessInput");
  const buttonEl = document.getElementById("guessButton");
  const clearCacheButtonEl = document.getElementById("clearCacheButton");
  const targetOverrideEl = document.getElementById("targetOverride");
  const puzzleMetaEl = document.getElementById("puzzleMeta");
  const statusEl = document.getElementById("status");
  const viewShareButtonEl = document.getElementById("viewShareButton");
  const suggestionsEl = document.getElementById("suggestions");
  const winModalEl = document.getElementById("winModal");
  const closeWinModalEl = document.getElementById("closeWinModal");
  const winSummaryEl = document.getElementById("winSummary");
  const shareMessageEl = document.getElementById("shareMessage");
  const copyShareButtonEl = document.getElementById("copyShareButton");
  const storageKeyPrefix = "berserk2dle-state-";
  const targetOverrideKey = "berserk2dle-target-override";
  const modeStorageKey = "berserk2dle-mode";
  const playUrl = "https://crekkers.net/berserk2dle";
  const gameModes = ["classic", "splash"];
  const maxSplashBlur = 52;
  const splashBlurStep = 10;
  let activeSuggestionIndex = -1;
  let currentSuggestions = [];

  const charactersByName = new Map();
  CHARACTERS.forEach((character) => {
    charactersByName.set(normalizeName(character.name), character);
  });

  const dateKey = getWarsawDateKey();
  const gameMode = getGameMode();
  const target = getTargetCharacter(gameMode);

  const storageKey = getModeStorageKey(gameMode);
  const state = loadState();

  renderModeTabs();
  renderTargetOverride();
  renderMode();
  restoreGuesses();
  updatePuzzleMeta();
  setInterval(updatePuzzleMeta, 1000);

  document.querySelectorAll(".mode-tab").forEach((button) => {
    button.addEventListener("click", () => setGameMode(button.dataset.mode));
  });
  buttonEl.addEventListener("click", submitGuess);
  viewShareButtonEl.addEventListener("click", showWinModal);
  clearCacheButtonEl.addEventListener("click", clearDevCache);
  targetOverrideEl.addEventListener("change", setTargetOverride);
  closeWinModalEl.addEventListener("click", hideWinModal);
  copyShareButtonEl.addEventListener("click", copyShareMessage);
  winModalEl.addEventListener("click", (event) => {
    if (event.target === winModalEl) {
      hideWinModal();
    }
  });
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


  function getTargetCharacter(mode) {
    const override = getTargetOverride();
    if (override) {
      return override;
    }

    return getRandomDailyCharacter(mode);
  }

  function getGameMode() {
    const savedMode = localStorage.getItem(modeStorageKey);
    return savedMode === "splash" ? "splash" : "classic";
  }

  function setGameMode(mode) {
    if (mode !== "classic" && mode !== "splash") {
      return;
    }

    localStorage.setItem(modeStorageKey, mode);
    window.location.reload();
  }

  function getTargetOverride() {
    const overrideName = localStorage.getItem(targetOverrideKey);
    return overrideName ? charactersByName.get(normalizeName(overrideName)) : null;
  }

  function getRandomDailyCharacter(mode) {
    const index = getDailyCharacterIndex(mode);
    return CHARACTERS[index];
  }

  function getDailyCharacterIndex(mode) {
    const seed = DATA.meta.seedEpochUtc + "-" + dateKey + "-" + mode;
    const index = hashSeed(seed) % CHARACTERS.length;

    if (mode === "splash" && CHARACTERS.length > 1 && index === getDailyCharacterIndex("classic")) {
      return (index + 1) % CHARACTERS.length;
    }

    return index;
  }

  function hashSeed(seed) {
    let hash = 2166136261;
    String(seed).split("").forEach((char) => {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    });

    return hash >>> 0;
  }

  function getWarsawDateKey() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Warsaw",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());

    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return values.year + "-" + values.month + "-" + values.day;
  }

  function getWarsawParts(date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Warsaw",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date);

    return Object.fromEntries(parts.map((part) => [part.type, part.value]));
  }

  function getTimeZoneOffsetMs(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const zonedAsUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    );

    return zonedAsUtc - date.getTime();
  }

  function getWarsawMidnightUtcMs(warsawDateKey) {
    const parts = warsawDateKey.split("-").map(Number);
    const localMidnightUtc = Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
    let utcGuess = localMidnightUtc;

    for (let index = 0; index < 3; index += 1) {
      utcGuess = localMidnightUtc - getTimeZoneOffsetMs(new Date(utcGuess), "Europe/Warsaw");
    }

    return utcGuess;
  }

  function getNextWarsawDateKey() {
    const parts = dateKey.split("-").map(Number);
    const nextDayNoonUtc = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 1, 12, 0, 0));
    const values = getWarsawParts(nextDayNoonUtc);
    return values.year + "-" + values.month + "-" + values.day;
  }

  function getCountdownToWarsawMidnight() {
    const nextMidnightUtcMs = getWarsawMidnightUtcMs(getNextWarsawDateKey());
    return Math.max(nextMidnightUtcMs - Date.now(), 0);
  }

  function formatCountdown(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [
      String(hours).padStart(2, "0"),
      String(minutes).padStart(2, "0"),
      String(seconds).padStart(2, "0")
    ].join(":");
  }

  function loadState() {
    return loadStateFromKey(storageKey);
  }

  function loadModeState(mode) {
    if (mode === gameMode) {
      return state;
    }

    return loadStateFromKey(getModeStorageKey(mode));
  }

  function loadStateFromKey(key) {
    try {
      const raw = localStorage.getItem(key);
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

  function getModeStorageKey(mode) {
    const modeTarget = getTargetCharacter(mode);
    return storageKeyPrefix + mode + "-" + dateKey + "-" + normalizeName(modeTarget.name);
  }

  function saveState() {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function clearDevCache() {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(storageKeyPrefix))
      .forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(targetOverrideKey);
    localStorage.removeItem(modeStorageKey);

    window.location.reload();
  }

  function renderModeTabs() {
    document.querySelectorAll(".mode-tab").forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === gameMode);
    });
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
      return getModeLabel() + " dev target override: " + target.name;
    }

    return getModeLabel() + " random daily puzzle: " + dateKey;
  }

  function updatePuzzleMeta() {
    if (getWarsawDateKey() !== dateKey) {
      window.location.reload();
      return;
    }

    puzzleMetaEl.textContent = getPuzzleStatus() + " · resets in " + formatCountdown(getCountdownToWarsawMidnight());
  }

  function getModeLabel() {
    return gameMode === "splash" ? "Splash" : "Classic";
  }

  function renderMode() {
    const isSplash = gameMode === "splash";
    boardEl.classList.toggle("hidden", isSplash);
    classicLegendEl.classList.toggle("hidden", isSplash);
    splashPanelEl.classList.toggle("hidden", !isSplash);

    if (isSplash) {
      renderSplashPanel();
    } else {
      renderHeader();
    }
  }

  function restoreGuesses() {
    if (gameMode === "splash") {
      renderSplashGuesses();
      updateSplashReveal();
      renderShareButton();
      return;
    }

    state.guesses.forEach((name) => {
      const character = charactersByName.get(normalizeName(name));
      if (character) {
        appendGuessRow(character, false);
      }
    });
    renderShareButton();
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
      setStatus("Please enter a valid character name", true);
      return;
    }

    if (state.guesses.some((name) => normalizeName(name) === normalizeName(character.name))) {
      setStatus("You already guessed " + character.name + ".", true);
      return;
    }

    if (gameMode === "classic") {
      appendGuessRow(character, true);
    }

    state.guesses.push(character.name);

    if (normalizeName(character.name) === normalizeName(target.name)) {
      state.completed = true;
      saveState();
      const solvedMessage = getModeSolvedMessage(gameMode, state);
      setStatus(
        "Correct. " + target.name + " was the answer. " + solvedMessage + ".",
        false
      );
      disableInput();
      if (gameMode === "splash") {
        updateSplashReveal();
        renderSplashGuesses();
      }
      if (areAllModesCompleted()) {
        showWinModal();
        renderShareButton();
      }
    } else {
      setStatus("Not correct yet.", false);
      if (gameMode === "splash") {
        updateSplashReveal();
        renderSplashGuesses();
      }
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

  function getModeSolvedMessage(mode, modeState) {
    return getModeDisplayName(mode) + " solved in " + modeState.guesses.length + " guess" + (modeState.guesses.length === 1 ? "" : "es") + "!";
  }

  function getModeDisplayName(mode) {
    return mode === "splash" ? "Splash" : "Classic";
  }

  function areAllModesCompleted() {
    return gameModes.every((mode) => loadModeState(mode).completed);
  }

  function getAllModesSolvedMessage() {
    return gameModes
      .map((mode) => getModeSolvedMessage(mode, loadModeState(mode)))
      .join("\n");
  }

  function getShareMessage() {
    const solvedMessage = getAllModesSolvedMessage();
    return (
      "**Berserk2dle Summary**: " + dateKey + "\n" +
      solvedMessage + "\n" +
      "Play on " + playUrl 
    );
  }

  function renderShareButton() {
    viewShareButtonEl.classList.toggle("hidden", !areAllModesCompleted());
  }

  function showWinModal() {
    winSummaryEl.textContent = "All modes complete.";
    shareMessageEl.value = getShareMessage();
    copyShareButtonEl.textContent = "Copy result";
    winModalEl.classList.remove("hidden");
  }

  function hideWinModal() {
    winModalEl.classList.add("hidden");
  }

  async function copyShareMessage() {
    const message = shareMessageEl.value;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(message);
      } else {
        shareMessageEl.focus();
        shareMessageEl.select();
        document.execCommand("copy");
      }

      copyShareButtonEl.textContent = "Copied";
    } catch (error) {
      copyShareButtonEl.textContent = "Copy failed";
    }
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

  function renderSplashPanel() {
    splashArtEl.src = getCharacterImagePath(target);
    splashArtEl.alt = "Splash art";
    renderSplashGuesses();
    updateSplashReveal();
  }

  function updateSplashReveal() {
    if (gameMode !== "splash") {
      return;
    }

    const blur = state.completed ? 0 : Math.max(maxSplashBlur - (state.guesses.length * splashBlurStep), 0);
    splashArtEl.style.filter = "blur(" + blur + "px)";
    splashHintEl.textContent = state.completed
      ? "Revealed: " + target.name
      : "Blur: " + blur + "px";
  }

  function renderSplashGuesses() {
    splashGuessesEl.replaceChildren();
    state.guesses.forEach((name) => {
      const item = document.createElement("div");
      item.className = "splash-guess";
      item.textContent = name;
      splashGuessesEl.prepend(item);
    });
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

    if (trait.exactOnly) {
      return { state: "none", arrow: "" };
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
