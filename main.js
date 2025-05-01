// --- Константы ---
const ADMIN_IDS = ['808001329', '6201881953', '7079704828'];
const CASE_TYPES = [
  { name: 'Обычный', chance: 0.7 },
  { name: 'Эпичный', chance: 0.2 },
  { name: 'Золотой', chance: 0.1 }
];

// --- Хранилище ---
function getData() {
  return JSON.parse(localStorage.getItem('steamkeydrop_data') || '{}');
}
function setData(data) {
  localStorage.setItem('steamkeydrop_data', JSON.stringify(data));
}
function resetData() {
  localStorage.removeItem('steamkeydrop_data');
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

// --- UI ---
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

function renderLogin() {
  app.innerHTML = `
    <h2>Steam Key Drop</h2>
    <form id="loginForm" class="card">
      <label>Ваш ID или ник:<br><input id="loginId" required></label><br>
      <label>Реферальный код (необязательно):<br><input id="refCode"></label><br>
      <button>Войти</button>
    </form>
    <button id="resetBtn" style="margin-top:10px;">Сбросить все данные</button>
  `;
  document.getElementById('loginForm').onsubmit = e => {
    e.preventDefault();
    const id = document.getElementById('loginId').value.trim();
    let user = getUser(id);
    if (!user) {
      user = { id, balance: 0, keys: 0, ref_code: generateCode(), refferer_id: null, isAdmin: ADMIN_IDS.includes(id), online: true };
    } else {
      user.isAdmin = ADMIN_IDS.includes(id);
    }
    saveUser(user);
    if (!user.refferer_id) {
      const ref = document.getElementById('refCode').value.trim();
      if (ref) {
        const refUser = getAllUsers().find(u => u.ref_code === ref && u.id !== id);
        if (refUser) {
          refUser.balance += 1;
          saveUser(refUser);
          user.refferer_id = refUser.id;
          saveUser(user);
          addLog({ time: new Date().toLocaleString(), text: `Пользователь ${id} зарегистрировался по реф. коду ${ref}` });
        }
      }
    }
    currentUser = user;
    setLastActivity(currentUser.id);
    currentTab = 'market';
    renderMain();
  };
  document.getElementById('resetBtn').onclick = () => {
    if (confirm('Сбросить все данные?')) {
      resetData();
      location.reload();
    }
  };
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
      <div>Имя: <b>${currentUser.id}</b> ${currentUser.isAdmin ? '<span class="admin">admin</span>' : ''}</div>
      <div>Рефералов: <b>${currentUser.balance}</b></div>
      <div>Куплено кейсов: <b>${currentUser.keys}</b></div>
      <div>Ваша реферальная ссылка:<br>
        <input value="${refLink}" readonly style="width:100%">
      </div>
      <button id="logoutBtn">Выйти</button>
    </div>
  `;
  document.getElementById('logoutBtn').onclick = () => { currentUser = null; renderLogin(); };
}

function renderOther() {
  document.getElementById('tab-content').innerHTML = `
    <div class="card">
      <h3>Другое</h3>
      <button id="bonusBtn">Бонусы</button>
      <button id="logsBtn">Логи</button>
      <button id="sendRefBtn">Отправить рефералы</button>
      <button id="helpBtn">Помощь</button>
      <div id="otherContent"></div>
    </div>
  `;
  document.getElementById('bonusBtn').onclick = renderBonus;
  document.getElementById('logsBtn').onclick = renderLogs;
  document.getElementById('sendRefBtn').onclick = renderSendReferrals;
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

function renderLogs() {
  const logs = getLogs();
  document.getElementById('otherContent').innerHTML = `
    <div class="card">
      <h3>Логи</h3>
      <div>${logs.map(l => `<div class="log">${l.time}: ${l.text}</div>`).join('') || 'Логов нет.'}</div>
    </div>
  `;
}

function renderSendReferrals() {
  document.getElementById('otherContent').innerHTML = `
    <div class="card">
      <h3>Отправить рефералы</h3>
      <form id="sendRefForm">
        <label>ID получателя:<br><input id="refRecipient"></label><br>
        <label>Сколько рефералов:<br><input id="refAmount" type="number" min="1"></label><br>
        <button>Отправить</button>
      </form>
      <div id="sendRefResult"></div>
    </div>
  `;
  document.getElementById('sendRefForm').onsubmit = e => {
    e.preventDefault();
    const recipientId = document.getElementById('refRecipient').value.trim();
    const amount = Number(document.getElementById('refAmount').value);
    if (!recipientId || !amount || amount <= 0) {
      document.getElementById('sendRefResult').innerHTML = 'Введите корректные данные!';
      return;
    }
    if (recipientId === currentUser.id) {
      document.getElementById('sendRefResult').innerHTML = 'Нельзя отправить себе!';
      return;
    }
    const recipient = getUser(recipientId);
    if (!recipient) {
      document.getElementById('sendRefResult').innerHTML = 'Пользователь не найден!';
      return;
    }
    if (currentUser.balance < amount) {
      document.getElementById('sendRefResult').innerHTML = 'Недостаточно рефералов!';
      return;
    }
    currentUser.balance -= amount;
    saveUser(currentUser);
    recipient.balance += amount;
    saveUser(recipient);
    addLog({ time: new Date().toLocaleString(), text: `${currentUser.id} отправил ${amount} рефералов пользователю ${recipientId}` });
    document.getElementById('sendRefResult').innerHTML = `Успешно отправлено!`;
  };
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
}

function renderAddKeys() {
  document.getElementById('adminContent').innerHTML = `
    <div class="card">
      <h3>Добавить ключи</h3>
      <form id="addKeysForm">
        <label>Тип кейса:
          <select id="caseTypeSel">
            ${CASE_TYPES.map(ct => `<option>${ct.name}</option>`).join('')}
          </select>
        </label><br>
        <label>Ключи (через пробел):<br>
          <input id="keysInput" style="width:100%">
        </label><br>
        <button>Добавить</button>
      </form>
      <div id="addKeysResult"></div>
    </div>
  `;
  document.getElementById('addKeysForm').onsubmit = e => {
    e.preventDefault();
    const type = document.getElementById('caseTypeSel').value;
    const keys = document.getElementById('keysInput').value.trim().split(/\s+/).filter(Boolean);
    if (!keys.length) {
      document.getElementById('addKeysResult').innerHTML = 'Введите ключи!';
      return;
    }
    addCaseKeys(type, keys);
    addLog({ time: new Date().toLocaleString(), text: `Админ добавил ключи в ${type}: ${keys.join(', ')}` });
    document.getElementById('addKeysResult').innerHTML = `Добавлено ключей: ${keys.length}`;
  };
}

function renderPromo() {
  document.getElementById('adminContent').innerHTML = `
    <div class="card">
      <h3>Создать промокод</h3>
      <form id="promoForm">
        <label>Тип награды:
          <select id="promoType">
            <option value="referrals">Рефералы</option>
            <option value="case">Кейс</option>
          </select>
        </label><br>
        <label id="promoValueLabel">Значение:<br>
          <input id="promoValue" value="1">
        </label><br>
        <label>Максимум использований:<br>
          <input id="promoMax" value="1" type="number" min="1">
        </label><br>
        <label>Код (оставьте пустым для авто):<br>
          <input id="promoCode">
        </label><br>
        <button>Создать</button>
      </form>
      <div id="promoResult"></div>
    </div>
  `;
  document.getElementById('promoType').onchange = function() {
    if (this.value === 'referrals') {
      document.getElementById('promoValueLabel').innerHTML = 'Сколько рефералов:<br><input id="promoValue" value="1">';
    } else {
      document.getElementById('promoValueLabel').innerHTML = 'Тип кейса:<br><select id="promoValue">' + CASE_TYPES.map(ct => `<option>${ct.name}</option>`).join('') + '<option>Рандомный</option></select>';
    }
  };
  document.getElementById('promoForm').onsubmit = e => {
    e.preventDefault();
    const type = document.getElementById('promoType').value;
    const value = document.getElementById('promoValue').value;
    const max = Number(document.getElementById('promoMax').value);
    let code = document.getElementById('promoCode').value.trim() || generateCode();
    if (getPromocodes().some(p => p.code === code)) {
      document.getElementById('promoResult').innerHTML = 'Такой промокод уже существует!';
      return;
    }
    addPromocode({ code, reward_type: type, reward_value: value, max_uses: max, uses: 0 });
    addLog({ time: new Date().toLocaleString(), text: `Админ создал промокод ${code} (${type}: ${value}, макс: ${max})` });
    document.getElementById('promoResult').innerHTML = `Промокод создан: <b>${code}</b>`;
  };
}

function renderAllKeys() {
  document.getElementById('adminContent').innerHTML = `
    <div class="card">
      <h3>Список ключей</h3>
      ${CASE_TYPES.map(ct => {
        const keys = getCaseKeys(ct.name);
        return `<div><b>${ct.name} (${keys.length}):</b><br>${keys.join(', ') || 'Пусто'}</div>`;
      }).join('<br>')}
    </div>
  `;
}

function renderUsers() {
  const users = getAllUsers();
  document.getElementById('adminContent').innerHTML = `
    <div class="card">
      <h3>Пользователи</h3>
      <ul>
        ${users.map(u => `<li>${u.id} — рефералов: ${u.balance}, кейсов: ${u.keys}, реф. код: ${u.ref_code}${u.isAdmin ? ' <span class="admin">admin</span>' : ''}</li>`).join('')}
      </ul>
    </div>
  `;
}

function renderBroadcast() {
  document.getElementById('adminContent').innerHTML = `
    <div class="card">
      <h3>Рассылка</h3>
      <form id="broadcastForm">
        <textarea id="broadcastMsg" rows="3" style="width:100%" placeholder="Текст рассылки"></textarea><br>
        <button type="submit">Отправить</button>
      </form>
      <div id="broadcastResult"></div>
    </div>
  `;
  document.getElementById('broadcastForm').onsubmit = e => {
    e.preventDefault();
    const msg = document.getElementById('broadcastMsg').value.trim();
    if (!msg) {
      document.getElementById('broadcastResult').innerHTML = 'Введите текст!';
      return;
    }
    const users = getAllUsers();
    users.forEach(u => {
      addLog({
        time: new Date().toLocaleString(),
        text: `Рассылка для ${u.id}: ${msg}`
      });
    });
    document.getElementById('broadcastResult').innerHTML = `Рассылка отправлена ${users.length} пользователям (в логах).`;
  };
}

function renderSearchUser() {
  document.getElementById('adminContent').innerHTML = `
    <div class="card">
      <h3>Поиск пользователя</h3>
      <form id="searchUserForm">
        <label>ID пользователя:<br><input id="searchUserId"></label><br>
        <button>Найти</button>
      </form>
      <div id="searchUserResult"></div>
    </div>
  `;
  document.getElementById('searchUserForm').onsubmit = e => {
    e.preventDefault();
    const id = document.getElementById('searchUserId').value.trim();
    const user = getUser(id);
    if (!user) {
      document.getElementById('searchUserResult').innerHTML = 'Пользователь не найден!';
      return;
    }
    document.getElementById('searchUserResult').innerHTML = `
      <div class="card">
        <b>ID:</b> ${user.id}<br>
        <b>Рефералов:</b> ${user.balance}<br>
        <b>Кейсов:</b> ${user.keys}<br>
        <b>Реф. код:</b> ${user.ref_code}<br>
        ${user.isAdmin ? '<span class="admin">admin</span>' : ''}
      </div>
    `;
  };
}

function renderOnline() {
  const lastActivity = getLastActivity();
  const now = Date.now();
  const onlineUsers = Object.entries(lastActivity)
    .filter(([id, ts]) => now - ts < 10 * 60 * 1000)
    .map(([id]) => id);
  document.getElementById('adminContent').innerHTML = `
    <div class="card">
      <h3>Онлайн (за 10 минут):</h3>
      ${onlineUsers.length ? onlineUsers.join(', ') : 'Нет активных пользователей.'}
    </div>
  `;
}

// --- Запуск ---
(function() {
  const params = new URLSearchParams(location.search);
  const ref = params.get('ref');
  if (!currentUser) renderLogin();
  if (ref) setTimeout(() => {
    const refInput = document.getElementById('refCode');
    if (refInput) refInput.value = ref;
  }, 100);
})();
