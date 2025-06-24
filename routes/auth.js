const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const router = express.Router();

const SECRET_KEY = process.env.SECRET_KEY || 'supersecret123'; // краще зберігати в .env

// 🔹 Реєстрація
router.post('/register', (req, res) => {
  const { name, email, password, favorite_team, location } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Всі поля обов’язкові' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  const query = `INSERT INTO users (name, email, password_hash, favorite_team, location) VALUES (?, ?, ?, ?, ?)`;
  db.run(query, [name, email, hashedPassword, favorite_team, location], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Користувач уже існує або помилка' });
    }

    const token = jwt.sign({ userId: this.lastID }, SECRET_KEY, { expiresIn: '7d' });
    res.json({ token, userId: this.lastID });
  });
});

// 🔹 Логін
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email та пароль обов’язкові' });
  }

  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (err || !user) {
      return res.status(400).json({ error: 'Користувача не знайдено' });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Невірний пароль' });
    }

    const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '7d' });
    res.json({ token, userId: user.id });
  });
});

// 🔹 Створення події
router.post('/events', (req, res) => {
  const { title, location, time, creatorId } = req.body;
  if (!title || !location || !time || !creatorId) {
    return res.status(400).json({ error: 'Усі поля обовʼязкові' });
  }

  const query = `INSERT INTO events (title, location, time, creator_id) VALUES (?, ?, ?, ?)`;
  db.run(query, [title, location, time, creatorId], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Помилка створення події' });
    }
    res.json({ eventId: this.lastID });
  });
});

// 🔹 Отримання постів
router.get('/posts', (req, res) => {
  db.all(`SELECT * FROM posts`, [], (err, posts) => {
    if (err) {
      return res.status(500).json({ error: 'Помилка отримання постів' });
    }
    res.json(posts);
  });
});

module.exports = router;
