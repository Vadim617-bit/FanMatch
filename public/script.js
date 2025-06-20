// ================== Дані користувача ==================
const token = localStorage.getItem('token');
const userId = localStorage.getItem('userId');
const username = localStorage.getItem('username');

const userInfoElement = document.getElementById('userInfo');
const eventsListElement = document.getElementById('eventsList');

if (userInfoElement) {
  if (userId && username) {
    userInfoElement.innerHTML = `Вітаємо, ${username}!`;
  } else {
    userInfoElement.innerHTML = 'Будь ласка, увійдіть в систему.';
  }
}

// ================== Вихід з системи ==================
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
  localStorage.removeItem('username');
  window.location.href = '/login';
}

// ================== Створення подій ==================
async function createEvent(e) {
  e.preventDefault();

  const title = document.getElementById('title').value;
  const location = document.getElementById('location').value;
  const time = document.getElementById('date_time').value;
  const image = document.getElementById('image')?.files[0];
  const creatorId = localStorage.getItem('userId');

  const formData = new FormData();
  formData.append('title', title);
  formData.append('location', location);
  formData.append('time', time);
  formData.append('creatorId', creatorId);
  if (image) formData.append('image', image);

  try {
    const res = await fetch('/events', { method: 'POST', body: formData });
    const data = await res.json();

    if (res.ok) {
      alert('Подію створено!');
      window.location.href = '/';
    } else {
      alert(data.error || 'Помилка створення події');
    }
  } catch (err) {
    console.error(err);
    alert('Помилка зʼєднання з сервером');
  }
}

// ================== Перехід на створення подій ==================
document.getElementById('createEventBtn')?.addEventListener('click', () => {
  window.location.href = 'create.html';
});

// ================== Завантаження подій ==================
async function loadEvents() {
  try {
    const response = await axios.get('/events');
    const events = response.data;
    if (!eventsListElement) return;
    eventsListElement.innerHTML = '';

    events.forEach(event => {
      const eventDiv = document.createElement('div');
      eventDiv.className = 'bg-black bg-opacity-60 border border-green-600 rounded-2xl p-5 shadow-lg transition hover:scale-[1.01]';

      const eventHTML = `
        ${event.image ? `<img src="${event.image}" alt="Зображення події" class="w-full h-48 object-cover rounded mb-3">` : ''}
        <h3 class="text-xl font-bold text-green-300 mb-2">⚽ ${event.title}</h3>
        <p class="text-white"><span class="mr-1">📍</span> ${event.location}</p>
        <p class="text-white"><span class="mr-1">⏰</span> ${new Date(event.time).toLocaleString()}</p>
        <p class="text-sm text-gray-400 italic mt-1">👤 ${event.creator_name}</p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button onclick="joinEvent(${event.id})" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Приєднатись</button>
          ${event.creator_name === username ? `
            <button onclick="editEvent(${event.id})" class="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded">Редагувати</button>
            <button onclick="deleteEvent(${event.id})" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">Видалити</button>
          ` : ''}
        </div>
      `;

      eventDiv.innerHTML = eventHTML;
      eventsListElement.appendChild(eventDiv);
    });
  } catch (error) {
    console.error('Помилка при завантаженні подій:', error);
  }
}

// ================== Завантаження постів ==================
async function loadPosts() {
  const container = document.getElementById('postsContainer');
  if (!container) {
    console.warn('postsContainer не знайдено');
    return;
  }

  try {
    const res = await axios.get('/posts');
    const posts = res.data;

    console.log('Отримані пости:', posts);

    container.innerHTML = '';

    posts.forEach(post => {
      const postEl = document.createElement('div');
      postEl.className = 'bg-black bg-opacity-50 rounded-xl p-5 shadow-md';

      postEl.innerHTML = `
        ${post.image ? `<img src="${post.image}" alt="Зображення поста" class="w-full max-h-96 object-cover rounded mb-4">` : ''}
        <h3 class="text-2xl font-bold text-green-300 mb-2">${post.title.replace(/^"|"$/g, '')}</h3>
        <p class="text-white mb-2">${post.content.replace(/^"|"$/g, '')}</p>
        <p class="text-sm text-gray-400 italic">👤 ${post.author} | 🕒 ${new Date(post.created_at).toLocaleString()}</p>
      `;

      container.appendChild(postEl);
    });
  } catch (err) {
    console.error('Помилка при завантаженні постів:', err);
  }
}

// ================== Автозапуск ==================
window.onload = () => {
  if (eventsListElement) loadEvents();
  if (document.getElementById('postsContainer')) loadPosts();
};

// ================== Дії з подіями ==================
async function joinEvent(eventId) {
  try {
    const response = await axios.post(`/events/${eventId}/join`, { userId });
    alert(response.data.message);
  } catch (error) {
    console.error('Не вдалося приєднатися до події', error);
  }
}

async function deleteEvent(eventId) {
  try {
    await axios.delete(`/events/${eventId}`);
    alert('Подію видалено');
    loadEvents();
  } catch (error) {
    console.error('Не вдалося видалити подію', error);
  }
}

async function editEvent(eventId) {
  try {
    const response = await axios.get(`/events/${eventId}`);
    const event = response.data;
    document.getElementById('editEventId').value = event.id;
    document.getElementById('editTitle').value = event.title;
    document.getElementById('editLocation').value = event.location;
    document.getElementById('editTime').value = event.time;
    document.getElementById('editEventModal')?.classList.remove('hidden');
  } catch (error) {
    console.error('Помилка при завантаженні події для редагування', error);
  }
}

async function saveEventChanges(e) {
  e.preventDefault();
  const eventId = document.getElementById('editEventId').value;
  const title = document.getElementById('editTitle').value;
  const location = document.getElementById('editLocation').value;
  const time = document.getElementById('editTime').value;

  try {
    await axios.put(`/events/${eventId}`, { title, location, time });
    alert('Подію оновлено!');
    loadEvents();
    closeEditModal();
  } catch (error) {
    console.error('Помилка при оновленні події', error);
  }
}

function closeEditModal() {
  document.getElementById('editEventModal')?.classList.add('hidden');
}

document.getElementById('editEventForm')?.addEventListener('submit', saveEventChanges);
document.getElementById('closeEditModal')?.addEventListener('click', closeEditModal);

// ================== Показати кнопки в шапці ==================
window.addEventListener('DOMContentLoaded', () => {
  if (username) {
    document.getElementById('profileLink')?.classList.remove('hidden');
    document.getElementById('createLink')?.classList.remove('hidden');
    document.getElementById('logoutBtn')?.classList.remove('hidden');
  }
});

// ================== Створення постів ==================
const postForm = document.getElementById('postForm');
if (postForm) {
  postForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    const image = document.getElementById('postImage').files[0];
    const creatorId = localStorage.getItem('userId');

    const formData = new FormData();
    formData.append('title', title);
    formData.append('content', content);
    formData.append('creatorId', creatorId);
    if (image) formData.append('image', image);

    try {
      const res = await fetch('/posts', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (res.ok) {
        alert('Пост створено успішно!');
        window.location.href = '/posts.html';
      } else {
        alert(data.error || 'Помилка при створенні поста');
      }
    } catch (err) {
      console.error('Помилка запиту:', err);
      alert('Не вдалося зʼєднатися з сервером');
    }
  });
}
