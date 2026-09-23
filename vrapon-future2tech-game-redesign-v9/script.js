/* ==========================================================================
   VrapOn — "PICK A CITY & WIN"
   Vanilla JS game logic for the Future2Tech 2026 booth touchscreen.
   No frameworks, no backend, no external APIs. Works fully offline.
   ========================================================================== */

"use strict";

/* ==========================================================================
   1. GAME CONFIGURATION
   Edit everything about coupons, odds, limits and timing right here.
   Nothing below this block needs to change when you tune the game.
   ========================================================================== */
const GAME_CONFIG = {
  // -------------------------------------------------------------------
  // EDIT HERE: taxi ride duration (ms) — how long the animation runs
  // -------------------------------------------------------------------
  animationDuration: 2600,

  // -------------------------------------------------------------------
  // EDIT HERE: unattended-kiosk idle timeout (ms). If nobody interacts
  // while the map or the result screen is showing, the game quietly
  // returns to the start screen so it's always ready for the next
  // visitor. Set to 0 to disable.
  // -------------------------------------------------------------------
  idleResetDelay: 25000,

  // -------------------------------------------------------------------
  // Five fixed, reusable coupon codes. Every play awards one of them.
  // Weights add up to 100, so each weight is its % chance:
  //   5% / 10% / 15% OFF -> 26.33% each (79 / 3), 20% OFF -> 20%, 50% OFF -> 1%.
  //   - weight: relative probability among prizes that still have stock
  //   - maxWinners: total number ever awarded (null = unlimited)
  //   - discount: numeric percent shown on the result screen (null = none)
  // -------------------------------------------------------------------
  prizes: [
    {
      id: "discount5",
      label: "5% OFF",
      code: "Future5",
      discount: 5,
      weight: 79 / 3,
      maxWinners: null
    },
    {
      id: "discount10",
      label: "10% OFF",
      code: "Future10",
      discount: 10,
      weight: 79 / 3,
      maxWinners: null
    },
    {
      id: "discount15",
      label: "15% OFF",
      code: "Future15",
      discount: 15,
      weight: 79 / 3,
      maxWinners: null
    },
    {
      id: "discount20",
      label: "20% OFF",
      code: "Future20",
      discount: 20,
      weight: 20,
      maxWinners: null
    },
    {
      id: "discount50",
      label: "50% OFF",
      code: "Future50",
      discount: 50,
      weight: 1,
      maxWinners: null
    }
  ],

  // -------------------------------------------------------------------
  // Each code may be shown to multiple visitors during the event.
  // -------------------------------------------------------------------
  reusableCouponCodes: {
    discount5: ["Future5"],
    discount10: ["Future10"],
    discount15: ["Future15"],
    discount20: ["Future20"],
    discount50: ["Future50"]
  }
};

// Key used to persist prize counters in localStorage.
const STORAGE_KEY = "vrapon_future2tech_prize_inventory_v2";

/* ==========================================================================
   2. CITY DATA
   Touch-point positions on the 917x1536 premium illustrated map.
   ========================================================================== */
const CITIES = [
  { name: "Bajram Curri", x: 494, y: 152 },
  { name: "Shkodër", x: 291, y: 231 },
  { name: "Kukës", x: 596, y: 252 },
  { name: "Lezhë", x: 322, y: 348 },
  { name: "Burrel", x: 465, y: 392 },
  { name: "Dibër", x: 585, y: 446 },
  { name: "Krujë", x: 386, y: 490 },
  { name: "Durrës", x: 317, y: 576 },
  { name: "Tiranë", x: 430, y: 586 },
  { name: "Elbasan", x: 494, y: 666 },
  { name: "Lushnjë", x: 394, y: 741 },
  { name: "Pogradec", x: 692, y: 766 },
  { name: "Fier", x: 304, y: 855 },
  { name: "Berat", x: 452, y: 861 },
  { name: "Korçë", x: 721, y: 906 },
  { name: "Vlorë", x: 264, y: 983 },
  { name: "Tepelenë", x: 493, y: 1039 },
  { name: "Përmet", x: 587, y: 1077 },
  { name: "Gjirokastër", x: 520, y: 1148 },
  { name: "Sarandë", x: 480, y: 1256, hitRadius: 31 },
  { name: "Ksamil", x: 480, y: 1325, hitRadius: 31 }
];

const ORIGIN_CITY_NAME = "Tiranë";

/* ==========================================================================
   3. APP STATE
   ========================================================================== */
