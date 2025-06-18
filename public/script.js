const token = localStorage.getItem('token');
const userId = localStorage.getItem('userId');
const username = localStorage.getItem('username');

const userInfoElement = document.getElementById('userInfo');
const eventsListElement = document.getElementById('eventsList');

// ================== Вивід імені користувача ==================
if (userId && username) {
  userInfoElement.innerHTML = `Вітаємо, ${username}!`;
} else {
  userInfoElement.innerHTML = 'Будь ласка, увійдіть в систему.';
}

// ================== Вихід з системи ==================
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
  localStorage.removeItem('username');
  window.location.href = 'login.html';
}

// ================== Створення подій =================
async function createEvent(e) {
  e.preventDefault();

  const title = document.getElementById('title').value;
  const location = document.getElementById('location').value;
  const time = document.getElementById('date_time').value;
  const image = document.getElementById('image').files[0];
  const creatorId = localStorage.getItem('userId');

  const formData = new FormData();
  formData.append('title', title);
  formData.append('location', location);
  formData.append('time', time);
  formData.append('creatorId', creatorId);
  if (image) {
    formData.append('image', image);
  }

  try {
    const res = await fetch('/events', {
      method: 'POST',
      body: formData
    });

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
    const response = await axios.get('http://localhost:3000/events');
    const events = response.data;

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

// ================== Приєднання до події ==================
async function joinEvent(eventId) {
  try {
    const response = await axios.post(`http://localhost:3000/events/${eventId}/join`, { userId });
    alert(response.data.message);
  } catch (error) {
    console.error('Не вдалося приєднатися до події', error);
  }
}

// ================== Видалення події ==================
async function deleteEvent(eventId) {
  try {
    await axios.delete(`http://localhost:3000/events/${eventId}`);
    alert('Подію видалено');
    loadEvents();
  } catch (error) {
    console.error('Не вдалося видалити подію', error);
  }
}

// ================== Відкриття форми редагування ==================
async function editEvent(eventId) {
  try {
    const response = await axios.get(`http://localhost:3000/events/${eventId}`);
    const event = response.data;

    document.getElementById('editEventId').value = event.id;
    document.getElementById('editTitle').value = event.title;
    document.getElementById('editLocation').value = event.location;
    document.getElementById('editTime').value = event.time;

    document.getElementById('editEventModal').classList.remove('hidden');
  } catch (error) {
    console.error('Помилка при завантаженні події для редагування', error);
  }
}

// ================== Збереження змін події ==================
async function saveEventChanges(e) {
  e.preventDefault();
  const eventId = document.getElementById('editEventId').value;
  const title = document.getElementById('editTitle').value;
  const location = document.getElementById('editLocation').value;
  const time = document.getElementById('editTime').value;

  try {
    await axios.put(`http://localhost:3000/events/${eventId}`, { title, location, time });
    alert('Подію оновлено!');
    loadEvents();
    closeEditModal();
  } catch (error) {
    console.error('Помилка при оновленні події', error);
  }
}

// ================== Закриття модального вікна ==================
function closeEditModal() {
  document.getElementById('editEventModal').classList.add('hidden');
}

// ================== Обробка подій форми редагування ==================
document.getElementById('editEventForm')?.addEventListener('submit', saveEventChanges);
document.getElementById('closeEditModal')?.addEventListener('click', closeEditModal);

// ================== Завантажити події при завантаженні ==================
window.onload = loadEvents;

// 👤 Навігація: показати/сховати кнопки залежно від входу
window.addEventListener('DOMContentLoaded', () => {
  const username = localStorage.getItem('username');
  if (username) {
    document.getElementById('profileLink').style.display = 'inline-block';
    document.getElementById('createLink').style.display = 'inline-block';
    document.getElementById('logoutBtn').style.display = 'inline-block';
  }
});

// 🚪 Вихід
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
  localStorage.removeItem('username');
  window.location.href = '/login';
}

