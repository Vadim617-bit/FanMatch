const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = express();
const port = 3000;
const path = require('path');

// Додати віддавання статичних файлів
app.use(express.static(path.join(__dirname, 'public')));

// Роутинг на HTML-сторінки
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// Middleware
app.use(cors());
app.use(express.json());

// DB
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('Помилка при відкритті бази даних', err);
  } else {
    console.log('Підключено до бази даних SQLite');
  }
});

// Створення таблиць, якщо не існують
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      location TEXT NOT NULL,
      time TEXT NOT NULL,
      creator_id INTEGER NOT NULL,
      FOREIGN KEY (creator_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      FOREIGN KEY (event_id) REFERENCES events(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
});

// 🔹 Simple check route
app.get('/', (req, res) => {
  res.send('FanMatch backend is running!');
});

// 🔹 Реєстрація
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  db.run(
    `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
    [username, email, hashedPassword],
    function (err) {
      if (err) {
        console.error(err.message);
        return res.status(400).json({ error: 'Користувач з такою поштою вже існує' });
      }
      res.status(201).json({ message: 'Користувача створено' });
    }
  );
});

// 🔹 Логін
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Невірний email або пароль' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Невірний email або пароль' });
    }

    const token = jwt.sign({ id: user.id }, 'your_jwt_secret');
    res.json({ token, username: user.username, userId: user.id });
  });
});

// 🔹 Створення події
app.post('/events', (req, res) => {
  const { title, location, time, creatorId } = req.body;

  db.run(
    `INSERT INTO events (title, location, time, creator_id) VALUES (?, ?, ?, ?)`,
    [title, location, time, creatorId],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Помилка при створенні події' });
      }
      res.status(201).json({ eventId: this.lastID });
    }
  );
});

// 🔹 Отримання всіх подій
app.get('/events', (req, res) => {
  db.all(`SELECT events.*, users.username AS creator_name FROM events JOIN users ON events.creator_id = users.id`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Не вдалося отримати події' });
    }
    res.json(rows);
  });
});

// 🔹 Приєднання до події
app.post('/events/:id/join', (req, res) => {
  const eventId = req.params.id;
  const { userId } = req.body;

  // Перевірка, чи вже приєднаний
  db.get(
    `SELECT * FROM participants WHERE event_id = ? AND user_id = ?`,
    [eventId, userId],
    (err, row) => {
      if (row) {
        return res.status(400).json({ error: 'Ви вже приєднані до цієї події' });
      }

      db.run(
        `INSERT INTO participants (event_id, user_id) VALUES (?, ?)`,
        [eventId, userId],
        function (err) {
          if (err) {
            return res.status(500).json({ error: 'Не вдалося приєднатися до події' });
          }
          res.status(201).json({ message: 'Успішно приєднано' });
        }
      );
    }
  );
});

// 🔹 Список учасників події
app.get('/events/:id/participants', (req, res) => {
  const eventId = req.params.id;

  db.all(
    `SELECT users.id, users.username FROM participants JOIN users ON participants.user_id = users.id WHERE participants.event_id = ?`,
    [eventId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Не вдалося отримати учасників' });
      }
      res.json(rows);
    }
  );
});

app.listen(port, () => {
  console.log(`Сервер запущено на http://localhost:${port}`);
});
