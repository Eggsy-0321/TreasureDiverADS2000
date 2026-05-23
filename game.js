const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const PLAYER_WIDTH = 84;
const PLAYER_HEIGHT = 62;
const PLAYER_SPEED = 245;
const MAX_OXYGEN = 100;
const OXYGEN_DRAIN_PER_SECOND = 8;
const TREASURE_BONUS_OXYGEN = 10;
const CHEST_COUNT = 6;
const TREASURE_TARGET = 1;
const LOCK_CODE = [6, 0, 9, 6];
const BUBBLE_COUNT = 22;
const WORLD_HEIGHT = 1560;
const SEABED_LINE = WORLD_HEIGHT - 180;

const GameState = {
  TITLE: "title",
  PLAYING: "playing",
  LOCK: "lock",
  CLEAR: "clear",
  GAME_OVER: "gameOver"
};

const canvas = document.getElementById("gameCanvas");
const context = canvas.getContext("2d");
const oxygenGaugeFillElement = document.getElementById("oxygenGaugeFill");
const lockOxygenGaugeFillElement = document.getElementById("lockOxygenGaugeFill");
const lockOxygenGaugeElement = lockOxygenGaugeFillElement?.parentElement ?? null;
const lockOxygenValueElement = document.getElementById("lockOxygenValue");
const lockModalElement = document.getElementById("lockModal");
const lockHintElement = document.getElementById("lockHint");
const lockSubmitButton = document.getElementById("lockSubmitButton");
const dialValueElements = Array.from(document.querySelectorAll(".dial-value"));
const dialColumnElements = Array.from(document.querySelectorAll(".dial-column"));
const keys = {
  left: false,
  right: false,
  up: false,
  down: false
};

const imageSources = {
  title: "Title.png",
  background: "BackGround.png",
  diverA: "Player_ADS2000_1.png",
  diverB: "Player_ADS2000_2.png",
  diverBroken: "Player_GameOver.png",
  chestClosed: "treasure_chest_closed.png",
  chestFull: "treasure_chest_open_full.png",
  chestEmpty: "treasure_chest_open_empty.png"
};

const images = loadImages(imageSources);

const game = {
  state: GameState.TITLE,
  elapsedTime: 0,
  oxygen: MAX_OXYGEN,
  score: 0,
  openedChests: 0,
  lastTimestamp: 0,
  stateTimer: 0,
  messageTimer: 0,
  player: createPlayer(),
  chests: [],
  bubbles: createBubbles(),
  cameraY: 0,
  reachedSeabed: false,
  activeLockChestIndex: null,
  lockDigits: [0, 0, 0, 0],
  selectedDialIndex: 0
};

context.imageSmoothingEnabled = false;
updateHud();
updateStartButtonLabel();

function loadImages(sourceMap) {
  const loaded = {};

  Object.entries(sourceMap).forEach(([key, src]) => {
    const image = new Image();
    image.src = src;
    loaded[key] = image;
  });

  return loaded;
}

function createPlayer() {
  return {
    x: GAME_WIDTH / 2 - PLAYER_WIDTH / 2,
    y: 90,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    direction: 1,
    bob: 0
  };
}

function startGame() {
  game.state = GameState.PLAYING;
  game.elapsedTime = 0;
  game.oxygen = MAX_OXYGEN;
  game.score = 0;
  game.openedChests = 0;
  game.stateTimer = 0;
  game.messageTimer = 0;
  game.player = createPlayer();
  game.chests = createChests();
  game.bubbles = createBubbles();
  game.cameraY = 0;
  game.reachedSeabed = false;
  game.activeLockChestIndex = null;
  game.lockDigits = [0, 0, 0, 0];
  game.selectedDialIndex = 0;
  closeLockModal();
  resetMovementKeys();
  updateHud();
  updateStartButtonLabel();
}

function createChests() {
  const positions = [
    { x: 90, y: WORLD_HEIGHT - 250 },
    { x: 225, y: WORLD_HEIGHT - 220 },
    { x: 370, y: WORLD_HEIGHT - 265 },
    { x: 520, y: WORLD_HEIGHT - 222 },
    { x: 675, y: WORLD_HEIGHT - 258 },
    { x: 810, y: WORLD_HEIGHT - 214 }
  ];

  const treasureSlots = shuffleArray([...Array(CHEST_COUNT).keys()]).slice(0, TREASURE_TARGET);

  return positions.map((position, index) => ({
    x: position.x,
    y: position.y,
    width: 82,
    height: 82,
    isOpen: false,
    hasTreasure: treasureSlots.includes(index),
    pulse: Math.random() * Math.PI * 2
  }));
}

