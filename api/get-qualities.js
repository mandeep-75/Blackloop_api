export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
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
  