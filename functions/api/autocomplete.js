export async function onRequestGet(context) {
  const keyword = String(context.request.url ? new URL(context.request.url).searchParams.get("keyword") || "" : "").trim();

  if (!keyword) {
    return json({ suggestions: [] }, 400);
  }

  try {
    const suggestions = context.env.SERPAPI_KEY
      ? await fetchSerpApiAutocomplete(keyword, context.env.SERPAPI_KEY)
      : await fetchGoogleSuggest(keyword);

    return json({
      suggestions: cleanSuggestions(suggestions, keyword).slice(0, 5)
    });
  } catch (error) {
    console.error("Google autocomplete failed:", error);
    return json({ suggestions: [] }, 502);
  }
}

async function fetchSerpApiAutocomplete(keyword, apiKey) {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_autocomplete");
  url.searchParams.set("q", keyword);
  url.searchParams.set("api_key", apiKey);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`SerpAPI returned ${response.status}`);

  const data = await response.json();
  return (data.suggestions || []).map((item) => item.value || item.suggestion || item);
}

async function fetchGoogleSuggest(keyword) {
  const url = new URL("https://suggestqueries.google.com/complete/search");
  url.searchParams.set("client", "firefox");
  url.searchParams.set("q", keyword);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 keyword-research-tool"
    }
  });
  if (!response.ok) throw new Error(`Google Suggest returned ${response.status}`);

  const data = await response.json();
  return Array.isArray(data[1]) ? data[1] : [];
}

function cleanSuggestions(items, keyword) {
  const normalizedKeyword = keyword.toLowerCase();
  const unique = new Set();

  return items
    .map((item) => String(item || "").trim().toLowerCase())
    .filter((item) => item && item.includes(normalizedKeyword))
    .filter((item) => {
      if (unique.has(item)) return false;
      unique.add(item);
      return true;
    })
    .map((keywordText) => ({ keyword: keywordText }));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60"
    }
  });
}
