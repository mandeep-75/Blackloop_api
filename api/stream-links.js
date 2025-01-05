import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

function decodeBase64(encoded) {
  return Buffer.from(encoded, 'base64').toString('utf-8');
}

async function fetchHTML(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch URL: ${url}, Status: ${res.status}`);
  }
  return res.text();
}

async function extractLinks(url) {
  try {
    const html = await fetchHTML(url);
    const links = [];
    const regex = /"title":\s*"([^"]+)",\s*"file":\s*"([^"]+)"/g;

    let match;
    while ((match = regex.exec(html))) {
      const [, lang, link] = match;
      links.push({ lang, link });
    }
    return links;
  } catch (err) {
    console.error('Error extracting links:', err);
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tmdbId, imdbId, type, season, episode } = req.query;

  if (!tmdbId || !type || (type === 'tv' && (!season || !episode))) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const streams = [];
    const baseUrl = 'https://moviesapi.club';
    const link =
      type === 'movie'
        ? `${baseUrl}/movie/${tmdbId}`
        : `${baseUrl}/tv/${tmdbId}-${season}-${episode}`;

    // Fetch data from moviesapi.club
    const res1 = await fetch(link, { headers: { referer: baseUrl } });
    const baseData = await res1.text();
    const $ = cheerio.load(baseData);
    const embededUrl = $('iframe').attr('src') || '';

    if (embededUrl) {
      const response = await fetch(embededUrl, {
        credentials: 'omit',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:101.0) Gecko/20100101 Firefox/101.0',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
          referer: baseUrl,
        },
      });
      const data2 = await response.text();

      const contents =
        data2.match(/const\s+Encrypted\s*=\s*['"]({.*})['"]/)?.[1] || '';

      if (contents) {
        const decryptRes = await fetch(
          'https://ext.8man.me/api/decrypt?passphrase==JV[t}{trEV=Ilh5',
          {
            method: 'POST',
            body: contents,
          }
        );

        const finalData = await decryptRes.json();

        if (finalData && finalData.videoUrl) {
          const subtitles = finalData?.subtitles?.map((sub) => ({
            title: sub?.label || 'Unknown',
            language: sub?.label,
            type: sub?.file?.includes('.vtt') ? 'vtt' : 'srt',
            uri: sub?.file,
          }));

          streams.push({
            server: 'vidstreaming',
            type: 'm3u8',
            subtitles,
            link: finalData.videoUrl,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:101.0) Gecko/20100101 Firefox/101.0',
              Referer: baseUrl,
              Origin: baseUrl,
              Accept: '*/*',
              'Accept-Language': 'en-US,en;q=0.5',
            },
          });
        }
      }
    }

    // Additional servers logic
    const encodedLink = 'YXV0b2VtYmVkLmNj'; // Base64 for additional server link
    const seasonQuery = season ? `&s=${season}` : '';
    const episodeQuery = episode ? `&e=${episode}` : season ? '&e=1' : '';

    // Server 1
    const server1Url =
      type === 'movie'
        ? `https://${decodeBase64(encodedLink)}/embed/oplayer.php?id=${imdbId}`
        : `https://${decodeBase64(encodedLink)}/embed/oplayer.php?id=${imdbId}${seasonQuery}${episodeQuery}`;
    const links1 = await extractLinks(server1Url);
    links1.forEach(({ lang, link }) => {
      streams.push({
        server: 'Server 1' + (lang ? ` - ${lang}` : ''),
        link,
        type: 'm3u8',
      });
    });

    // Server 3
    const server3Url =
      type === 'movie'
        ? `https://viet.${decodeBase64(encodedLink)}/movie/${imdbId}`
        : `https://viet.${decodeBase64(encodedLink)}/tv/${imdbId}/${season || 1}/${episode || 1}`;
    const links3 = await extractLinks(server3Url);
    links3.forEach(({ lang, link }) => {
      streams.push({
        server: 'Server 3' + (lang ? ` - ${lang}` : ''),
        link,
        type: 'm3u8',
      });
    });

    return res.status(200).json({ streams });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
