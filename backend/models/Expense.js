// backend/models/Expense.js
const mongoose = require('mongoose');

const expenseSchema = mongoose.Schema(
    {
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Project', // ربط المصروف بالمشروع
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        date: {
            type: Date,
            required: true,
        },
        categoryId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Category', // ربط المصروف بالتصنيف (مثل مواد، أجور)
        },
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Contractor', // ربط المصروف بالمقاول/المورد
        },
        attachment: { // مرفق الفاتورة أو الإيصال (يمكن تخزين مسار الملف أو URL)
            type: String,
            required: false,
        },
        // يمكن إضافة حقول أخرى مثل من قام بإضافة المصروف (userID)
    },
    {
        timestamps: true, // لإضافة حقلي createdAt و updatedAt تلقائياً
    }
);

const Expense = mongoose.model('Expense', expenseSchema);

module.exports = Expense;
