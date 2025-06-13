// backend/config/db.js
const mongoose = require('mongoose');
require('dotenv').config(); // عشان نقرا متغيرات البيئة من ملف .env

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1); // الخروج من العملية بفشل
    }
};

module.exports = connectDB;