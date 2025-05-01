// --- Константы ---
const ADMIN_IDS = ['admin']; // id админов
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

function renderLogin() {
  app.innerHTML = `
    <h2>Steam Key Drop</h2>
    <form id="loginForm">
      <label>Ваш ID или ник: <input id="loginId" required></label><br>
      <label>Реферальный код (необязательно): <input id="refCode"></label><br>
      <button>Войти</button>
    </form>
    <button id="resetBtn" style="margin-top:10px;">Сбросить все данные</button>
  `;
  document.getElementById('loginForm').onsubmit = e => {
    e.preventDefault();
    const id = document.getElementById('loginId').value.trim();
    let user = getUser(id);
    if (!user) {
      user = { id, balance: 0, keys: 0, ref_code: generateCode(), refferer_id: null, isAdmin: ADMIN_IDS.includes(id) };
      saveUser(user);
      // Реферал
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
  let html = `
    <h2>Steam Key Drop</h2>
    <div>Вы вошли как <b>${currentUser.id}</b> ${currentUser.isAdmin ? '<span class="admin">(админ)</span>' : ''}</div>
    <button id="profileBtn">Профиль</button>
    <button id="bonusBtn">Бонусы</button>
    <button id="marketBtn">Маркет</button>
    <button id="helpBtn">Помощь</button>
    <button id="logsBtn">Логи</button>
    <button id="logoutBtn" style="float:right;">Выйти</button>
    <hr>
  `;
  if (currentUser.isAdmin) {
    html += `
      <div><b>Админ-панель:</b></div>
      <button id="addKeysBtn">Добавить ключи</button>
      <button id="promoBtn">Создать промокод</button>
      <button id="allKeysBtn">Список ключей</button>
      <button id="usersBtn">Пользователи</button>
      <hr>
    `;
  }
  app.innerHTML = html;
  document.getElementById('profileBtn').onclick = renderProfile;
  document.getElementById('bonusBtn').onclick = renderBonus;
  document.getElementById('marketBtn').onclick = renderMarket;
  document.getElementById('helpBtn').onclick = renderHelp;
  document.getElementById('logsBtn').onclick = renderLogs;
  document.getElementById('logoutBtn').onclick = () => { currentUser = null; renderLogin(); };
  if (currentUser.isAdmin) {
    document.getElementById('addKeysBtn').onclick = renderAddKeys;
    document.getElementById('promoBtn').onclick = renderPromo;
    document.getElementById('allKeysBtn').onclick = renderAllKeys;
    document.getElementById('usersBtn').onclick = renderUsers;
  }
}

function renderProfile() {
  const refLink = location.href.split('#')[0] + `?ref=${currentUser.ref_code}`;
  app.innerHTML = `
    <button onclick="renderMain()">Назад</button>
    <h3>Профиль</h3>
    <div>Имя: <b>${currentUser.id}</b></div>
    <div>Рефералов: <b>${currentUser.balance}</b></div>
    <div>Куплено кейсов: <b>${currentUser.keys}</b></div>
    <div>Ваша реферальная ссылка:<br>
      <input value="${refLink}" readonly style="width:100%">
    </div>
  `;
}

function renderBonus() {
  const refLink = location.href.split('#')[0] + `?ref=${currentUser.ref_code}`;
  app.innerHTML = `
    <button onclick="renderMain()">Назад</button>
    <h3>Бонусы</h3>
    <div>Приглашайте друзей по ссылке и получайте рефералы!</div>
    <div>Ваша реферальная ссылка:<br>
      <input value="${refLink}" readonly style="width:100%">
    </div>
    <div>За 5 рефералов — 1 кейс.</div>
  `;
}

function renderMarket() {
  app.innerHTML = `
    <button onclick="renderMain()">Назад</button>
    <h3>Маркет</h3>
    <div>Ваш баланс рефералов: <b>${currentUser.balance}</b></div>
    <button id="buyCaseBtn">Открыть кейс (5 рефералов)</button>
    <button id="promoUseBtn">Активировать промокод</button>
    <div id="marketResult"></div>
  `;
  document.getElementById('buyCaseBtn').onclick = () => {
    if (currentUser.balance < 5) {
      document.getElementById('marketResult').innerHTML = 'Недостаточно рефералов!';
      return;
    }
    // Выбор кейса
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

function renderHelp() {
  app.innerHTML = `
    <button onclick="renderMain()">Назад</button>
    <h3>Помощь</h3>
    <ul>
      <li>Как часто добавляются ключи? — Админ добавляет вручную.</li>
      <li>Можно ли обменять ключ? — Нет.</li>
      <li>Почему не засчитан реферал? — Возможно, друг уже был зарегистрирован.</li>
    </ul>
  `;
}

function renderLogs() {
  const logs = getLogs();
  app.innerHTML = `
    <button onclick="renderMain()">Назад</button>
    <h3>Логи</h3>
    <div>${logs.map(l => `<div class="log">${l.time}: ${l.text}</div>`).join('') || 'Логов нет.'}</div>
  `;
}

function renderAddKeys() {
  app.innerHTML = `
    <button onclick="renderMain()">Назад</button>
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
  app.innerHTML = `
    <button onclick="renderMain()">Назад</button>
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
    <script>
      document.getElementById('promoType').onchange = function() {
        if (this.value === 'referrals') {
          document.getElementById('promoValueLabel').innerHTML = 'Сколько рефералов:<br><input id="promoValue" value="1">';
        } else {
          document.getElementById('promoValueLabel').innerHTML = 'Тип кейса:<br><select id="promoValue">${CASE_TYPES.map(ct => `<option>${ct.name}</option>`).join('')}<option>Рандомный</option></select>';
        }
      };
    </script>
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
  app.innerHTML = `
    <button onclick="renderMain()">Назад</button>
    <h3>Список ключей</h3>
    ${CASE_TYPES.map(ct => {
      const keys = getCaseKeys(ct.name);
      return `<div><b>${ct.name} (${keys.length}):</b><br>${keys.join(', ') || 'Пусто'}</div>`;
    }).join('<br>')}
  `;
}

function renderUsers() {
  const users = getAllUsers();
  app.innerHTML = `
    <button onclick="renderMain()">Назад</button>
    <h3>Пользователи</h3>
    <ul>
      ${users.map(u => `<li>${u.id} — рефералов: ${u.balance}, кейсов: ${u.keys}, реф. код: ${u.ref_code}</li>`).join('')}
    </ul>
  `;
}

// --- Запуск ---
(function() {
  // Если есть реф. код в URL — подставить в форму
  const params = new URLSearchParams(location.search);
  const ref = params.get('ref');
  if (!currentUser) renderLogin();
  if (ref) setTimeout(() => {
    const refInput = document.getElementById('refCode');
    if (refInput) refInput.value = ref;
  }, 100);
  window.renderMain = renderMain; // для кнопок "Назад"
})();
