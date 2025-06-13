// backend/routes/incomeRoutes.js
const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const Income = require('../models/Income');
const Treasury = require('../models/Treasury');     // NEW: Import Treasury model
const Transaction = require('../models/Transaction'); // NEW: Import Transaction model

// @desc    إضافة إيراد جديد لمشروع
// @route   POST /api/incomes
// @access  Private (للمديرين والمهندسين)
router.post('/', protect(['admin', 'account_manager', 'engineer']), async (req, res) => {
    const { projectId, amount, description, date, paymentMethod } = req.body;
    const createdByUserId = req.user._id;

    if (!projectId || !amount || !description || !date || !paymentMethod) {
        return res.status(400).json({ message: 'الرجاء توفير جميع حقول الإيراد المطلوبة.' });
    }
    if (amount <= 0) {
        return res.status(400).json({ message: 'المبلغ يجب أن يكون رقماً موجباً.' });
    }

    try {
        const income = await Income.create({
            projectId,
            amount,
            description,
            date,
            paymentMethod,
        });

        // إضافة المبلغ إلى الخزينة الرئيسية
        const mainTreasury = await Treasury.findOne({ type: 'main' });
        if (!mainTreasury) {
            // يمكن إنشاء الخزينة الرئيسية هنا إذا لم تكن موجودة، أو إرجاع خطأ
            // نفترض أنها ستكون موجودة مسبقاً من خلال آلية الإعداد
            return res.status(500).json({ message: 'الخزينة الرئيسية غير موجودة. يرجى إعدادها أولاً.' });
        }

        mainTreasury.balance += amount;
        await mainTreasury.save();

        // سجل المعاملة المالية
        await Transaction.create({
            amount,
            type: 'income_to_main',
            description: `إيراد للمشروع ${projectId}: ${description}`,
            date: new Date(date), // استخدم تاريخ الإيراد
            treasury: mainTreasury._id,
            relatedProject: projectId,
            createdBy: createdByUserId,
        });

        res.status(201).json(income);
    } catch (error) {
        console.error('Error adding income:', error);
        res.status(500).json({ message: 'فشل إضافة الإيراد.', error: error.message });
    }
});

// @desc    جلب جميع إيرادات مشروع معين
// @route   GET /api/incomes/project/:projectId
// @access  Private (يتطلب تسجيل دخول)
router.get('/project/:projectId', protect(), async (req, res) => {
    const userRole = req.user.role;
    const userId = req.user._id;

    // المهندس يمكنه رؤية الإيرادات الخاصة بالمشاريع التي هو مسؤول عنها
    if (userRole === 'engineer') {
        const project = await Project.findById(req.params.projectId);
        if (!project || (project.engineerId && project.engineerId.toString() !== userId.toString())) {
            return res.status(403).json({ message: 'ليس لديك صلاحية لعرض إيرادات هذا المشروع.' });
        }
    }

    try {
        const incomes = await Income.find({ projectId: req.params.projectId })
            .sort({ date: -1, createdAt: -1 });
        res.json(incomes);
    } catch (error) {
        console.error('Error fetching incomes for project:', error);
        res.status(500).json({ message: 'فشل جلب الإيرادات.', error: error.message });
    }
});

// @desc    جلب إيراد واحد بواسطة ID
// @route   GET /api/incomes/:id
// @access  Private (يتطلب تسجيل دخول)
router.get('/:id', protect(), async (req, res) => {
    try {
        const income = await Income.findById(req.params.id);
        if (!income) {
            return res.status(404).json({ message: 'الإيراد غير موجود.' });
        }
        res.json(income);
    } catch (error) {
        console.error('Error fetching income by ID:', error);
        res.status(500).json({ message: 'فشل جلب الإيراد.', error: error.message });
    }
});

// @desc    تعديل إيراد بواسطة ID
// @route   PUT /api/incomes/:id
// @access  Private (للمديرين والمهندسين)
router.put('/:id', protect(['admin', 'account_manager', 'engineer']), async (req, res) => {
    const { amount, description, date, paymentMethod } = req.body;
    const userRole = req.user.role;

    try {
        const income = await Income.findById(req.params.id);

        if (!income) {
            return res.status(404).json({ message: 'الإيراد غير موجود.' });
        }

        // صلاحية المهندس لتعديل الإيرادات التي قام هو بإضافتها فقط
        if (userRole === 'engineer') {
            const relatedTransaction = await Transaction.findOne({ relatedProject: income.projectId, type: 'income_to_main', createdBy: req.user._id });
            if (!relatedTransaction) {
                 return res.status(403).json({ message: 'ليس لديك صلاحية لتعديل هذا الإيراد.' });
            }
        }
        
        // إذا تغير المبلغ، يجب تعديل رصيد الخزينة الرئيسية والمعاملة
        const oldAmount = income.amount;
        const newAmount = amount;

        if (oldAmount !== newAmount) {
            const mainTreasury = await Treasury.findOne({ type: 'main' });
            if (!mainTreasury) {
                return res.status(500).json({ message: 'الخزينة الرئيسية غير موجودة.' });
            }

            mainTreasury.balance -= oldAmount; // عكس تأثير الإيراد القديم
            mainTreasury.balance += newAmount; // تطبيق تأثير الإيراد الجديد
            await mainTreasury.save();

            // تحديث المعاملة
            const transaction = await Transaction.findOne({ relatedProject: income.projectId, type: 'income_to_main' });
            if (transaction) {
                transaction.amount = newAmount;
                transaction.description = `تعديل إيراد للمشروع ${income.projectId}: ${description}`;
                await transaction.save();
            }
        }

        income.amount = amount || income.amount;
        income.description = description || income.description;
        income.date = date || income.date;
        income.paymentMethod = paymentMethod || income.paymentMethod;

        const updatedIncome = await income.save();
        res.json(updatedIncome);
    } catch (error) {
        console.error('Error updating income:', error);
        res.status(500).json({ message: 'فشل تحديث الإيراد.', error: error.message });
    }
});

// @desc    حذف إيراد
// @route   DELETE /api/incomes/:id
// @access  Private (للمديرين والمهندسين)
router.delete('/:id', protect(['admin', 'account_manager', 'engineer']), async (req, res) => {
    const userRole = req.user.role;
    try {
        const income = await Income.findById(req.params.id);

        if (!income) {
            return res.status(404).json({ message: 'الإيراد غير موجود.' });
        }

        // صلاحية المهندس لحذف الإيرادات التي قام هو بإضافتها فقط
        if (userRole === 'engineer') {
            const relatedTransaction = await Transaction.findOne({ relatedProject: income.projectId, type: 'income_to_main', createdBy: req.user._id });
            if (!relatedTransaction) {
                 return res.status(403).json({ message: 'ليس لديك صلاحية لحذف هذا الإيراد.' });
            }
        }

        // استعادة المبلغ من الخزينة الرئيسية
        const mainTreasury = await Treasury.findOne({ type: 'main' });
        if (mainTreasury) {
            mainTreasury.balance -= income.amount;
            await mainTreasury.save();
        }

        // حذف المعاملة المرتبطة
        await Transaction.deleteOne({ relatedProject: income.projectId, type: 'income_to_main' });

        await income.deleteOne();
        res.json({ message: 'تم حذف الإيراد بنجاح.' });
    } catch (error) {
        console.error('Error deleting income:', error);
        res.status(500).json({ message: 'فشل حذف الإيراد.', error: error.message });
    }
});

module.exports = router;
