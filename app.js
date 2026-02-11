const BOARD_SIZE = 5;
const SAVE_KEY = "game-dice-save-v1";
const MERGE_TOTAL_KEY = "game-dice-merge-total";

const challengeTemplates = [
  { key: "mergeLevel3", text: "Сделать 3 слияния до уровня 3", target: 3 },
  { key: "mergeAny5", text: "Сделать 5 любых слияний", target: 5 },
  { key: "clearLevel5", text: "Очистить хотя бы одно трио 5-к", target: 1 },
  { key: "createLevel6", text: "Получить 1 кубик 6 уровня", target: 1 },
  { key: "place10", text: "Сделать 10 установок", target: 10 },
  { key: "useBoost", text: "Использовать 1 буст", target: 1 },
  { key: "chain2", text: "Сделать цепочку из 2 слияний подряд", target: 1 },
  { key: "spawnPair3", text: "Поставить 3 парных набора", target: 3 },
  { key: "remove10", text: "Очистить суммарно 10 костей", target: 10 },
  { key: "score8", text: "Набрать 8 очков партии", target: 8 },
];

const levelColors = {
  1: "level-1",
  2: "level-2",
  3: "level-3",
  4: "level-4",
  5: "level-5",
  6: "level-6",
};

const ui = {
  board: document.getElementById("board"),
  base: document.getElementById("base"),
  score: document.getElementById("score"),
  mergeTotal: document.getElementById("merge-total"),
  challengeText: document.getElementById("challenge-text"),
  challengeChecks: document.getElementById("challenge-checks"),
  rotateBtn: document.getElementById("rotate-btn"),
  cancelPickBtn: document.getElementById("cancel-pick-btn"),
  modal: document.getElementById("modal"),
  gameScreen: document.getElementById("game-screen"),
  stubScreen: document.getElementById("stub-screen"),
  returnBtn: document.getElementById("return-btn"),
  exitBtn: document.getElementById("exit-btn"),
  tipsBtn: document.getElementById("tips-btn"),
  boostUndo: document.getElementById("boost-undo"),
  boostClearLevel: document.getElementById("boost-clear-level"),
  boostHammer: document.getElementById("boost-hammer"),
  countUndo: document.getElementById("count-undo"),
  countClearLevel: document.getElementById("count-clear-level"),
  countHammer: document.getElementById("count-hammer"),
};

let state = loadGame() ?? createNewGame();
let mergeTotal = Number(localStorage.getItem(MERGE_TOTAL_KEY) ?? 0);
renderAll();

function createNewGame() {
  return {
    board: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0)),
    score: 0,
    challenge: createChallenge(),
    challengeDone: false,
    boosts: { undo: 2, clearLevel: 1, hammer: 1 },
    history: [],
    pendingPack: null,
    placementCount: 0,
    pairPlacedCount: 0,
    removedCount: 0,
    mergedTo3Count: 0,
    mergedAnyCount: 0,
    clearLevel5Count: 0,
    createLevel6Count: 0,
    usedBoostCount: 0,
    chain2Count: 0,
  };
}

function createChallenge() {
  const random = challengeTemplates[Math.floor(Math.random() * challengeTemplates.length)];
  return { ...random, progress: 0, checks: 0 };
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveGame() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  localStorage.setItem(MERGE_TOTAL_KEY, String(mergeTotal));
}

function getWeightedLevel() {
  const r = Math.random() * 100;
  if (r < 50) return 1;
  if (r < 85) return 2;
  return 3;
}

function getFreeCells() {
  const cells = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!state.board[r][c]) cells.push([r, c]);
    }
  }
  return cells;
}

function hasAdjacentFreePair() {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (state.board[r][c]) continue;
      if (c + 1 < BOARD_SIZE && !state.board[r][c + 1]) return true;
      if (r + 1 < BOARD_SIZE && !state.board[r + 1][c]) return true;
    }
  }
  return false;
}

