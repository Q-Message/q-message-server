const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const usersModel = require('../models/users');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/authMiddleware');

// Rutas de contactos aquí

module.exports = router;