const state = {
  screen: "start",       // "start" | "map" | "riding" | "result"
  isAnimating: false,    // guards against double taps / multiple results
  inventory: null         // loaded prize inventory, see loadPrizeInventory()
};

// Cached DOM references, filled in on initializeGame()
const dom = {};

/* ==========================================================================
   4. INITIALIZATION
   ========================================================================== */
function initializeGame() {
  dom.screenStart = document.getElementById("screen-start");
  dom.screenMap = document.getElementById("screen-map");
  dom.screenResult = document.getElementById("screen-result");

  dom.btnStart = document.getElementById("btn-start");
  dom.btnPlayAgain = document.getElementById("btn-play-again");
  dom.btnFullscreen = document.getElementById("btn-fullscreen");

  dom.mapSvg = document.getElementById("map-svg");
  dom.cityPinsGroup = document.getElementById("city-pins");
  dom.routePath = document.getElementById("route-path");
  dom.taxiMarker = document.getElementById("taxi-marker");
  dom.rideStatus = document.getElementById("ride-status");
  dom.mapEyebrow = document.querySelector(".map-copy > p");
  dom.mapInstruction = document.querySelector(".map-instruction");
  dom.footerIndex = document.querySelector(".footer-index");

  dom.resultEyebrow = document.getElementById("result-eyebrow");
  dom.resultHeadline = document.getElementById("result-headline");
  dom.resultSubline = document.getElementById("result-subline");
  dom.confettiLayer = document.getElementById("result-confetti");
  dom.resultTitle = document.querySelector(".result-title");
  dom.couponLabel = document.querySelector(".coupon-details > span");

  state.inventory = loadPrizeInventory();

  dom.btnStart.addEventListener("click", showMapScreen);
  dom.btnPlayAgain.addEventListener("click", resetGame);

  setUpFullscreenToggle();
  renderCityPins();

  // Hidden admin reset: press and hold the VrapOn logo on the start screen
  // for 4 seconds. Never exposed as a visible control in the public UI.
  attachAdminResetGesture();

  showStartScreen();
}

/* ==========================================================================
   5. SCREEN MANAGEMENT
   ========================================================================== */
function setActiveScreen(name) {
  state.screen = name;
  const map = {
    start: dom.screenStart,
    map: dom.screenMap,
    riding: dom.screenMap,   // ride animation reuses the map screen
    result: dom.screenResult
  };
  [dom.screenStart, dom.screenMap, dom.screenResult].forEach((el) => {
    const isActive = map[name] === el;
    el.classList.toggle("is-active", isActive);
    el.setAttribute("aria-hidden", isActive ? "false" : "true");
  });

  // Unattended visitors shouldn't strand the booth on the map or the
  // result screen — start screen has nothing to time out from.
  if (name === "map" || name === "result") {
    armIdleReset();
  } else {
    disarmIdleReset();
  }
}

let idleResetTimer = null;

/** (Re)starts the unattended-kiosk idle timer, see GAME_CONFIG.idleResetDelay. */
function armIdleReset() {
  disarmIdleReset();
  if (!GAME_CONFIG.idleResetDelay) return;
  idleResetTimer = setTimeout(() => {
    // Never interrupt an in-progress ride animation or an already-settled
    // start screen — only reset an idle map (nobody picked a city yet) or
    // an idle result screen (nobody tapped PLAY AGAIN).
    const idleOnMap = state.screen === "map" && !state.isAnimating;
    const idleOnResult = state.screen === "result";
    if (idleOnMap || idleOnResult) {
      resetGame();
    }
  }, GAME_CONFIG.idleResetDelay);
}

function disarmIdleReset() {
  if (idleResetTimer) {
    clearTimeout(idleResetTimer);
    idleResetTimer = null;
  }
}

function showStartScreen() {
  state.isAnimating = false;
  setActiveScreen("start");
}

function showMapScreen() {
  resetMapVisuals();
  dom.mapEyebrow.textContent = "WHERE TO NEXT?";
  dom.mapInstruction.textContent = "Choose your city";
  dom.footerIndex.textContent = "01";
  setActiveScreen("map");
}

/* ==========================================================================
   6. MAP + CITY PINS
   ========================================================================== */

