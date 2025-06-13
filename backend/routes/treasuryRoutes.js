// backend/routes/treasuryRoutes.js
const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const Treasury = require('../models/Treasury');
const Transaction = require('../models/Transaction'); // لإنشاء سجلات المعاملات
const User = require('../models/User'); // لجلب بيانات المهندس
const Project = require('../models/Project'); // NEW: لفلترة المشروع

// @desc    إنشاء خزينة رئيسية (إذا لم تكن موجودة) أو خزينة عهد
//          للاستخدام الداخلي أو الإعداد الأولي فقط
// @route   POST /api/treasuries
// @access  Private (فقط للآدمن)
router.post('/', protect(['admin']), async (req, res) => {
    const { name, type, userId, initialBalance = 0 } = req.body;

    if (!name || !type) {
        return res.status(400).json({ message: 'الرجاء توفير اسم ونوع الخزينة.' });
    }

    try {
        let treasury;
        if (type === 'main') {
            treasury = await Treasury.findOne({ type: 'main' });
            if (treasury) {
                return res.status(409).json({ message: 'الخزينة الرئيسية موجودة بالفعل.' });
            }
            treasury = await Treasury.create({ name, type, balance: initialBalance });

            // سجل المعاملة الأولية للخزينة الرئيسية
            await Transaction.create({
                amount: initialBalance,
                type: 'deposit_main',
                description: `إيداع رصيد أولي للخزينة الرئيسية`,
                date: new Date(),
                treasury: treasury._id,
                createdBy: req.user._id,
            });

        } else if (type === 'custody') {
            if (!userId) {
                return res.status(400).json({ message: 'معرف المستخدم مطلوب لخزينة العهدة.' });
            }
            treasury = await Treasury.findOne({ type: 'custody', userId });
            if (treasury) {
                return res.status(409).json({ message: 'هذا المهندس لديه خزينة عهدة بالفعل.' });
            }
            const user = await User.findById(userId);
            if (!user || user.role !== 'engineer') {
                return res.status(404).json({ message: 'المستخدم غير موجود أو ليس مهندساً.' });
            }
            treasury = await Treasury.create({ name, type, userId, balance: initialBalance });
        } else {
            return res.status(400).json({ message: 'نوع خزينة غير صالح.' });
        }

        res.status(201).json(treasury);
    } catch (error) {
        console.error('Error creating treasury:', error);
        res.status(500).json({ message: 'فشل إنشاء الخزينة.', error: error.message });
    }
});

// @desc    جلب أرصدة الخزائن (الرئيسية، أو عهدة مهندس معين)
// @route   GET /api/treasuries
// @access  Private (لجميع الأدوار، ولكن بفلترة حسب الدور)
router.get('/', protect(), async (req, res) => {
    const userRole = req.user.role;
    const userId = req.user._id;

    let query = {};

    if (userRole === 'admin' || userRole === 'account_manager') {
        // الآدمن ومدير الحسابات يمكنهما رؤية كل الخزائن
        // يمكن إضافة فلترة هنا إذا كانوا يريدون خزينة معينة فقط
        if (req.query.type) {
            query.type = req.query.type;
        }
        if (req.query.userId) { // لجلب خزينة عهدة لمهندس معين (من قبل آدمن/مدير حسابات)
            query.userId = req.query.userId;
        }
    } else if (userRole === 'engineer') {
        // المهندس يرى خزينة العهد الخاصة به فقط
        query.type = 'custody';
        query.userId = userId;
    } else {
        return res.status(403).json({ message: 'ليس لديك صلاحية لعرض الخزائن.' });
    }

    try {
        const treasuries = await Treasury.find(query)
            .populate('userId', 'username email'); // جلب بيانات المهندس المرتبط
        res.json(treasuries);
    } catch (error) {
        console.error('Error fetching treasuries:', error);
        res.status(500).json({ message: 'فشل جلب الخزائن.', error: error.message });
    }
});

