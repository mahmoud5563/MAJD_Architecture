// backend/routes/categoryRoutes.js
const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const Category = require('../models/Category'); // استيراد موديل التصنيف

// @desc    إضافة تصنيف جديد
// @route   POST /api/categories
// @access  Private (للآدمن ومدير الحسابات والمهندس)
router.post('/', protect(['admin', 'account_manager', 'engineer']), async (req, res) => {
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ message: 'الرجاء توفير اسم التصنيف.' });
    }

    try {
        const categoryExists = await Category.findOne({ name });
        if (categoryExists) {
            return res.status(400).json({ message: 'هذا التصنيف موجود بالفعل.' });
        }
        const category = await Category.create({ name });
        res.status(201).json(category);
    } catch (error) {
        console.error('Error adding category:', error);
        res.status(500).json({ message: 'فشل إضافة التصنيف.', error: error.message });
    }
});

// @desc    جلب جميع التصنيفات
// @route   GET /api/categories
// @access  Private (يتطلب تسجيل دخول - جميع الأدوار)
router.get('/', protect(), async (req, res) => {
    try {
        const categories = await Category.find({}).sort({ name: 1 }); // فرز أبجدي
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'فشل جلب التصنيفات.', error: error.message });
    }
});

// @desc    جلب تصنيف واحد بواسطة ID
// @route   GET /api/categories/:id
// @access  Private (يتطلب تسجيل دخول - جميع الأدوار)
router.get('/:id', protect(), async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ message: 'التصنيف غير موجود.' });
        }
        res.json(category);
    } catch (error) {
        console.error('Error fetching category by ID:', error);
        res.status(500).json({ message: 'فشل جلب التصنيف.', error: error.message });
    }
});

// @desc    تعديل اسم تصنيف بواسطة ID
// @route   PUT /api/categories/:id
// @access  Private (للآدمن ومدير الحسابات والمهندس)
router.put('/:id', protect(['admin', 'account_manager', 'engineer']), async (req, res) => {
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ message: 'الرجاء توفير اسم التصنيف.' });
    }

    try {
        const category = await Category.findById(req.params.id);

        if (!category) {
            return res.status(404).json({ message: 'التصنيف غير موجود.' });
        }

        // التحقق إذا كان الاسم الجديد موجود بالفعل لتصنيف آخر
        const existingCategory = await Category.findOne({ name, _id: { $ne: req.params.id } });
        if (existingCategory) {
            return res.status(400).json({ message: 'هذا الاسم موجود بالفعل لتصنيف آخر.' });
        }

        category.name = name;
        const updatedCategory = await category.save();
        res.json(updatedCategory);
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ message: 'فشل تحديث التصنيف.', error: error.message });
    }
});

// @desc    حذف تصنيف
// @route   DELETE /api/categories/:id
// @access  Private (للآدمن ومدير الحسابات والمهندس)
router.delete('/:id', protect(['admin', 'account_manager', 'engineer']), async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);

        if (!category) {
            return res.status(404).json({ message: 'التصنيف غير موجود.' });
        }

        await category.deleteOne();
        res.json({ message: 'تم حذف التصنيف بنجاح.' });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ message: 'فشل حذف التصنيف.', error: error.message });
    }
});

module.exports = router;
