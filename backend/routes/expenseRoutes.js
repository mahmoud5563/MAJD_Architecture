// backend/routes/expenseRoutes.js
const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const Expense = require('../models/Expense');
const Treasury = require('../models/Treasury');     // NEW: Import Treasury model
const Transaction = require('../models/Transaction'); // NEW: Import Transaction model
const Project = require('../models/Project');       // NEW: Import Project model for engineer checks

// @desc    إضافة مصروف جديد لمشروع
// @route   POST /api/expenses
// @access  Private (للمديرين والمهندسين)
router.post('/', protect(['admin', 'account_manager', 'engineer']), async (req, res) => {
    // تم إضافة treasuryId هنا
    const { projectId, amount, description, date, categoryId, vendorId, attachment, treasuryId } = req.body;
    const createdByUserId = req.user._id; // من قام بإضافة المصروف
    const userRole = req.user.role;

    // التحقق من المدخلات الأساسية، بما في ذلك treasuryId
    if (!projectId || !amount || !description || !date || !categoryId || !vendorId || !treasuryId) {
        return res.status(400).json({ message: 'الرجاء توفير جميع حقول المصروف المطلوبة، بما في ذلك الخزينة.' });
    }
    if (amount <= 0) {
        return res.status(400).json({ message: 'المبلغ يجب أن يكون رقماً موجباً.' });
    }

    try {
        // 1. العثور على الخزينة المحددة
        const selectedTreasury = await Treasury.findById(treasuryId);
        if (!selectedTreasury) {
            return res.status(404).json({ message: 'الخزينة المحددة غير موجودة.' });
        }

        // 2. التحقق من صلاحيات استخدام الخزينة
        if (userRole === 'engineer') {
            // المهندس يمكنه استخدام خزائن العهدة الخاصة به فقط
            if (selectedTreasury.type !== 'custody' || selectedTreasury.userId.toString() !== createdByUserId.toString()) {
                return res.status(403).json({ message: 'ليس لديك صلاحية استخدام هذه الخزينة.' });
            }
        } else { // admin, account_manager
            // المدير ومدير الحسابات يمكنهما استخدام الخزينة الرئيسية فقط
            if (selectedTreasury.type !== 'main') {
                return res.status(403).json({ message: 'يمكن للمديرين ومديري الحسابات الصرف من الخزينة الرئيسية فقط.' });
            }
        }

        // 3. التحقق من الرصيد الكافي
        if (selectedTreasury.balance < amount) {
            return res.status(400).json({ message: `الرصيد في خزينة "${selectedTreasury.name}" غير كافٍ لإتمام المصروف.` });
        }

        // 4. خصم المبلغ من رصيد الخزينة
        selectedTreasury.balance -= amount;
        await selectedTreasury.save();

        // 5. إنشاء المصروف
        const expense = await Expense.create({
            projectId,
            amount,
            description,
            date,
            categoryId,
            vendorId,
            attachment,
            treasuryId: selectedTreasury._id, // ربط المصروف بالخزينة
            createdBy: createdByUserId, // Store who created the expense
        });

        // 6. سجل المعاملة المالية
        await Transaction.create({
            amount,
            type: 'expense', // نوع المعاملة الآن هو "مصروف" بشكل عام
            description: `مصروف: ${description} (للمقاول: ${vendorId}, المشروع: ${projectId})`,
            date: new Date(date), // استخدم تاريخ المصروف
            treasury: selectedTreasury._id, // ربط المعاملة بالخزينة التي تم الصرف منها
            relatedUser: createdByUserId, // من قام بالعملية
            relatedProject: projectId,
            relatedVendor: vendorId, // ربط المعاملة بالمقاول
            relatedExpense: expense._id, // ربط المعاملة بالمصروف نفسه لسهولة التتبع
            createdBy: createdByUserId,
        });

        // Populate and return the expense to include populated fields in the response
        const populatedExpense = await Expense.findById(expense._id)
            .populate('projectId', 'name address')
            .populate('categoryId', 'name')
            .populate('vendorId', 'name')
            .populate('createdBy', 'name')
            .populate('treasuryId', 'name type'); // Populate treasury info

        res.status(201).json(populatedExpense);
    } catch (error) {
        console.error('Error adding expense:', error);
        res.status(500).json({ message: 'فشل إضافة المصروف.', error: error.message });
    }
});

