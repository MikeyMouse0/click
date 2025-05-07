const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Настройка Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Настройка Multer
const upload = multer({ storage: multer.memoryStorage() });

// Подключение к MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("MongoDB подключен"))
  .catch(err => console.error("Ошибка MongoDB:", err));

// Схемы
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isModerator: { type: Boolean, default: false },
    profilePic: { type: String, default: "" },
    status: { type: String, default: "" },
    theme: { type: String, default: "light" }
});
const User = mongoose.model("User", userSchema);

const memeSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    image: { type: String, required: true },
    tag: { type: String },
    nsfw: { type: Boolean, default: false },
    likes: [{ type: String }],
    creator: { type: String, required: true },
    approved: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});
const Meme = mongoose.model("Meme", memeSchema);

// Middleware аутентификации
function authenticate(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Токен не предоставлен" });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: "Недействительный токен" });
    }
}

// Инициализация тестовых данных
async function initData() {
    const adminCount = await User.countDocuments({ username: "admin" });
    if (adminCount === 0) {
        await User.create({
            username: "admin",
            password: await bcrypt.hash("admin123", 10),
            isModerator: true,
            status: "Чиллю",
            theme: "light"
        });
    }
    const userCount = await User.countDocuments({ username: "user1" });
    if (userCount === 0) {
        await User.create({
            username: "user1",
            password: await bcrypt.hash("pass123", 10),
            isModerator: false,
            status: "Лорд мемов",
            theme: "light"
        });
    }
    const memeCount = await Meme.countDocuments({ title: "Пример мема" });
    if (memeCount === 0) {
        await Meme.create({
            title: "Пример мема",
            description: "Смешной мем",
            image: "https://via.placeholder.com/300",
            tag: "funny",
            nsfw: false,
            likes: [],
            creator: "user1",
            approved: true
        });
    }
}
initData();

// Маршруты
app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !await bcrypt.compare(password, user.password)) {
        return res.status(401).json({ message: "Неверные учетные данные" });
    }
    const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET, { expiresIn: "1d" });
    res.json({ token, user });
});

app.get("/api/auth/verify", authenticate, async (req, res) => {
    const user = await User.findOne({ username: req.user.username });
    if (!user) return res.status(401).json({ message: "Пользователь не найден" });
    res.json({ user });
});

app.get("/api/memes", authenticate, async (req, res) => {
    const memes = await Meme.find({ approved: true });
    res.json(memes);
});

app.get("/api/memes/pending", authenticate, async (req, res) => {
    const user = await User.findOne({ username: req.user.username });
    if (!user.isModerator) return res.status(403).json({ message: "Вы не модератор" });
    const memes = await Meme.find({ approved: false });
    res.json(memes);
});

app.post("/api/memes", authenticate, upload.single("image"), async (req, res) => {
    try {
        const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream({ resource_type: "image" }, (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }).end(req.file.buffer);
        });
        const meme = new Meme({
            title: req.body.title,
            description: req.body.description,
            image: result.secure_url,
            tag: req.body.tag,
            nsfw: req.body.nsfw === "true",
            creator: req.user.username
        });
        await meme.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: "Не удалось загрузить мем" });
    }
});

app.post("/api/memes/:id/like", authenticate, async (req, res) => {
    const meme = await Meme.findById(req.params.id);
    if (!meme.likes.includes(req.user.username)) {
        meme.likes.push(req.user.username);
        await meme.save();
    }
    res.json({ success: true });
});

app.post("/api/memes/:id/approve", authenticate, async (req, res) => {
    const user = await User.findOne({ username: req.user.username });
    if (!user.isModerator) return res.status(403).json({ message: "Вы не модератор" });
    await Meme.findByIdAndUpdate(req.params.id, { approved: true });
    res.json({ success: true });
});

app.post("/api/memes/:id/reject", authenticate, async (req, res) => {
    const user = await User.findOne({ username: req.user.username });
    if (!user.isModerator) return res.status(403).json({ message: "Вы не модератор" });
    await Meme.findByIdAndDelete(req.params.id);
    res.json({ success: true });
});

app.put("/api/users/profile", authenticate, upload.single("profilePic"), async (req, res) => {
    const updates = {};
    if (req.body.username) updates.username = req.body.username;
    if (req.body.password) updates.password = await bcrypt.hash(req.body.password, 10);
    if (req.body.status) updates.status = req.body.status;
    try {
        if (req.file) {
            const result = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream({ resource_type: "image" }, (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }).end(req.file.buffer);
            });
            updates.profilePic = result.secure_url;
        }
        const user = await User.findOneAndUpdate({ username: req.user.username }, updates, { new: true });
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ message: "Не удалось обновить профиль" });
    }
});

app.put("/api/users/theme", authenticate, async (req, res) => {
    await User.findOneAndUpdate({ username: req.user.username }, { theme: req.body.theme });
    res.json({ success: true });
});

app.get("/api/users/search", authenticate, async (req, res) => {
    const query = req.query.q || "";
    const users = await User.find({ username: { $regex: query, $options: "i" } }, "username status");
    res.json(users);
});

// Запуск сервера
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
