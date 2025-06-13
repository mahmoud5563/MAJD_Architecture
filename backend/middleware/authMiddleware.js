// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = (allowedRoles = []) => async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // الحصول على التوكن من الهيدر
            token = req.headers.authorization.split(' ')[1];

            // فك تشفير التوكن والتحقق منه
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // جلب المستخدم من قاعدة البيانات (بدون كلمة المرور)
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                return res.status(401).json({ message: 'المستخدم غير موجود، التوكن غير صالح.' });
            }

            // التحقق من صلاحية الدور إذا كانت محددة
            if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
                return res.status(403).json({ message: 'ليس لديك صلاحية للوصول إلى هذا المورد.' });
            }

            next(); // الاستمرار للـ Route التالي
        } catch (error) {
            console.error(error);
            return res.status(401).json({ message: 'التوكن غير صالح أو انتهت صلاحيته.' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'غير مصرح، لا يوجد توكن.' });
    }
};

module.exports = protect;