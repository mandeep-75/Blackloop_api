import fetch from 'node-fetch';

const BASE_URL = "https://torrentio.strem.fun/sort=seeders%7Clanguage=hindi";

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

  console.log(`\nFetching data from: ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Fetch failed: ${error}`);
    throw error;
  }
}

async function getStreamingUrls(options) {
  try {
    const data = await fetchStreamData(options);
    let trackers = [];
    let streams = [];

    // Check if data is an array; if first element has trackers, extract them.
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

    // Process each stream to create a data list with file index, title, file name and generated link.
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

      // Generate the link:
      // If a direct URL is provided, use it; otherwise, generate a magnet link from infoHash.
      let link = "";
      if (stream.url) {
        link = stream.url;
      } else if (stream.infoHash) {
        link = `magnet:?xt=urn:btih:${stream.infoHash}`;
        // Append each tracker (if any) as a &tr parameter (URL-encoded)
        if (trackers.length) {
          trackers.forEach(tr => {
            link += `&tr=${encodeURIComponent(tr)}`;
          });
        }
      }

      return {
        fileIndex,
        title: streamTitle,
        fileName,
        link
      };
    });

    // Log the final data list
    console.log("\nGenerated Data List:");
    streamList.forEach(item => {
      console.log(`Index: ${item.fileIndex}`);
      console.log(`Title: ${item.title}`);
      console.log(`File Name: ${item.fileName}`);
      console.log(`Link: ${item.link}\n`);
    });

    return streamList;
  } catch (error) {
    console.error(`Error processing stream data: ${error.message}`);
    return [];
  }
}

// Example usage
const TEST_IDS = {
  MOVIES: ["tt14948432"] // Example movie ID
};

async function main() {
  for (const movieId of TEST_IDS.MOVIES) {
    console.log(`\nProcessing movie: ${movieId}`);
    await getStreamingUrls({ type: "movie", id: movieId });
  }
}

main();

export { fetchStreamData, getStreamingUrls };