function renderCityPins() {
  dom.cityPinsGroup.innerHTML = "";

  CITIES.forEach((city) => {
    const pin = document.createElementNS("http://www.w3.org/2000/svg", "g");
    pin.classList.add("city-pin", "city-option");
    pin.dataset.city = city.name;
    pin.setAttribute("tabindex", "0");
    pin.setAttribute("role", "button");
    pin.setAttribute("aria-label", `Pick ${city.name}`);
    pin.setAttribute("transform", `translate(${city.x}, ${city.y})`);

    // Transparent touchscreen hotspot aligned with the illustrated pin.
    const touchTarget = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    touchTarget.setAttribute("r", String(city.hitRadius || 38));
    touchTarget.classList.add("pin-touch-target");

    const selectedRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    selectedRing.setAttribute("r", "47");
    selectedRing.classList.add("pin-selected-ring");

    pin.appendChild(touchTarget);
    pin.appendChild(selectedRing);

    pin.addEventListener("click", () => selectCity(city));
    pin.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        selectCity(city);
      }
    });

    dom.cityPinsGroup.appendChild(pin);
  });
}

function resetMapVisuals() {
  dom.routePath.classList.remove("is-visible");
  dom.routePath.setAttribute("d", "");
  dom.taxiMarker.classList.remove("is-visible");
  dom.rideStatus.textContent = "Tap a city to start the ride";
  dom.mapSvg.querySelectorAll(".city-option").forEach((pin) => {
    pin.classList.remove("is-disabled", "is-selected");
  });
}

function disableAllPins() {
  dom.mapSvg.querySelectorAll(".city-option").forEach((pin) => {
    pin.classList.add("is-disabled");
  });
}

/* ==========================================================================
   7. CITY SELECTION -> RIDE FLOW
   ========================================================================== */
function selectCity(city) {
  // Prevent double taps / multiple selections during the same animation
  if (state.isAnimating || state.screen !== "map") return;
  state.isAnimating = true;
  disarmIdleReset(); // a ride is in progress — the result screen re-arms it

  disableAllPins();
  const selectedPin = dom.mapSvg.querySelector(`[data-city="${city.name}"]`);
  if (selectedPin) selectedPin.classList.add("is-selected");

  dom.rideStatus.textContent = `Driving to ${city.name}…`;
  dom.mapEyebrow.textContent = "RIDE IN PROGRESS";
  dom.mapInstruction.textContent = "Tiranë → " + city.name;
  dom.footerIndex.textContent = "02";

  const origin = CITIES.find((c) => c.name === ORIGIN_CITY_NAME);
  const route = createRoute(origin, city);
  animateTaxi(route, () => {
    const prize = selectPrize();
    showResult(prize);
  });
}

/**
 * Builds an SVG route from the origin city to the destination city and
 * draws it on the map. Returns the <path> element used for the animation.
 * If the destination IS the origin (Tirane picked), a short circular local
 * loop is generated instead so the taxi still visibly moves.
 */
function createRoute(origin, destination) {
  let d;

  if (destination.name === origin.name) {
    // Short circular local route around Tirane
    const r = 26;
    const cx = origin.x;
    const cy = origin.y;
    d = `M ${cx + r},${cy} ` +
        `A ${r},${r} 0 1,1 ${cx - r},${cy} ` +
        `A ${r},${r} 0 1,1 ${cx + r},${cy}`;
  } else {
    // Gentle curve from origin to destination (quadratic bezier),
    // offset perpendicular to the straight line for a natural "road" feel.
    const midX = (origin.x + destination.x) / 2;
    const midY = (origin.y + destination.y) / 2;
    const dx = destination.x - origin.x;
    const dy = destination.y - origin.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    // perpendicular unit vector, curve amount scaled to distance
    const perpX = -dy / len;
    const perpY = dx / len;
    const curveAmount = Math.min(len * 0.22, 60);
    const controlX = midX + perpX * curveAmount;
    const controlY = midY + perpY * curveAmount;

    d = `M ${origin.x},${origin.y} Q ${controlX},${controlY} ${destination.x},${destination.y}`;
  }

  dom.routePath.setAttribute("d", d);
  dom.routePath.classList.add("is-visible");

  return dom.routePath;
}

/**
 * Animates the taxi marker smoothly along the given SVG path using
 * requestAnimationFrame, then calls onComplete().
 */
function animateTaxi(routeEl, onComplete) {
  const totalLength = routeEl.getTotalLength();
  const duration = GAME_CONFIG.animationDuration;
  let startTime = null;

  dom.taxiMarker.classList.add("is-visible");

  function frame(timestamp) {
    if (startTime === null) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // ease-in-out for a smooth, natural ride
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    const point = routeEl.getPointAtLength(eased * totalLength);
    const lookahead = routeEl.getPointAtLength(Math.min(eased * totalLength + 1, totalLength));
    const angle = Math.atan2(lookahead.y - point.y, lookahead.x - point.x) * (180 / Math.PI);

    dom.taxiMarker.setAttribute(
      "transform",
      `translate(${point.x}, ${point.y}) rotate(${angle + 90})`
    );

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      onComplete();
    }
  }

  requestAnimationFrame(frame);
}

