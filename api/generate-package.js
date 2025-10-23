// api/generate-package.js
import { PackageGenerator } from '../lib/package-generator.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { config } = req.body;

    if (!config || !config.mazeRooms || !config.trainingSteps) {
      return res.status(400).json({ error: 'Invalid configuration' });
    }

    const generator = new PackageGenerator();
    const packageInfo = await generator.generatePackage(config);

    // return package id and size
    res.status(200).json({
      success: true,
      packageId: packageInfo.packageId,
      message: 'Package generated successfully',
      downloadUrl: `/api/download/${packageInfo.packageId}`,
      config: packageInfo.config,
      size: packageInfo.size
    });

  } catch (err) {
    console.error('Package generation error (api):', err);
    res.status(500).json({
      error: 'Failed to generate package',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}
