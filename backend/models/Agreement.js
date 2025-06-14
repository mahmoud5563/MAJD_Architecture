// backend/models/Agreement.js
const mongoose = require('mongoose');

const agreementSchema = mongoose.Schema(
    {
        contractorId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Contractor', // يشير إلى نموذج المقاول
        },
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Project', // يشير إلى نموذج المشروع
        },
        amount: {
            type: Number,
            required: true,
            min: 0, // المبلغ المستحق يجب أن يكون أكبر من أو يساوي صفر
        },
        description: {
            type: String,
            required: false, // الوصف اختياري
        },
        date: {
            type: Date,
            required: true, // تاريخ الاتفاق
            default: Date.now, // الافتراضي هو التاريخ الحالي
        },
        status: {
            type: String,
            enum: ['active', 'completed', 'cancelled'], // حالات الاتفاق
            default: 'active',
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User', // يشير إلى نموذج المستخدم الذي أنشأ الاتفاق
        },
    },
    {
        timestamps: true, // يضيف حقول createdAt و updatedAt تلقائيًا
    }
);

const Agreement = mongoose.model('Agreement', agreementSchema);

module.exports = Agreement;
