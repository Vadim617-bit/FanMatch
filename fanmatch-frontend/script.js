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
      eventDiv.classList.add('bg-white', 'p-4', 'rounded-lg', 'shadow');
      eventDiv.innerHTML = `
        <h3 class="font-semibold">${event.title}</h3>
        <p>Місце: ${event.location}</p>
        <p>Час: ${event.time}</p>
        <p>Створено: ${event.creator_name}</p>
        <button onclick="joinEvent(${event.id})" class="bg-blue-500 text-white px-4 py-2 rounded mt-2">Приєднатися</button>
        ${event.creator_name === username ? `
          <button onclick="editEvent(${event.id})" class="bg-yellow-500 text-white px-4 py-2 rounded mt-2">Редагувати</button>
          <button onclick="deleteEvent(${event.id})" class="bg-red-500 text-white px-4 py-2 rounded mt-2">Видалити</button>
        ` : ''}
      `;
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
