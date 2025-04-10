const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

const {
  uploadDocument,
  getDocuments,
  updateDocument,
  getDocumentVersions,
  extractMetadataFromOCR,
  scanDocument,
  deleteDocument,
  getDocumentById,
  stats,
  uploadScannedDocument
} = require('../controllers/documentController');

// 📤 Upload new document
router.post('/upload', auth, upload.single('file'), uploadDocument);

// 🔍 Get documents with optional filters
router.get('/', auth, getDocuments);

// 🔄 Update document (new version)
router.post('/update/:id', auth, upload.single('file'), updateDocument);
router.get('/stats',auth,stats);
// 📜 Get document version history
router.get('/:id/versions', auth, getDocumentVersions);
router.get('/:id', auth, getDocumentById);

router.post('/ocr', auth, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file.mimetype.startsWith("image")) return res.status(400).json({ error: "Only images supported" });

    const metadata = await extractMetadataFromOCR(file.path);
    res.json(metadata);
  } catch (err) {
    console.error("OCR API error", err);
    res.status(500).json({ error: "OCR failed" });
  }
});
// 📠 Scan document via scanner
router.post('/scan', auth, upload.single('file'), uploadScannedDocument);
// router.post('/scan', auth, scanDocument);
router.delete('/:id', auth, deleteDocument);

module.exports = router;
