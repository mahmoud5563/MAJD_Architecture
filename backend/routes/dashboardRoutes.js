// backend/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware'); 
const Project = require('../models/Project'); // استيراد موديل المشروع
const Client = require('../models/Client');   // استيراد موديل العميل

// @desc    جلب بيانات ملخص لوحة التحكم (Dashboard)
// @route   GET /api/dashboard/summary
// @access  Private (يتطلب تسجيل دخول)
router.get('/summary', protect(), async (req, res) => {
    try {
        // جلب عدد العملاء
        const clientsCount = await Client.countDocuments();

        // جلب إجمالي عدد المشاريع
        const totalProjectsCount = await Project.countDocuments();

        // جلب عدد المشاريع الجارية
        const ongoingProjectsCount = await Project.countDocuments({ status: 'ongoing' });

        // جلب عدد المشاريع المنتهية
        const completedProjectsCount = await Project.countDocuments({ status: 'completed' });

        // يمكنك جلب المزيد من البيانات هنا لاحقاً
        // مثلاً: آخر المشاريع المضافة، ملخص مالي، إلخ.

        res.json({
            clientsCount,
            totalProjectsCount,
            ongoingProjectsCount,
            completedProjectsCount,
            // يمكن إضافة المزيد من البيانات هنا لاحقاً
        });
    } catch (error) {
        console.error('Error fetching dashboard summary:', error);
        res.status(500).json({ message: 'فشل جلب بيانات لوحة التحكم.', error: error.message });
    }
});

module.exports = router;
