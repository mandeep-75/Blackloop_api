// api/get-qualities.js
import Hls from 'hls.js';

export default async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Check for a GET request
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ message: 'Missing m3u8 URL parameter' });
  }

  try {
    // Fetch the m3u8 file
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(400).json({ message: 'Failed to fetch m3u8 file' });
    }

    const m3u8Content = await response.text();

    // Parse the m3u8 content using Hls.js
    const hls = new Hls();
    hls.loadSource(url);

    hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
      const qualities = data.levels.map((level, index) => ({
        label: `${level.height}p`,
        level: index,
      }));

      return res.status(200).json({
        qualities: [{ label: 'Auto', level: -1 }, ...qualities],
      });
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}
