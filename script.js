const API_ENDPOINTS = {
  volume: "/api/keyword-volume",
  suggestions: "/api/keyword-suggestions",
  googleAutocomplete: "/api/google-autocomplete",
  trends: "/api/keyword-trends",
  difficulty: "/api/keyword-difficulty",
  youtube: "/api/youtube-keywords",
  instagram: "/api/instagram-keywords"
};

const input = document.querySelector("#keywordInput");
const form = document.querySelector("#keywordForm");
const suggestionsBox = document.querySelector("#suggestions");
const results = document.querySelector("#results");
const trendCanvas = document.querySelector("#trendChart");
const chartFallback = document.querySelector("#chartFallback");
const keywordLabel = document.querySelector("#keywordLabel");
const volumeValue = document.querySelector("#volumeValue");
const difficultyValue = document.querySelector("#difficultyValue");
const difficultyBadge = document.querySelector("#difficultyBadge");
const competitionValue = document.querySelector("#competitionValue");
const opportunityValue = document.querySelector("#opportunityValue");
const opportunityProgress = document.querySelector("#opportunityProgress");
const difficultyProgress = document.querySelector("#difficultyProgress");
const relatedBody = document.querySelector("#relatedBody");
const tipsList = document.querySelector("#tipsList");
const dataStatus = document.querySelector("#dataStatus");
const modeBadge = document.querySelector("#modeBadge");
const intentBadge = document.querySelector("#intentBadge");
const cpcBadge = document.querySelector("#cpcBadge");
const youtubeIdeas = document.querySelector("#youtubeIdeas");
const instagramIdeas = document.querySelector("#instagramIdeas");
const shortsIdeas = document.querySelector("#shortsIdeas");
const gamingIdeas = document.querySelector("#gamingIdeas");

let trendChart;
let suggestionTimer;
let suggestionRequestId = 0;

const demoKeywordSeeds = {
  youtube: { baseVolume: 74000, difficulty: 56, cpc: "$2.40", intent: "Video research" },
  instagram: { baseVolume: 52000, difficulty: 48, cpc: "$1.70", intent: "Social discovery" },
  gaming: { baseVolume: 68000, difficulty: 58, cpc: "$1.95", intent: "Creator research" },
  seo: { baseVolume: 90500, difficulty: 67, cpc: "$4.80", intent: "Informational" },
  marketing: { baseVolume: 74000, difficulty: 61, cpc: "$5.20", intent: "Commercial" },
  finance: { baseVolume: 110000, difficulty: 78, cpc: "$8.60", intent: "Transactional" },
  default: { baseVolume: 18100, difficulty: 42, cpc: "$1.90", intent: "Informational" }
};

if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    analyzeKeyword(input.value);
  });
}

if (input) {
  input.addEventListener("input", () => queueSuggestionRender(input.value));
  input.addEventListener("focus", () => queueSuggestionRender(input.value, 0));
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".input-wrap")) suggestionsBox.innerHTML = "";
  });
}

async function fetchKeywordData(keyword) {
  // Frontend API keys are never safe. Keep real provider keys in backend .env files only.
  // Supported backend providers: Google Ads Keyword Planner API, DataForSEO, SerpAPI,
  // Google Trends through a pytrends backend, SEMrush API placeholder, Ahrefs API placeholder.
  // These browser calls should hit your own server routes, not third-party APIs directly.
  const payload = { keyword };
  const [volume, suggestions, trends, difficulty, youtube, instagram] = await Promise.allSettled([
    postJson(API_ENDPOINTS.volume, payload),
    postJson(API_ENDPOINTS.suggestions, payload),
    postJson(API_ENDPOINTS.trends, payload),
    postJson(API_ENDPOINTS.difficulty, payload),
    postJson(API_ENDPOINTS.youtube, payload),
    postJson(API_ENDPOINTS.instagram, payload)
  ]);

  const apiData = {
    volume: fulfilled(volume),
    suggestions: fulfilled(suggestions),
    trends: fulfilled(trends),
    difficulty: fulfilled(difficulty),
    youtube: fulfilled(youtube),
    instagram: fulfilled(instagram)
  };

  if (!Object.values(apiData).some(Boolean)) {
    return createDemoKeywordData(keyword);
  }

  return normalizeApiData(keyword, apiData);
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }

  return response.json();
}

function fulfilled(result) {
  return result.status === "fulfilled" ? result.value : null;
}

