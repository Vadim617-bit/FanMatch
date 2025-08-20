// ================== Ініціалізація ==================
let token = localStorage.getItem('token');
let userId = localStorage.getItem('userId');
let username = localStorage.getItem('username');
let isAdmin = localStorage.getItem('isAdmin') === 'true';

const userInfoEl = document.getElementById('userInfo');
const eventsListEl = document.getElementById('eventsList');
const postsContainerEl = document.getElementById('postsContainer');
const messageEl = document.getElementById('message');

// Показ користувача
if (userInfoEl) {
  userInfoEl.textContent = username ? `Вітаємо, ${username}!` : 'Будь ласка, увійдіть';
}

// ================== Навігація ==================
window.addEventListener('DOMContentLoaded', () => {
  if (username) {
    ['profileLink', 'logoutBtn'].forEach(id => document.getElementById(id)?.classList.remove('hidden'));
    if (isAdmin) {
      document.getElementById('createLink')?.classList.remove('hidden');
      document.getElementById('adminLink')?.classList.remove('hidden');
    }
  }

  // Встановлюємо мінімальну дату для datetime-local
  const dateInput = document.getElementById('date_time');
  if (dateInput) {
    dateInput.min = new Date().toISOString().slice(0, 16);
  }
});

function logout() {
  localStorage.clear();
  window.location.href = '/login';
}

// ================== Повідомлення ==================
function showMessage(msg, type = 'info') {
  if (!messageEl) return;
  messageEl.textContent = msg;
  messageEl.className = type === 'error' ? 'text-red-500' : 'text-green-400';
  setTimeout(() => messageEl.textContent = '', 4000);
}

// ================== Створення події ==================
async function createEvent(e) {
  e.preventDefault();
  if (!token || !isAdmin) {
    showMessage('Ви не авторизовані або не маєте прав адміністратора.', 'error');
    return window.location.href = '/login';
  }

  const form = e.target;
  const formData = new FormData(form);

  try {
    const res = await axios.post('/events', formData, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    showMessage('Подію створено успішно!');
    form.reset();
    loadEvents();
  } catch (err) {
    console.error(err);
    showMessage(err.response?.data?.error || 'Помилка створення події', 'error');
  }
}

// ================== Створення поста ==================
async function createPost(e) {
  e.preventDefault();
  if (!token || !isAdmin) {
    showMessage('Ви не авторизовані або не маєте прав адміністратора.', 'error');
    return window.location.href = '/login';
  }

  const form = e.target;
  const formData = new FormData(form);

  try {
    const res = await axios.post('/posts', formData, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    showMessage('Пост створено успішно!');
    form.reset();
    loadPosts();
  } catch (err) {
    console.error(err);
    showMessage(err.response?.data?.error || 'Помилка створення поста', 'error');
  }
}

// ================== Завантаження подій ==================
async function loadEvents() {
  if (!eventsListEl) return;
  try {
    const res = await axios.get('/events', { headers: { 'Authorization': `Bearer ${token}` } });
    const events = res.data;
    eventsListEl.innerHTML = '';

    events.forEach(event => {
      const div = document.createElement('div');
      div.className = 'bg-black bg-opacity-60 border border-green-600 rounded-2xl p-5 shadow-lg transition hover:scale-[1.01]';

      div.innerHTML = `
        ${event.image ? `<img src="${event.image}" class="w-full h-48 object-cover rounded mb-3">` : ''}
        <h3 class="text-xl font-bold text-green-300 mb-2">⚽ ${event.title}</h3>
        <p class="text-white">📍 ${event.location}</p>
        <p class="text-white">⏰ ${new Date(event.time).toLocaleString()}</p>
        <p class="text-sm text-gray-400 italic">👤 ${event.creator_name}</p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button onclick="joinEvent(${event.id})" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Приєднатись</button>
          ${event.creator_name?.toLowerCase() === username?.toLowerCase() ? `
            <button onclick="editEvent(${event.id})" class="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded">Редагувати</button>
            <button onclick="deleteEvent(${event.id})" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">Видалити</button>
          ` : ''}
        </div>
      `;
      eventsListEl.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    showMessage('Помилка завантаження подій', 'error');
  }
}

// ================== Завантаження постів ==================
async function loadPosts() {
  if (!postsContainerEl) return;
  try {
    const res = await axios.get('/posts', { headers: { 'Authorization': `Bearer ${token}` } });
    postsContainerEl.innerHTML = '';
    res.data.forEach(post => {
      const div = document.createElement('div');
      div.className = 'bg-black bg-opacity-50 rounded-xl p-5 shadow-md mb-4';
      div.innerHTML = `
        ${post.image || post.image_url ? `<img src="${post.image || post.image_url}" class="w-full max-h-96 object-cover rounded mb-4">` : ''}
        <h3 class="text-2xl font-bold text-green-300 mb-2">${post.title}</h3>
        <p class="text-white mb-2">${post.content}</p>
        <p class="text-sm text-gray-400 italic">👤 ${post.author} | 🕒 ${new Date(post.created_at).toLocaleString()}</p>
      `;
      postsContainerEl.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    showMessage('Помилка завантаження постів', 'error');
  }
}

// ================== Приєднання ==================
async function joinEvent(eventId) {
  try {
    const res = await axios.post(`/events/${eventId}/join`, { userId }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    showMessage(res.data.message || 'Приєднано до події');
  } catch (err) {
    console.error(err);
    showMessage('Не вдалося приєднатися', 'error');
  }
}

// ================== Видалення ==================
async function deleteEvent(eventId) {
  try {
    await axios.delete(`/events/${eventId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    showMessage('Подію видалено');
    loadEvents();
  } catch (err) {
    console.error(err);
    showMessage('Не вдалося видалити подію', 'error');
  }
}

// ================== Редагування ==================
async function editEvent(eventId) {
  try {
    const res = await axios.get(`/events/${eventId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const event = res.data;

    document.getElementById('editEventId').value = event.id;
    document.getElementById('editTitle').value = event.title;
    document.getElementById('editLocation').value = event.location;
    document.getElementById('editTime').value = new Date(event.time).toISOString().slice(0, 16);
    document.getElementById('editEventModal')?.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    showMessage('Не вдалося завантажити подію для редагування', 'error');
  }
}

async function saveEventChanges(e) {
  e.preventDefault();
  const id = document.getElementById('editEventId').value;
  const title = document.getElementById('editTitle').value;
  const location = document.getElementById('editLocation').value;
  const time = document.getElementById('editTime').value;

  try {
    await axios.put(`/events/${id}`, { title, location, time }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    showMessage('Подію оновлено');
    closeEditModal();
    loadEvents();
  } catch (err) {
    console.error(err);
    showMessage('Помилка оновлення події', 'error');
  }
}

function closeEditModal() {
  document.getElementById('editEventModal')?.classList.add('hidden');
}

// ================== Події ==================
document.getElementById('createForm')?.addEventListener('submit', createEvent);
document.getElementById('postForm')?.addEventListener('submit', createPost);
document.getElementById('editEventForm')?.addEventListener('submit', saveEventChanges);
document.getElementById('closeEditModal')?.addEventListener('click', closeEditModal);

// ================== Завантаження при старті ==================
window.onload = () => {
  loadEvents();
  loadPosts();
};
