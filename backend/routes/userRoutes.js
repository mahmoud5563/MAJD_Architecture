// backend/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const protect = require('../middleware/authMiddleware');

// @desc    الحصول على جميع المستخدمين (لصفحة إدارة المستخدمين)
// @route   GET /api/users
// @access  Private (فقط للآدمن ومدير الحسابات)
router.get('/', protect(['admin', 'account_manager']), async (req, res) => {
    const { search, role } = req.query;
    let query = {};

    if (search) {
        query.$or = [
            { username: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
        ];
    }
    if (role && role !== 'all') { // أضفنا 'all' كخيار فلترة
        query.role = role;
    }

    // صلاحية مدير الحسابات: لا يمكنه رؤية الآدمن
    if (req.user.role === 'account_manager') {
        query.role = { $ne: 'admin' }; // لا تعرض الأدمن لمدير الحسابات
    }
     // الآدمن يرى الجميع

    try {
        const users = await User.find(query).select('-password'); // لا ترجع كلمات المرور
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'فشل جلب المستخدمين.', error: error.message });
    }
});

// @desc    الحصول على ملف تعريف المستخدم (بعد تسجيل الدخول)
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', protect(), async (req, res) => {
    // req.user موجود بسبب الـ middleware بتاع protect
    res.json({
        _id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
    });
});


// @desc    الحصول على مستخدم واحد (للتعديل)
// @route   GET /api/users/:id
// @access  Private (فقط للآدمن ومدير الحسابات)
router.get('/:id', protect(['admin', 'account_manager']), async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'المستخدم غير موجود.' });
        }

        // صلاحية مدير الحسابات: لا يمكنه جلب آدمن أو مدير حسابات آخر
        if (req.user.role === 'account_manager' && (user.role === 'admin' || user.role === 'account_manager')) {
            return res.status(403).json({ message: 'ليس لديك صلاحية لعرض بيانات هذا المستخدم.' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error fetching user by ID:', error);
        res.status(500).json({ message: 'فشل جلب المستخدم.', error: error.message });
    }
});

// @desc    تعديل بيانات المستخدم
// @route   PUT /api/users/:id
// @access  Private (فقط للآدمن ومدير الحسابات)
router.put('/:id', protect(['admin', 'account_manager']), async (req, res) => {
    const { username, email, password, role } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
        return res.status(404).json({ message: 'المستخدم غير موجود.' });
    }

    // صلاحية مدير الحسابات: لا يمكنه تعديل آدمن أو مدير حسابات آخر
    if (req.user.role === 'account_manager') {
        if (user.role === 'admin' || user.role === 'account_manager') {
            return res.status(403).json({ message: 'ليس لديك صلاحية لتعديل هذا المستخدم.' });
        }
        // لا يمكن لمدير الحسابات تغيير دور المستخدم إلى آدمن أو مدير حسابات
        if (role && (role === 'admin' || role === 'account_manager')) {
            return res.status(403).json({ message: 'ليس لديك صلاحية لتغيير دور المستخدم لهذا الدور.' });
        }
    }
    // الآدمن يمكنه تعديل الأدوار، لكن لا يمكنه تغيير دوره الخاص من خلال هذه الواجهة
    if (req.user.role === 'admin' && user._id.toString() === req.user._id.toString() && role && role !== req.user.role) {
        return res.status(403).json({ message: 'لا يمكنك تغيير دورك الخاص من هنا.' });
    }


    user.username = username || user.username;
    user.email = email || user.email;
    if (password) {
        // سيتم تشفير كلمة المرور بواسطة pre-save hook في موديل User
        user.password = password;
    }
    user.role = role || user.role; 

    try {
        const updatedUser = await user.save();
        res.json({
            _id: updatedUser._id,
            username: updatedUser.username,
            email: updatedUser.email,
            role: updatedUser.role,
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(400).json({ message: error.message });
    }
});


// @desc    حذف مستخدم
// @route   DELETE /api/users/:id
// @access  Private (فقط للآدمن ومدير الحسابات)
router.delete('/:id', protect(['admin', 'account_manager']), async (req, res) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        return res.status(404).json({ message: 'المستخدم غير موجود.' });
    }

    // منع المستخدم من حذف نفسه
    if (user._id.toString() === req.user._id.toString()) {
        return res.status(403).json({ message: 'لا يمكنك حذف حسابك الخاص.' });
    }

    // صلاحية مدير الحسابات: لا يمكنه حذف آدمن أو مدير حسابات آخر
    if (req.user.role === 'account_manager') {
        if (user.role === 'admin' || user.role === 'account_manager') {
            return res.status(403).json({ message: 'ليس لديك صلاحية لحذف هذا المستخدم.' });
        }
    }

    try {
        await user.deleteOne(); 
        res.json({ message: 'تم حذف المستخدم بنجاح.' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'فشل حذف المستخدم.', error: error.message });
    }
});

module.exports = router;
