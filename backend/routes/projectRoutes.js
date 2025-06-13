// backend/routes/projectRoutes.js
const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const Project = require('../models/Project');
const User = require('../models/User'); // استيراد موديل المستخدم لجلب معلومات المهندس

// @desc    إضافة مشروع جديد
// @route   POST /api/projects
// @access  Private (للآدمن ومدير الحسابات والمهندس)
router.post('/', protect(['admin', 'account_manager', 'engineer']), async (req, res) => {
    const { name, address, description, startDate, endDate, client, notes, status, engineerId } = req.body;

    // التحقق من المدخلات الأساسية
    if (!name || !address || !startDate) {
        return res.status(400).json({ message: 'الرجاء توفير اسم المشروع، العنوان، وتاريخ البدء.' });
    }

    // إذا كان المستخدم الحالي مهندساً:
    // 1. لا يمكنه إضافة مشروع لمهندس آخر.
    // 2. إذا لم يحدد engineerId، يتم تعيينه هو نفسه تلقائياً.
    let assignedEngineerId = engineerId; // القيمة المرسلة من الـ req.body
    if (req.user.role === 'engineer') {
        if (engineerId && req.user._id.toString() !== engineerId) {
            return res.status(403).json({ message: 'المهندس لا يمكنه إضافة مشروع لمهندس آخر.' });
        }
        assignedEngineerId = req.user._id; // المهندس يضيف المشروع لنفسه دائماً
    } else { // آدمن أو مدير حسابات
        if (engineerId === '') { // لو تم إرسال سلسلة فارغة، اجعلها null في قاعدة البيانات
            assignedEngineerId = null;
        }
    }

    try {
        const project = await Project.create({
            name,
            address,
            description,
            startDate,
            endDate,
            client: client || null, // إذا لم يرسل العميل أو كان فارغاً، اجعله null
            notes,
            status: status || 'pending', // حالة افتراضية
            engineerId: assignedEngineerId // تعيين المهندس المسؤول
        });
        res.status(201).json(project);
    } catch (error) {
        console.error('Error adding project:', error);
        res.status(500).json({ message: 'فشل إضافة المشروع.', error: error.message });
    }
});

// @desc    جلب جميع المشاريع (مع إمكانيات البحث والتصفية)
// @route   GET /api/projects
// @access  Private (يتطلب تسجيل دخول)
router.get('/', protect(), async (req, res) => {
    const { search, status, engineerId, clientId } = req.query; // Added engineerId and clientId to destructuring
    const userRole = req.user.role;
    const userId = req.user._id;

    let query = {};

    if (search) {
        // بحث شامل في حقول متعددة
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { address: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { notes: { $regex: search, $options: 'i' } },
        ];
    }
    if (status && status !== 'all') {
        query.status = status;
    }

    // فلترة المشاريع بناءً على الدور ومُعرف المهندس في الاستعلام
    if (userRole === 'engineer') {
        // المهندس يرى فقط المشاريع المعينة له
        query.engineerId = userId;
    } else { // آدمن أو مدير حسابات
        if (engineerId) { // إذا تم توفير engineerId في الاستعلام (من واجهة "عهد المهندسين" مثلاً)
            query.engineerId = engineerId;
        }
        // إذا لم يتم توفير engineerId، فسيرى المدير جميع المشاريع
    }

    // فلترة المشاريع بناءً على clientId إذا تم توفيره في الاستعلام (لصفحة تفاصيل العميل)
    if (clientId) {
        query.client = clientId;
    }

    try {
        const projects = await Project.find(query)
            .populate('client', 'name phone') // جلب اسم ورقم هاتف العميل
            .populate('engineerId', 'username') // جلب اسم المستخدم للمهندس المسؤول
            .sort({ createdAt: -1 }); // فرز من الأحدث للأقدم

        res.json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ message: 'فشل جلب المشاريع.', error: error.message });
    }
});

