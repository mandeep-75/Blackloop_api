import fetch from 'node-fetch';

// Base64 encoded string for "autoembed.cc"
const Link = 'YXV0b2VtYmVkLmNj';

/**
 * Decodes a Base64 encoded string.
 * In Node.js, we use Buffer instead of atob.
 */
function decodeBase64(encoded) {
  return Buffer.from(encoded, 'base64').toString('ascii');
}

/**
 * Fetches HTML content from the given URL.
 * Throws an error if the response is not OK.
 */
async function fetchHTML(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch URL: ${url}, Status: ${res.status}`);
  }
  return res.text();
}

/**
 * Extracts streaming links from HTML using a regex that matches "title" and "file" keys.
 */
async function extractLinks(url) {
  try {
    const html = await fetchHTML(url);
    const links = [];
    // Regex to match key-value pairs for "title" and "file"
    const regex = /"title":\s*"([^"]+)",\s*"file":\s*"([^"]+)"/g;
    let match;
    while ((match = regex.exec(html))) {
      const [, lang, url] = match;
      links.push({ lang, url });
    }
    return links;
  } catch (err) {
    console.error('Error extracting links:', err);
    return [];
  }
}

/**
 * Fetches streaming links for the given IMDb ID and type (movie or series).
 * Optionally accepts season and episode for TV shows.
 * This function calls multiple server endpoints—including Torrentio—to aggregate stream links.
 */
async function getStreamingLinks(imdbId, type, season = null, episode = null) {
  try {
    const allStreams = [];
    // Build query parameters for season and episode if provided
    const seasonQuery = season ? `&s=${season}` : '';
    const episodeQuery = episode ? `&e=${episode}` : season ? '&e=1' : '';

    // ----- Server 1 -----
    const server1Url =
      type === 'movie'
        ? `https://${decodeBase64(Link)}/embed/oplayer.php?id=${imdbId}`
        : `https://${decodeBase64(Link)}/embed/oplayer.php?id=${imdbId}${seasonQuery}${episodeQuery}`;
    const links1 = await extractLinks(server1Url);
    links1.forEach(({ lang, url }) => {
      allStreams.push({
        server: 'Server 1' + (lang ? ` - ${lang}` : ''),
        link: url,
        type: 'm3u8',
      });
    });

    // ----- Server 4 -----
    const server4Url =
      type === 'movie'
        ? `https://${decodeBase64(Link)}/embed/player.php?id=${imdbId}`
        : `https://${decodeBase64(Link)}/embed/player.php?id=${imdbId}${seasonQuery}${episodeQuery}`;
    const links4 = await extractLinks(server4Url);
    links4.forEach(({ lang, url }) => {
      allStreams.push({
        server: 'Server 4' + (lang ? ` - ${lang}` : ''),
        link: url,
        type: 'm3u8',
      });
    });

    // ----- Server 3 -----
    const server3Url =
      type === 'movie'
        ? `https://viet.${decodeBase64(Link)}/movie/${imdbId}`
        : `https://viet.${decodeBase64(Link)}/tv/${imdbId}/${season || 1}/${episode || 1}`;
    const links3 = await extractLinks(server3Url);
    links3.forEach(({ lang, url }) => {
      allStreams.push({
        server: 'Server 3' + (lang ? ` - ${lang}` : ''),
        link: url,
        type: 'm3u8',
      });
    });

    // ----- Server 5 -----
    const server5Url =
      type === 'movie'
        ? `https://${decodeBase64(Link)}/api/getVideoSource?type=movie&id=${imdbId}`
        : `https://${decodeBase64(Link)}/api/getVideoSource?type=tv&id=${imdbId}${seasonQuery}/${episode || 1}`;
    try {
      const res = await fetch(server5Url, {
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:101.0) Gecko/20100101 Firefox/101.0',
          Referer: `https://${decodeBase64(Link)}/`,
        },
      });
      const data = await res.json();
      if (data.videoSource) {
        allStreams.push({
          server: 'Server 5',
          link: data.videoSource,
          type: 'm3u8',
        });
      }
    } catch (err) {
      console.error('Error fetching server 5 links:', err);
    }

    // ----- Torrentio Fetching -----
    const torrentioUrl =
      type === 'movie'
        ? `https://torrentio.strem.fun/language=hindi%7Climit=3/stream/movie/${imdbId}.json`
        : `https://torrentio.strem.fun/language=hindi%7Climit=3/stream/series/${imdbId}.json?season=${season ? season : 1}&episode=${episode ? episode : 1}`;
    try {
      const resT = await fetch(torrentioUrl);
      if (resT.ok) {
        const dataT = await resT.json();
        let trackers = [];
        let torrentioStreams = [];
        if (Array.isArray(dataT)) {
          // If the first element contains trackers, extract them.
          if (dataT.length > 0 && dataT[0].trackers) {
            trackers = dataT[0].trackers;
            torrentioStreams = dataT.slice(1);
          } else {
            torrentioStreams = dataT;
          }
        } else if (dataT && dataT.streams) {
          torrentioStreams = dataT.streams;
        }

        torrentioStreams.forEach(stream => {
          let link = '';
          if (stream.url) {
            link = stream.url;
          } else if (stream.infoHash) {
            link = `magnet:?xt=urn:btih:${stream.infoHash}`;
            // Append each tracker as a URL parameter
            if (trackers.length) {
              trackers.forEach(tr => {
                link += `&tr=${encodeURIComponent(tr)}`;
              });
            }
          }
          allStreams.push({
            server: 'Torrentio',
            link: link,
            type: 'm3u8',
          });
        });
      } else {
        console.error('Torrentio fetch error:', resT.status, resT.statusText);
      }
    } catch (err) {
      console.error('Error fetching torrentio links:', err);
    }

    return allStreams;
  } catch (err) {
    console.error('Error in getStreamingLinks:', err);
    return [];
  }
}

/**
 * API handler for fetching streaming links.
 * Expects query parameters: imdbId, type (movie or series), and optionally season and episode.
 * Handles CORS for specific origins.
 */
export default async function handler(req, res) {
  const { imdbId, type, season, episode } = req.query;

  if (!imdbId || !type) {
    return res.status(400).json({ error: 'IMDb ID and type are required.' });
  }

  // Handle CORS for allowed origins
  const allowedOrigins = ['https://movies-react.vercel.app', 'http://localhost:5173'];
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '');
  }

  try {
    const streams = await getStreamingLinks(imdbId, type, season, episode);
    res.json({ streams });
  } catch (err) {
    console.error('Error fetching streaming links:', err);
    res.status(500).json({ error: 'Failed to fetch streaming links.' });
  }
}
