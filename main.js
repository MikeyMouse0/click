// === Настройки ===
const API_URL = "https://your-bot-server.com/api/verify-token"; // адрес FastAPI

// --- Хранилище ---
function getData() {
  return JSON.parse(localStorage.getItem('steamkeydrop_data') || '{}');
}
function setData(data) {
  localStorage.setItem('steamkeydrop_data', JSON.stringify(data));
}
function resetData() {
  localStorage.removeItem('steamkeydrop_data');
  localStorage.removeItem('steamkeydrop_current_user');
}

// --- Модели ---
function getUser(id) {
  const data = getData();
  return data.users?.[id] || null;
}
function saveUser(user) {
  const data = getData();
  data.users = data.users || {};
  data.users[user.id] = user;
  setData(data);
}
function getAllUsers() {
  const data = getData();
  return Object.values(data.users || {});
}
function getCaseKeys(type) {
  const data = getData();
  return data.caseKeys?.[type] || [];
}
function addCaseKeys(type, keys) {
  const data = getData();
  data.caseKeys = data.caseKeys || {};
  data.caseKeys[type] = data.caseKeys[type] || [];
  data.caseKeys[type].push(...keys);
  setData(data);
}
function removeCaseKey(type, key) {
  const data = getData();
  data.caseKeys = data.caseKeys || {};
  data.caseKeys[type] = data.caseKeys[type] || [];
  data.caseKeys[type] = data.caseKeys[type].filter(k => k !== key);
  setData(data);
}
function getPromocodes() {
  const data = getData();
  return data.promocodes || [];
}
function addPromocode(promo) {
  const data = getData();
  data.promocodes = data.promocodes || [];
  data.promocodes.push(promo);
  setData(data);
}
function updatePromocode(code, update) {
  const data = getData();
  data.promocodes = data.promocodes || [];
  const idx = data.promocodes.findIndex(p => p.code === code);
  if (idx !== -1) Object.assign(data.promocodes[idx], update);
  setData(data);
}
function addLog(entry) {
  const data = getData();
  data.logs = data.logs || [];
  data.logs.unshift(entry);
  if (data.logs.length > 100) data.logs.length = 100;
  setData(data);
}
function getLogs() {
  const data = getData();
  return data.logs || [];
}
function setLastActivity(id) {
  const data = getData();
  data.lastActivity = data.lastActivity || {};
  data.lastActivity[id] = Date.now();
  setData(data);
}
function getLastActivity() {
  const data = getData();
  return data.lastActivity || {};
}

// --- Генерация кода ---
function generateCode(len = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// --- Telegram токен ---
function getTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('token');
}
async function verifyToken(token) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });
  return await res.json();
}

// --- UI ---
const CASE_TYPES = [
  { name: 'Обычный', chance: 0.7 },
  { name: 'Эпичный', chance: 0.2 },
  { name: 'Золотой', chance: 0.1 }
];
const ADMIN_IDS = ['808001329', '6201881953', '7079704828'];

const app = document.getElementById('app');
let currentUser = null;
let currentTab = 'market'; // market, profile, other, admin

function renderTabs() {
  let tabs = [
    { id: 'market', label: 'Маркет' },
    { id: 'profile', label: 'Профиль' },
    { id: 'other', label: 'Другое' }
  ];
  if (currentUser && currentUser.isAdmin) {
    tabs.push({ id: 'admin', label: 'Админ' });
  }
  return `
    <div class="tabs">
      ${tabs.map(tab => `
        <button class="tab${currentTab === tab.id ? ' active' : ''}" id="tab-${tab.id}">${tab.label}</button>
      `).join('')}
    </div>
  `;
}

function saveCurrentUserSession(id) {
  localStorage.setItem('steamkeydrop_current_user', id);
}
function clearCurrentUserSession() {
  localStorage.removeItem('steamkeydrop_current_user');
}
function getCurrentUserSession() {
  return localStorage.getItem('steamkeydrop_current_user');
}

function renderMain() {
  setLastActivity(currentUser.id);
  app.innerHTML = renderTabs() + `<div id="tab-content"></div>`;
  // Навигация по вкладкам
  ['market', 'profile', 'other', 'admin'].forEach(tab => {
    const btn = document.getElementById('tab-' + tab);
    if (btn) btn.onclick = () => { currentTab = tab; renderMain(); };
  });
  // Контент вкладки
  if (currentTab === 'market') renderMarket();
  else if (currentTab === 'profile') renderProfile();
  else if (currentTab === 'other') renderOther();
  else if (currentTab === 'admin') renderAdmin();
}

