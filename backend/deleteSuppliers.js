const mongoose = require('mongoose');
const Supplier = require('./models/Supplier');

// الاتصال بقاعدة البيانات
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/majd_architecture';

mongoose.connect(mongoUri)
    .then(async () => {
        console.log('Connected to MongoDB');
        
        try {
            // حذف جميع الموردين
            const result = await Supplier.deleteMany({});
            console.log(`تم حذف ${result.deletedCount} مورد بنجاح`);
            
            // التحقق من عدد الموردين المتبقين
            const remainingSuppliers = await Supplier.countDocuments();
            console.log(`عدد الموردين المتبقين: ${remainingSuppliers}`);
            
        } catch (error) {
            console.error('خطأ في حذف الموردين:', error);
        } finally {
            mongoose.connection.close();
            console.log('تم إغلاق الاتصال بقاعدة البيانات');
        }
    })
    .catch(err => {
        console.error('Could not connect to MongoDB...', err);
        process.exit(1);
    }); 