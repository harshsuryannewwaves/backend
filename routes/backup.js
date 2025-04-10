const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createBackup } = require('../controllers/backupController');

router.post('/', auth, createBackup);

module.exports = router;
