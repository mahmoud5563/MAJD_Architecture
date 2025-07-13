require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const cron = require('node-cron');
const fs = require('fs');
const archiver = require('archiver');

// استيراد جميع المسارات والميدل وير
const authRoutes = require('./routes/auth');
const projectsRoutes = require('./routes/projects');
const clientsRoutes = require('./routes/clients');
const treasuriesRoutes = require('./routes/treasuries');
const transactionsRoutes = require('./routes/transactions');
const contractorsRoutes = require('./routes/contractors');
const contractAgreementsRoutes = require('./routes/contractAgreements');
const contractPaymentsRoutes = require('./routes/contractPayments');
const categoriesRoutes = require('./routes/categories');
const usersRoutes = require('./routes/users');
const generalExpensesRoutes = require('./routes/generalExpenses');
const filesRoutes = require('./routes/files');
const employeesRoutes = require('./routes/employees');
const productsRouter = require('./routes/products');
const warehousesRouter = require('./routes/warehouses');
const stockOperationsRouter = require('./routes/stockOperations');
const salesRouter = require('./routes/sales');
const generalAccountsRoutes = require('./routes/generalAccounts');
const backupRoutes = require('./routes/backup');
const suppliersRoutes = require('./routes/suppliers');
const purchasesRoutes = require('./routes/purchases');

const { auth, authorizeRoles } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware للتعامل مع preflight requests
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-auth-token');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// إعدادات CORS
app.use(cors({
    origin: '*', // السماح لجميع النطاقات
    credentials: false, // تعطيل الكوكيز لتجنب مشاكل CORS
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'Accept', 'Origin', 'X-Requested-With'],
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// Middleware
app.use(express.json());

// الاتصال بقاعدة البيانات MongoDB
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/majd_architecture';
console.log('MongoDB URI:', mongoUri);
console.log('JWT Secret configured:', !!process.env.JWT_SECRET);

mongoose.connect(mongoUri)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => {
        console.error('Could not connect to MongoDB...', err);
        console.error('Please make sure MongoDB is running and MONGO_URI is set correctly');
        process.exit(1);
    });

// استخدام مسارات الـ API
app.use('/api', authRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/treasuries', treasuriesRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/contractors', contractorsRoutes);
app.use('/api/contract-agreements', contractAgreementsRoutes);
app.use('/api/contract-payments', contractPaymentsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/general-expenses', generalExpensesRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/products', productsRouter);
app.use('/api/warehouses', warehousesRouter);
app.use('/api/stock-operations', stockOperationsRouter);
app.use('/api/sales', salesRouter);
app.use('/api/salary-transactions', require('./routes/salaryTransactions'));
app.use('/api/general-accounts', generalAccountsRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/purchases', purchasesRoutes);

// تقديم الملفات الثابتة (frontend files)
app.use(express.static(path.join(__dirname, '../public')));

// المسار الرئيسي لتقديم صفحة تسجيل الدخول
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// ميدل وير عام للتعامل مع أي خطأ غير متوقع
app.use((err, req, res, next) => {
    console.error('🔥 Unhandled Error:', err.stack);
    res.status(500).json({ message: 'حدث خطأ غير متوقع في الخادم.' });
});

// جدولة النسخ الاحتياطي الأسبوعي (كل أحد 3 صباحًا)
cron.schedule('0 3 * * 0', async () => {
  try {
    const data = {
      projects: await Project.find({}),
      transactions: await Transaction.find({}),
      users: await User.find({}),
      contractAgreements: await ContractAgreement.find({}),
      contractPayments: await ContractPayment.find({}),
      contractors: await Contractor.find({}),
      categories: await Category.find({}),
      treasuries: await Treasury.find({}),
      clients: await Client.find({}),
      generalExpenses: await GeneralExpense.find({}),
      employees: await Employee.find({}),
      salaryTransactions: await SalaryTransaction.find({}),
    };
    const backupsDir = path.join(__dirname, 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });
    const dateStr = new Date().toISOString().slice(0, 10);
    const zipPath = path.join(backupsDir, `backup-${dateStr}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', err => { throw err; });
    archive.pipe(output);
    archive.append(JSON.stringify(data, null, 2), { name: 'backup.json' });
    const uploadsDir = path.join(__dirname, 'uploads');
    if (fs.existsSync(uploadsDir)) {
      archive.directory(uploadsDir, 'uploads');
    }
    await archive.finalize();
    console.log(`✅ [Backup] Weekly backup created: ${zipPath}`);
  } catch (err) {
    console.error('❌ [Backup] Weekly backup failed:', err);
  }
});

module.exports = app;