function createBubbles() {
  const bubbles = [];

  for (let index = 0; index < BUBBLE_COUNT; index += 1) {
    bubbles.push(createBubble(true));
  }

  return bubbles;
}

function createBubble(randomY = false) {
  return {
    x: randomRange(30, GAME_WIDTH - 30),
    y: randomY ? randomRange(0, GAME_HEIGHT) : GAME_HEIGHT + randomRange(10, 140),
    radius: randomRange(2, 9),
    speed: randomRange(18, 48),
    sway: Math.random() * Math.PI * 2
  };
}

function shuffleArray(values) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [values[index], values[target]] = [values[target], values[index]];
  }

  return values;
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getOxygenRatio() {
  return clamp(game.oxygen / MAX_OXYGEN, 0, 1);
}

function getOxygenGaugeColor(oxygenRatio) {
  if (oxygenRatio <= 0.25) {
    return "linear-gradient(90deg, #ffb36b 0%, #ff6b4a 55%, #ff3d3d 100%)";
  }

  if (oxygenRatio <= 0.5) {
    return "linear-gradient(90deg, #ffe17a 0%, #ffb84d 55%, #ff8f3d 100%)";
  }

  return "linear-gradient(90deg, #62e5ff 0%, #2eb6ff 50%, #0b7cf2 100%)";
}

function handleKeyChange(event, isPressed) {
  const key = event.key.toLowerCase();

  if (game.state === GameState.LOCK) {
    handleLockInput(key, isPressed, event);
    return;
  }

  if (key === "arrowleft" || key === "a") {
    keys.left = isPressed;
  }
  if (key === "arrowright" || key === "d") {
    keys.right = isPressed;
  }
  if (key === "arrowup" || key === "w") {
    keys.up = isPressed;
  }
  if (key === "arrowdown" || key === "s") {
    keys.down = isPressed;
  }

  if (isPressed && (key === " " || key === "enter")) {
    if (game.state !== GameState.PLAYING) {
      startGame();
    }
    event.preventDefault();
  }

  if (key.startsWith("arrow")) {
    event.preventDefault();
  }
}

function handleLockInput(key, isPressed, event) {
  const handledKeys = ["arrowleft", "a", "arrowright", "d", "arrowup", "w", "arrowdown", "s", "enter", " "];

  if (!handledKeys.includes(key)) {
    return;
  }

  event.preventDefault();

  if (!isPressed) {
    return;
  }

  if (key === "arrowleft" || key === "a") {
    moveDialSelection(-1);
    return;
  }

  if (key === "arrowright" || key === "d") {
    moveDialSelection(1);
    return;
  }

  if (key === "arrowup" || key === "w") {
    adjustDialDigit(game.selectedDialIndex, 1);
    return;
  }

  if (key === "arrowdown" || key === "s") {
    adjustDialDigit(game.selectedDialIndex, -1);
    return;
  }

  tryUnlockChest();
}

function bindInput() {
  window.addEventListener("keydown", (event) => handleKeyChange(event, true));
  window.addEventListener("keyup", (event) => handleKeyChange(event, false));
  bindLockControls();
}

function bindLockControls() {
  lockModalElement.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");

    if (!button) {
      return;
    }

    const digitIndex = Number(button.dataset.digitIndex);
    const delta = button.dataset.action === "up" ? 1 : -1;
    game.selectedDialIndex = digitIndex;
    adjustDialDigit(digitIndex, delta);
  });

  lockSubmitButton.addEventListener("click", () => {
    tryUnlockChest();
  });
}

function update(deltaTime) {
  game.elapsedTime += deltaTime;
  game.stateTimer += deltaTime;
  game.messageTimer += deltaTime;
  updateBubbles(deltaTime);

  if (
    game.state === GameState.TITLE ||
    game.state === GameState.CLEAR ||
    game.state === GameState.GAME_OVER
  ) {
    return;
  }

  if (game.state === GameState.PLAYING) {
    updatePlaying(deltaTime);
  } else if (game.state === GameState.LOCK) {
    updateLock(deltaTime);
  }
}

