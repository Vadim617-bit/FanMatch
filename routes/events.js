const express = require('express');
const db = require('../db/database');
const jwt = require('jsonwebtoken');
const router = express.Router();

const SECRET_KEY = 'supersecret123';

// Middleware для перевірки токена
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader ? authHeader.split(' ')[1] : null;
  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
}

// 🔹 Створити подію
router.post('/', authenticateToken, (req, res) => {
  const { title, team1, team2, date_time, location, description, max_participants, imageUrl } = req.body;

  // Check for required fields
  if (!title || !team1 || !team2 || !date_time || !location) {
    return res.status(400).json({ error: 'Всі обов’язкові поля повинні бути заповнені' });
  }

  db.run(
    `INSERT INTO events (title, team1, team2, date_time, location, description, max_participants, creator_id, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, team1, team2, date_time, location, description, max_participants, req.user.userId, imageUrl],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ eventId: this.lastID });
    }
  );
});

// 🔹 Отримати список подій
router.get('/', (req, res) => {
  db.all(`SELECT * FROM events ORDER BY date_time ASC`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// 🔹 Приєднатися до події
router.post('/:id/join', authenticateToken, (req, res) => {
  const eventId = req.params.id;
  const userId = req.user.userId;

  db.get(`SELECT * FROM event_participants WHERE event_id = ? AND user_id = ?`, [eventId, userId], (err, existing) => {
    if (existing) {
      return res.status(400).json({ error: 'Ви вже приєдналися' });
    }

    db.run(
      `INSERT INTO event_participants (event_id, user_id) VALUES (?, ?)`,
      [eventId, userId],
      function (err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
      }
    );
  });
});

// 🔹 Отримати учасників події
router.get('/:id/participants', (req, res) => {
  const eventId = req.params.id;

  db.all(
    `SELECT users.id, users.name, users.favorite_team, users.location
     FROM users
     JOIN event_participants ON users.id = event_participants.user_id
     WHERE event_participants.event_id = ?`,
    [eventId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

module.exports = router;
