// backend/models/Client.js
const mongoose = require('mongoose');

const clientSchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: false, // يمكن أن يكون اختيارياً لو كان العميل شركة مثلاً
            trim: true,
            lowercase: true,
        },
        phone: {
            type: String,
            required: true,
            trim: true,
        },
        company: {
            type: String,
            required: false,
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

const Client = mongoose.model('Client', clientSchema);

module.exports = Client;
