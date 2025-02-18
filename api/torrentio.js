// fetchStreamData.js

// Base URL including default configuration (here: language=hindi and limit=3)
const BASE_URL = "https://torrentio.strem.fun/language=hindi%7Climit=3";

/**
 * Fetches stream data for a movie or series.
 *
 * @param {Object} options - Options for the request.
 * @param {string} options.type - Either "movie" or "series".
 * @param {string} options.id - The content ID (e.g. an IMDb ID).
 * @param {number} [options.season] - Season number (required for series).
 * @param {number} [options.episode] - Episode number (required for series).
 */
async function fetchStreamData({ type, id, season, episode }) {
  let url;
  if (type === "movie") {
    // For movies, build URL without extra query parameters.
    url = `${BASE_URL}/stream/movie/${id}.json`;
  } else if (type === "series") {
    // For series, ensure season and episode are provided.
    if (season === undefined || episode === undefined) {
      console.error("For series, both season and episode numbers must be provided.");
      return;
    }
    // Extra parameters are appended in the URL as "season=1&episode=2" before ".json"
    const extra = `season=${season}&episode=${episode}`;
    url = `${BASE_URL}/stream/series/${id}/${extra}.json`;
  } else {
    console.error("Unknown type. Please use 'movie' or 'series'.");
    return;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Error fetching stream data: ${response.status} ${response.statusText}`);
      return;
    }
    const data = await response.json();
    console.log("Stream data for", type, id, 
                type === "series" ? `(Season: ${season}, Episode: ${episode})` : "", ":", data);
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

// Example usage:

// Fetch stream data for a movie with a dummy ID.
fetchStreamData({ type: "movie", id: "tt14948432" });

// Fetch stream data for a series with dummy ID, season, and episode.
fetchStreamData({ type: "series", id: "tt7654321", season: 1, episode: 2 });
