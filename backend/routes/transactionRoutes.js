// backend/routes/transactionRoutes.js
const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const Transaction = require('../models/Transaction');
const Treasury = require('../models/Treasury'); // Needed for engineer treasury check

// @desc    جلب جميع المعاملات بناءً على الفلاتر (النوع، المستخدم، المشروع، الخزينة)
// @route   GET /api/transactions
// @access  Private (يتطلب تسجيل دخول - صلاحيات مرنة)
router.get('/', protect(), async (req, res) => {
    const { type, relatedUser, relatedProject, treasuryId, startDate, endDate, search } = req.query; // Removed userId, projectId from destructuring as we'll use relatedUser/relatedProject
    const currentUserRole = req.user.role;
    const currentUserId = req.user._id;

    let query = {};

    // فلترة حسب النوع
    if (type && type !== 'all') {
        query.type = type;
    }

    // فلترة حسب المستخدم المرتبط (مثل المهندس في عهدته)
    if (currentUserRole === 'engineer') {
        // المهندس يرى فقط معاملاته الخاصة
        // نضمن هنا أن الـ relatedUser دائماً هو المهندس المسجل دخوله
        if (relatedUser && relatedUser !== currentUserId.toString()) {
            return res.status(403).json({ message: 'ليس لديك صلاحية لعرض معاملات مستخدم آخر.' });
        }
        query.relatedUser = currentUserId; 
    } else { // آدمن أو مدير حسابات (يمكنهم البحث عن معاملات لأي مستخدم)
        if (relatedUser) { // استخدم relatedUser الذي يأتي من الـ frontend
            query.relatedUser = relatedUser;
        }
    }
    
    // فلترة حسب المشروع المرتبط
    if (relatedProject) { // استخدم relatedProject الذي يأتي من الـ frontend
        query.relatedProject = relatedProject;
    }
    
    // فلترة حسب الخزينة (إذا أردت جلب معاملات خزينة معينة)
    if (treasuryId) {
        query.treasury = treasuryId;
    }
    
    // فلترة حسب نطاق التاريخ
    if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
    }

    // فلترة حسب البحث في الوصف
    if (search) {
        query.description = { $regex: search, $options: 'i' };
    }

    try {
        const transactions = await Transaction.find(query)
            .populate('treasury', 'name type userId')
            .populate('relatedUser', 'username') // جلب اسم المستخدم المرتبط (المهندس)
            .populate('relatedProject', 'name') // جلب اسم المشروع المرتبط
            .populate('createdBy', 'username')   // جلب اسم المستخدم الذي أنشأ المعاملة
            .sort({ date: -1, createdAt: -1 }); // فرز حسب التاريخ ثم وقت الإنشاء (الأحدث أولاً)

        res.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ message: 'فشل جلب المعاملات.', error: error.message });
    }
});

// @desc    جلب معاملات خزينة معينة (مثل خزينة عهدة لمهندس)
// @route   GET /api/transactions/treasury/:treasuryId
// @access  Private (المهندس يرى خزينته فقط، والمديرون يرون أي خزينة)
router.get('/treasury/:treasuryId', protect(), async (req, res) => {
    const userRole = req.user.role;
    const userId = req.user._id;
    const treasuryId = req.params.treasuryId;

    try {
        // التأكد من أن الخزينة موجودة
        const treasury = await Treasury.findById(treasuryId);
        if (!treasury) {
            return res.status(404).json({ message: 'الخزينة غير موجودة.' });
        }

        // إذا كان المستخدم مهندس، تأكد أن خزينة العهدة تخصه
        if (userRole === 'engineer') {
            if (treasury.type !== 'custody' || treasury.userId.toString() !== userId.toString()) {
                return res.status(403).json({ message: 'ليس لديك صلاحية لعرض معاملات هذه الخزينة.' });
            }
        }

        const transactions = await Transaction.find({ treasury: treasuryId })
            .populate('treasury', 'name type userId')
            .populate('relatedUser', 'username')
            .populate('relatedProject', 'name')
            .populate('createdBy', 'username')
            .sort({ date: -1, createdAt: -1 });

        res.json(transactions);
    } catch (error) {
        console.error('Error fetching treasury transactions:', error);
        res.status(500).json({ message: 'فشل جلب معاملات الخزينة.', error: error.message });
    }
});

module.exports = router;