function updatePlaying(deltaTime) {
  const wasAtSeabed = game.reachedSeabed;
  drainOxygen(deltaTime);

  let moveX = 0;
  let moveY = 0;

  if (keys.left) {
    moveX -= 1;
  }
  if (keys.right) {
    moveX += 1;
  }
  if (keys.up) {
    moveY -= 1;
  }
  if (keys.down) {
    moveY += 1;
  }

  if (moveX !== 0 && moveY !== 0) {
    moveX *= Math.SQRT1_2;
    moveY *= Math.SQRT1_2;
  }

  game.player.x += moveX * PLAYER_SPEED * deltaTime;
  game.player.y += moveY * PLAYER_SPEED * 0.95 * deltaTime;
  game.player.bob += deltaTime * (moveX === 0 && moveY === 0 ? 3 : 9);

  if (moveX !== 0) {
    game.player.direction = moveX < 0 ? -1 : 1;
  }

  game.player.x = clamp(game.player.x, 38, GAME_WIDTH - game.player.width - 38);
  game.player.y = clamp(game.player.y, 58, WORLD_HEIGHT - game.player.height - 30);
  game.cameraY = clamp(
    game.player.y - GAME_HEIGHT * 0.42,
    0,
    WORLD_HEIGHT - GAME_HEIGHT
  );
  game.reachedSeabed = game.player.y + game.player.height >= SEABED_LINE;

  if (!wasAtSeabed && game.reachedSeabed) {
    game.messageTimer = 0;
  }

  updateChestCollection();
  updateHud();

  if (game.score >= TREASURE_TARGET) {
    game.state = GameState.CLEAR;
    updateStartButtonLabel();
  } else if (game.oxygen <= 0) {
    game.state = GameState.GAME_OVER;
    updateStartButtonLabel();
  }
}

function updateLock(deltaTime) {
  drainOxygen(deltaTime);
  updateHud();

  if (game.oxygen <= 0) {
    game.activeLockChestIndex = null;
    closeLockModal();
    game.state = GameState.GAME_OVER;
    updateStartButtonLabel();
  }
}

function drainOxygen(deltaTime) {
  game.oxygen = Math.max(0, game.oxygen - OXYGEN_DRAIN_PER_SECOND * deltaTime);
}

function updateChestCollection() {
  const playerBounds = getPlayerBounds();

  game.chests.forEach((chest, index) => {
    if (chest.isOpen) {
      return;
    }

    if (isColliding(playerBounds, chest)) {
      if (chest.hasTreasure) {
        openLockModal(index);
      } else {
        openChest(chest);
      }
    }
  });
}

function openChest(chest) {
  chest.isOpen = true;
  game.openedChests += 1;

  if (chest.hasTreasure) {
    game.score += 1;
    game.oxygen = clamp(game.oxygen + TREASURE_BONUS_OXYGEN, 0, MAX_OXYGEN);
  }

  updateHud();
}

function openLockModal(chestIndex) {
  if (game.activeLockChestIndex === chestIndex && game.state === GameState.LOCK) {
    return;
  }

  game.state = GameState.LOCK;
  game.oxygen = MAX_OXYGEN;
  game.activeLockChestIndex = chestIndex;
  game.lockDigits = [0, 0, 0, 0];
  game.selectedDialIndex = 0;
  resetMovementKeys();
  updateHud();
  updateLockDisplay();
  lockHintElement.textContent = "上下にダイアルを回して4桁をそろえる";
  lockModalElement.classList.remove("hidden");
  lockModalElement.setAttribute("aria-hidden", "false");
}

function closeLockModal() {
  lockModalElement.classList.add("hidden");
  lockModalElement.setAttribute("aria-hidden", "true");
}

function moveDialSelection(delta) {
  const dialCount = game.lockDigits.length;
  game.selectedDialIndex = (game.selectedDialIndex + delta + dialCount) % dialCount;
  updateLockDisplay();
}

function adjustDialDigit(digitIndex, delta) {
  game.lockDigits[digitIndex] = (game.lockDigits[digitIndex] + delta + 10) % 10;
  updateLockDisplay();
}

