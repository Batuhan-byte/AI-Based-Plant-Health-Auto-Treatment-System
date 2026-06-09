const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// /api/auth/register
router.post('/register', authController.register);

// /api/auth/login
router.post('/login', authController.login);

// /api/auth/guest
router.post('/guest', authController.guest);

// /api/auth/upgrade
router.post('/upgrade', authController.upgrade);

module.exports = router;
