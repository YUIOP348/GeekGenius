import "./custom.js";

const GAME_SERVER = "https://gms.parcoil.com";
const gamesContainer = document.getElementById("gamesContainer");
const searchInput = document.getElementById("searchInput");
const resultsCount = document.getElementById("resultsCount");
const gameCount = document.getElementById("gameCount");
const favoriteCount = document.getElementById("favoriteCount");
const surpriseButton = document.getElementById("surpriseButton");
const viewButtons = [...document.querySelectorAll("[data-view]")];

let games = [];
let currentView = "all";
let favorites = readFavorites();

function readFavorites() {
  try {
    return new Set(JSON.parse(localStorage.getItem("geekgenius-favorites") || "[]"));
  } catch {
    return new Set();
  }
}

function saveFavorites() {
  try {
    localStorage.setItem("geekgenius-favorites", JSON.stringify([...favorites]));
  } catch {
    // The library still works when browser storage is unavailable.
  }
}

function updateFavoriteCount() {
  favoriteCount.textContent = String(favorites.size);
}

function gameImageUrl(game) {
  const imagePath = [game.url, game.image]
    .flatMap((part) => String(part).split("/"))
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${GAME_SERVER}/${imagePath}`;
}

function makeGameCard(game) {
  const card = document.createElement("article");
  card.className = "game-card";

  const playLink = document.createElement("a");
  playLink.className = "game-card-open";
  const playUrl = new URL("play.html", document.baseURI);
  playUrl.searchParams.set("gameurl", `${game.url}/`);
  playLink.href = playUrl.href;
  playLink.setAttribute("aria-label", `Play ${game.name}`);

  const art = document.createElement("div");
  art.className = "game-art";
  const image = document.createElement("img");
  image.src = gameImageUrl(game);
  image.alt = "";
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener("error", () => {
    image.remove();
    const fallback = document.createElement("span");
    fallback.className = "game-art-fallback";
    fallback.textContent = game.name.slice(0, 1).toUpperCase();
    fallback.setAttribute("aria-hidden", "true");
    art.append(fallback);
  }, { once: true });
  art.append(image);

  if (game.new) {
    const badge = document.createElement("span");
    badge.className = "new-badge";
    badge.textContent = "New";
    art.append(badge);
  }

  const details = document.createElement("div");
  details.className = "game-card-details";
  const name = document.createElement("h3");
  name.textContent = game.name;
  const action = document.createElement("span");
  action.className = "play-indicator";
  action.setAttribute("aria-hidden", "true");
  action.textContent = "↗";
  details.append(name, action);
  playLink.append(art, details);

  const isFavorite = favorites.has(game.url);
  const favoriteButton = document.createElement("button");
  favoriteButton.className = "game-favorite";
  favoriteButton.type = "button";
  favoriteButton.textContent = "♥";
  favoriteButton.setAttribute("aria-label", `${isFavorite ? "Remove" : "Add"} ${game.name} ${isFavorite ? "from" : "to"} favorites`);
  favoriteButton.setAttribute("aria-pressed", String(isFavorite));
  favoriteButton.addEventListener("click", () => {
    if (favorites.has(game.url)) favorites.delete(game.url);
    else favorites.add(game.url);
    saveFavorites();
    updateFavoriteCount();
    renderGames();
  });

  card.append(playLink, favoriteButton);
  return card;
}

function renderGames() {
  if (!gamesContainer) return;
  const query = searchInput.value.trim().toLocaleLowerCase();
  const visibleGames = games.filter((game) => {
    const matchesSearch = game.name.toLocaleLowerCase().includes(query);
    return matchesSearch && (currentView === "all" || favorites.has(game.url));
  });

  gamesContainer.replaceChildren();
  gamesContainer.setAttribute("aria-busy", "false");
  visibleGames.forEach((game) => gamesContainer.append(makeGameCard(game)));

  if (!visibleGames.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const title = document.createElement("strong");
    const message = document.createElement("span");
    if (currentView === "favorites" && !query) {
      title.textContent = "Your favorites will show up here";
      message.textContent = "Tap the heart on any game to save it for later.";
    } else {
      title.textContent = "No games found";
      message.textContent = "Try another title or clear your search.";
    }
    empty.append(title, message);
    gamesContainer.append(empty);
  }

  resultsCount.textContent = currentView === "favorites"
    ? `${visibleGames.length} favorite${visibleGames.length === 1 ? "" : "s"}`
    : `${visibleGames.length} game${visibleGames.length === 1 ? "" : "s"} to explore`;
}

function setView(view) {
  currentView = view;
  viewButtons.forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  renderGames();
}

searchInput.addEventListener("input", renderGames);
viewButtons.forEach((button) => button.addEventListener("click", () => {
  setView(button.dataset.view);
  document.getElementById("games").scrollIntoView({ behavior: "smooth" });
}));

surpriseButton.addEventListener("click", () => {
  if (!games.length) return;
  const game = games[Math.floor(Math.random() * games.length)];
  const playUrl = new URL("play.html", document.baseURI);
  playUrl.searchParams.set("gameurl", `${game.url}/`);
  window.location.assign(playUrl);
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.focus();
    document.getElementById("games").scrollIntoView({ behavior: "smooth" });
  }
});

fetch("./config/games.json")
  .then((response) => {
    if (!response.ok) throw new Error(`Games list returned ${response.status}`);
    return response.json();
  })
  .then((data) => {
    games = Array.isArray(data) ? data.filter((game) => game && game.name && game.url && game.image) : [];
    favorites = new Set([...favorites].filter((url) => games.some((game) => game.url === url)));
    updateFavoriteCount();
    gameCount.textContent = new Intl.NumberFormat().format(games.length);
    renderGames();
  })
  .catch((error) => {
    console.error("Error loading games:", error);
    gamesContainer.setAttribute("aria-busy", "false");
    gamesContainer.replaceChildren();
    const errorState = document.createElement("div");
    errorState.className = "empty-state";
    const title = document.createElement("strong");
    title.textContent = "We couldn't load the game library.";
    const message = document.createElement("span");
    message.textContent = "Refresh the page to try again.";
    errorState.append(title, message);
    gamesContainer.append(errorState);
    gameCount.textContent = "0";
    resultsCount.textContent = "The game list could not be loaded";
  });
