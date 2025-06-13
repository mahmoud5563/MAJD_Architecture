// backend/models/Project.js
const mongoose = require('mongoose');

const projectSchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        address: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: false,
            trim: true,
        },
        startDate: {
            type: Date,
            required: true,
        },
        endDate: { // تاريخ الانتهاء المتوقع
            type: Date,
            required: false,
        },
        client: { // ربط المشروع بالعميل
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Client',
            required: false, // يمكن أن يكون المشروع بدون عميل في البداية
        },
        engineerId: { // NEW: ربط المشروع بالمهندس المسؤول
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User', // نشير إلى موديل المستخدم
            required: false, // يمكن أن يكون اختيارياً في البداية
        },
        status: {
            type: String,
            enum: ['pending', 'ongoing', 'completed'],
            default: 'pending',
        },
        notes: {
            type: String,
            required: false,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
