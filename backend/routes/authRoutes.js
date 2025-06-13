// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const protect = require('../middleware/authMiddleware'); // تأكد إن هذا المسار صحيح

// توليد التوكن (JWT)
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '1d', // التوكن صالح لمدة يوم واحد
    });
};

// @desc    تسجيل مستخدم جديد (متاح للآدمن ومدير الحسابات فقط)
// @route   POST /api/register
// @access  Private (فقط للآدمن ومدير الحسابات حالياً)
router.post('/register', protect(['admin', 'account_manager']), async (req, res) => {
    const { username, email, password, role } = req.body;

    const currentUserRole = req.user.role; 
    if (currentUserRole === 'account_manager' && (role === 'admin' || role === 'account_manager')) {
        return res.status(403).json({ message: 'مدير الحسابات لا يمكنه إضافة آدمن أو مدير حسابات آخر.' });
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
        return res.status(400).json({ message: 'هذا البريد الإلكتروني مسجل بالفعل.' });
    }

    const user = await User.create({
        username,
        email,
        password,
        role,
    });

    if (user) {
        res.status(201).json({
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
        });
    } else {
        res.status(400).json({ message: 'بيانات مستخدم غير صالحة.' });
    }
});

// @desc    تسجيل الدخول للمستخدم
// @route   POST /api/login
// @access  Public
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // --- رسائل التشخيص هنا ---
    console.log('\n--- Login Attempt Details ---');
    console.log('Received Email:', email);
    console.log('Received Password:', password); // **تنبيه: لا تترك هذا في بيئة الإنتاج**
    // --- نهاية رسائل التشخيص ---

    const user = await User.findOne({ email });

    if (!user) {
        console.log('User NOT found in DB for email:', email);
        return res.status(401).json({ message: 'بريد إلكتروني أو كلمة مرور غير صحيحة.' });
    }

    console.log('User found in DB. Stored Email:', user.email);
    
    // مقارنة كلمة المرور المدخلة بالكلمة المشفرة المخزنة
    const isMatch = await user.matchPassword(password);
    console.log('Password Match Result (isMatch):', isMatch); // true or false

    if (isMatch) {
        console.log('Login successful for user:', user.username);
        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            token: generateToken(user._id),
        });
    } else {
        console.log('Password mismatch for user:', user.username);
        res.status(401).json({ message: 'بريد إلكتروني أو كلمة مرور غير صحيحة.' });
    }
    console.log('--- End Login Attempt ---');
});

module.exports = router;