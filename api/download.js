import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
    const { packageId } = req.query;

    if (!packageId) {
        return res.status(400).json({ error: 'Package ID required' });
    }

    try {
        const filePath = path.join(process.cwd(), 'generated-packages', `${packageId}.zip`);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Package not found' });
        }

        // Set headers for file download
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="RLMazeTrainer_${packageId}.zip"`);
        
        // Stream the file
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
        
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Download failed' });
    }
}// api/download.js
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // For Vercel functions: method can be GET with query param ?packageId=...
  const packageId = req.query.packageId || req.query['packageId'] || req.query['packageid'];

  if (!packageId) {
    res.status(400).json({ error: 'Package ID required' });
    return;
  }

  try {
    // We write packages to /tmp on serverless platforms
    const filePath = path.join('/tmp', `${packageId}.zip`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Package not found' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="RLMazeTrainer_${packageId}.zip"`);
    res.setHeader('Content-Length', fs.statSync(filePath).size);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);

    stream.on('error', (err) => {
      console.error('File stream error (api/download):', err);
      try { res.status(500).end(); } catch (e) {}
    });

  } catch (err) {
    console.error('Download error (api):', err);
    res.status(500).json({ error: 'Download failed' });
  }
}
