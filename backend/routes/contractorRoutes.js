// backend/routes/contractorRoutes.js
const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const Contractor = require('../models/Contractor'); // استيراد موديل المقاول

// @desc    إضافة مقاول جديد
// @route   POST /api/contractors
// @access  Private (للمديرين فقط)
router.post('/', protect(['admin', 'account_manager']), async (req, res) => {
    const { name, email, phone, specialty, notes } = req.body;

    // التحقق الأساسي من المدخلات
    if (!name || !phone) {
        return res.status(400).json({ message: 'الرجاء توفير اسم المقاول ورقم الهاتف.' });
    }

    try {
        const contractor = await Contractor.create({
            name,
            email,
            phone,
            specialty,
            notes,
        });
        res.status(201).json(contractor);
    } catch (error) {
        console.error('Error adding contractor:', error);
        res.status(500).json({ message: 'فشل إضافة المقاول.', error: error.message });
    }
});

// @desc    جلب جميع المقاولين
// @route   GET /api/contractors
// @access  Private (يتطلب تسجيل دخول)
router.get('/', protect(), async (req, res) => {
    const { search } = req.query;
    let query = {};

    if (search) {
        // البحث بالاسم أو البريد الإلكتروني أو الهاتف أو التخصص (case-insensitive)
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
            { specialty: { $regex: search, $options: 'i' } }
        ];
    }

    try {
        const contractors = await Contractor.find(query).sort({ createdAt: -1 }); // فرز من الأحدث للأقدم
        res.json(contractors);
    } catch (error) {
        console.error('Error fetching contractors:', error);
        res.status(500).json({ message: 'فشل جلب المقاولين.', error: error.message });
    }
});

// @desc    جلب مقاول واحد بواسطة ID
// @route   GET /api/contractors/:id
// @access  Private (يتطلب تسجيل دخول)
router.get('/:id', protect(), async (req, res) => {
    try {
        const contractor = await Contractor.findById(req.params.id);
        if (!contractor) {
            return res.status(404).json({ message: 'المقاول غير موجود.' });
        }
        res.json(contractor);
    } catch (error) {
        console.error('Error fetching contractor by ID:', error);
        res.status(500).json({ message: 'فشل جلب المقاول.', error: error.message });
    }
});

// @desc    تعديل بيانات مقاول بواسطة ID
// @route   PUT /api/contractors/:id
// @access  Private (للمديرين فقط)
router.put('/:id', protect(['admin', 'account_manager']), async (req, res) => {
    const { name, email, phone, specialty, notes } = req.body;

    try {
        const contractor = await Contractor.findById(req.params.id);

        if (!contractor) {
            return res.status(404).json({ message: 'المقاول غير موجود.' });
        }

        // تحديث الحقول
        contractor.name = name || contractor.name;
        contractor.email = email || contractor.email;
        contractor.phone = phone || contractor.phone;
        contractor.specialty = specialty || contractor.specialty;
        contractor.notes = notes || contractor.notes;

        const updatedContractor = await contractor.save();
        res.json(updatedContractor);
    } catch (error) {
        console.error('Error updating contractor:', error);
        res.status(500).json({ message: 'فشل تحديث المقاول.', error: error.message });
    }
});

// @desc    حذف مقاول
// @route   DELETE /api/contractors/:id
// @access  Private (للمديرين فقط)
router.delete('/:id', protect(['admin', 'account_manager']), async (req, res) => {
    try {
        const contractor = await Contractor.findById(req.params.id);

        if (!contractor) {
            return res.status(404).json({ message: 'المقاول غير موجود.' });
        }

        await contractor.deleteOne();
        res.json({ message: 'تم حذف المقاول بنجاح.' });
    } catch (error) {
        console.error('Error deleting contractor:', error);
        res.status(500).json({ message: 'فشل حذف المقاول.', error: error.message });
    }
});

module.exports = router;
