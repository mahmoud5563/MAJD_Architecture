// backend/routes/transactionRoutes.js
const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const Transaction = require('../models/Transaction');

// @desc    جلب جميع المعاملات (للمديرين فقط)
// @route   GET /api/transactions
// @access  Private (فقط للآدمن ومدير الحسابات)
router.get('/', protect(['admin', 'account_manager']), async (req, res) => {
    const { type, treasuryId, userId, projectId, startDate, endDate, search } = req.query;
    let query = {};

    if (type && type !== 'all') {
        query.type = type;
    }
    if (treasuryId) {
        query.treasury = treasuryId;
    }
    if (userId) {
        query.relatedUser = userId;
    }
    if (projectId) {
        query.relatedProject = projectId;
    }
    if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
    }
    if (search) {
        query.description = { $regex: search, $options: 'i' };
    }

    try {
        const transactions = await Transaction.find(query)
            .populate('treasury', 'name type userId')
            .populate('relatedUser', 'username')
            .populate('relatedProject', 'name')
            .populate('createdBy', 'username')
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
        const treasury = await Transaction.findOne({_id: treasuryId, type: 'custody'});
        // يمكن إضافة فلترة هنا للوصول إلى الخزينة
        // إذا كان المستخدم مهندس، تأكد أن خزينة العهدة تخصه
        if (userRole === 'engineer') {
            const engineerTreasury = await Treasury.findOne({ _id: treasuryId, userId: userId, type: 'custody' });
            if (!engineerTreasury) {
                return res.status(403).json({ message: 'ليس لديك صلاحية لعرض معاملات هذه الخزينة.' });
            }
        }
        // للآدمن ومدير الحسابات، لا توجد قيود إضافية هنا (protect middleware يكفي)

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
