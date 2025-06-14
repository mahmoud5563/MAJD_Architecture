// backend/models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = mongoose.Schema(
    {
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        type: {
            type: String,
            // تم إضافة 'income_to_custody' إلى قائمة الأنواع الصالحة
            enum: ['deposit_main', 'withdrawal_main', 'custody_assignment', 'expense_from_custody', 'income_to_main', 'project_expense', 'project_income', 'income_to_custody'],
            required: true,
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
        // المرجع للخزينة التي تأثرت بشكل مباشر (عادة ما تكون To أو From)
        treasury: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Treasury',
            required: true,
        },
        // يمكن استخدام هذه الحقول لربط المعاملة بعناصر أخرى
        relatedUser: { // مثل المهندس الذي تلقى العهدة، أو العميل الذي أودع
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false,
        },
        relatedExpense: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Expense',
            required: false // يمكن أن تكون المعاملة غير مرتبطة بمصروف محدد
        },
        relatedProject: { // للمصروفات/الإيرادات الخاصة بالمشاريع
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Project',
            required: false,
        },
        createdBy: { // من قام بإنشاء هذه المعاملة
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true, // لإضافة حقلي createdAt و updatedAt
    }
);

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
