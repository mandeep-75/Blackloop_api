import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const Link = 'YXV0b2VtYmVkLmNj'; // Base64 encoded URL

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

async function getStreamingLinks(imdbId, type, season = null, episode = null) {
  try {
    const streams = [];
    const seasonQuery = season ? `&s=${season}` : '';
    const episodeQuery = episode ? `&e=${episode}` : season ? '&e=1' : '';

    // Server 1
    const server1Url =
      type === 'movie'
        ? `https://${decodeBase64(Link)}/embed/oplayer.php?id=${imdbId}`
        : `https://${decodeBase64(Link)}/embed/oplayer.php?id=${imdbId}${seasonQuery}${episodeQuery}`;
    const links1 = await extractLinks(server1Url);
    links1.forEach(({ lang, link }) => {
      streams.push({
        server: 'Server 1' + (lang ? ` - ${lang}` : ''),
        link,
        type: 'm3u8',
      });
    });

    // Server 4
    const server4Url =
      type === 'movie'
        ? `https://${decodeBase64(Link)}/embed/player.php?id=${imdbId}`
        : `https://${decodeBase64(Link)}/embed/player.php?id=${imdbId}${seasonQuery}${episodeQuery}`;
    const links4 = await extractLinks(server4Url);
    links4.forEach(({ lang, link }) => {
      streams.push({
        server: 'Server 4' + (lang ? ` - ${lang}` : ''),
        link,
        type: 'm3u8',
      });
    });

    // Server 3
    const server3Url =
      type === 'movie'
        ? `https://viet.${decodeBase64(Link)}/movie/${imdbId}`
        : `https://viet.${decodeBase64(Link)}/tv/${imdbId}/${season || 1}/${episode || 1}`;
    const links3 = await extractLinks(server3Url);
    links3.forEach(({ lang, link }) => {
      streams.push({
        server: 'Server 3' + (lang ? ` - ${lang}` : ''),
        link,
        type: 'm3u8',
      });
    });

    // Server 5
    const server5Url =
      type === 'movie'
        ? `https://tom.${decodeBase64(Link)}/api/getVideoSource?type=movie&id=${imdbId}`
        : `https://tom.${decodeBase64(Link)}/api/getVideoSource?type=tv&id=${imdbId}${seasonQuery}/${episode || 1}`;
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
        streams.push({
          server: 'Server 5',
          link: data.videoSource,
          type: 'm3u8',
        });
      }
    } catch (err) {
      console.error('Error fetching server 5 links:', err);
    }

    return streams;
  } catch (err) {
    console.error('Error in getStreamingLinks:', err);
    return [];
  }
}

async function fetchFromMoviesApi(tmdbId, type, season, episode) {
  const baseUrl = 'https://moviesapi.club';
  const link =
    type === 'movie'
      ? `${baseUrl}/movie/${tmdbId}`
      : `${baseUrl}/tv/${tmdbId}-${season}-${episode}`;

  const res1 = await fetch(link, { headers: { referer: baseUrl } });
  const baseData = await res1.text();
  const $ = cheerio.load(baseData);
  const embededUrl = $('iframe').attr('src') || '';

  if (!embededUrl) {
    throw new Error('No embedded URL found.');
  }

  const response = await fetch(embededUrl, {
    credentials: 'omit',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:101.0) Gecko/20100101 Firefox/101.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Cache-Control': 'no-cache',
      referer: baseUrl,
    },
  });
  const data2 = await response.text();

  const contents =
    data2.match(/const\s+Encrypted\s*=\s*['"]({.*})['"]/)?.[1] || '';

  if (!contents) {
    throw new Error('No encrypted content found.');
  }

  const decryptRes = await fetch(
    'https://ext.8man.me/api/decrypt?passphrase==JV[t}{trEV=Ilh5',
    {
      method: 'POST',
      body: contents,
    }
  );

  const finalData = await decryptRes.json();

  if (!finalData || !finalData.videoUrl) {
    throw new Error('No streaming link found.');
  }

  const subtitles = finalData?.subtitles?.map((sub) => ({
    title: sub?.label || 'Unknown',
    language: sub?.label,
    type: sub?.file?.includes('.vtt') ? 'vtt' : 'srt',
    uri: sub?.file,
  }));

  return {
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
  };
}

export default async function handler(req, res) {
  const { imdbId, tmdbId, type, season, episode } = req.query;

  if (!imdbId || !type) {
    return res.status(400).json({ error: 'IMDb ID and type are required.' });
  }

  try {
    const streams = await getStreamingLinks(imdbId, type, season, episode);
    if (tmdbId) {
      try {
        const movieApiStream = await fetchFromMoviesApi(
          tmdbId,
          type,
          season,
          episode
        );
        streams.push(movieApiStream);
      } catch (err) {
        console.error('Error fetching from Movies API:', err);
      }
    }

    res.json({ streams });
  } catch (err) {
    console.error('Error in handler:', err);
    res.status(500).json({ error: 'Failed to fetch streaming links.' });
  }
}
