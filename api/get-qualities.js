export default async function handler(req, res) {
    // Handle CORS for multiple origins
    const allowedOrigins = ['https://movies-react.vercel.app', 'http://localhost:5173']; // Add more origins if needed
    const origin = req.headers.origin;
  
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin); // Allow only the specific origin
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    } else {
      res.setHeader('Access-Control-Allow-Origin', ''); // Deny access to others
      return res.status(403).json({ message: 'Forbidden' });
    }
  
    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
  
    if (req.method !== 'GET') {
      return res.status(405).json({ message: 'Method Not Allowed' });
    }
  
    const { url } = req.query;
  
    if (!url) {
      return res.status(400).json({ message: 'Missing m3u8 URL parameter' });
    }
  
    try {
      const response = await fetch(url);
  
      if (!response.ok) {
        return res.status(400).json({ message: 'Failed to fetch m3u8 file' });
      }
  
      const contentType = response.headers.get('content-type');
      const content = await response.text();
  
      // Return the fetched content with appropriate headers
      res.setHeader('Content-Type', contentType);
      return res.status(200).send(content);
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  }
  