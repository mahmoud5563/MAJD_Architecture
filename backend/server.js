// backend/server.js
const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const projectRoutes = require('./routes/projectRoutes');
const clientRoutes = require('./routes/clientRoutes');
const contractorRoutes = require('./routes/contractorRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const incomeRoutes = require('./routes/incomeRoutes');
const treasuryRoutes = require('./routes/treasuryRoutes');     // استيراد راوتات الخزينة
const transactionRoutes = require('./routes/transactionRoutes'); // استيراد راوتات المعاملات
const agreementRoutes = require('./routes/agreementRoutes');   // NEW: استيراد مسارات الاتفاقات
const cors = require('cors');
const User = require('./models/User');
const Treasury = require('./models/Treasury'); // استيراد موديل Treasury
const bcrypt = require('bcryptjs');
const path = require('path');

// تهيئة dotenv لقراءة ملف .env
dotenv.config();

// الاتصال بقاعدة البيانات
connectDB();

// وظيفة لإنشاء الخزينة الرئيسية إذا لم تكن موجودة
const createMainTreasuryIfNotExist = async () => {
    try {
        const mainTreasury = await Treasury.findOne({ type: 'main' });
        if (!mainTreasury) {
            await Treasury.create({
                name: 'الخزينة الرئيسية للشركة',
                type: 'main',
                balance: 0, // تبدأ بصفر، ويمكن الإيداع فيها لاحقاً
            });
            console.log('Main Treasury created successfully.');
        } else {
            console.log('Main Treasury already exists.');
        }
    } catch (error) {
        console.error('Error creating main treasury:', error.message);
    }
};

// وظيفة لإضافة مستخدم آدمن افتراضي إذا لم يكن موجودًا (معطلة حالياً)
/*
const createDefaultAdmin = async () => {
    try {
        const adminExists = await User.findOne({ email: 'fresh_admin@majd.com' });
        if (!adminExists) {
            const rawPassword = 'fresh_password123';
            // const salt = await bcrypt.genSalt(10);
            // const hashedPassword = await bcrypt.hash(rawPassword, salt);

            await User.create({
                username: 'Fresh Admin User',
                email: 'fresh_admin@majd.com',
                password: rawPassword, // نستخدم كلمة المرور الصريحة هنا مؤقتاً إذا فعلت هذا الجزء للاختبار
                role: 'admin',
            });
            console.log('Fresh default admin user created (NO HASHING): fresh_admin@majd.com with password: fresh_password123');
        } else {
            console.log('Fresh admin user (fresh_admin@majd.com) already exists.');
        }
    } catch (error) {
        console.error('Error creating fresh default admin:', error.message);
    }
};

// createDefaultAdmin(); // تم تعطيل هذا الاستدعاء لضمان عدم إنشاء المستخدم في كل مرة، وتجنب مشكلة كلمات المرور غير المشفرة
*/

// تهيئة Express app
const app = express();

app.use(cors());
app.use(express.json());

// تعريف الـ APIs
app.use('/api', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/contractors', contractorRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/incomes', incomeRoutes);
app.use('/api/treasuries', treasuryRoutes);      // استخدام راوتات الخزينة
app.use('/api/transactions', transactionRoutes);  // استخدام راوتات المعاملات
app.use('/api/agreements', agreementRoutes);     // NEW: استخدام راوتات الاتفاقات

// تقديم الملفات الثابتة (Static Files) من مجلد 'public'
app.use(express.static(path.join(__dirname, '../public')));

// توجيه الطلبات الواردة إلى المسار الأساسي (الروت /) إلى ملف index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

const PORT = process.env.PORT || 5000;

// ابدأ السيرفر ثم تأكد من إنشاء الخزينة الرئيسية
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await createMainTreasuryIfNotExist(); // تأكد من إنشاء الخزينة الرئيسية عند بدء السيرفر
});
