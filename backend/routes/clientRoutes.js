// backend/routes/clientRoutes.js
const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const Client = require('../models/Client'); // استيراد موديل العميل

// @desc    إضافة عميل جديد
// @route   POST /api/clients
// @access  Private (للمديرين فقط)
router.post('/', protect(['admin', 'account_manager']), async (req, res) => {
    const { name, email, phone, company, notes } = req.body;

    // التحقق الأساسي من المدخلات
    if (!name || !phone) {
        return res.status(400).json({ message: 'الرجاء توفير اسم العميل ورقم الهاتف.' });
    }

    try {
        const client = await Client.create({
            name,
            email,
            phone,
            company,
            notes,
        });
        res.status(201).json(client);
    } catch (error) {
        console.error('Error adding client:', error);
        res.status(500).json({ message: 'فشل إضافة العميل.', error: error.message });
    }
});

// @desc    جلب جميع العملاء
// @route   GET /api/clients
// @access  Private (يتطلب تسجيل دخول)
router.get('/', protect(), async (req, res) => {
    const { search } = req.query;
    let query = {};

    if (search) {
        // البحث بالاسم أو البريد الإلكتروني أو الهاتف (case-insensitive)
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } }
        ];
    }

    try {
        const clients = await Client.find(query).sort({ createdAt: -1 }); // فرز من الأحدث للأقدم
        res.json(clients);
    } catch (error) {
        console.error('Error fetching clients:', error);
        res.status(500).json({ message: 'فشل جلب العملاء.', error: error.message });
    }
});

// @desc    جلب عميل واحد بواسطة ID
// @route   GET /api/clients/:id
// @access  Private (يتطلب تسجيل دخول)
router.get('/:id', protect(), async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);
        if (!client) {
            return res.status(404).json({ message: 'العميل غير موجود.' });
        }
        res.json(client);
    } catch (error) {
        console.error('Error fetching client by ID:', error);
        res.status(500).json({ message: 'فشل جلب العميل.', error: error.message });
    }
});

// @desc    تعديل بيانات عميل بواسطة ID
// @route   PUT /api/clients/:id
// @access  Private (للمديرين فقط)
router.put('/:id', protect(['admin', 'account_manager']), async (req, res) => {
    const { name, email, phone, company, notes } = req.body;

    try {
        const client = await Client.findById(req.params.id);

        if (!client) {
            return res.status(404).json({ message: 'العميل غير موجود.' });
        }

        // تحديث الحقول
        client.name = name || client.name;
        client.email = email || client.email;
        client.phone = phone || client.phone;
        client.company = company || client.company;
        client.notes = notes || client.notes;

        const updatedClient = await client.save();
        res.json(updatedClient);
    } catch (error) {
        console.error('Error updating client:', error);
        res.status(500).json({ message: 'فشل تحديث العميل.', error: error.message });
    }
});

// @desc    حذف عميل
// @route   DELETE /api/clients/:id
// @access  Private (للمديرين فقط)
router.delete('/:id', protect(['admin', 'account_manager']), async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);

        if (!client) {
            return res.status(404).json({ message: 'العميل غير موجود.' });
        }

        await client.deleteOne();
        res.json({ message: 'تم حذف العميل بنجاح.' });
    } catch (error) {
        console.error('Error deleting client:', error);
        res.status(500).json({ message: 'فشل حذف العميل.', error: error.message });
    }
});

module.exports = router;