// @desc    جلب خزينة واحدة بواسطة ID (للاختبار/الاستخدام الداخلي)
// @route   GET /api/treasuries/:id
// @access  Private (لجميع الأدوار، ولكن مع تحقق من صلاحية الوصول)
router.get('/:id', protect(), async (req, res) => {
    const userRole = req.user.role;
    const userId = req.user._id;

    try {
        const treasury = await Treasury.findById(req.params.id)
            .populate('userId', 'username email');

        if (!treasury) {
            return res.status(404).json({ message: 'الخزينة غير موجودة.' });
        }

        // تحقق من الصلاحيات:
        // المهندس لا يمكنه رؤية سوى خزينته الخاصة
        if (userRole === 'engineer' && (treasury.type !== 'custody' || treasury.userId.toString() !== userId.toString())) {
            return res.status(403).json({ message: 'ليس لديك صلاحية لعرض هذه الخزينة.' });
        }
        // الآدمن ومدير الحسابات يمكنهما رؤية الكل (مغطاة بـ protect)

        res.json(treasury);
    } catch (error) {
        console.error('Error fetching treasury by ID:', error);
        res.status(500).json({ message: 'فشل جلب الخزينة.', error: error.message });
    }
});


// @desc    إيداع أموال في الخزينة الرئيسية
// @route   POST /api/treasuries/deposit
// @access  Private (للمديرين فقط)
router.post('/deposit', protect(['admin', 'account_manager']), async (req, res) => {
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'المبلغ يجب أن يكون رقماً موجباً.' });
    }
    if (!description) {
        return res.status(400).json({ message: 'الرجاء توفير وصف لعملية الإيداع.' });
    }

    try {
        const mainTreasury = await Treasury.findOne({ type: 'main' });
        if (!mainTreasury) {
            return res.status(404).json({ message: 'الخزينة الرئيسية غير موجودة.' });
        }

        mainTreasury.balance += amount;
        await mainTreasury.save();

        await Transaction.create({
            amount,
            type: 'deposit_main',
            description,
            date: new Date(),
            treasury: mainTreasury._id,
            createdBy: req.user._id,
        });

        res.status(200).json({ message: 'تم الإيداع بنجاح.', newBalance: mainTreasury.balance });
    } catch (error) {
        console.error('Error depositing to main treasury:', error);
        res.status(500).json({ message: 'فشل عملية الإيداع.', error: error.message });
    }
});

// @desc    سحب أموال من الخزينة الرئيسية
// @route   POST /api/treasuries/withdrawal
// @access  Private (للمديرين فقط)
router.post('/withdrawal', protect(['admin', 'account_manager']), async (req, res) => {
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'المبلغ يجب أن يكون رقماً موجباً.' });
    }
    if (!description) {
        return res.status(400).json({ message: 'الرجاء توفير وصف لعملية السحب.' });
    }

    try {
        const mainTreasury = await Treasury.findOne({ type: 'main' });
        if (!mainTreasury) {
            return res.status(404).json({ message: 'الخزينة الرئيسية غير موجودة.' });
        }
        if (mainTreasury.balance < amount) {
            return res.status(400).json({ message: 'الرصيد غير كافٍ لإتمام عملية السحب.' });
        }

        mainTreasury.balance -= amount;
        await mainTreasury.save();

        await Transaction.create({
            amount,
            type: 'withdrawal_main',
            description,
            date: new Date(),
            treasury: mainTreasury._id,
            createdBy: req.user._id,
        });

        res.status(200).json({ message: 'تم السحب بنجاح.', newBalance: mainTreasury.balance });
    } catch (error) {
        console.error('Error withdrawing from main treasury:', error);
        res.status(500).json({ message: 'فشل عملية السحب.', error: error.message });
    }
});


