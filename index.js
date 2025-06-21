const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = express();
const port = 3000;
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Створити директорію uploads, якщо не існує
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Налаштування multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});
const upload = multer({ storage });

// Serve uploaded images as static files
app.use('/uploads', express.static(uploadDir));


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

  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      image TEXT,
      creator_id INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (creator_id) REFERENCES users(id)
    )
  `);  
});

// 🔹 Реєстрація
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, row) => {
    if (err) {
      console.error('Помилка при перевірці користувача:', err);
      return res.status(500).json({ error: 'Внутрішня помилка сервера' });
    }

    if (row) {
      return res.status(400).json({ error: 'Користувач з такою поштою вже існує' });
    }

    db.run(
      `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
      [username, email, hashedPassword],
      function (err) {
        if (err) {
          console.error('Помилка при створенні користувача:', err);
          return res.status(500).json({ error: 'Не вдалося створити користувача' });
        }
        res.status(201).json({ message: 'Користувача створено' });
      }
    );
  });
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
app.post('/events', upload.single('image'), (req, res) => {
  const { title, location, time, creatorId } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  if (!title || !location || !time || !creatorId) {
    return res.status(400).json({ error: 'Усі поля обовʼязкові' });
  }

  db.run(
    `INSERT INTO events (title, location, time, creator_id, image) VALUES (?, ?, ?, ?, ?)`,
    [title, location, time, creatorId, imagePath],
    function (err) {
      if (err) {
        console.error('Помилка додавання події:', err.message);
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

// 🔎 Отримання події за ID
app.get('/events/:id', (req, res) => {
  const eventId = req.params.id;

  db.get(
    `SELECT events.*, users.username AS creator_name FROM events JOIN users ON events.creator_id = users.id WHERE events.id = ?`,
    [eventId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Не вдалося отримати подію' });
      }
      if (!row) {
        return res.status(404).json({ error: 'Подію не знайдено' });
      }
      res.json(row);
    }
  );
});


// 🔁 Оновлення події
app.put('/events/:id', (req, res) => {
  const eventId = req.params.id;
  const { title, location, time } = req.body;

  db.run(
    `UPDATE events SET title = ?, location = ?, time = ? WHERE id = ?`,
    [title, location, time, eventId],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Помилка бази даних при оновленні' });
      }
      res.json({ message: 'Оновлено' });
    }
  );
});

// ❌ Видалення події
app.delete('/events/:id', (req, res) => {
  const eventId = req.params.id;

  db.run(
    `DELETE FROM events WHERE id = ?`,
    [eventId],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Помилка при видаленні' });
      }
      res.json({ message: 'Видалено' });
    }
  );
});

// 🔹 Створення поста
app.post('/posts', upload.single('image'), (req, res) => {
  const { title, content, creatorId } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  if (!title || !content || !creatorId) {
    return res.status(400).json({ error: 'Усі поля (крім зображення) обовʼязкові' });
  }

  db.run(
    `INSERT INTO posts (title, content, image, creator_id) VALUES (?, ?, ?, ?)`,
    [title, content, imagePath, creatorId],
    function (err) {
      if (err) {
        console.error('Помилка при створенні поста:', err.message);
        return res.status(500).json({ error: 'Не вдалося створити пост' });
      }
      res.status(201).json({ postId: this.lastID });
    }
  );
});

// 🔹 Отримання всіх постів
app.get('/posts', (req, res) => {
  db.all(`
    SELECT posts.*, users.username AS author
    FROM posts
    JOIN users ON posts.creator_id = users.id
    ORDER BY created_at DESC
  `, [], (err, rows) => {
    if (err) {
      console.error('Помилка при отриманні постів:', err);
      return res.status(500).json({ error: 'Не вдалося отримати пости' });
    }
    res.json(rows);
  });
});