function updateLockDisplay() {
  dialValueElements.forEach((element, index) => {
    element.textContent = `${game.lockDigits[index]}`;
  });

  dialColumnElements.forEach((element, index) => {
    element.classList.toggle("is-selected", index === game.selectedDialIndex);
  });
}

function tryUnlockChest() {
  const isMatch = game.lockDigits.every((digit, index) => digit === LOCK_CODE[index]);

  if (!isMatch) {
    lockHintElement.textContent = "番号が違います。";
    return;
  }

  const chest = game.chests[game.activeLockChestIndex];

  if (chest && !chest.isOpen) {
    openChest(chest);
  }

  game.activeLockChestIndex = null;
  game.lockDigits = [0, 0, 0, 0];
  game.selectedDialIndex = 0;
  closeLockModal();
  game.state = GameState.PLAYING;
}

function resetMovementKeys() {
  keys.left = false;
  keys.right = false;
  keys.up = false;
  keys.down = false;
}

function getPlayerBounds() {
  return {
    x: game.player.x + game.player.width * 0.14,
    y: game.player.y + game.player.height * 0.28,
    width: game.player.width * 0.72,
    height: game.player.height * 0.5
  };
}

function isColliding(first, second) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

function updateBubbles(deltaTime) {
  game.bubbles.forEach((bubble) => {
    bubble.y -= bubble.speed * deltaTime;
    bubble.x += Math.sin(game.elapsedTime * 0.8 + bubble.sway) * 10 * deltaTime;

    if (bubble.y + bubble.radius < -10) {
      Object.assign(bubble, createBubble(false));
    }
  });
}

function draw() {
  drawBackground();
  drawLightRays();
  drawBubbles();

  if (game.state !== GameState.TITLE) {
    drawSeafloorGlow();
    drawChests();
    drawPlayer();
  }

  if (game.state === GameState.PLAYING || game.state === GameState.LOCK) {
    drawHudOverlay();
  }

  drawMessage();
}

function drawBackground() {
  if (game.state === GameState.TITLE && images.title.complete) {
    drawCoverImage(images.title, 0, 0, GAME_WIDTH, GAME_HEIGHT, 0.08);
    return;
  }

  if (images.background.complete) {
    const progress = game.state === GameState.PLAYING
      ? game.cameraY / (WORLD_HEIGHT - GAME_HEIGHT)
      : 1;
    drawVerticalPanImage(images.background, progress);
  } else {
    const gradient = context.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, "#0d5f90");
    gradient.addColorStop(0.55, "#063a5a");
    gradient.addColorStop(1, "#031825");
    context.fillStyle = gradient;
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  context.fillStyle = "rgba(2, 8, 18, 0.20)";
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}

function drawCoverImage(image, dx, dy, dw, dh, shade = 0) {
  const imageRatio = image.width / image.height;
  const targetRatio = dw / dh;
  let sourceWidth = image.width;
  let sourceHeight = image.height;
  let sourceX = 0;
  let sourceY = 0;

  if (imageRatio > targetRatio) {
    sourceWidth = image.height * targetRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else {
    sourceHeight = image.width / targetRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, dx, dy, dw, dh);

  if (shade > 0) {
    context.fillStyle = `rgba(2, 8, 16, ${shade})`;
    context.fillRect(dx, dy, dw, dh);
  }
}

function drawVerticalPanImage(image, progress) {
  const targetRatio = GAME_WIDTH / GAME_HEIGHT;
  let sourceWidth = image.width;
  let sourceHeight = sourceWidth / targetRatio;

  if (sourceHeight > image.height) {
    sourceHeight = image.height;
    sourceWidth = sourceHeight * targetRatio;
  }

  const sourceX = (image.width - sourceWidth) / 2;
  const maxOffsetY = image.height - sourceHeight;
  const sourceY = clamp(progress, 0, 1) * maxOffsetY;

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, GAME_WIDTH, GAME_HEIGHT);
}

