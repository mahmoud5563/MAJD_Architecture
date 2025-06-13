// backend/models/Income.js
const mongoose = require('mongoose');

const incomeSchema = mongoose.Schema(
    {
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Project', // ربط الإيراد بالمشروع
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
        paymentMethod: {
            type: String,
            enum: ['cash', 'bank_transfer', 'cheque', 'other'], // طرق الدفع
            default: 'cash',
        },
        // يمكن إضافة حقول أخرى مثل من قام بإضافة الإيراد (userID)
    },
    {
        timestamps: true, // لإضافة حقلي createdAt و updatedAt تلقائياً
    }
);

const Income = mongoose.model('Income', incomeSchema);

module.exports = Income;
