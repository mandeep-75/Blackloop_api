import fetch from "node-fetch";

const BASE_URL = "https://torrentio.strem.fun/sort=seeders%7Clanguage=hindi";

/**
 * Fetches torrent stream data from Torrentio based on type and ID.
 * For movies, it calls the movie endpoint.
 * For series, it calls the series endpoint with season and episode parameters.
 *
 * @param {Object} options - The options for fetching.
 * @param {string} options.type - Either "movie" or "series".
 * @param {string} options.id - The IMDb ID.
 * @param {number} [options.season] - Season number (for series).
 * @param {number} [options.episode] - Episode number (for series).
 * @returns {Promise<Object|Array>} The fetched JSON data.
 */
async function fetchStreamData({ type, id, season, episode }) {
  let url;
  if (type === "movie") {
    url = `${BASE_URL}/stream/movie/${id}.json`;
  } else if (type === "series") {
    season = season || 1;
    episode = episode || 1;
    url = `${BASE_URL}/stream/series/${id}.json?season=${season}&episode=${episode}`;
  } else {
    throw new Error("Unknown type. Use 'movie' or 'series'.");
  }

  console.log(`Fetching data from: ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Fetch failed: ${error}`);
    throw error;
  }
}

/**
 * Processes the fetched data to return a list of stream objects.
 * Each object contains fileIndex, title, fileName, and a link (direct URL or magnet link).
 *
 * @param {Object} options - Options to pass to fetchStreamData.
 * @returns {Promise<Array>} A list of stream objects.
 */
async function getStreamingUrls(options) {
  try {
    const data = await fetchStreamData(options);
    let trackers = [];
    let streams = [];

    // If data is an array and the first element contains trackers, extract them.
    if (Array.isArray(data)) {
      if (data.length > 0 && data[0].trackers) {
        trackers = data[0].trackers;
        streams = data.slice(1);
      } else {
        streams = data;
      }
    } else if (data && data.streams) {
      streams = data.streams;
    } else {
      console.error("Invalid data format");
      return [];
    }

    // Process each stream entry.
    const streamList = streams.map((stream, idx) => {
      // Use provided fileIdx or fallback to sequential index (1-indexed)
      const fileIndex =
        typeof stream.fileIdx === "number" ? stream.fileIdx : idx + 1;
      // Use 'title' property if available, otherwise fallback to 'name'
      const streamTitle = stream.title || stream.name || "Unknown Title";
      // Extract file name from behaviorHints if available
      const fileName =
        stream.behaviorHints && stream.behaviorHints.filename
          ? stream.behaviorHints.filename
          : "Unknown File";

      // Generate the link: use a direct URL if available, otherwise build a magnet link.
      let link = "";
      if (stream.url) {
        link = stream.url;
      } else if (stream.infoHash) {
        link = `magnet:?xt=urn:btih:${stream.infoHash}`;
        if (trackers.length) {
          trackers.forEach((tr) => {
            link += `&tr=${encodeURIComponent(tr)}`;
          });
        }
      }

      return {
        fileIndex,
        title: streamTitle,
        fileName,
        link,
      };
    });

    console.log("Generated Data List:", streamList);
    return streamList;
  } catch (error) {
    console.error(`Error processing stream data: ${error.message}`);
    return [];
  }
}

/**
 * API handler for fetching torrent streaming links.
 * Expects query parameters: imdbId, type (movie or series), and optionally season and episode.
 * Implements CORS handling for specific origins.
 */
export default async function handler(req, res) {
  const { imdbId, type, season, episode } = req.query;

  if (!imdbId || !type) {
    return res.status(400).json({ error: "IMDb ID and type are required." });
  }

  // CORS handling for allowed origins.
  const allowedOrigins = [
    "https://movies-react.vercel.app",
    "http://localhost:5173",
  ];
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
  } else {
    res.setHeader("Access-Control-Allow-Origin", "");
  }

  try {
    const streams = await getStreamingUrls({
      type,
      id: imdbId,
      season,
      episode,
    });
    res.json({ streams });
  } catch (err) {
    console.error("Error fetching streaming links:", err);
    res.status(500).json({ error: "Failed to fetch streaming links." });
  }
}
