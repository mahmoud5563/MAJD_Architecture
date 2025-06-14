// backend/routes/agreementRoutes.js
const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const Agreement = require('../models/Agreement');
const Project = require('../models/Project'); // نحتاجها للتحقق من صلاحية المهندس

// @desc    إضافة اتفاق جديد (التزام مالي)
// @route   POST /api/agreements
// @access  Private (للمديرين والمهندسين)
router.post('/', protect(['admin', 'account_manager', 'engineer']), async (req, res) => {
    const { contractorId, projectId, amount, description, date } = req.body;
    const createdByUserId = req.user._id;
    const userRole = req.user.role;

    // التحقق من المدخلات الأساسية
    if (!contractorId || !projectId || !amount || !date) {
        return res.status(400).json({ message: 'الرجاء توفير جميع حقول الاتفاق المطلوبة (المقاول، المشروع، المبلغ، التاريخ).' });
    }
    if (amount <= 0) {
        return res.status(400).json({ message: 'المبلغ المستحق يجب أن يكون رقماً موجباً.' });
    }

    try {
        // إذا كان المستخدم مهندس، تأكد أنه مسؤول عن المشروع الذي يتم الاتفاق عليه
        if (userRole === 'engineer') {
            const project = await Project.findById(projectId);
            if (!project || (project.engineerId && project.engineerId.toString() !== createdByUserId.toString())) {
                return res.status(403).json({ message: 'ليس لديك صلاحية لإنشاء اتفاقات لهذا المشروع.' });
            }
        }

        const agreement = await Agreement.create({
            contractorId,
            projectId,
            amount,
            description,
            date,
            createdBy: createdByUserId,
        });

        res.status(201).json(agreement);
    } catch (error) {
        console.error('Error adding agreement:', error);
        res.status(500).json({ message: 'فشل إضافة الاتفاق.', error: error.message });
    }
});

// @desc    جلب جميع الاتفاقات (مع إمكانية الفلترة بالمقاول أو المشروع)
// @route   GET /api/agreements
// @access  Private (يتطلب تسجيل دخول)
router.get('/', protect(), async (req, res) => {
    const { contractorId, projectId, search } = req.query;
    const userRole = req.user.role;
    const userId = req.user._id;

    let query = {};

    // فلترة للمهندسين: فقط الاتفاقات المتعلقة بمشاريعهم
    if (userRole === 'engineer') {
        const engineerProjects = await Project.find({ engineerId: userId }).select('_id');
        const projectIds = engineerProjects.map(p => p._id);
        query.projectId = { $in: projectIds };
    }

    if (contractorId) {
        query.contractorId = contractorId;
    }
    if (projectId) {
        // إذا كان projectId محددًا للمهندس، تأكد أنه ضمن مشاريعه
        if (userRole === 'engineer' && query.projectId && !query.projectId.$in.some(id => id.toString() === projectId)) {
             return res.status(403).json({ message: 'ليس لديك صلاحية لعرض اتفاقات هذا المشروع.' });
        } else if (userRole !== 'engineer') { // لغير المهندس، يمكن جلب أي مشروع
            query.projectId = projectId;
        }
    }
    if (search) {
        query.description = { $regex: search, $options: 'i' };
    }

    try {
        const agreements = await Agreement.find(query)
            .populate('contractorId', 'name') // جلب اسم المقاول
            .populate('projectId', 'name')    // جلب اسم المشروع
            .populate('createdBy', 'name');   // جلب اسم المستخدم الذي أنشأ الاتفاق
        res.json(agreements);
    } catch (error) {
        console.error('Error fetching agreements:', error);
        res.status(500).json({ message: 'فشل جلب الاتفاقات.', error: error.message });
    }
});

