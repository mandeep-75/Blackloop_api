export default async function handler(req, res) {
    const allowedOrigins = ['https://movies-react.vercel.app', 'http://localhost:5173'];
    const origin = req.headers.origin;
  
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '');
      return res.status(403).json({ message: 'Forbidden' });
    }
  
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
  
    const { url } = req.query;
  
    if (!url) {
      return res.status(400).json({ message: 'Missing m3u8 URL parameter' });
    }
  
    try {
      const decodedUrl = decodeURIComponent(url);
      const response = await fetch(decodedUrl);
  
      if (!response.ok) {
        console.error('Failed to fetch:', response.status, response.statusText);
        return res.status(400).json({ message: 'Failed to fetch m3u8 file' });
      }
  
      const contentType = response.headers.get('content-type');
      const content = await response.text();
  
      res.setHeader('Content-Type', contentType);
      return res.status(200).send(content);
    } catch (error) {
      console.error('Error fetching m3u8 file:', error.message);
      return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
  }
  