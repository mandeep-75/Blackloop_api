
import fetch from "node-fetch"
module.exports = async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) {
      res.status(400).json({ error: 'Missing URL parameter' });
      return;
    }

    const response = await fetch(url);
    if (!response.ok) {
      res.status(response.status).json({ error: 'Failed to fetch m3u8 file' });
      return;
    }

    const rawData = await response.text();

    // Parse the m3u8 data to extract qualities
    const qualityRegex = /#EXT-X-STREAM-INF:.*RESOLUTION=(\d+)x(\d+)/g;
    const qualities = [];
    let match;
    while ((match = qualityRegex.exec(rawData)) !== null) {
      const [, width, height] = match;
      qualities.push({ width: parseInt(width, 10), height: parseInt(height, 10) });
    }

    if (qualities.length === 0) {
      res.status(400).json({ error: 'No qualities found in m3u8 file' });
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow CORS for all origins
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.json(qualities);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