function ensurePendingPack() {
  if (state.pendingPack) return;
  if (!getFreeCells().length) return;

  const sameLevel = getWeightedLevel();
  if (hasAdjacentFreePair()) {
    state.pendingPack = {
      type: "pair",
      orientation: Math.random() > 0.5 ? "h" : "v",
      dice: [sameLevel, sameLevel],
    };
  } else {
    state.pendingPack = { type: "single", dice: [sameLevel] };
  }
}

function renderAll() {
  ensurePendingPack();
  renderBoard();
  renderBase();
  renderStats();
  renderChallenge();
  renderBoosts();
  saveGame();
}

function renderBoard() {
  ui.board.innerHTML = "";
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement("button");
      cell.className = "cell";
      cell.dataset.r = r;
      cell.dataset.c = c;
      const bg = document.createElement("img");
      bg.src = "Game_0004_Cell-min.png";
      bg.className = "bg";
      bg.alt = "";
      cell.append(bg);

      const value = state.board[r][c];
      if (value) {
        cell.append(createDieElement(value));
      }
      cell.addEventListener("click", () => placePackAt(r, c));
      cell.addEventListener("dragover", (e) => {
        e.preventDefault();
        cell.classList.add("drop-ok");
      });
      cell.addEventListener("dragleave", () => cell.classList.remove("drop-ok"));
      cell.addEventListener("drop", (e) => {
        e.preventDefault();
        cell.classList.remove("drop-ok");
        placePackAt(r, c);
      });
      ui.board.append(cell);
    }
  }
}

function createDieElement(level) {
  const die = document.createElement("div");
  die.className = `die ${levelColors[level]}`;
  die.textContent = String(level);
  return die;
}

function renderBase() {
  ui.base.innerHTML = "";
  const pack = state.pendingPack;
  if (!pack) {
    ui.base.classList.add("empty");
    ui.base.textContent = "Нет доступных ходов";
    return;
  }
  ui.base.classList.remove("empty");
  ui.base.classList.toggle("vertical", pack.type === "pair" && pack.orientation === "v");
  pack.dice.forEach((level) => ui.base.append(createDieElement(level)));
}

function renderStats() {
  ui.score.textContent = state.score;
  ui.mergeTotal.textContent = mergeTotal;
}

function renderChallenge() {
  ui.challengeText.textContent = `${state.challenge.text} (${state.challenge.progress}/${state.challenge.target})`;
  ui.challengeChecks.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const img = document.createElement("img");
    img.src = i < state.challenge.checks ? "Game_0000_check_yellow-min.png" : "Game_0001_check_box_empty-min.png";
    img.alt = i < state.challenge.checks ? "done" : "todo";
    ui.challengeChecks.append(img);
  }
}

function renderBoosts() {
  renderBoostCount(ui.countUndo, state.boosts.undo);
  renderBoostCount(ui.countClearLevel, state.boosts.clearLevel);
  renderBoostCount(ui.countHammer, state.boosts.hammer);
}

function renderBoostCount(el, count) {
  if (count > 0) {
    el.classList.remove("empty");
    el.textContent = String(count);
    return;
  }
  el.classList.add("empty");
  el.textContent = "+";
}

function copyStateForHistory() {
  return JSON.parse(JSON.stringify(state));
}

function placePackAt(r, c) {
  const pack = state.pendingPack;
  if (!pack) return;
  const coords = getPlacementCoords(pack, r, c);
  if (!coords) return;
  if (!coords.every(([rr, cc]) => !state.board[rr][cc])) return;

  state.history.push(copyStateForHistory());

  coords.forEach(([rr, cc], index) => {
    state.board[rr][cc] = pack.dice[index];
  });

  state.placementCount += 1;
  if (pack.type === "pair") state.pairPlacedCount += 1;

  state.pendingPack = null;
  resolveMerges();
  registerChallengeProgress();
  checkGameOver();
  renderAll();
}

function getPlacementCoords(pack, r, c) {
  if (pack.type === "single") return [[r, c]];
  if (pack.orientation === "h") {
    if (c + 1 >= BOARD_SIZE) return null;
    return [[r, c], [r, c + 1]];
  }
  if (r + 1 >= BOARD_SIZE) return null;
  return [[r, c], [r + 1, c]];
}

