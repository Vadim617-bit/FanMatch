// index.js
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
const cookieParser = require('cookie-parser');

// 🔐 Config
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const COOKIE_NAME = 'fanmatch_token';

// 📂 uploads dir
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// 📸 multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});
const upload = multer({ storage });

// 🧩 middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// static
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, 'public')));

// 🗄️ DB
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) console.error('Помилка при відкритті бази даних', err);
  else {
    console.log('Підключено до бази даних SQLite');
    console.log('📁 Шлях до БД:', path.join(__dirname, 'database.db'));
  }
});

// 🛠️ Міграції + seed адміна
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
      image TEXT,
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

  db.all(`PRAGMA table_info(users)`, [], (err, cols) => {
    if (err) return console.error('PRAGMA error:', err);

    const hasRole = cols.some((c) => c.name === 'role');

    const seedAdmin = () => {
      const adminEmail = 'admin@fanmatch.local';
      const adminPassHash = bcrypt.hashSync('Admin123!', 10);

      db.get(`SELECT id FROM users WHERE email = ?`, [adminEmail], (e1, row) => {
        if (e1) return console.error('Помилка перевірки адміна:', e1);
        if (!row) {
          db.run(
            `INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'admin')`,
            ['Admin', adminEmail, adminPassHash],
            function (e2) {
              if (e2) console.error('Помилка створення адміна:', e2);
              else console.log(`✅ Створено адміністратора: ${adminEmail} / Admin123!`);
            }
          );
        }
      });
    };

    if (!hasRole) {
      db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`, (e2) => {
        if (e2) return console.warn('ALTER users ADD role warning:', e2.message);
        console.log('Колонку role додано до users (default user)');
        seedAdmin();
      });
    } else seedAdmin();
  });
});

// 🔑 helpers
function extractToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.split(' ')[1];
  if (req.cookies && req.cookies[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  return null;
}

function authenticateToken(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Токен відсутній' });
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ error: 'Недійсний або прострочений токен' });
    req.user = payload;
    next();
  });
}

function isAdmin(req, res, next) {
  db.get(`SELECT role FROM users WHERE id = ?`, [req.user?.id], (err, row) => {
    if (err || !row) return res.status(403).json({ error: 'Користувача не знайдено' });
    if (row.role !== 'admin') return res.status(403).json({ error: 'Доступ лише для адміністраторів' });
    next();
  });
}

// 🌐 HTML сторінки
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'public', 'profile.html')));
app.get('/create', (req, res) => res.sendFile(path.join(__dirname, 'public', 'create.html')));

// 🔒 серверний гард адмінки
app.get('/admin', authenticateToken, isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 👤 Auth
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Усі поля обовʼязкові' });

  const hashedPassword = await bcrypt.hash(password, 10);

  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, row) => {
    if (err) return res.status(500).json({ error: 'Внутрішня помилка сервера' });
    if (row) return res.status(400).json({ error: 'Користувач з такою поштою вже існує' });

    db.run(
      `INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'user')`,
      [username, email, hashedPassword],
      function (e2) {
        if (e2) return res.status(500).json({ error: 'Не вдалося створити користувача' });
        res.status(201).json({ message: 'Користувача створено' });
      }
    );
  });
});

// 🔑 Логін по username
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Невірний логін або пароль' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Невірний логін або пароль' });

    const token = jwt.sign({ id: user.id, role: user.role || 'user' }, JWT_SECRET, {
      expiresIn: process.env.TOKEN_EXPIRES || '30d',
    });

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });

    res.json({ token, username: user.username, userId: user.id, role: user.role || 'user' });
  });
});

app.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax', secure: false });
  res.json({ message: 'Вихід виконано' });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get(`SELECT id, username, email, role FROM users WHERE id = ?`, [req.user.id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Не знайдено' });
    res.json(row);
  });
});

// 📅 Events
app.post('/events', authenticateToken, isAdmin, upload.single('image'), (req, res) => {
  const { title, location, time } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  if (!title || !location || !time) return res.status(400).json({ error: 'Усі поля обовʼязкові' });

  db.run(
    `INSERT INTO events (title, location, time, creator_id, image) VALUES (?, ?, ?, ?, ?)`,
    [title, location, time, req.user.id, imagePath],
    function (err) {
      if (err) return res.status(500).json({ error: 'Помилка при створенні події' });
      res.status(201).json({ eventId: this.lastID });
    }
  );
});

app.get('/events', (req, res) => {
  db.all(
    `SELECT events.*, users.username AS creator_name
     FROM events JOIN users ON events.creator_id = users.id`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Не вдалося отримати події' });
      res.json(rows);
    }
  );
});

app.get('/events/:id', (req, res) => {
  const eventId = req.params.id;

  db.get(
    `SELECT events.*, users.username AS creator_name
     FROM events JOIN users ON events.creator_id = users.id
     WHERE events.id = ?`,
    [eventId],
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Не вдалося отримати подію' });
      if (!row) return res.status(404).json({ error: 'Подію не знайдено' });
      res.json(row);
    }
  );
});

app.put('/events/:id', authenticateToken, isAdmin, (req, res) => {
  const eventId = req.params.id;
  const { title, location, time } = req.body;

  db.run(
    `UPDATE events SET title = ?, location = ?, time = ? WHERE id = ?`,
    [title, location, time, eventId],
    function (err) {
      if (err) return res.status(500).json({ error: 'Помилка бази даних при оновленні' });
      res.json({ message: 'Оновлено' });
    }
  );
});

app.delete('/events/:id', authenticateToken, isAdmin, (req, res) => {
  const eventId = req.params.id;

  db.run(`DELETE FROM events WHERE id = ?`, [eventId], function (err) {
    if (err) return res.status(500).json({ error: 'Помилка при видаленні' });
    res.json({ message: 'Видалено' });
  });
});

// 👥 Join
app.post('/events/:id/join', authenticateToken, (req, res) => {
  const eventId = req.params.id;
  const userId = req.user.id;

  db.get(
    `SELECT * FROM participants WHERE event_id = ? AND user_id = ?`,
    [eventId, userId],
    (err, row) => {
      if (row) return res.status(400).json({ error: 'Ви вже приєднані до цієї події' });

      db.run(
        `INSERT INTO participants (event_id, user_id) VALUES (?, ?)`,
        [eventId, userId],
        function (err) {
          if (err) return res.status(500).json({ error: 'Не вдалося приєднатися до події' });
          res.status(201).json({ message: 'Успішно приєднано' });
        }
      );
    }
  );
});

app.get('/events/:id/participants', (req, res) => {
  const eventId = req.params.id;

  db.all(
    `SELECT users.id, users.username
     FROM participants JOIN users ON participants.user_id = users.id
     WHERE participants.event_id = ?`,
    [eventId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Не вдалося отримати учасників' });
      res.json(rows);
    }
  );
});

// 📰 Posts
app.post('/posts', authenticateToken, isAdmin, upload.single('image'), (req, res) => {
  const { title, content } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  if (!title || !content) return res.status(400).json({ error: 'Усі поля (крім зображення) обовʼязкові' });

  db.run(
    `INSERT INTO posts (title, content, image, creator_id) VALUES (?, ?, ?, ?)`,
    [title, content, imagePath, req.user.id],
    function (err) {
      if (err) return res.status(500).json({ error: 'Не вдалося створити пост' });
      res.status(201).json({ postId: this.lastID });
    }
  );
});

app.get('/posts', (req, res) => {
  db.all(
    `SELECT posts.*, users.username AS author
     FROM posts JOIN users ON posts.creator_id = users.id
     ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Не вдалося отримати пости' });
      const postsWithImagePaths = rows.map((post) => {
        if (post.image && !post.image.startsWith('http')) {
          post.image = `${req.protocol}://${req.get('host')}${post.image}`;
        }
        return post;
      });
      res.json(postsWithImagePaths);
    }
  );
});

// 🤖 AI posts (admin)
app.post('/api/ai-posts', authenticateToken, isAdmin, (req, res) => {
  const { title, content, image, author } = req.body;

  if (!title || !content) return res.status(400).json({ error: 'Title and content are required.' });

  db.run(
    `INSERT INTO posts (title, content, image, creator_id) VALUES (?, ?, ?, ?)`,
    [title, content, image || null, req.user.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({
        id: this.lastID,
        title,
        content,
        image: image ? `${req.protocol}://${req.get('host')}${image}` : null,
        author,
      });
    }
  );
});

// proxy до /posts
app.get('/api/posts', (req, res) => {
  db.all(
    `SELECT posts.*, users.username AS author
     FROM posts JOIN users ON posts.creator_id = users.id
     ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Не вдалося отримати пости' });
      const postsWithImagePaths = rows.map((post) => {
        if (post.image && !post.image.startsWith('http')) {
          post.image = `${req.protocol}://${req.get('host')}${post.image}`;
        }
        return post;
      });
      res.json(postsWithImagePaths);
    }
  );
});

// 🚀 start
app.listen(port, () => {
  console.log(`Сервер запущено на http://localhost:${port}`);
});
