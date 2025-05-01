// Инициализация Telegram Web Apps SDK
const tg = window.Telegram.WebApp;
tg.ready();

// Получение данных пользователя
const user = tg.initDataUnsafe.user || { username: "Guest" };

// Элементы DOM
const scoreDisplay = document.getElementById("score");
const clickButton = document.getElementById("click-btn");
const resetButton = document.getElementById("reset-btn");

// Инициализация счетчика
let score = localStorage.getItem("clicker_score") || 0;
scoreDisplay.textContent = score;

// Обработчик кликов
clickButton.addEventListener("click", () => {
    score++;
    scoreDisplay.textContent = score;
    localStorage.setItem("clicker_score", score);
    tg.sendData(JSON.stringify({ score })); // Отправка данных в Telegram (опционально)
});

// Сброс счета
resetButton.addEventListener("click", () => {
    score = 0;
    scoreDisplay.textContent = score;
    localStorage.setItem("clicker_score", score);
});

// Приветственное сообщение
tg.expand();
alert(`Welcome, ${user.username}! Start clicking!`);
