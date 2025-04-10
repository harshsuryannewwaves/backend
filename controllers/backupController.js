const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const archiver = require("archiver");
const cloudinary = require("cloudinary").v2;

// Cloudinary config (make sure these are set in your .env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.createBackup = async (req, res) => {
  const backupDir = process.env.BACKUP_DIR;
  const mongoUri = process.env.MONGO_URI;

  if (!backupDir || !mongoUri) {
    return res.status(500).json({ msg: "Missing BACKUP_DIR or MONGO_URI" });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFolder = path.join(backupDir, `backup-${timestamp}`);
  const zipPath = path.join(backupDir, `backup-${timestamp}.zip`);

  const dumpCommand = `mongodump --uri="${mongoUri}" --out="${backupFolder}"`;

  exec(dumpCommand, async (err) => {
    if (err) return res.status(500).json({ msg: "Backup failed", error: err.message });

    // Create ZIP of the backup folder
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);
    archive.directory(backupFolder, false);
    await archive.finalize();

    output.on("close", async () => {
      try {
        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(zipPath, {
          resource_type: "raw", // use raw for non-image files
          folder: "dms_backups",
          public_id: `backup-${timestamp}`,
        });

        // Cleanup local files (optional)
        fs.rmSync(backupFolder, { recursive: true, force: true });
        fs.unlinkSync(zipPath);

        res.json({ msg: "Backup successful", cloudinaryUrl: result.secure_url });
      } catch (cloudErr) {
        res.status(500).json({ msg: "Cloudinary upload failed", error: cloudErr.message });
      }
    });
  });
};