/* ==========================================================================
   8. REUSABLE COUPON CODES
   The event uses four coupons created in VrapOn. Codes repeat by design,
   while each code always stays tied to the correct discount percentage.
   ========================================================================== */

/** Returns one of the reusable codes configured for the selected prize tier. */
function getReusableCouponCode(prizeId) {
  const codes = GAME_CONFIG.reusableCouponCodes[prizeId] || [];
  if (codes.length === 0) return null;
  return codes[Math.floor(Math.random() * codes.length)];
}

/* ==========================================================================
   9. PRIZE ENGINE (weighted random, quantity-limited, persisted)
   ========================================================================== */

/**
 * Loads the prize inventory (awarded counts per prize) from localStorage.
 * Falls back to an in-memory-only inventory if localStorage is unavailable
 * (private browsing, storage disabled, quota exceeded, etc).
 */
function loadPrizeInventory() {
  const fallback = {};
  GAME_CONFIG.prizes.forEach((p) => { fallback[p.id] = 0; });

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    // Merge so newly-added prizes in GAME_CONFIG default to 0 safely
    GAME_CONFIG.prizes.forEach((p) => {
      fallback[p.id] = typeof parsed[p.id] === "number" ? parsed[p.id] : 0;
    });
    return fallback;
  } catch (err) {
    // localStorage unavailable or corrupted data — safe in-memory fallback
    console.warn("VrapOn game: localStorage unavailable, using in-memory inventory.", err);
    return fallback;
  }
}

/** Persists the current prize inventory to localStorage (safe no-op on failure). */
function savePrizeInventory() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.inventory));
  } catch (err) {
    console.warn("VrapOn game: could not save prize inventory.", err);
  }
}

/** Hidden admin utility: resets every prize counter. */
function resetPrizeInventory() {
  const fresh = {};
  GAME_CONFIG.prizes.forEach((p) => { fresh[p.id] = 0; });
  state.inventory = fresh;
  savePrizeInventory();
  console.info("VrapOn game: prize inventory has been reset.");
}

/**
 * Weighted random prize selection. Coupon codes are intentionally reusable;
 * each discount tier draws from its own configured code list.
 */
function selectPrize() {
  const available = GAME_CONFIG.prizes.filter((p) => {
    return p.maxWinners === null || p.maxWinners === undefined
      ? true
      : (state.inventory[p.id] || 0) < p.maxWinners;
  });

  // Safety net if prize limits are introduced later and all are exhausted.
  const pool = available.length > 0 ? available : GAME_CONFIG.prizes;

  const totalWeight = pool.reduce((sum, p) => sum + (p.weight || 1), 0);
  let roll = Math.random() * totalWeight;

  let chosen = pool[pool.length - 1];
  for (const prize of pool) {
    roll -= (prize.weight || 1);
    if (roll <= 0) {
      chosen = prize;
      break;
    }
  }

  if (state.inventory[chosen.id] !== undefined) {
    state.inventory[chosen.id] += 1;
    savePrizeInventory();
  }

  const isDiscountPrize = chosen.discount !== null && chosen.discount !== undefined;
  const reusableCode = isDiscountPrize ? getReusableCouponCode(chosen.id) : null;

  return {
    ...chosen,
    code: isDiscountPrize ? (reusableCode || chosen.code) : null
  };
}

/* ==========================================================================
   10. RESULT SCREEN
   ========================================================================== */
function showResult(prize) {
  const isWinner = prize.discount !== null && prize.discount !== undefined;
  dom.screenResult.classList.toggle("is-download", !isWinner);

  if (isWinner) {
    dom.resultEyebrow.textContent = "NICE CHOICE.";
    dom.resultTitle.innerHTML = "YOUR RIDE<span>PAID OFF.</span>";
    dom.resultHeadline.textContent = `${prize.discount}%`;
    dom.resultSubline.textContent = prize.code;
    dom.couponLabel.textContent = "COUPON CODE";
    launchConfetti();
  } else {
    dom.resultEyebrow.textContent = "READY WHEN YOU ARE.";
    dom.resultTitle.innerHTML = "READY TO RIDE?<span>DOWNLOAD VRAPON.</span>";
    dom.resultHeadline.textContent = "SCAN. DOWNLOAD. GO.";
    dom.resultSubline.textContent = "IOS · ANDROID";
    dom.couponLabel.textContent = "DOWNLOAD VRAPON";
    dom.confettiLayer.innerHTML = "";
  }

  setActiveScreen("result");
}

