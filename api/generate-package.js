// api/generate-package.js
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

// init supabase using env vars (service role key)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.warn('Supabase env vars not set. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false }
});

// Helper functions (adapted from your generator)
// REPLACE your old readDirectoryRecursive function with this one

async function readDirectoryRecursive(dir) {
  const files = [];
  async function scan(current) {
    // 1. Read just the names from the directory
    const items = await fsp.readdir(current); 
    
    for (const item of items) {
      // 2. Skip filtered folders
      if (item === 'node_modules' || item === '.git' || item === '__pycache__') continue;
      
      const full = path.join(current, item);

      // 3. Use fsp.stat() which follows symlinks
      const stats = await fsp.stat(full);

      // 4. This will now be TRUE for the 'game' symlink
      if (stats.isDirectory()) { 
        await scan(full); // Recurse into the directory
      } else {
        files.push(full); // Add the file
      }
    }
  }
  await scan(dir);
  return files;
}

function isTextFile(filename) {
  const textExtensions = ['.txt', '.py', '.js', '.json', '.html', '.css', '.md', '.bat', '.sh', '.command', '.xml', '.yaml', '.yml'];
  const binaryExtensions = ['.exe', '.dll', '.so', '.dylib', '.zip', '.jpg', '.png', '.gif', '.ico', '.ttf', '.woff', '.woff2'];
  const ext = path.extname(filename).toLowerCase();
  if (binaryExtensions.includes(ext)) return false;
  return true;
}

function customizeFile(content, config, filename) {
  let customized = content;
  if (filename === 'train_sphere_agent.py') {
    customized = customized.replace(/total_timesteps\s*=\s*\d+/, `total_timesteps = ${config.trainingSteps}`);
    customized = customized.replace(/maze_rooms\s*=\s*\d+/, `maze_rooms = ${config.mazeRooms}`);
    customized = customized.replace(/algorithm\s*=\s*["'][^"']*["']/, `algorithm = "${config.algorithm}"`);
  }

  if (filename.endsWith('.js')) {
    customized = customized.replace(/mazeRooms:\s*\d+/, `mazeRooms: ${config.mazeRooms}`);
    customized = customized.replace(/trainingSteps:\s*\d+/, `trainingSteps: ${config.trainingSteps}`);
    customized = customized.replace(/algorithm:\s*['"][^'"]*['"]/, `algorithm: '${config.algorithm}'`);
  }

  if (filename === 'INSTRUCTIONS.txt' || filename === 'INSTRUCTIONS.TXT') {
    customized = customized.replace(/{{MAZE_ROOMS}}/g, String(config.mazeRooms));
    customized = customized.replace(/{{TRAINING_STEPS}}/g, String(config.trainingSteps));
    customized = customized.replace(/{{ALGORITHM}}/g, String(config.algorithm));
    customized = customized.replace(/{{GENERATION_DATE}}/g, new Date().toLocaleString());
  }

  return customized;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const config = req.body?.config;
  if (!config || !config.mazeRooms || !config.trainingSteps) {
    res.status(400).json({ error: 'Invalid configuration' });
    return;
  }

  // Make sure template exists in the deployed project
  const templateDir = path.join(process.cwd(), 'package-template');
  try {
    await fsp.access(templateDir);
  } catch (err) {
    console.error('Template directory missing:', templateDir, err);
    res.status(500).json({ error: 'Template directory not found on server' });
    return;
  }

  const packageId = uuidv4();
  const tmpZipPath = path.join('/tmp', `${packageId}.zip`);
  const output = fs.createWriteStream(tmpZipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  // handle archive errors
  archive.on('error', (err) => {
    console.error('Archive error:', err);
    try { res.status(500).json({ error: 'Archive error', details: err.message }); } catch (e) {}
  });

  // Pipe archive into the temp file
  archive.pipe(output);

  try {
    // read all files from template
    const files = await readDirectoryRecursive(templateDir);
    if (!files.length) throw new Error('No files in template directory');

    for (const file of files) {
      const relativePath = path.relative(templateDir, file);
      if (isTextFile(file)) {
        let content = await fsp.readFile(file, 'utf8');
        content = customizeFile(content, config, path.basename(file));
        archive.append(content, { name: relativePath });
      } else {
        archive.file(file, { name: relativePath });
      }
    }

    await archive.finalize();

    // Wait for output stream to finish writing
    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
    });

    // Upload to Supabase Storage 'packages' bucket
    const filename = `RLMazeTrainer_${packageId}.zip`;
    const fileBuffer = await fsp.readFile(tmpZipPath);

    const { data, error: uploadError } = await supabase.storage
      .from('packages')
      .upload(filename, fileBuffer, { contentType: 'application/zip', upsert: true });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      // cleanup tmp
      try { await fsp.unlink(tmpZipPath); } catch (e) {}
      return res.status(500).json({ error: 'Upload failed', details: uploadError.message || uploadError });
    }

    // Build public URL
    const { data: publicData } = supabase.storage.from('packages').getPublicUrl(filename);
    const publicUrl = publicData?.publicUrl || `${SUPABASE_URL}/storage/v1/object/public/packages/${filename}`;

    // Optionally delete local tmp file (cleanup)
    try { await fsp.unlink(tmpZipPath); } catch (e) { /* ignore */ }

    // Respond with the public URL
    return res.status(200).json({
      success: true,
      packageId,
      downloadUrl: publicUrl
    });

  } catch (err) {
    console.error('Generate/upload error:', err);
    try { await fsp.unlink(tmpZipPath); } catch (e) {}
    return res.status(500).json({ error: 'Failed to generate package', details: err.message });
  }
}
