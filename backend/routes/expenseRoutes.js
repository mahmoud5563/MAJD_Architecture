// backend/routes/expenseRoutes.js
const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const Expense = require('../models/Expense');
const Treasury = require('../models/Treasury');     // NEW: Import Treasury model
const Transaction = require('../models/Transaction'); // NEW: Import Transaction model

// @desc    إضافة مصروف جديد لمشروع
// @route   POST /api/expenses
// @access  Private (للمديرين والمهندسين)
router.post('/', protect(['admin', 'account_manager', 'engineer']), async (req, res) => {
    const { projectId, amount, description, date, categoryId, vendorId, attachment } = req.body;
    const createdByUserId = req.user._id; // من قام بإضافة المصروف
    const userRole = req.user.role;

    // التحقق من المدخلات الأساسية
    if (!projectId || !amount || !description || !date || !categoryId || !vendorId) {
        return res.status(400).json({ message: 'الرجاء توفير جميع حقول المصروف المطلوبة.' });
    }
    if (amount <= 0) {
        return res.status(400).json({ message: 'المبلغ يجب أن يكون رقماً موجباً.' });
    }

    try {
        let expense;
        let transactionType;
        let affectedTreasury = null;

        if (userRole === 'engineer') {
            // إذا كان المستخدم مهندس، افترض أنه يصرف من عهدته
            const engineerCustodyTreasury = await Treasury.findOne({ type: 'custody', userId: createdByUserId });

            if (!engineerCustodyTreasury) {
                return res.status(400).json({ message: 'ليس لديك خزينة عهدة لإجراء هذا المصروف.' });
            }
            if (engineerCustodyTreasury.balance < amount) {
                return res.status(400).json({ message: 'الرصيد في خزينة العهدة غير كافٍ.' });
            }

            // خصم المبلغ من خزينة العهدة
            engineerCustodyTreasury.balance -= amount;
            await engineerCustodyTreasury.save();
            affectedTreasury = engineerCustodyTreasury._id;
            transactionType = 'expense_from_custody';

        } else {
            // إذا كان آدمن أو مدير حسابات، لا يخصم من خزينة معينة مباشرة
            // يعتبر مصروف مشروع يتم تسجيله فقط
            transactionType = 'project_expense';
            // affectedTreasury يبقى null لأنه لا يخصم من خزينة مباشرة
            // (يمكن ربطه بالخزينة الرئيسية هنا إذا اعتبرت كل المصروفات تخصم منها مباشرة)
            // بما أن العهدة هي الخصم المباشر، فهذا مناسب
        }

        expense = await Expense.create({
            projectId,
            amount,
            description,
            date,
            categoryId,
            vendorId,
            attachment,
        });

        // سجل المعاملة المالية
        await Transaction.create({
            amount,
            type: transactionType,
            description: `مصروف للمشروع ${projectId}: ${description}`,
            date: new Date(date), // استخدم تاريخ المصروف
            treasury: affectedTreasury, // سيكون null إذا لم يكن من عهدة
            relatedUser: createdByUserId, // من قام بالعملية
            relatedProject: projectId,
            createdBy: createdByUserId,
        });

        res.status(201).json(expense);
    } catch (error) {
        console.error('Error adding expense:', error);
        res.status(500).json({ message: 'فشل إضافة المصروف.', error: error.message });
    }
});

// @desc    جلب جميع مصروفات مشروع معين
// @route   GET /api/expenses/project/:projectId
// @access  Private (يتطلب تسجيل دخول)
router.get('/project/:projectId', protect(), async (req, res) => {
    // هذه الراوت يمكن للمهندس رؤية المصروفات الخاصة بالمشاريع التي هو مسؤول عنها
    // تحقق من صلاحية المهندس لجلب مصروفات مشروع معين
    const userRole = req.user.role;
    const userId = req.user._id;

    if (userRole === 'engineer') {
        const project = await Project.findById(req.params.projectId);
        if (!project || (project.engineerId && project.engineerId.toString() !== userId.toString())) {
            return res.status(403).json({ message: 'ليس لديك صلاحية لعرض مصروفات هذا المشروع.' });
        }
    }

    try {
        const expenses = await Expense.find({ projectId: req.params.projectId })
            .populate('categoryId', 'name')
            .populate('vendorId', 'name')
            .sort({ date: -1, createdAt: -1 });
        res.json(expenses);
    } catch (error) {
        console.error('Error fetching expenses for project:', error);
        res.status(500).json({ message: 'فشل جلب المصروفات.', error: error.message });
    }
});

// @desc    جلب مصروف واحد بواسطة ID
// @route   GET /api/expenses/:id
// @access  Private (يتطلب تسجيل دخول)
router.get('/:id', protect(), async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id)
            .populate('categoryId', 'name')
            .populate('vendorId', 'name');
        if (!expense) {
            return res.status(404).json({ message: 'المصروف غير موجود.' });
        }
        res.json(expense);
    } catch (error) {
        console.error('Error fetching expense by ID:', error);
        res.status(500).json({ message: 'فشل جلب المصروف.', error: error.message });
    }
});