// @desc    تعيين عهدة لمهندس (تحويل من الخزينة الرئيسية إلى خزينة العهدة)
// @route   POST /api/treasuries/assign-custody
// @access  Private (فقط للآدمن ومدير الحسابات)
router.post('/assign-custody', protect(['admin', 'account_manager']), async (req, res) => {
    const { engineerId, amount, description, projectId } = req.body; // NEW: Add projectId

    if (!engineerId || !amount || amount <= 0) {
        return res.status(400).json({ message: 'معرف المهندس والمبلغ الموجب مطلوبان.' });
    }
    if (!description) {
        return res.status(400).json({ message: 'الرجاء توفير وصف لتعيين العهدة.' });
    }
    // NEW: projectId is now required for custody assignment
    if (!projectId) {
        return res.status(400).json({ message: 'الرجاء اختيار مشروع لتعيين العهدة.' });
    }

    try {
        const engineer = await User.findById(engineerId);
        if (!engineer || engineer.role !== 'engineer') {
            return res.status(404).json({ message: 'المهندس غير موجود أو ليس مهندساً.' });
        }

        // NEW: Check if the project exists
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'المشروع المحدد غير موجود.' });
        }
        // NEW: Optional - Check if the engineer is actually assigned to this project
        // This is a business logic decision. For now, we allow assigning custody to an engineer for any project.
        // If you want to enforce that the engineer must be assigned to the project, uncomment/add similar logic.
        /*
        if (project.engineerId && project.engineerId.toString() !== engineerId) {
            return res.status(400).json({ message: 'المهندس المحدد ليس مسؤولاً عن هذا المشروع.' });
        }
        */

        const mainTreasury = await Treasury.findOne({ type: 'main' });
        if (!mainTreasury) {
            return res.status(404).json({ message: 'الخزينة الرئيسية غير موجودة.' });
        }
        if (mainTreasury.balance < amount) {
            return res.status(400).json({ message: 'الرصيد في الخزينة الرئيسية غير كافٍ لتعيين العهدة.' });
        }

        let engineerCustodyTreasury = await Treasury.findOne({ type: 'custody', userId: engineerId });

        if (!engineerCustodyTreasury) {
            // إذا لم يكن للمهندس خزينة عهدة، أنشئ واحدة له
            engineerCustodyTreasury = await Treasury.create({
                name: `عهد ${engineer.username}`,
                type: 'custody',
                userId: engineerId,
                balance: 0 // سيزيد الرصيد بالأسفل
            });
        }

        // خصم المبلغ من الخزينة الرئيسية
        mainTreasury.balance -= amount;
        await mainTreasury.save();

        // إضافة المبلغ إلى خزينة عهدة المهندس
        engineerCustodyTreasury.balance += amount;
        await engineerCustodyTreasury.save();

        // سجل المعاملة: تحويل من الخزينة الرئيسية
        await Transaction.create({
            amount,
            type: 'custody_assignment',
            description: `تحويل عهدة إلى ${engineer.username} للمشروع ${project.name}: ${description}`, // NEW: Include project name in description
            date: new Date(),
            treasury: mainTreasury._id, // المعاملة الأصلية من الخزينة الرئيسية
            relatedUser: engineerId, // المهندس الذي استلم العهدة
            relatedProject: projectId, // NEW: Link to project
            createdBy: req.user._id,
        });

        // سجل معاملة منفصلة لخزينة عهدة المهندس (نوع مختلف ليتم تتبعها بسهولة)
        await Transaction.create({
            amount,
            type: 'income_to_custody', // نوع جديد لإيراد العهدة
            description: `استلام عهدة من الشركة للمشروع ${project.name}: ${description}`, // NEW: Include project name in description
            date: new Date(),
            treasury: engineerCustodyTreasury._id, // خزينة العهدة
            relatedUser: engineerId,
            relatedProject: projectId, // NEW: Link to project
            createdBy: req.user._id,
        });


        res.status(200).json({
            message: `تم تعيين عهدة بقيمة ${amount} جنيه للمهندس ${engineer.username} بنجاح.`,
            mainTreasuryBalance: mainTreasury.balance,
            engineerCustodyBalance: engineerCustodyTreasury.balance
        });

    } catch (error) {
        console.error('Error assigning custody:', error);
        res.status(500).json({ message: 'فشل تعيين العهدة.', error: error.message });
    }
});


// @desc    حذف خزينة (فقط لعهد المهندس، وليست الرئيسية)
// @route   DELETE /api/treasuries/:id
// @access  Private (للمديرين فقط)
router.delete('/:id', protect(['admin', 'account_manager']), async (req, res) => {
    try {
        const treasury = await Treasury.findById(req.params.id);

        if (!treasury) {
            return res.status(404).json({ message: 'الخزينة غير موجودة.' });
        }
        if (treasury.type === 'main') {
            return res.status(403).json({ message: 'لا يمكن حذف الخزينة الرئيسية.' });
        }
        if (treasury.balance > 0) {
            return res.status(400).json({ message: 'لا يمكن حذف خزينة عهدة تحتوي على رصيد. يرجى تصفيرها أولاً.' });
        }

        // حذف جميع المعاملات المرتبطة بهذه الخزينة
        await Transaction.deleteMany({ treasury: treasury._id });

        await treasury.deleteOne();
        res.json({ message: 'تم حذف الخزينة ومعاملاتها المرتبطة بنجاح.' });
    } catch (error) {
        console.error('Error deleting treasury:', error);
        res.status(500).json({ message: 'فشل حذف الخزينة.', error: error.message });
    }
});


module.exports = router;