async function analyzeKeyword(rawKeyword) {
  const keyword = normalizeKeyword(rawKeyword);
  if (!keyword) {
    input.focus();
    return;
  }

  input.value = keyword;
  suggestionsBox.innerHTML = "";
  setLoadingState(true);

  try {
    const data = await fetchKeywordData(keyword);
    const difficulty = clampScore(data.difficulty);
    const competition = getCompetitionLabel(difficulty);
    const opportunity = calculateSeoOpportunityScore(data.volume, difficulty, competition);

    keywordLabel.textContent = keyword;
    volumeValue.textContent = formatNumber(data.volume);
    difficultyValue.textContent = `${difficulty}/100`;
    competitionValue.textContent = competition;
    opportunityValue.textContent = `${opportunity}/100`;
    intentBadge.textContent = `Intent: ${data.intent}`;
    cpcBadge.textContent = `CPC: ${data.cpc}`;
    difficultyBadge.textContent = competition;
    difficultyBadge.className = `badge ${badgeClassForDifficulty(difficulty)}`;
    difficultyProgress.style.width = `${difficulty}%`;
    opportunityProgress.style.width = `${opportunity}%`;

    if (data.mode === "demo") {
      dataStatus.textContent = "Demo estimated data — connect API for accurate search volume.";
      modeBadge.textContent = "Demo estimated data";
      modeBadge.className = "badge warning";
    } else {
      dataStatus.textContent = "Live API data loaded from your secure backend endpoints.";
      modeBadge.textContent = "Live API data";
      modeBadge.className = "badge success";
    }

    renderTrendChart(data.trend, data.months);
    renderRelatedKeywords(data.related);
    renderIdeas(youtubeIdeas, data.youtubeIdeas);
    renderIdeas(instagramIdeas, data.instagramIdeas);
    renderIdeas(shortsIdeas, data.shortsIdeas);
    renderIdeas(gamingIdeas, data.gamingIdeas);
    renderTips(keyword, data.volume, difficulty, competition, opportunity, data.intent);
    results.hidden = false;
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error(error);
    dataStatus.textContent = "Unable to load keyword data. Check backend API routes and try again.";
  } finally {
    setLoadingState(false);
  }
}

function normalizeApiData(keyword, apiData) {
  const demo = createDemoKeywordData(keyword);
  const volumeBlock = apiData.volume || {};
  const suggestionsBlock = apiData.suggestions || {};
  const trendsBlock = apiData.trends || {};
  const difficultyBlock = apiData.difficulty || {};
  const youtubeBlock = apiData.youtube || {};
  const instagramBlock = apiData.instagram || {};

  return {
    mode: "api",
    keyword,
    volume: Number(volumeBlock.volume || volumeBlock.monthlySearches || demo.volume),
    cpc: String(volumeBlock.cpc || demo.cpc),
    intent: String(volumeBlock.intent || difficultyBlock.intent || demo.intent),
    difficulty: Number(difficultyBlock.difficulty || difficultyBlock.score || demo.difficulty),
    trend: Array.isArray(trendsBlock.trend) ? trendsBlock.trend : demo.trend,
    months: Array.isArray(trendsBlock.months) ? trendsBlock.months : demo.months,
    related: normalizeRelated(suggestionsBlock.related || suggestionsBlock.suggestions, demo.related),
    youtubeIdeas: normalizeIdeas(youtubeBlock.ideas || youtubeBlock.keywords, demo.youtubeIdeas),
    instagramIdeas: normalizeIdeas(instagramBlock.ideas || instagramBlock.keywords, demo.instagramIdeas),
    shortsIdeas: normalizeIdeas(instagramBlock.shortsIdeas || youtubeBlock.shortsIdeas, demo.shortsIdeas),
    gamingIdeas: normalizeIdeas(youtubeBlock.gamingIdeas, demo.gamingIdeas)
  };
}

function normalizeRelated(items, fallback) {
  if (!Array.isArray(items) || items.length === 0) return fallback;
  return items.slice(0, 5).map((item) => {
    const difficulty = clampScore(item.difficulty || item.score || 35);
    return {
      keyword: String(item.keyword || item.query || "keyword idea"),
      volume: Number(item.volume || item.monthlySearches || 0),
      cpc: String(item.cpc || "API"),
      competition: item.competition || getCompetitionLabel(difficulty),
      difficulty
    };
  });
}

function normalizeIdeas(items, fallback) {
  if (!Array.isArray(items) || items.length === 0) return fallback;
  return items.slice(0, 5).map((item) => String(item.keyword || item.query || item));
}

function createDemoKeywordData(keyword) {
  const seed = getSeed(keyword);
  const hash = hashKeyword(keyword);
  const volume = estimateVolume(keyword, seed.baseVolume);
  const difficulty = clampScore(seed.difficulty + (hash % 29) - 14);

  return {
    mode: "demo",
    keyword,
    volume,
    difficulty,
    cpc: seed.cpc,
    intent: seed.intent,
    trend: createThreeMonthTrend(volume, hash),
    months: getLastThreeMonthLabels(),
    related: [],
    youtubeIdeas: [],
    instagramIdeas: [],
    shortsIdeas: [],
    gamingIdeas: []
  };
}

