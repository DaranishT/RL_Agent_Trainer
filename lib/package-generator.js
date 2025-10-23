// lib/package-generator.js
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import archiver from 'archiver';

export class PackageGenerator {
  constructor() {
    // On Vercel serverless: process.cwd() is project root (where your package-template will be deployed)
    this.templateDir = path.join(process.cwd(), 'package-template'); // expects this folder to be included in deployment
    this.outputDir = '/tmp'; // serverless writable tmp dir

    this.ensureDirectoriesCalled = false;
  }

  async ensureDirectories() {
    if (this.ensureDirectoriesCalled) return;
    this.ensureDirectoriesCalled = true;

    try {
      await fsp.access(this.templateDir);
      // no-op if exists
    } catch (err) {
      console.error('Template directory not found:', this.templateDir);
      throw new Error(`Template directory not found: ${this.templateDir}`);
    }
  }

  async generatePackage(userConfig) {
    await this.ensureDirectories();

    const packageId = uuidv4();
    const outputPath = path.join(this.outputDir, `${packageId}.zip`);

    return new Promise(async (resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      let fileCount = 0;

      output.on('close', () => {
        const sizeMB = Math.round(archive.pointer() / 1024 / 1024);
        resolve({
          packageId,
          filePath: outputPath,
          size: sizeMB,
          fileCount,
          config: userConfig
        });
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.on('entry', () => { fileCount++; });

      archive.pipe(output);

      try {
        const files = await this.readDirectoryRecursive(this.templateDir);

        if (!files.length) throw new Error('No files in template directory');

        for (const file of files) {
          const relativePath = path.relative(this.templateDir, file);
          try {
            const isText = this.isTextFile(file);
            if (isText) {
              let content = await fsp.readFile(file, 'utf8');
              content = this.customizeFile(content, userConfig, path.basename(file));
              archive.append(content, { name: relativePath });
            } else {
              archive.file(file, { name: relativePath });
            }
          } catch (e) {
            // fallback: attach file raw
            archive.file(file, { name: relativePath });
          }
        }

        await archive.finalize();
      } catch (err) {
        reject(err);
      }
    });
  }

  isTextFile(filename) {
    const textExtensions = ['.txt', '.py', '.js', '.json', '.html', '.css', '.md', '.bat', '.sh', '.command', '.xml', '.yaml', '.yml'];
    const binaryExtensions = ['.exe', '.dll', '.so', '.dylib', '.zip', '.jpg', '.png', '.gif', '.ico', '.ttf', '.woff', '.woff2'];

    const ext = path.extname(filename).toLowerCase();
    if (binaryExtensions.includes(ext)) return false;
    // default to text
    return true;
  }

  customizeFile(content, config, filename) {
    let customized = content;

    // Examples of replacements (kept from your original logic)
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

  async readDirectoryRecursive(dir) {
    const files = [];

    async function scan(current) {
      const items = await fsp.readdir(current, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(current, item.name);
        if (item.name === 'node_modules' || item.name === '.git' || item.name === '__pycache__') continue;
        if (item.isDirectory()) await scan(full);
        else files.push(full);
      }
    }

    await scan(dir);
    return files;
  }
}
