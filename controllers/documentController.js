const Document = require('../models/Document');
const Version = require('../models/Version');
const AuditLog = require('../models/AuditLog');
const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');
const { exec } = require('child_process');
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
// 📦 OCR helper to extract metadata from file
async function extractMetadataFromOCR(filepath) {
  try {
    const { data: { text } } = await Tesseract.recognize(filepath, 'eng');
    const metadata = {};

    const authorMatch = text.match(/Author[:\-]\s*(.+)/i);
    const typeMatch = text.match(/Type[:\-]\s*(.+)/i);
    const dateMatch = text.match(/Date[:\-]\s*(\d{4}-\d{2}-\d{2})/i);

    if (authorMatch) metadata.author = authorMatch[1].trim();
    if (typeMatch) metadata.type = typeMatch[1].trim();
    if (dateMatch) metadata.date = new Date(dateMatch[1].trim());

    return metadata;
  } catch (err) {
    console.error('OCR failed:', err);
    return {};
  }
}
module.exports.extractMetadataFromOCR = extractMetadataFromOCR;
// 📁 Upload a new document
exports.uploadDocument = async (req, res) => {
  try {
    const file = req.file;
    const { author, type, date } = req.body;

    let ocrData = {};
    if (file.mimetype.startsWith('image')) {
      ocrData = await extractMetadataFromOCR(file.path);
    }

    // Normalize local file path
    const normalizedPath = file.path.replace(/\\/g, '/');

    // Upload to Cloudinary
    const cloudResult = await cloudinary.uploader.upload(file.path, {
      resource_type: "auto",
      folder: "dms_documents",
      public_id: path.parse(file.originalname).name + '-' + Date.now()
    });

    const doc = await Document.create({
      filename: file.originalname,
      filepath: normalizedPath,
      cloudinaryUrl: cloudResult.secure_url,  // Save Cloudinary URL
      author: author || ocrData.author || 'Unknown',
      type: type || ocrData.type || 'Uncategorized',
      date: date || ocrData.date || new Date(),
      version: 1,
      uploadedBy: req.user.username
    });

    await Version.create({
      documentId: doc._id,
      version: 1,
      filename: file.originalname,
      filepath: normalizedPath,
      cloudinaryUrl: cloudResult.secure_url
    });

    await AuditLog.create({
      action: 'UPLOAD',
      user: req.user.username,
      details: `Uploaded document ${file.originalname}`
    });

    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).send('Upload failed');
  }
};


// 📄 Get documents with filters
exports.getDocuments = async (req, res) => {
  try {
    const { author, type, startDate, endDate } = req.query;
    const query = {};
    if (author) query.author = new RegExp(author, 'i');
    if (type) query.type = new RegExp(type, 'i');
    if (startDate || endDate) query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);

    const docs = await Document.find(query);
    res.json(docs);
  } catch (err) {
    console.error(err);
    res.status(500).send('Search failed');
  }
};
exports.getDocumentById = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ msg: 'Not found' });
    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Error retrieving document' });
  }
};
// 🔄 Update (new version) of existing document
exports.updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file; // Optional
    const { author, type, date } = req.body;

    const doc = await Document.findById(id);
    if (!doc) return res.status(404).json({ msg: 'Document not found' });

    let versionUpdated = false;

    if (file) {
      // Push current version to history before updating file
      doc.history.push({
        version: doc.version,
        filepath: doc.filepath,
        updatedAt: new Date()
      });

      const normalizedPath = file.path.replace(/\\/g, '/');
      doc.version += 1;
      doc.filepath = normalizedPath;
      doc.filename = file.originalname;
      versionUpdated = true;
    }

    // Update metadata fields if provided
    if (author) doc.author = author;
    if (type) doc.type = type;
    if (date) doc.date = new Date(date);

    await doc.save();

    await AuditLog.create({
      action: versionUpdated ? 'VERSION_UPDATE' : 'METADATA_UPDATE',
      user: req.user.username,
      details: versionUpdated
        ? `Updated document version for ${doc.filename}`
        : `Updated metadata for document ${doc.filename}`
    });

    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).send('Update failed');
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await Document.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ msg: "Document not found" });

    await AuditLog.create({
      action: 'DELETE',
      user: req.user.username,
      details: `Deleted document ${doc.filename}`
    });

    res.json({ msg: "Document deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Delete failed" });
  }
};

// 🔍 Get version history of a document
exports.getDocumentVersions = async (req, res) => {
  try {
    const versions = await Version.find({ documentId: req.params.id }).sort({ version: 1 });
    res.json(versions);
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to fetch versions');
  }
};

// 📠 Upload scanned document (manual file upload placeholder + OCR)
exports.uploadScannedDocument = async (req, res) => {
  try {
    const timestamp = Date.now();
    const scannedFilename = `scan-${timestamp}.jpg`;
    console.log(scannedFilename);
    const scannedPath = path.join(__dirname, `../scans/${scannedFilename}`);
    fs.writeFileSync(scannedPath,scannedFilename);
    
    // PowerShell script to scan and save to the scans folder
    const psScriptPath = path.join(__dirname, `../scripts/scan-${timestamp}.ps1`);
    const psScriptContent = `
      $deviceManager = new-object -com "WIA.DeviceManager"
      $device = $deviceManager.DeviceInfos.Item(1).Connect()
      $item = $device.Items.Item(1)
      $imageFile = $item.Transfer("{B96B3CAB-0728-11D3-9D7B-0000F81EF32E}")
      $imageFile.SaveFile("${scannedPath.replace(/\\/g, '\\\\')}")
    `;

    fs.writeFileSync(psScriptPath, psScriptContent);

    await new Promise((resolve, reject) => {
      exec(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, (error, stdout, stderr) => {
        fs.unlinkSync(psScriptPath); // clean up the script
        if (error) return reject(stderr || error);
        resolve(stdout);
      });
    });

    const normalizedPath = scannedPath.replace(/\\/g, '/');

    const { author, type, date } = req.body;

    const doc = await Document.create({
      filename: scannedFilename,
      filepath: normalizedPath,
      author: author || 'Unknown',
      type: type || 'Uncategorized',
      date: date || new Date(),
      version: 1,
      uploadedBy: req.user.username
    });

    await Version.create({
      documentId: doc._id,
      version: 1,
      filename: doc.filename,
      filepath: normalizedPath
    });

    await AuditLog.create({
      action: 'SCAN_UPLOAD',
      user: req.user.username,
      details: `Scanned and uploaded document ${doc.filename}`
    });

    res.json(doc);
  } catch (err) {
    console.error("Scan upload failed:", err);
    res.status(500).send('Scan upload failed');
  }
};
exports.stats = async (req, res) => {
  try {
    const totalDocuments = await Document.countDocuments();
    const versionedDocs = await Version.countDocuments();

    const docs = await Document.find({}, 'filepath');

    const fs = require('fs');
    const path = require('path');
    let totalSizeBytes = 0;
    for (const doc of docs) {
      const filePath = path.join(__dirname, '..', doc.filepath.replace(/\\/g, '/'));
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        totalSizeBytes += stat.size;
      }
    }
    res.json({
      totalDocuments,
      versionedDocs,
      totalSizeMB: totalSizeBytes / (1024 * 1024),
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
}