// Start of Selection
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

// 🔐 NEW: з .env або фолбек
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

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

app.get('/create', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'create.html'));
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
    console.log('📁 Шлях до БД:', path.join(__dirname, 'database.db'));
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
      -- role додаємо нижче через ALTER TABLE, щоб не ламати існуючі інсталяції
    )
  `);

  // 🔧 NEW: додати колонку role, якщо її ще немає
  db.get(`PRAGMA table_info(users)`, [], (err) => {
    if (err) {
      console.error('PRAGMA error:', err);
    } else {
      db.all(`PRAGMA table_info(users)`, [], (_e, cols) => {
        const hasRole = cols?.some(c => c.name === 'role');
        if (!hasRole) {
          db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`, (e2) => {
            if (e2) console.warn('ALTER users ADD role warning:', e2.message);
            else console.log('Колонку role додано до users (default user)');
          });
        }
      });
    }
  });

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
});

// 🔐 NEW: seed admin (разово створить, якщо немає)
(function seedAdminOnce() {
  const adminEmail = 'admin@fanmatch.local';
  const adminPassHash = bcrypt.hashSync('Admin123!', 10); // ⚠️ заміни пароль у продакшні

  db.get(`SELECT id FROM users WHERE email = ?`, [adminEmail], (err, row) => {
    if (err) {
      console.error('Помилка перевірки адміна:', err);
      return;
    }
    if (!row) {
      db.run(
        `INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'admin')`,
        ['Admin', adminEmail, adminPassHash],
        function (e2) {
          if (e2) console.error('Помилка створення адміна:', e2);
          else console.log(`✅ Створено адміністратора: ${adminEmail} / Admin123! (заміни)`);
        }
      );
    }
  });
})();

// 🔒 NEW: JWT middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Токен відсутній' });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ error: 'Недійсний або прострочений токен' });
    req.user = payload; // { id, role }
    next();
  });
}

// 🔒 NEW: перевірка ролі admin
function isAdmin(req, res, next) {
  // Довіряємось JWT, але перепровіримо в БД (на випадок зміни ролі)
  db.get(`SELECT role FROM users WHERE id = ?`, [req.user?.id], (err, row) => {
    if (err || !row) return res.status(403).json({ error: 'Користувача не знайдено' });
    if (row.role !== 'admin') return res.status(403).json({ error: 'Доступ лише для адміністраторів' });
    next();
  });
}

// 🔹 Реєстрація
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Усі поля обовʼязкові' });
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
      `INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'user')`,
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

// 🔹 Логін (оновлено: додаємо role у відповідь і в токен)
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

    // 🔐 NEW: підписуємо { id, role } єдиним секретом
    const token = jwt.sign({ id: user.id, role: user.role || 'user' }, JWT_SECRET, {
      expiresIn: process.env.TOKEN_EXPIRES || '30d'
    });
    res.json({ token, username: user.username, userId: user.id, role: user.role || 'user' });
  });
});

// 🔹 Створення події (ЗАХИСТ: тільки адмін)
app.post('/events', authenticateToken, isAdmin, upload.single('image'), (req, res) => {
  const { title, location, time, creatorId } = req.body; // creatorId лишаємо для сумісності
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  if (!title || !location || !time) {
    return res.status(400).json({ error: 'Усі поля обовʼязкові' });
  }

  const creator_id = req.user?.id || creatorId; // пріоритет — токен
  db.run(
    `INSERT INTO events (title, location, time, creator_id, image) VALUES (?, ?, ?, ?, ?)`,
    [title, location, time, creator_id, imagePath],
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

// 🔹 Приєднання до події (ЗАХИСТ: потрібен акаунт)
app.post('/events/:id/join', authenticateToken, (req, res) => {
  const eventId = req.params.id;
  const userId = req.user.id; // перестаємо довіряти body

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

// 🔁 Оновлення події (ЗАХИСТ: тільки адмін)
app.put('/events/:id', authenticateToken, isAdmin, (req, res) => {
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

// ❌ Видалення події (ЗАХИСТ: тільки адмін)
app.delete('/events/:id', authenticateToken, isAdmin, (req, res) => {
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

// 🔹 Створення поста (ЗАХИСТ: тільки адмін)
app.post('/posts', authenticateToken, isAdmin, upload.single('image'), (req, res) => {
  const { title, content, creatorId } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  if (!title || !content) {
    return res.status(400).json({ error: 'Усі поля (крім зображення) обовʼязкові' });
  }

  const creator_id = req.user?.id || creatorId; // пріоритет токену
  db.run(
    `INSERT INTO posts (title, content, image, creator_id) VALUES (?, ?, ?, ?)`,
    [title, content, imagePath, creator_id],
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
    // Ensure image paths are correctly prefixed for client access
    const postsWithImagePaths = rows.map(post => {
      if (post.image && !post.image.startsWith('http')) {
        post.image = `${req.protocol}://${req.get('host')}${post.image}`;
      }
      return post;
    });
    res.json(postsWithImagePaths);
  });
});

// ✅ Новий маршрут для AI-новин (ЗАХИСТ: тільки адмін / для Make)
app.post('/api/ai-posts', authenticateToken, isAdmin, (req, res) => {
  const { title, content, image, author } = req.body;

  console.log('📥 AI POST DATA:', { title, content, image, author });

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required.' });
  }

  const creatorIdFromToken = req.user?.id || 1; // fallback, але має бути з токену
  db.run(
    'INSERT INTO posts (title, content, image, creator_id) VALUES (?, ?, ?, ?)',
    [title, content, image || null, creatorIdFromToken],
    function (err) {
      if (err) {
        console.error('❌ SQLite error:', err.message);
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        id: this.lastID,
        title,
        content,
        image: image ? `${req.protocol}://${req.get('host')}${image}` : null, // Ensure image path is correctly prefixed
        author
      });
    }
  );
});

// Проксі для /api/posts (альтернативний шлях до /posts)
app.get('/api/posts', (req, res) => {
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
    const postsWithImagePaths = rows.map(post => {
      if (post.image && !post.image.startsWith('http')) {
        post.image = `${req.protocol}://${req.get('host')}${post.image}`;
      }
      return post;
    });
    res.json(postsWithImagePaths);
  });
});