// @desc    جلب اتفاق واحد بواسطة ID
// @route   GET /api/agreements/:id
// @access  Private (يتطلب تسجيل دخول)
router.get('/:id', protect(), async (req, res) => {
    const userRole = req.user.role;
    const userId = req.user._id;

    try {
        const agreement = await Agreement.findById(req.params.id)
            .populate('contractorId', 'name')
            .populate('projectId', 'name')
            .populate('createdBy', 'name');

        if (!agreement) {
            return res.status(404).json({ message: 'الاتفاق غير موجود.' });
        }

        // Engineer can only view agreements related to projects they are assigned to
        if (userRole === 'engineer') {
            const project = await Project.findById(agreement.projectId);
            if (!project || (project.engineerId && project.engineerId.toString() !== userId.toString())) {
                return res.status(403).json({ message: 'ليس لديك صلاحية لعرض تفاصيل هذا الاتفاق.' });
            }
        }

        res.json(agreement);
    } catch (error) {
        console.error('Error fetching agreement by ID:', error);
        res.status(500).json({ message: 'فشل جلب الاتفاق.', error: error.message });
    }
});

// @desc    تعديل اتفاق بواسطة ID
// @route   PUT /api/agreements/:id
// @access  Private (للمديرين والمهندسين)
router.put('/:id', protect(['admin', 'account_manager', 'engineer']), async (req, res) => {
    const { contractorId, projectId, amount, description, date, status } = req.body;
    const userRole = req.user.role;
    const userId = req.user._id;

    if (amount !== undefined && amount < 0) { // Allow amount 0 for completed agreements
        return res.status(400).json({ message: 'المبلغ المستحق يجب أن يكون رقماً موجباً أو صفراً.' });
    }

    try {
        const agreement = await Agreement.findById(req.params.id);

        if (!agreement) {
            return res.status(404).json({ message: 'الاتفاق غير موجود.' });
        }

        // Engineer can only modify agreements related to projects they are assigned to
        if (userRole === 'engineer') {
            const project = await Project.findById(agreement.projectId);
            if (!project || (project.engineerId && project.engineerId.toString() !== userId.toString())) {
                return res.status(403).json({ message: 'ليس لديك صلاحية لتعديل هذا الاتفاق.' });
            }
            // Engineer cannot change project or contractor of an agreement after creation
            if (projectId && projectId.toString() !== agreement.projectId.toString()) {
                return res.status(403).json({ message: 'المهندس لا يمكنه تغيير المشروع المرتبط بالاتفاق.' });
            }
            if (contractorId && contractorId.toString() !== agreement.contractorId.toString()) {
                return res.status(403).json({ message: 'المهندس لا يمكنه تغيير المقاول المرتبط بالاتفاق.' });
            }
            // Engineer cannot change agreement status to anything other than active or completed if needed
            // For simplicity, allow engineers to update their agreements' status.
        }

        agreement.contractorId = contractorId !== undefined ? contractorId : agreement.contractorId;
        agreement.projectId = projectId !== undefined ? projectId : agreement.projectId;
        agreement.amount = amount !== undefined ? amount : agreement.amount;
        agreement.description = description !== undefined ? description : agreement.description;
        agreement.date = date !== undefined ? date : agreement.date;
        agreement.status = status !== undefined ? status : agreement.status;

        const updatedAgreement = await agreement.save();

        const populatedAgreement = await Agreement.findById(updatedAgreement._id)
            .populate('contractorId', 'name')
            .populate('projectId', 'name')
            .populate('createdBy', 'name');
            
        res.json(populatedAgreement);
    } catch (error) {
        console.error('Error updating agreement:', error);
        res.status(500).json({ message: 'فشل تحديث الاتفاق.', error: error.message });
    }
});

// @desc    حذف اتفاق
// @route   DELETE /api/agreements/:id
// @access  Private (للمديرين والآدمن)
router.delete('/:id', protect(['admin', 'account_manager']), async (req, res) => { // فقط للآدمن ومدير الحسابات للحذف
    try {
        const agreement = await Agreement.findById(req.params.id);

        if (!agreement) {
            return res.status(404).json({ message: 'الاتفاق غير موجود.' });
        }

        await agreement.deleteOne();
        res.json({ message: 'تم حذف الاتفاق بنجاح.' });
    } catch (error) {
        console.error('Error deleting agreement:', error);
        res.status(500).json({ message: 'فشل حذف الاتفاق.', error: error.message });
    }
});

module.exports = router;