// @desc    جلب جميع المصروفات مع إمكانية الفلترة بالمشروع أو المقاول
// @route   GET /api/expenses
// @access  Private (يتطلب تسجيل دخول)
router.get('/', protect(), async (req, res) => {
    const { projectId, vendorId, search, categoryId, startDate, endDate, treasuryId } = req.query; // Added treasuryId to query params
    const userRole = req.user.role;
    const userId = req.user._id;

    let query = {};

    // For engineer, filter by projects they are responsible for OR expenses they created
    if (userRole === 'engineer') {
        const engineerProjects = await Project.find({ engineerId: userId }).select('_id');
        const projectIds = engineerProjects.map(p => p._id);
        
        // Engineer can see expenses related to their projects OR expenses created by them
        query.$or = [{ projectId: { $in: projectIds } }, { createdBy: userId }];
    }

    if (projectId) {
        if (userRole === 'engineer') {
            // If engineer, ensure the requested projectId is among their projects
            const project = await Project.findById(projectId);
            if (!project || (project.engineerId && project.engineerId.toString() !== userId.toString())) {
                return res.status(403).json({ message: 'ليس لديك صلاحية لعرض مصروفات هذا المشروع.' });
            }
        }
        query.projectId = projectId; // Apply projectId filter
    }
    
    if (vendorId) {
        query.vendorId = vendorId;
    }
    if (categoryId) {
        query.categoryId = categoryId;
    }
    if (treasuryId) { // New filter for treasury
        query.treasuryId = treasuryId;
    }
    if (search) {
        query.description = { $regex: search, $options: 'i' };
    }
    if (startDate && endDate) {
        query.date = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };
    } else if (startDate) {
        query.date = { $gte: new Date(startDate) };
    } else if (endDate) {
        query.date = { $lte: new Date(endDate) };
    }

    try {
        const expenses = await Expense.find(query)
            .populate('projectId', 'name address') // جلب اسم وعنوان المشروع
            .populate('categoryId', 'name')        // جلب اسم التصنيف
            .populate('vendorId', 'name')          // جلب اسم المقاول
            .populate('createdBy', 'name')         // جلب اسم من أنشأ المصروف
            .populate('treasuryId', 'name type');  // NEW: جلب اسم ونوع الخزينة
        res.json(expenses);
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ message: 'فشل جلب المصروفات.', error: error.message });
    }
});