function drawLightRays() {
  const topAlpha = game.reachedSeabed ? 0.1 : 0.18;
  const gradient = context.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  gradient.addColorStop(0, `rgba(180, 236, 255, ${topAlpha})`);
  gradient.addColorStop(0.48, "rgba(180, 236, 255, 0.03)");
  gradient.addColorStop(1, "rgba(3, 12, 20, 0.18)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}

function drawBubbles() {
  game.bubbles.forEach((bubble) => {
    context.fillStyle = "rgba(208, 242, 255, 0.34)";
    context.beginPath();
    context.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "rgba(255, 255, 255, 0.55)";
    context.lineWidth = 1;
    context.stroke();
  });
}

function drawSeafloorGlow() {
  const seafloorScreenY = SEABED_LINE - game.cameraY;
  const gradient = context.createLinearGradient(0, seafloorScreenY - 90, 0, GAME_HEIGHT);
  gradient.addColorStop(0, "rgba(15, 29, 38, 0)");
  gradient.addColorStop(1, "rgba(1, 7, 12, 0.55)");
  context.fillStyle = gradient;
  context.fillRect(0, Math.max(seafloorScreenY - 120, 0), GAME_WIDTH, GAME_HEIGHT);
}

function drawChests() {
  game.chests.forEach((chest) => {
    const screenY = chest.y - game.cameraY;

    if (screenY > GAME_HEIGHT + 120 || screenY < -120) {
      return;
    }

    const bob = Math.sin(game.elapsedTime * 1.8 + chest.pulse) * 3;
    const image = chest.isOpen
      ? chest.hasTreasure ? images.chestFull : images.chestEmpty
      : images.chestClosed;

    if (image.complete) {
      context.drawImage(image, chest.x, screenY + bob, chest.width, chest.height);
    } else {
      context.fillStyle = chest.isOpen ? "#8a6730" : "#b98517";
      context.fillRect(chest.x, screenY + bob, chest.width, chest.height);
    }

    if (!chest.isOpen) {
      context.fillStyle = "rgba(255, 217, 108, 0.16)";
      context.beginPath();
      context.ellipse(chest.x + chest.width / 2, screenY + chest.height + 14, 42, 10, 0, 0, Math.PI * 2);
      context.fill();
    }
  });
}

function drawPlayer() {
  const diverImage = game.state === GameState.GAME_OVER
    ? images.diverBroken
    : Math.floor(game.player.bob * 1.6) % 2 === 0 ? images.diverA : images.diverB;
  const screenY = game.player.y - game.cameraY;

  if (!diverImage.complete) {
    context.fillStyle = "#d9edf5";
    context.fillRect(game.player.x, screenY, game.player.width, game.player.height);
    return;
  }

  const bobOffset = Math.sin(game.player.bob) * 5;

  context.save();

  if (game.player.direction < 0) {
    context.translate(game.player.x + game.player.width / 2, screenY + game.player.height / 2 + bobOffset);
    context.scale(-1, 1);
    context.drawImage(
      diverImage,
      -game.player.width / 2,
      -game.player.height / 2,
      game.player.width,
      game.player.height
    );
  } else {
    context.drawImage(
      diverImage,
      game.player.x,
      screenY + bobOffset,
      game.player.width,
      game.player.height
    );
  }

  context.restore();
}

function drawHudOverlay() {
  context.fillStyle = "rgba(4, 16, 25, 0.58)";
  context.fillRect(16, 14, 228, 52);

  context.fillStyle = "#eff9ff";
  context.font = "18px Trebuchet MS";
  context.fillText("酸素", 28, 46);
  drawOxygenGauge(88, 34, 138, 14, getOxygenRatio());
}

function drawMessage() {
  if (game.state === GameState.PLAYING || game.state === GameState.LOCK) {
    return;
  }

  context.fillStyle = "rgba(1, 8, 15, 0.56)";
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  context.textAlign = "center";
  context.fillStyle = "#f6fbff";

  if (game.state === GameState.TITLE) {
    context.font = "bold 34px Trebuchet MS";
    context.fillText(`海底に潜り、宝箱の宝を${TREASURE_TARGET}つ見つけよう`, GAME_WIDTH / 2, 350);
    context.font = "23px Trebuchet MS";
    context.fillText("Enter / Space で潜水開始", GAME_WIDTH / 2, 395);
    context.fillText("移動: 矢印キー / WASD", GAME_WIDTH / 2, 430);
  }

  if (game.state === GameState.CLEAR) {
    context.font = "bold 44px Trebuchet MS";
    context.fillText("探索成功!", GAME_WIDTH / 2, 195);
    context.font = "25px Trebuchet MS";
    context.fillText(`宝を${TREASURE_TARGET}つ回収しました`, GAME_WIDTH / 2, 246);
    context.fillText("残り酸素", GAME_WIDTH / 2, 286);
    drawOxygenGauge(GAME_WIDTH / 2 - 130, 304, 260, 18, getOxygenRatio());
    context.fillText("Enter / Space で再挑戦", GAME_WIDTH / 2, 338);
  }

  if (game.state === GameState.GAME_OVER) {
    drawGameOverDiver();
    context.font = "bold 44px Trebuchet MS";
    context.fillText("潜水失敗...", GAME_WIDTH / 2, 135);
    context.font = "25px Trebuchet MS";
    context.fillText(`回収した宝 ${game.score} / ${TREASURE_TARGET}`, GAME_WIDTH / 2, 185);
    context.fillText("酸素が尽きてしまいました", GAME_WIDTH / 2, 222);
    context.fillText("Enter / Space で再挑戦", GAME_WIDTH / 2, 412);
  }

  context.textAlign = "start";
}

function drawCenterBanner(text) {
  context.fillStyle = "rgba(1, 11, 18, 0.62)";
  context.fillRect(170, 30, 620, 58);
  context.fillStyle = "#f3fbff";
  context.font = "22px Trebuchet MS";
  context.textAlign = "center";
  context.fillText(text, GAME_WIDTH / 2, 67);
  context.textAlign = "start";
}

function drawGameOverDiver() {
  if (!images.diverBroken.complete) {
    return;
  }

  context.drawImage(images.diverBroken, GAME_WIDTH / 2 - 145, 240, 290, 210);
}

function drawOxygenGauge(x, y, width, height, oxygenRatio) {
  const radius = height / 2;

  context.fillStyle = "rgba(255, 255, 255, 0.14)";
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();

  if (oxygenRatio <= 0) {
    return;
  }

  const fillWidth = Math.max(height, width * oxygenRatio);
  const gradient = context.createLinearGradient(x, y, x + width, y);

  if (oxygenRatio <= 0.25) {
    gradient.addColorStop(0, "#ffb36b");
    gradient.addColorStop(0.55, "#ff6b4a");
    gradient.addColorStop(1, "#ff3d3d");
  } else if (oxygenRatio <= 0.5) {
    gradient.addColorStop(0, "#ffe17a");
    gradient.addColorStop(0.55, "#ffb84d");
    gradient.addColorStop(1, "#ff8f3d");
  } else {
    gradient.addColorStop(0, "#62e5ff");
    gradient.addColorStop(0.5, "#2eb6ff");
    gradient.addColorStop(1, "#0b7cf2");
  }

  context.fillStyle = gradient;
  context.beginPath();
  context.roundRect(x, y, fillWidth, height, radius);
  context.fill();
}

function updateHud() {
  const oxygenRatio = getOxygenRatio();
  const oxygenValue = `${Math.ceil(game.oxygen)}`;
  const oxygenPercent = `${Math.round(oxygenRatio * 100)}%`;
  const oxygenGaugeColor = getOxygenGaugeColor(oxygenRatio);

  if (oxygenGaugeFillElement) {
    oxygenGaugeFillElement.style.width = `${oxygenRatio * 100}%`;
    oxygenGaugeFillElement.style.background = oxygenGaugeColor;
    oxygenGaugeFillElement.setAttribute("aria-valuenow", oxygenValue);
  }

  if (lockOxygenGaugeFillElement) {
    lockOxygenGaugeFillElement.style.width = `${oxygenRatio * 100}%`;
    lockOxygenGaugeFillElement.style.background = oxygenGaugeColor;
  }

  if (lockOxygenGaugeElement) {
    lockOxygenGaugeElement.setAttribute("aria-valuenow", oxygenValue);
  }

  if (lockOxygenValueElement) {
    lockOxygenValueElement.textContent = oxygenPercent;
  }
}

function updateStartButtonLabel() {
  return;
}

function gameLoop(timestamp) {
  if (game.lastTimestamp === 0) {
    game.lastTimestamp = timestamp;
  }

  const deltaTime = Math.min((timestamp - game.lastTimestamp) / 1000, 0.033);
  game.lastTimestamp = timestamp;

  update(deltaTime);
  draw();
  requestAnimationFrame(gameLoop);
}

bindInput();
requestAnimationFrame(gameLoop);