function renderMarket() {
  document.getElementById('tab-content').innerHTML = `
    <div class="card">
      <h3>Маркет</h3>
      <div>Ваш баланс рефералов: <b>${currentUser.balance}</b></div>
      <button id="buyCaseBtn">Открыть кейс (5 рефералов)</button>
      <button id="promoUseBtn">Активировать промокод</button>
      <div id="marketResult"></div>
    </div>
  `;
  document.getElementById('buyCaseBtn').onclick = () => {
    if (currentUser.balance < 5) {
      document.getElementById('marketResult').innerHTML = 'Недостаточно рефералов!';
      return;
    }
    let roll = Math.random();
    let acc = 0, caseType = CASE_TYPES[0].name;
    for (let ct of CASE_TYPES) {
      acc += ct.chance;
      if (roll < acc) { caseType = ct.name; break; }
    }
    let keys = getCaseKeys(caseType);
    if (!keys.length) {
      document.getElementById('marketResult').innerHTML = `Ключи для ${caseType} кейса закончились!`;
      return;
    }
    const key = keys[Math.floor(Math.random() * keys.length)];
    removeCaseKey(caseType, key);
    currentUser.balance -= 5;
    currentUser.keys += 1;
    saveUser(currentUser);
    addLog({ time: new Date().toLocaleString(), text: `${currentUser.id} открыл ${caseType} кейс: ${key}` });
    document.getElementById('marketResult').innerHTML = `Вам выпал <b>${caseType}</b> кейс!<br>Ваш ключ: <span class="case-key">${key}</span>`;
  };
  document.getElementById('promoUseBtn').onclick = () => {
    const code = prompt('Введите промокод:');
    if (!code) return;
    const promo = getPromocodes().find(p => p.code === code);
    if (!promo) {
      document.getElementById('marketResult').innerHTML = 'Промокод не найден!';
      return;
    }
    if (promo.uses >= promo.max_uses) {
      document.getElementById('marketResult').innerHTML = 'Промокод исчерпан!';
      return;
    }
    updatePromocode(code, { uses: promo.uses + 1 });
    if (promo.reward_type === 'referrals') {
      currentUser.balance += Number(promo.reward_value);
      saveUser(currentUser);
      addLog({ time: new Date().toLocaleString(), text: `${currentUser.id} активировал промокод ${code}: +${promo.reward_value} рефералов` });
      document.getElementById('marketResult').innerHTML = `Промокод активирован! +${promo.reward_value} рефералов.`;
    } else if (promo.reward_type === 'case') {
      let caseType = promo.reward_value;
      if (caseType === 'Рандомный') {
        let roll = Math.random();
        let acc = 0;
        for (let ct of CASE_TYPES) {
          acc += ct.chance;
          if (roll < acc) { caseType = ct.name; break; }
        }
      }
      let keys = getCaseKeys(caseType);
      if (!keys.length) {
        document.getElementById('marketResult').innerHTML = `Ключи для ${caseType} кейса закончились!`;
        return;
      }
      const key = keys[Math.floor(Math.random() * keys.length)];
      removeCaseKey(caseType, key);
      currentUser.keys += 1;
      saveUser(currentUser);
      addLog({ time: new Date().toLocaleString(), text: `${currentUser.id} активировал промокод ${code}: ${caseType} кейс - ${key}` });
      document.getElementById('marketResult').innerHTML = `Промокод активирован! Ваш ${caseType} кейс: <span class="case-key">${key}</span>`;
    }
  };
}

function renderProfile() {
  const refLink = location.href.split('#')[0] + `?ref=${currentUser.ref_code}`;
  document.getElementById('tab-content').innerHTML = `
    <div class="card">
      <h3>Профиль</h3>
      <div>Имя: <b>${currentUser.username || currentUser.id}</b> ${currentUser.isAdmin ? '<span class="admin">admin</span>' : ''}</div>
      <div>Рефералов: <b>${currentUser.balance}</b></div>
      <div>Куплено кейсов: <b>${currentUser.keys}</b></div>
      <div>Ваша реферальная ссылка:<br>
        <input value="${refLink}" readonly style="width:100%">
      </div>
      <button id="logoutBtn">Выйти</button>
    </div>
  `;
  document.getElementById('logoutBtn').onclick = () => { 
    clearCurrentUserSession();
    currentUser = null; 
    location.href = location.pathname; // сбросить токен
  };
}

