const express = require('express');
const router = express.Router();
const upload = require('../middlewares/uploadMiddleware');
const diagnoseController = require('../controllers/diagnoseController');

// POST /api/diagnose - Fotoğraf yükle ve AI tahmin al
router.post('/diagnose', upload.single('image'), diagnoseController.diagnose);

// GET /api/labels - Desteklenen etiket listesi
router.get('/labels', diagnoseController.getLabels);

// GET /api/history - Teşhis geçmişini listele
router.get('/history', diagnoseController.getHistory);

// DELETE /api/history/:id - Teşhis kaydını sil
router.delete('/history/:id', diagnoseController.deleteHistory);

module.exports = router;
