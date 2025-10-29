import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  const dir = path.join(process.cwd(), "package-template");
  try {
    const files = fs.readdirSync(dir);
    res.status(200).json({ exists: true, count: files.length, files });
  } catch (err) {
    res.status(404).json({ exists: false, error: err.message });
  }
}