function renderOther() {
  document.getElementById('tab-content').innerHTML = `
    <div class="card">
      <h3>Другое</h3>
      <button id="bonusBtn">Бонусы</button>
      <button id="helpBtn">Помощь</button>
      <div id="otherContent"></div>
    </div>
  `;
  document.getElementById('bonusBtn').onclick = renderBonus;
  document.getElementById('helpBtn').onclick = renderHelp;
}

function renderBonus() {
  const refLink = location.href.split('#')[0] + `?ref=${currentUser.ref_code}`;
  document.getElementById('otherContent').innerHTML = `
    <div class="card">
      <h3>Бонусы</h3>
      <div>Приглашайте друзей по ссылке и получайте рефералы!</div>
      <div>Ваша реферальная ссылка:<br>
        <input value="${refLink}" readonly style="width:100%">
      </div>
      <div>За 5 рефералов — 1 кейс.</div>
    </div>
  `;
}

function renderHelp() {
  document.getElementById('otherContent').innerHTML = `
    <div class="card">
      <h3>Помощь</h3>
      <ul>
        <li>Как часто добавляются ключи? — Админ добавляет вручную.</li>
        <li>Можно ли обменять ключ? — Нет.</li>
        <li>Почему не засчитан реферал? — Возможно, друг уже был зарегистрирован.</li>
      </ul>
    </div>
  `;
}

function renderAdmin() {
  document.getElementById('tab-content').innerHTML = `
    <div class="card">
      <h3>Админ-панель</h3>
      <button id="addKeysBtn">Добавить ключи</button>
      <button id="promoBtn">Создать промокод</button>
      <button id="allKeysBtn">Список ключей</button>
      <button id="usersBtn">Пользователи</button>
      <button id="broadcastBtn">Рассылка</button>
      <button id="searchUserBtn">Поиск пользователя</button>
      <button id="onlineBtn">Онлайн</button>
      <button id="logsBtn">Логи</button>
      <button id="sendRefBtn">Передать рефералы</button>
      <div id="adminContent"></div>
    </div>
  `;
  document.getElementById('addKeysBtn').onclick = renderAddKeys;
  document.getElementById('promoBtn').onclick = renderPromo;
  document.getElementById('allKeysBtn').onclick = renderAllKeys;
  document.getElementById('usersBtn').onclick = renderUsers;
  document.getElementById('broadcastBtn').onclick = renderBroadcast;
  document.getElementById('searchUserBtn').onclick = renderSearchUser;
  document.getElementById('onlineBtn').onclick = renderOnline;
  document.getElementById('logsBtn').onclick = renderLogs;
  document.getElementById('sendRefBtn').onclick = renderSendReferrals;
}

// ... (оставшиеся функции renderAddKeys, renderPromo, renderAllKeys, renderUsers, renderBroadcast, renderSendReferrals, renderSearchUser, renderOnline, renderLogs — смотри предыдущие версии, они не изменились)


// --- Запуск ---
(async function() {
  // 1. Проверка токена Telegram
  const token = getTokenFromUrl();
  if (!token) {
    app.innerHTML = `
      <div class="card" style="margin:40px auto;text-align:center;">
        <h2>Авторизация</h2>
        <p>Для входа получите ссылку у <b>Telegram-бота</b>.</p>
      </div>
    `;
    return;
  }
  const result = await verifyToken(token);
  if (!result.ok) {
    app.innerHTML = `
      <div class="card" style="margin:40px auto;text-align:center;">
        <h2>Ошибка</h2>
        <p>Токен недействителен или устарел.<br>Получите новую ссылку у бота.</p>
      </div>
    `;
    return;
  }
  // 2. Авторизация успешна!
  let id = String(result.user_id);
  let user = getUser(id);
  if (!user) {
    user = {
      id,
      username: result.username,
      balance: 0,
      keys: 0,
      ref_code: generateCode(),
      refferer_id: null,
      isAdmin: ADMIN_IDS.includes(id)
    };
  } else {
    user.isAdmin = ADMIN_IDS.includes(id);
    user.username = result.username;
  }
  saveUser(user);
  currentUser = user;
  setLastActivity(currentUser.id);
  saveCurrentUserSession(currentUser.id);
  currentTab = 'market';
  renderMain();
})();