function findCluster(sr, sc, value, visited) {
  const stack = [[sr, sc]];
  const cluster = [];
  visited.add(`${sr},${sc}`);
  while (stack.length) {
    const [r, c] = stack.pop();
    cluster.push([r, c]);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
      const rr = r + dr;
      const cc = c + dc;
      const key = `${rr},${cc}`;
      if (rr < 0 || rr >= BOARD_SIZE || cc < 0 || cc >= BOARD_SIZE) return;
      if (visited.has(key)) return;
      if (state.board[rr][cc] !== value) return;
      visited.add(key);
      stack.push([rr, cc]);
    });
  }
  return cluster;
}

function resolveMerges() {
  let chainCount = 0;
  while (true) {
    const visited = new Set();
    const merges = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const value = state.board[r][c];
        if (!value) continue;
        const key = `${r},${c}`;
        if (visited.has(key)) continue;
        const cluster = findCluster(r, c, value, visited);
        if (cluster.length >= 3) merges.push({ value, cluster });
      }
    }

    if (!merges.length) break;
    chainCount += 1;

    merges.forEach(({ value, cluster }) => {
      const keep = cluster[0];
      cluster.forEach(([r, c]) => {
        state.board[r][c] = 0;
      });
      state.removedCount += cluster.length;

      if (value < 5) {
        state.board[keep[0]][keep[1]] = value + 1;
        if (value + 1 === 3) state.mergedTo3Count += 1;
        if (value + 1 === 6) state.createLevel6Count += 1;
      } else {
        state.clearLevel5Count += 1;
      }
      state.score += 1;
      state.mergedAnyCount += 1;
    });
  }

  if (chainCount >= 2) state.chain2Count += 1;
}

function registerChallengeProgress() {
  const ch = state.challenge;
  const progressMap = {
    mergeLevel3: state.mergedTo3Count,
    mergeAny5: state.mergedAnyCount,
    clearLevel5: state.clearLevel5Count,
    createLevel6: state.createLevel6Count,
    place10: state.placementCount,
    useBoost: state.usedBoostCount,
    chain2: state.chain2Count,
    spawnPair3: state.pairPlacedCount,
    remove10: state.removedCount,
    score8: state.score,
  };

  ch.progress = Math.min(ch.target, progressMap[ch.key] ?? 0);
  while (ch.checks < 3 && ch.progress >= ((ch.checks + 1) * ch.target) / 3) {
    ch.checks += 1;
  }

  if (ch.checks >= 3 && !state.challengeDone) {
    state.score += 10;
    state.challengeDone = true;
  }
}

function checkGameOver() {
  if (getFreeCells().length) return;
  mergeTotal += state.score;
  showModal(
    "Партия окончена",
    `Свободные клетки закончились. Получено ${state.score} очков. mergeTotal: ${mergeTotal}`,
    [
      {
        label: "Новая партия",
        primary: true,
        onClick: () => {
          state = createNewGame();
          closeModal();
          renderAll();
        },
      },
    ],
  );
}

function rotateBase() {
  if (!state.pendingPack || state.pendingPack.type !== "pair") return;
  state.pendingPack.orientation = state.pendingPack.orientation === "h" ? "v" : "h";
  renderBase();
  saveGame();
}

function closeModal() {
  ui.modal.classList.add("hidden");
  ui.modal.innerHTML = "";
}

function showModal(title, text, actions) {
  ui.modal.classList.remove("hidden");
  const content = document.createElement("div");
  content.className = "modal-content";
  content.innerHTML = `<h3>${title}</h3><p>${text}</p>`;

  const actionsWrap = document.createElement("div");
  actionsWrap.className = "modal-actions";
  actions.forEach((action) => {
    const btn = document.createElement("button");
    btn.className = `btn ${action.primary ? "" : "secondary"}`;
    btn.textContent = action.label;
    btn.addEventListener("click", action.onClick);
    actionsWrap.append(btn);
  });

  content.append(actionsWrap);
  ui.modal.innerHTML = "";
  ui.modal.append(content);
}

