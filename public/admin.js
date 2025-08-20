// public/admin.js
// Логіка адмінки: створення / редагування / видалення подій і постів

// ======================= Допоміжні =======================
function getAuthHeaders() {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Будь ласка, увійдіть знову.");
    window.location.href = "/admin-login.html";
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

async function verifyAdmin() {
  try {
    const res = await axios.get('/verify-admin', { headers: getAuthHeaders() });
    if (!res.data.isAdmin) {
      alert("У вас немає прав адміністратора.");
      window.location.href = "/admin-login.html";
    }
  } catch (err) {
    console.error("Помилка перевірки адміністратора:", err);
    window.location.href = "/admin-login.html";
  }
}

function logout() {
  localStorage.clear();
  window.location.href = "/admin-login.html";
}

// ======================= Завантаження списків =======================
async function loadPosts() {
  try {
    const res = await axios.get("/posts", { headers: getAuthHeaders() });
    renderPosts(res.data);
  } catch (err) {
    console.error("Помилка при завантаженні постів:", err);
  }
}

async function loadEvents() {
  try {
    const res = await axios.get("/events", { headers: getAuthHeaders() });
    renderEvents(res.data);
  } catch (err) {
    console.error("Помилка при завантаженні подій:", err);
  }
}

// ======================= Рендер =======================
function renderPosts(posts) {
  const container = document.getElementById("postsList");
  if (!container) return;
  container.innerHTML = "";

  posts.forEach((post) => {
    const div = document.createElement("div");
    div.className = "bg-gray-800 p-4 rounded mb-3";
    div.innerHTML = `
      <h3 class="text-lg font-bold">${post.title}</h3>
      <p>${post.content}</p>
      <div class="mt-2 flex gap-2">
        <button onclick="editPost(${post.id})" class="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded">✏️ Редагувати</button>
        <button onclick="deletePost(${post.id})" class="bg-red-600 hover:bg-red-700 px-2 py-1 rounded">🗑️ Видалити</button>
      </div>
    `;
    container.appendChild(div);
  });
}

function renderEvents(events) {
  const container = document.getElementById("eventsList");
  if (!container) return;
  container.innerHTML = "";

  events.forEach((event) => {
    const div = document.createElement("div");
    div.className = "bg-gray-800 p-4 rounded mb-3";
    div.innerHTML = `
      <h3 class="text-lg font-bold">${event.title}</h3>
      <p>${event.description}</p>
      <p class="text-sm text-gray-400">${event.date || ""}</p>
      <div class="mt-2 flex gap-2">
        <button onclick="editEvent(${event.id})" class="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded">✏️ Редагувати</button>
        <button onclick="deleteEvent(${event.id})" class="bg-red-600 hover:bg-red-700 px-2 py-1 rounded">🗑️ Видалити</button>
      </div>
    `;
    container.appendChild(div);
  });
}

// ======================= CRUD для постів =======================
async function createPost(event) {
  event.preventDefault();
  const title = document.getElementById("postTitle").value;
  const content = document.getElementById("postContent").value;

  try {
    await axios.post("/posts", { title, content }, { headers: getAuthHeaders() });
    document.getElementById("postForm").reset();
    loadPosts();
  } catch (err) {
    console.error("Помилка при створенні поста:", err);
    alert("Не вдалося створити пост");
  }
}

async function editPost(id) {
  const newTitle = prompt("Нова назва:");
  const newContent = prompt("Новий текст:");
  if (!newTitle || !newContent) return;

  try {
    await axios.put(`/posts/${id}`, { title: newTitle, content: newContent }, { headers: getAuthHeaders() });
    loadPosts();
  } catch (err) {
    console.error("Помилка при редагуванні поста:", err);
  }
}

async function deletePost(id) {
  if (!confirm("Видалити пост?")) return;

  try {
    await axios.delete(`/posts/${id}`, { headers: getAuthHeaders() });
    loadPosts();
  } catch (err) {
    console.error("Помилка при видаленні поста:", err);
  }
}

// ======================= CRUD для подій =======================
async function createEvent(event) {
  event.preventDefault();
  const title = document.getElementById("eventTitle").value;
  const description = document.getElementById("eventDescription").value;
  const date = document.getElementById("eventDate").value;

  try {
    await axios.post("/events", { title, description, date }, { headers: getAuthHeaders() });
    document.getElementById("eventForm").reset();
    loadEvents();
  } catch (err) {
    console.error("Помилка при створенні події:", err);
    alert("Не вдалося створити подію");
  }
}

async function editEvent(id) {
  const newTitle = prompt("Нова назва події:");
  const newDescription = prompt("Новий опис:");
  const newDate = prompt("Нова дата (YYYY-MM-DD):");
  if (!newTitle || !newDescription) return;

  try {
    await axios.put(`/events/${id}`, { title: newTitle, description: newDescription, date: newDate }, { headers: getAuthHeaders() });
    loadEvents();
  } catch (err) {
    console.error("Помилка при редагуванні події:", err);
  }
}

async function deleteEvent(id) {
  if (!confirm("Видалити подію?")) return;

  try {
    await axios.delete(`/events/${id}`, { headers: getAuthHeaders() });
    loadEvents();
  } catch (err) {
    console.error("Помилка при видаленні події:", err);
  }
}

// ======================= Ініціалізація =======================
window.addEventListener("DOMContentLoaded", async () => {
  await verifyAdmin();
  loadPosts();
  loadEvents();

  const postForm = document.getElementById("postForm");
  if (postForm) postForm.addEventListener("submit", createPost);

  const eventForm = document.getElementById("eventForm");
  if (eventForm) eventForm.addEventListener("submit", createEvent);
});