// @desc    تعديل مصروف بواسطة ID
// @route   PUT /api/expenses/:id
// @access  Private (للمديرين والمهندسين)
router.put('/:id', protect(['admin', 'account_manager', 'engineer']), async (req, res) => {
    const { amount, description, date, categoryId, vendorId, attachment } = req.body;
    const userRole = req.user.role;

    try {
        const expense = await Expense.findById(req.params.id);

        if (!expense) {
            return res.status(404).json({ message: 'المصروف غير موجود.' });
        }

        // صلاحية المهندس لتعديل المصروفات التي قام هو بإضافتها فقط
        if (userRole === 'engineer') {
            const relatedTransaction = await Transaction.findOne({ relatedProject: expense.projectId, type: 'expense_from_custody', createdBy: req.user._id });
            if (!relatedTransaction || relatedTransaction.treasury.toString() !== (await Treasury.findOne({ userId: req.user._id, type: 'custody' }))._id.toString()) {
                 return res.status(403).json({ message: 'ليس لديك صلاحية لتعديل هذا المصروف.' });
            }
        }
        
        // إذا تغير المبلغ، يجب تعديل رصيد الخزينة والمعاملة القديمة وإنشاء معاملة جديدة
        const oldAmount = expense.amount;
        const newAmount = amount;

        if (oldAmount !== newAmount) {
            // ابحث عن المعاملة المرتبطة بالمصروف (يمكن أن يكون هناك أكثر من نوع)
            const transaction = await Transaction.findOne({ relatedProject: expense.projectId, relatedUser: req.user._id });

            if (transaction && transaction.type === 'expense_from_custody') {
                const engineerCustodyTreasury = await Treasury.findById(transaction.treasury);

                if (!engineerCustodyTreasury) {
                    return res.status(500).json({ message: 'خزينة العهدة المرتبطة غير موجودة.' });
                }

                // عكس تأثير المصروف القديم ثم تطبيق الجديد
                engineerCustodyTreasury.balance += oldAmount; // إعادة المبلغ القديم
                if (engineerCustodyTreasury.balance < newAmount) { // التحقق من الرصيد الجديد
                    return res.status(400).json({ message: 'الرصيد في خزينة العهدة غير كافٍ بعد التعديل.' });
                }
                engineerCustodyTreasury.balance -= newAmount; // خصم المبلغ الجديد
                await engineerCustodyTreasury.save();

                // تحديث المعاملة
                transaction.amount = newAmount;
                transaction.description = `تعديل مصروف للمشروع ${expense.projectId}: ${description}`;
                await transaction.save();
            }
            // إذا كان نوع المعاملة ليس expense_from_custody، فلا تؤثر على الرصيد
        }

        expense.amount = amount || expense.amount;
        expense.description = description || expense.description;
        expense.date = date || expense.date;
        expense.categoryId = categoryId || expense.categoryId;
        expense.vendorId = vendorId || expense.vendorId;
        expense.attachment = attachment || expense.attachment;

        const updatedExpense = await expense.save();
        res.json(updatedExpense);
    } catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).json({ message: 'فشل تحديث المصروف.', error: error.message });
    }
});

// @desc    حذف مصروف
// @route   DELETE /api/expenses/:id
// @access  Private (للمديرين والمهندسين)
router.delete('/:id', protect(['admin', 'account_manager', 'engineer']), async (req, res) => {
    const userRole = req.user.role;
    try {
        const expense = await Expense.findById(req.params.id);

        if (!expense) {
            return res.status(404).json({ message: 'المصروف غير موجود.' });
        }

        // صلاحية المهندس لحذف المصروفات التي قام هو بإضافتها فقط
        if (userRole === 'engineer') {
            const relatedTransaction = await Transaction.findOne({ relatedProject: expense.projectId, type: 'expense_from_custody', createdBy: req.user._id });
            if (!relatedTransaction || relatedTransaction.treasury.toString() !== (await Treasury.findOne({ userId: req.user._id, type: 'custody' }))._id.toString()) {
                 return res.status(403).json({ message: 'ليس لديك صلاحية لحذف هذا المصروف.' });
            }
        }

        // استعادة المبلغ إلى الخزينة إذا كان مصروف عهدة
        const transaction = await Transaction.findOne({ relatedProject: expense.projectId, relatedUser: req.user._id, type: 'expense_from_custody' });
        if (transaction) {
            const engineerCustodyTreasury = await Treasury.findById(transaction.treasury);
            if (engineerCustodyTreasury) {
                engineerCustodyTreasury.balance += expense.amount;
                await engineerCustodyTreasury.save();
            }
            await transaction.deleteOne(); // حذف المعاملة المرتبطة
        }
        
        await expense.deleteOne();
        res.json({ message: 'تم حذف المصروف بنجاح.' });
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ message: 'فشل حذف المصروف.', error: error.message });
    }
});

module.exports = router;
