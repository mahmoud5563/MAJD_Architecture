// backend/models/Treasury.js
const mongoose = require('mongoose');

const treasurySchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true, // لضمان وجود خزينة رئيسية واحدة وكل خزينة عهد باسم فريد
            trim: true,
        },
        type: {
            type: String,
            enum: ['main', 'custody'], // نوع الخزينة: رئيسية أو عهدة
            required: true,
        },
        userId: { // يُستخدم لربط خزينة العهد بمهندس معين
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: function() { return this.type === 'custody'; }, // مطلوب فقط إذا كان النوع 'custody'
            unique: function() { return this.type === 'custody'; }, // كل مهندس له خزينة عهد واحدة
        },
        balance: {
            type: Number,
            required: true,
            default: 0,
            min: 0, // الرصيد لا يمكن أن يكون سالباً (يمكن تعديله إذا سمحت السلبيات مؤقتاً)
        },
    },
    {
        timestamps: true, // لإضافة حقلي createdAt و updatedAt
    }
);

const Treasury = mongoose.model('Treasury', treasurySchema);

module.exports = Treasury;
