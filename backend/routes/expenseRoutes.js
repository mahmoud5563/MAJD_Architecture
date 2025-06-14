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
            createdBy: createdByUserId, // Store who created the expense
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

// @desc    جلب جميع المصروفات مع إمكانية الفلترة بالمشروع أو المقاول
// @route   GET /api/expenses
// @access  Private (يتطلب تسجيل دخول)
router.get('/', protect(), async (req, res) => {
    const { projectId, vendorId, search, categoryId, startDate, endDate } = req.query;
    const userRole = req.user.role;
    const userId = req.user._id;

    let query = {};

    // For engineer, filter by projects they are responsible for
    if (userRole === 'engineer') {
        const engineerProjects = await Project.find({ engineerId: userId }).select('_id');
        const projectIds = engineerProjects.map(p => p._id);
        query.projectId = { $in: projectIds };
    }

    if (projectId) {
        // If a specific projectId is requested, ensure it's either part of engineer's projects
        // or user is admin/account_manager
        if (userRole === 'engineer' && query.projectId && !query.projectId.$in.some(id => id.toString() === projectId)) {
            return res.status(403).json({ message: 'ليس لديك صلاحية لعرض مصروفات هذا المشروع.' });
        } else if (userRole !== 'engineer') { // Admins/Account Managers can see any project
            query.projectId = projectId;
        }
    }
    
    if (vendorId) {
        query.vendorId = vendorId;
    }
    if (categoryId) {
        query.categoryId = categoryId;
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
            .populate('createdBy', 'name');        // جلب اسم من أنشأ المصروف
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
            .populate('createdBy', 'name')
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
            .populate('createdBy', 'name'); // Populate who created it

        if (!expense) {
            return res.status(404).json({ message: 'المصروف غير موجود.' });
        }

        // Engineer can only view expenses related to projects they are assigned to
        if (userRole === 'engineer') {
            const project = await Project.findById(expense.projectId);
            if (!project || (project.engineerId && project.engineerId.toString() !== userId.toString())) {
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
    const { amount, description, date, categoryId, vendorId, attachment, projectId } = req.body; // Added projectId to body for validation
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
            // Check if the expense was created by the current engineer, or if it's their project
            const project = await Project.findById(expense.projectId);
            const isEngineerProject = project && project.engineerId && project.engineerId.toString() === userId.toString();
            const isCreatedByEngineer = expense.createdBy && expense.createdBy.toString() === userId.toString();

            if (!isEngineerProject && !isCreatedByEngineer) {
                return res.status(403).json({ message: 'ليس لديك صلاحية لتعديل هذا المصروف.' });
            }

            // If engineer, ensure the expense's project is still one of their projects if projectId is updated
            if (projectId && projectId.toString() !== expense.projectId.toString()) {
                const newProject = await Project.findById(projectId);
                if (!newProject || newProject.engineerId.toString() !== userId.toString()) {
                    return res.status(403).json({ message: 'لا يمكنك نقل المصروف إلى مشروع لست مسؤولاً عنه.' });
                }
            }
        }
        
        const oldAmount = expense.amount;
        const newAmount = amount !== undefined ? amount : oldAmount; // Use new amount if provided, else old

        if (oldAmount !== newAmount) {
            // Find the transaction associated with this expense
            // We need to find the specific transaction that matches this expense, not just by project and user
            const transaction = await Transaction.findOne({ 
                relatedProject: expense.projectId, 
                relatedUser: expense.createdBy, // The user who created the expense
                type: 'expense_from_custody',
                amount: oldAmount, // Find the transaction with the old amount
                // Add more specific fields to uniquely identify the transaction related to THIS expense
                // For example, if expense has a transactionId field, or check description
            });

            if (transaction && transaction.treasury) { // Only if it was an expense from custody
                const engineerCustodyTreasury = await Treasury.findById(transaction.treasury);

                if (engineerCustodyTreasury) {
                    // Revert old amount, then apply new amount
                    engineerCustodyTreasury.balance += oldAmount; 
                    if (engineerCustodyTreasury.balance < newAmount) { 
                        return res.status(400).json({ message: 'الرصيد في خزينة العهدة غير كافٍ بعد التعديل.' });
                    }
                    engineerCustodyTreasury.balance -= newAmount; 
                    await engineerCustodyTreasury.save();

                    // Update the transaction record
                    transaction.amount = newAmount;
                    transaction.description = `تعديل مصروف للمشروع ${expense.projectId}: ${description}`; // Update description
                    transaction.date = new Date(date); // Update date if it changed
                    await transaction.save();
                } else {
                     // This case should ideally not happen if transaction has a treasury reference
                     console.warn(`Transaction ${transaction._id} references missing treasury ${transaction.treasury}`);
                }
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

        const updatedExpense = await expense.save();
        // Populate fields for the response
        const populatedExpense = await Expense.findById(updatedExpense._id)
            .populate('projectId', 'name address')
            .populate('categoryId', 'name')
            .populate('vendorId', 'name')
            .populate('createdBy', 'name'); // Populate who created it
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

        // استعادة المبلغ إلى الخزينة إذا كان مصروف عهدة
        const transaction = await Transaction.findOne({ 
            relatedProject: expense.projectId, 
            relatedUser: expense.createdBy, // The user who created the expense
            type: 'expense_from_custody',
            amount: expense.amount, // Match by amount to be more specific
            // Add more specific fields to uniquely identify the transaction related to THIS expense
        });

        if (transaction && transaction.treasury) { // Only if it was an expense from custody
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