function useUndoBoost() {
  if (state.boosts.undo <= 0) return openShopStub();
  const prev = state.history.pop();
  if (!prev) return;
  state.boosts.undo -= 1;
  state.usedBoostCount += 1;
  const savedBoosts = { ...state.boosts };
  state = prev;
  state.boosts = savedBoosts;
  registerChallengeProgress();
  renderAll();
}

function useClearLevelBoost() {
  if (state.boosts.clearLevel <= 0) return openShopStub();
  const values = state.board.flat().filter(Boolean);
  if (!values.length) return;
  const level = Number(prompt("Какой номинал удалить? (1-6)", "1"));
  if (!level || level < 1 || level > 6) return;

  state.history.push(copyStateForHistory());
  state.boosts.clearLevel -= 1;
  state.usedBoostCount += 1;

  let removed = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (state.board[r][c] === level) {
        state.board[r][c] = 0;
        removed += 1;
      }
    }
  }
  state.removedCount += removed;
  registerChallengeProgress();
  renderAll();
}

function useHammerBoost() {
  if (state.boosts.hammer <= 0) return openShopStub();
  showModal(
    "Удалить один дайс",
    "Кликните на клетку с дайсом, чтобы удалить её.",
    [{ label: "Отмена", onClick: () => closeModal() }],
  );

  const once = (event) => {
    const target = event.target.closest(".cell");
    if (!target) return;
    const r = Number(target.dataset.r);
    const c = Number(target.dataset.c);
    if (!state.board[r][c]) return;

    state.history.push(copyStateForHistory());
    state.boosts.hammer -= 1;
    state.usedBoostCount += 1;
    state.board[r][c] = 0;
    state.removedCount += 1;
    registerChallengeProgress();
    renderAll();
    closeModal();
    ui.board.removeEventListener("click", once, true);
  };

  ui.board.addEventListener("click", once, true);
}

function openShopStub() {
  showModal(
    "Покупка буста",
    "Заглушка магазина: в финальном проекте здесь будет поп-ап покупки буста.",
    [{ label: "Закрыть", primary: true, onClick: closeModal }],
  );
}

function showTips() {
  showModal(
    "Подсказка по бустам",
    "Undo: отменяет последнее действие. Удалить номинал: очищает все кости выбранного уровня. Молоток: удаляет одну выбранную кость.",
    [{ label: "Понятно", primary: true, onClick: closeModal }],
  );
}

function exitFlow() {
  showModal(
    "Выход",
    "Завершить партию с начислением очков или сохранить и выйти в заглушку?",
    [
      {
        label: "Завершить и начислить",
        primary: true,
        onClick: () => {
          mergeTotal += state.score;
          localStorage.removeItem(SAVE_KEY);
          state = createNewGame();
          closeModal();
          ui.gameScreen.classList.add("hidden");
          ui.stubScreen.classList.remove("hidden");
          renderAll();
        },
      },
      {
        label: "Сохранить и выйти",
        onClick: () => {
          saveGame();
          closeModal();
          ui.gameScreen.classList.add("hidden");
          ui.stubScreen.classList.remove("hidden");
        },
      },
      { label: "Отмена", onClick: closeModal },
    ],
  );
}

ui.base.addEventListener("click", rotateBase);
ui.base.addEventListener("dragstart", (event) => {
  if (!state.pendingPack) {
    event.preventDefault();
    return;
  }
  event.dataTransfer.setData("text/plain", "dice-pack");
});
ui.rotateBtn.addEventListener("click", rotateBase);
ui.cancelPickBtn.addEventListener("click", renderBase);
ui.returnBtn.addEventListener("click", () => {
  ui.stubScreen.classList.add("hidden");
  ui.gameScreen.classList.remove("hidden");
  renderAll();
});
ui.exitBtn.addEventListener("click", exitFlow);
ui.tipsBtn.addEventListener("click", showTips);
ui.boostUndo.addEventListener("click", useUndoBoost);
ui.boostClearLevel.addEventListener("click", useClearLevelBoost);
ui.boostHammer.addEventListener("click", useHammerBoost);