function queueSuggestionRender(value, delay = 220) {
  window.clearTimeout(suggestionTimer);
  suggestionTimer = window.setTimeout(() => renderSuggestions(value), delay);
}

async function renderSuggestions(value) {
  const keyword = normalizeKeyword(value);
  if (!keyword) {
    suggestionsBox.innerHTML = "";
    return;
  }

  const requestId = ++suggestionRequestId;
  renderSuggestionLoading();

  const result = await generateSuggestions(keyword);
  if (requestId !== suggestionRequestId) return;

  if (result.items.length === 0) {
    suggestionsBox.innerHTML = '<div class="suggestion-message">Live Google suggestions unavailable. Please try again.</div>';
    return;
  }

  suggestionsBox.innerHTML = result.items
    .map((suggestion) => {
      return `<button class="suggestion-button" type="button" data-keyword="${escapeHtml(suggestion.keyword)}">
        <span>${escapeHtml(suggestion.keyword)}</span>
        <small>Google</small>
      </button>`;
    })
    .join("");

  suggestionsBox.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => analyzeKeyword(button.dataset.keyword));
  });
}

function renderSuggestionLoading() {
  suggestionsBox.innerHTML = '<div class="suggestion-message">Fetching live Google suggestions…</div>';
}

async function generateSuggestions(keyword) {
  // Calls your backend Google autocomplete proxy only.
  // Keep SerpAPI/DataForSEO/Google proxy keys in backend .env files, never in frontend JavaScript.
  try {
    const response = await fetch(`${API_ENDPOINTS.googleAutocomplete}?keyword=${encodeURIComponent(keyword)}`, {
      method: "GET",
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Suggestion endpoint returned ${response.status}`);
    }

    const data = await response.json();
    const liveItems = normalizeSuggestionItems(data, keyword);
    return { mode: "api", items: liveItems.slice(0, 5) };
  } catch (error) {
    console.info("Live Google suggestions unavailable. Please try again.", error);
  }

  return { mode: "unavailable", items: [] };
}

function normalizeSuggestionItems(data, keyword) {
  const source = data || {};
  const rawItems = extractAutocompleteItems(source);

  const unique = new Map();
  rawItems.forEach((item, index) => {
    const phrase = normalizeKeyword(item.keyword || item.query || item.term || item.phrase || item.value || item.suggestion || item);
    if (!phrase || phrase === keyword || !isRelevantSuggestion(phrase, keyword) || unique.has(phrase)) return;

    unique.set(phrase, {
      keyword: phrase,
      score: Number(item.volume || item.searchVolume || item.popularity || item.score || 0),
      position: index
    });
  });

  return [...unique.values()].sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (scoreDiff !== 0) return scoreDiff;
    const relevanceDiff = relevanceScore(b.keyword, keyword) - relevanceScore(a.keyword, keyword);
    if (relevanceDiff !== 0) return relevanceDiff;
    return a.position - b.position;
  });
}

function extractAutocompleteItems(source) {
  if (Array.isArray(source)) {
    if (Array.isArray(source[1])) return source[1];
    return source;
  }

  return (
    source.suggestions ||
    source.autocomplete ||
    source.completions ||
    source.predictions ||
    source.results ||
    source.keywords ||
    []
  );
}

function isRelevantSuggestion(suggestion, keyword) {
  if (suggestion.includes(keyword)) return true;
  const keywordWords = keyword.split(" ").filter(Boolean);
  return keywordWords.length > 1 && keywordWords.every((word) => suggestion.includes(word));
}

function relevanceScore(suggestion, keyword) {
  const keywordWords = new Set(keyword.split(" "));
  return suggestion.split(" ").reduce((score, word) => score + (keywordWords.has(word) ? 1 : 0), 0);
}

function renderTrendChart(values, labels) {
  if (!trendCanvas) return;

  if (!window.Chart) {
    renderChartFallback(values, labels);
    return;
  }

  chartFallback.hidden = true;
  trendCanvas.hidden = false;

  if (trendChart) trendChart.destroy();

  trendChart = new Chart(trendCanvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Monthly search volume",
          data: values,
          borderColor: "#0f8f83",
          backgroundColor: "rgba(15, 143, 131, 0.14)",
          pointBackgroundColor: "#ff7a59",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 3,
          tension: 0.38,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (context) => `${formatNumber(context.parsed.y)} searches` } }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: { callback: (value) => formatNumber(value) },
          grid: { color: "rgba(21, 32, 43, 0.08)" }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderChartFallback(values, labels) {
  trendCanvas.hidden = true;
  chartFallback.hidden = false;
  const max = Math.max(...values);
  chartFallback.innerHTML = values
    .map((value, index) => {
      const height = Math.max(18, Math.round((value / max) * 250));
      return `<div class="fallback-bar" style="height:${height}px"><span>${labels[index]}</span></div>`;
    })
    .join("");
}

function renderRelatedKeywords(items) {
  relatedBody.innerHTML = items
    .map((item) => {
      const badgeClass = badgeClassForDifficulty(item.difficulty);
      return `<tr>
        <td><strong>${escapeHtml(item.keyword)}</strong></td>
        <td>${formatNumber(item.volume)}</td>
        <td>${escapeHtml(item.cpc)}</td>
        <td><span class="badge ${badgeClass}">${escapeHtml(item.competition)}</span></td>
        <td><span class="badge ${badgeClass}">${item.difficulty}/100</span></td>
      </tr>`;
    })
    .join("");
}

function renderIdeas(container, ideas) {
  container.innerHTML = ideas.map((idea) => `<li>${escapeHtml(idea)}</li>`).join("");
}

function renderTips(keyword, volume, difficulty, competition, opportunity, intent) {
  const ideas = [
    `Match "${escapeHtml(keyword)}" to ${escapeHtml(intent.toLowerCase())} intent before writing content.`,
    `Ranking competition is ${escapeHtml(competition.toLowerCase())}; compare page quality and backlinks before publishing.`,
    `The SEO opportunity score is ${opportunity}/100, so balance demand with realistic ranking effort.`,
    `Use related long-tail phrases in headings, FAQs, image alt text, and internal links where they fit naturally.`
  ];

  if (volume > 50000) {
    ideas.push("High volume keywords usually need stronger topical authority and a complete content cluster.");
  } else {
    ideas.push("Lower and mid-volume keywords can be useful for faster wins when the content answers the query clearly.");
  }

  tipsList.innerHTML = ideas.map((idea) => `<li>${idea}</li>`).join("");
}

function setLoadingState(isLoading) {
  const button = form.querySelector("button");
  button.disabled = isLoading;
  button.classList.toggle("is-loading", isLoading);
  button.lastChild.textContent = isLoading ? "Analyzing" : "Analyze";
}

function normalizeKeyword(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function getSeed(keyword) {
  const found = Object.keys(demoKeywordSeeds).find((key) => keyword.includes(key));
  return demoKeywordSeeds[found] || demoKeywordSeeds.default;
}

function estimateVolume(keyword, base = demoKeywordSeeds.default.baseVolume) {
  const hash = hashKeyword(keyword);
  const lengthFactor = Math.max(0.18, 1 - keyword.length / 72);
  const intentBoost = /free|best|tool|checker|youtube|instagram|viral|gaming/.test(keyword) ? 1.26 : 1;
  const variation = 0.72 + (hash % 80) / 100;
  return roundVolume(base * lengthFactor * intentBoost * variation);
}

function calculateSeoOpportunityScore(volume, difficulty, competition) {
  const volumeScore = Math.min(42, Math.round(Math.log10(volume + 1) * 10));
  const difficultyScore = Math.max(0, 46 - Math.round(difficulty * 0.46));
  const competitionPenalty = { Easy: 0, Medium: 7, Challenging: 12, Hard: 17, "Super Hard": 23 }[competition] || 8;
  return Math.max(4, Math.min(100, volumeScore + difficultyScore + 25 - competitionPenalty));
}

function getCompetitionLabel(score) {
  if (score <= 20) return "Easy";
  if (score <= 40) return "Medium";
  if (score <= 60) return "Challenging";
  if (score <= 80) return "Hard";
  return "Super Hard";
}

function badgeClassForDifficulty(score) {
  if (score <= 40) return "success";
  if (score <= 60) return "warning";
  return "danger";
}

function createThreeMonthTrend(volume, hash) {
  const first = Math.max(20, Math.round(volume * (0.78 + (hash % 12) / 100)));
  const second = Math.max(20, Math.round(volume * (0.9 + (hash % 17) / 100)));
  return [first, second, volume];
}

function getLastThreeMonthLabels() {
  const formatter = new Intl.DateTimeFormat("en", { month: "short" });
  const now = new Date();
  return [2, 1, 0].map((offset) => formatter.format(new Date(now.getFullYear(), now.getMonth() - offset, 1)));
}

function hashKeyword(keyword) {
  let hash = 0;
  for (let index = 0; index < keyword.length; index += 1) {
    hash = (hash << 5) - hash + keyword.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function roundVolume(value) {
  if (value >= 10000) return Math.round(value / 1000) * 1000;
  if (value >= 1000) return Math.round(value / 100) * 100;
  return Math.round(value / 10) * 10;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value) || 0);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
