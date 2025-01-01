import express from 'express';
import cors from 'cors';
import https from 'https';

const app = express();
app.use(cors()); // Enable CORS for all routes

const autoembed = 'YXV0b2VtYmVkLmNj';

function decodeBase64(encoded) {
  return Buffer.from(encoded, 'base64').toString('utf-8');
}

function fetchHTML(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`Failed to fetch URL: ${url}, Status: ${res.statusCode}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function extractLinks(url) {
  try {
    const html = await fetchHTML(url);
    const links = [];
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

async function getStreamingLinks(imdbId, type) {
  try {
    const streams = [];

    // Server 1
    const server1Url =
      type === 'movie'
        ? `https://${decodeBase64(autoembed)}/embed/oplayer.php?id=${imdbId}`
        : `https://${decodeBase64(autoembed)}/embed/oplayer.php?id=${imdbId}&s=1&e=1`;
    const links1 = await extractLinks(server1Url);
    links1.forEach(({ lang, url }) => {
      streams.push({
        server: 'Server 1' + (lang ? ` - ${lang}` : ''),
        link: url,
        type: 'm3u8',
      });
    });

    // Server 4
    const server4Url =
      type === 'movie'
        ? `https://${decodeBase64(autoembed)}/embed/player.php?id=${imdbId}`
        : `https://${decodeBase64(autoembed)}/embed/player.php?id=${imdbId}&s=1&e=1`;
    const links4 = await extractLinks(server4Url);
    links4.forEach(({ lang, url }) => {
      streams.push({
        server: 'Server 4' + (lang ? ` - ${lang}` : ''),
        link: url,
        type: 'm3u8',
      });
    });

    return streams;
  } catch (err) {
    console.error('Error in getStreamingLinks:', err);
    return [];
  }
}

app.get('/api/streams', async (req, res) => {
  const { imdbId, type } = req.query;

  if (!imdbId || !type) {
    return res.status(400).json({ error: 'Missing imdbId or type parameter' });
  }

  try {
    const streams = await getStreamingLinks(imdbId, type);
    res.json({ streams });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch streaming links', details: err.message });
  }
});

// Export the app for Vercel
export default app;