/** Lightweight, restrained confetti burst — not a casino-style effect. */
function launchConfetti() {
  dom.confettiLayer.innerHTML = "";
  const colors = ["#06A663", "#F5B324", "#2B2B2B", "#E4F5EC"];
  const pieceCount = 26;

  for (let i = 0; i < pieceCount; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDuration = `${1400 + Math.random() * 900}ms`;
    piece.style.animationDelay = `${Math.random() * 250}ms`;
    dom.confettiLayer.appendChild(piece);
  }
}

/* ==========================================================================
   11. RESET
   ========================================================================== */
function resetGame() {
  state.isAnimating = false;
  resetMapVisuals();
  showStartScreen();
}

/* ==========================================================================
   12. FULL SCREEN TOGGLE
   A small persistent corner button. A --kiosk-launched browser is already
   full screen, so this is mainly for anyone opening the game in an
   ordinary browser tab or on a personal phone — one tap for an immersive,
   chrome-free view. Hidden automatically if the Fullscreen API isn't
   available (some iOS Safari versions) so it never shows a dead control.
   ========================================================================== */
function setUpFullscreenToggle() {
  const btn = dom.btnFullscreen;
  if (!btn) return;

  const el = document.documentElement;
  const canFullscreen = !!(
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.msRequestFullscreen
  );

  if (!canFullscreen) {
    btn.hidden = true;
    return;
  }

  const isCurrentlyFullscreen = () =>
    !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);

  const requestFullscreen = () => {
    const request = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    return request.call(el);
  };

  const exitFullscreen = () => {
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if (exit) return exit.call(document);
  };

  const syncButtonState = () => {
    const active = isCurrentlyFullscreen();
    btn.classList.toggle("is-fullscreen", active);
    btn.setAttribute("aria-pressed", String(active));
    btn.setAttribute("aria-label", active ? "Exit full screen" : "Enter full screen");
  };

  btn.addEventListener("click", () => {
    const action = isCurrentlyFullscreen() ? exitFullscreen() : requestFullscreen();
    // Fullscreen requests can be silently rejected (e.g. no user-gesture
    // context, or the browser policy declines it) — fail quietly rather
    // than breaking the game.
    if (action && typeof action.catch === "function") {
      action.catch(() => {});
    }
  });

  ["fullscreenchange", "webkitfullscreenchange", "msfullscreenchange"].forEach((evt) => {
    document.addEventListener(evt, syncButtonState);
  });
}

/* ==========================================================================
   13. HIDDEN ADMIN RESET GESTURE
   Not exposed anywhere in the public UI. Press and hold the logo on the
   start screen for 4 seconds to reset the prize inventory. Intended for
   booth staff only.
   ========================================================================== */
function attachAdminResetGesture() {
  const logo = document.querySelector(".start-logo");
  if (!logo) return;

  let holdTimer = null;
  const HOLD_MS = 4000;

  const start = () => {
    holdTimer = setTimeout(() => {
      resetPrizeInventory();
      // Quiet visual confirmation for staff, no public-facing UI element
      logo.style.transition = "opacity 150ms ease";
      logo.style.opacity = "0.4";
      setTimeout(() => { logo.style.opacity = "1"; }, 300);
    }, HOLD_MS);
  };
  const cancel = () => {
    if (holdTimer) clearTimeout(holdTimer);
  };

  logo.addEventListener("touchstart", start, { passive: true });
  logo.addEventListener("touchend", cancel);
  logo.addEventListener("touchcancel", cancel);
  logo.addEventListener("mousedown", start);
  logo.addEventListener("mouseup", cancel);
  logo.addEventListener("mouseleave", cancel);
}

/* ==========================================================================
   14. BOOT
   ========================================================================== */
document.addEventListener("DOMContentLoaded", initializeGame);

// Prevent the double-tap-to-zoom gesture some mobile browsers still apply,
// even with the touch-action/meta-viewport rules already in place.
let lastTouchEnd = 0;
document.addEventListener("touchend", (event) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 350) {
    event.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });

// Suppress the right-click / long-press context menu so an accidental
// press on the booth touchscreen never exposes a browser menu over the game.
document.addEventListener("contextmenu", (event) => event.preventDefault());
