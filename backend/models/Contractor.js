// backend/models/Contractor.js
const mongoose = require('mongoose');

const contractorSchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: false, // يمكن أن يكون اختيارياً
            trim: true,
            lowercase: true,
        },
        phone: {
            type: String,
            required: true,
            trim: true,
        },
        specialty: {
            type: String,
            required: false, // تخصص المقاول
            trim: true,
        },
        notes: {
            type: String,
            required: false,
            trim: true,
        },
    },
    {
        timestamps: true, // لإضافة حقلي createdAt و updatedAt تلقائياً
    }
);

const Contractor = mongoose.model('Contractor', contractorSchema);

module.exports = Contractor;