// @desc    جلب جميع مصروفات مشروع معين (هذا المسار يمكن أن يكون أكثر تحديدًا للمهندسين)
// @route   GET /api/expenses/project/:projectId
// @access  Private (يتطلب تسجيل دخول)
router.get('/project/:projectId', protect(), async (req, res) => {
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
            .populate('createdBy', 'name')
            .populate('treasuryId', 'name type') // NEW: Populate treasury info
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
    const userRole = req.user.role;
    const userId = req.user._id;

    try {
        const expense = await Expense.findById(req.params.id)
            .populate('projectId', 'name address') // Populate project details
            .populate('categoryId', 'name')
            .populate('vendorId', 'name')
            .populate('createdBy', 'name') // Populate who created it
            .populate('treasuryId', 'name type'); // NEW: Populate treasury info

        if (!expense) {
            return res.status(404).json({ message: 'المصروف غير موجود.' });
        }

        // Engineer can only view expenses related to projects they are assigned to or expenses they created
        if (userRole === 'engineer') {
            const project = await Project.findById(expense.projectId);
            const isEngineerProject = project && project.engineerId && project.engineerId.toString() === userId.toString();
            const isCreatedByEngineer = expense.createdBy && expense.createdBy.toString() === userId.toString();

            if (!isEngineerProject && !isCreatedByEngineer) {
                return res.status(403).json({ message: 'ليس لديك صلاحية لعرض تفاصيل هذا المصروف.' });
            }
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
    // تم إضافة treasuryId هنا للسماح بتغييره
    const { amount, description, date, categoryId, vendorId, attachment, projectId, treasuryId } = req.body; 
    const userRole = req.user.role;
    const userId = req.user._id;

    if (amount !== undefined && amount <= 0) {
        return res.status(400).json({ message: 'المبلغ يجب أن يكون رقماً موجباً.' });
    }

    try {
        const expense = await Expense.findById(req.params.id);

        if (!expense) {
            return res.status(404).json({ message: 'المصروف غير موجود.' });
        }

        // Engineer can only modify expenses they created OR are related to their projects
        if (userRole === 'engineer') {
            const project = await Project.findById(expense.projectId);
            const isEngineerProject = project && project.engineerId && project.engineerId.toString() === userId.toString();
            const isCreatedByEngineer = expense.createdBy && expense.createdBy.toString() === userId.toString();

            if (!isEngineerProject && !isCreatedByEngineer) {
                return res.status(403).json({ message: 'ليس لديك صلاحية لتعديل هذا المصروف.' });
            }

            // If engineer, ensure the expense's project is still one of their projects if projectId is updated
            if (projectId && projectId.toString() !== expense.projectId.toString()) {
                const newProject = await Project.findById(projectId);
                if (!newProject || (newProject.engineerId && newProject.engineerId.toString() !== userId.toString())) {
                    return res.status(403).json({ message: 'لا يمكنك نقل المصروف إلى مشروع لست مسؤولاً عنه.' });
                }
            }
            // If engineer tries to change treasury, it must be their custody treasury
            if (treasuryId && expense.treasuryId.toString() !== treasuryId.toString()) {
                const newTreasury = await Treasury.findById(treasuryId);
                if (!newTreasury || newTreasury.type !== 'custody' || newTreasury.userId.toString() !== userId.toString()) {
                    return res.status(403).json({ message: 'ليس لديك صلاحية استخدام هذه الخزينة الجديدة.' });
                }
            }
        } else { // Admin or Account Manager
            // If admin/account_manager tries to change treasury, it must be the main treasury
            if (treasuryId && expense.treasuryId.toString() !== treasuryId.toString()) {
                const newTreasury = await Treasury.findById(treasuryId);
                if (!newTreasury || newTreasury.type !== 'main') {
                    return res.status(403).json({ message: 'يمكن للمديرين ومديري الحسابات الصرف من الخزينة الرئيسية فقط.' });
                }
            }
        }
        
        const oldAmount = expense.amount;
        const oldTreasuryId = expense.treasuryId;
        const newAmount = amount !== undefined ? amount : oldAmount;
        const newTreasuryId = treasuryId !== undefined ? treasuryId : oldTreasuryId;

        // Handle treasury balance adjustments if amount or treasury changes
        if (oldAmount !== newAmount || oldTreasuryId.toString() !== newTreasuryId.toString()) {
            const oldTreasury = await Treasury.findById(oldTreasuryId);
            const newTreasury = await Treasury.findById(newTreasuryId);

            if (!oldTreasury) {
                console.error(`Old treasury with ID ${oldTreasuryId} not found for expense ${expense._id}`);
                // Proceed with warning, or handle as an error if critical
            }
            if (!newTreasury) {
                 return res.status(404).json({ message: 'الخزينة الجديدة المحددة غير موجودة.' });
            }

            // 1. Return old amount to old treasury
            if (oldTreasury) {
                oldTreasury.balance += oldAmount;
                await oldTreasury.save();
            }

            // 2. Deduct new amount from new treasury
            if (newTreasury.balance < newAmount) {
                // If insufficient funds, revert old treasury and send error
                if (oldTreasury) {
                    oldTreasury.balance -= oldAmount; // Revert the previous addition
                    await oldTreasury.save();
                }
                return res.status(400).json({ message: `الرصيد في خزينة "${newTreasury.name}" غير كافٍ بعد التعديل.` });
            }
            newTreasury.balance -= newAmount;
            await newTreasury.save();

            // Update the associated transaction
            const transaction = await Transaction.findOne({ relatedExpense: expense._id }); // Find by relatedExpense ID

            if (transaction) {
                transaction.amount = newAmount;
                transaction.description = `تعديل مصروف: ${description} (للمقاول: ${vendorId}, المشروع: ${projectId})`;
                transaction.date = new Date(date);
                transaction.treasury = newTreasuryId; // Update treasury link
                transaction.relatedProject = projectId;
                transaction.relatedVendor = vendorId;
                await transaction.save();
            } else {
                // If no transaction found (e.g., old data without relatedExpense), create a new one
                await Transaction.create({
                    amount: newAmount,
                    type: 'expense',
                    description: `تعديل مصروف: ${description} (للمقاول: ${vendorId}, المشروع: ${projectId})`,
                    date: new Date(date),
                    treasury: newTreasuryId,
                    relatedUser: createdByUserId,
                    relatedProject: projectId,
                    relatedVendor: vendorId,
                    relatedExpense: expense._id,
                    createdBy: createdByUserId,
                });
            }
        }


        // Update expense fields
        expense.projectId = projectId !== undefined ? projectId : expense.projectId; // Allow changing project
        expense.amount = newAmount; // Already handled
        expense.description = description !== undefined ? description : expense.description;
        expense.date = date !== undefined ? date : expense.date;
        expense.categoryId = categoryId !== undefined ? categoryId : expense.categoryId;
        expense.vendorId = vendorId !== undefined ? vendorId : expense.vendorId;
        expense.attachment = attachment !== undefined ? attachment : expense.attachment;
        expense.treasuryId = newTreasuryId; // Update treasury ID

        const updatedExpense = await expense.save();
        // Populate fields for the response
        const populatedExpense = await Expense.findById(updatedExpense._id)
            .populate('projectId', 'name address')
            .populate('categoryId', 'name')
            .populate('vendorId', 'name')
            .populate('createdBy', 'name')
            .populate('treasuryId', 'name type'); // Populate treasury info
        res.json(populatedExpense);
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
    const userId = req.user._id;

    try {
        const expense = await Expense.findById(req.params.id);

        if (!expense) {
            return res.status(404).json({ message: 'المصروف غير موجود.' });
        }

        // صلاحية المهندس لحذف المصروفات التي قام هو بإنشائها فقط أو التي تخص مشروعه
        if (userRole === 'engineer') {
            const project = await Project.findById(expense.projectId);
            const isEngineerProject = project && project.engineerId && project.engineerId.toString() === userId.toString();
            const isCreatedByEngineer = expense.createdBy && expense.createdBy.toString() === userId.toString();

            if (!isEngineerProject && !isCreatedByEngineer) {
                return res.status(403).json({ message: 'ليس لديك صلاحية لحذف هذا المصروف.' });
            }
        }

        // استعادة المبلغ إلى الخزينة التي تم الصرف منها
        const transaction = await Transaction.findOne({ relatedExpense: expense._id }); // Find by relatedExpense ID

        if (transaction && transaction.treasury) { // Only if a linked transaction with treasury exists
            const affectedTreasury = await Treasury.findById(transaction.treasury);
            if (affectedTreasury) {
                affectedTreasury.balance += expense.amount; // Add the amount back
                await affectedTreasury.save();
            } else {
                console.warn(`Transaction ${transaction._id} references missing treasury ${transaction.treasury}`);
            }
            await transaction.deleteOne(); // حذف المعاملة المرتبطة
        } else {
            console.warn(`No linked transaction or treasury found for expense ${expense._id}. Balance not reverted.`);
        }
        
        await expense.deleteOne();
        res.json({ message: 'تم حذف المصروف بنجاح.' });
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ message: 'فشل حذف المصروف.', error: error.message });
    }
});

module.exports = router;