// @desc    جلب مشروع واحد بواسطة ID
// @route   GET /api/projects/:id
// @access  Private (يتطلب تسجيل دخول)
router.get('/:id', protect(), async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate('client', 'name phone')
            .populate('engineerId', 'username');

        if (!project) {
            return res.status(404).json({ message: 'المشروع غير موجود.' });
        }

        // تحكم في صلاحية المهندس لعرض تفاصيل مشروع معين
        if (req.user.role === 'engineer' && project.engineerId && project.engineerId._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'ليس لديك صلاحية لعرض تفاصيل هذا المشروع.' });
        }

        res.json(project);
    } catch (error) {
        console.error('Error fetching project by ID:', error);
        res.status(500).json({ message: 'فشل جلب المشروع.', error: error.message });
    }
});

// @desc    تعديل بيانات مشروع بواسطة ID
// @route   PUT /api/projects/:id
// @access  Private (للآدمن ومدير الحسابات والمهندس)
router.put('/:id', protect(['admin', 'account_manager', 'engineer']), async (req, res) => {
    const { name, address, description, startDate, endDate, client, engineerId, status, notes } = req.body;

    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'المشروع غير موجود.' });
        }

        // صلاحية المهندس: لا يمكن للمهندس تعديل مشروع ليس خاصاً به،
        // ولا يمكنه تغيير العميل أو المهندس المعين أو حالة المشروع.
        if (req.user.role === 'engineer') {
            if (!project.engineerId || project.engineerId.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: 'ليس لديك صلاحية لتعديل هذا المشروع.' });
            }
            if (client !== undefined && client !== project.client?.toString()) {
                return res.status(403).json({ message: 'ليس لديك صلاحية لتغيير العميل المعين للمشروع.' });
            }
            if (engineerId !== undefined && engineerId !== project.engineerId?.toString()) {
                return res.status(403).json({ message: 'ليس لديك صلاحية لتغيير المهندس المعين للمشروع.' });
            }
            if (status && status !== project.status) {
                return res.status(403).json({ message: 'ليس لديك صلاحية لتغيير حالة المشروع.' });
            }
        }

        // تحديث الحقول
        project.name = name || project.name;
        project.address = address || project.address;
        project.description = description || project.description;
        project.startDate = startDate || project.startDate;
        project.endDate = endDate || project.endDate;
        project.client = client === '' ? null : client; // لو تم إرسال قيمة فارغة، اجعلها null
        project.engineerId = engineerId === '' ? null : engineerId; // لو تم إرسال قيمة فارغة، اجعلها null
        project.status = status || project.status;
        project.notes = notes || project.notes;

        const updatedProject = await project.save();
        res.json(updatedProject);
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ message: 'فشل تحديث المشروع.', error: error.message });
    }
});

// @desc    تغيير حالة المشروع
// @route   PUT /api/projects/:id/status
// @access  Private (للمديرين فقط)
router.put('/:id/status', protect(['admin', 'account_manager']), async (req, res) => {
    const { status } = req.body;

    if (!status || !['pending', 'ongoing', 'completed'].includes(status)) {
        return res.status(400).json({ message: 'حالة المشروع غير صالحة.' });
    }

    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'المشروع غير موجود.' });
        }

        project.status = status;
        const updatedProject = await project.save();
        res.json(updatedProject);
    } catch (error) {
        console.error('Error changing project status:', error);
        res.status(500).json({ message: 'فشل تغيير حالة المشروع.', error: error.message });
    }
});

// @desc    حذف مشروع
// @route   DELETE /api/projects/:id
// @access  Private (فقط للآدمن ومدير الحسابات)
router.delete('/:id', protect(['admin', 'account_manager']), async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'المشروع غير موجود.' });
        }

        await project.deleteOne();
        res.json({ message: 'تم حذف المشروع بنجاح.' });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ message: 'فشل حذف المشروع.', error: error.message });
    }
});

module.exports = router;
