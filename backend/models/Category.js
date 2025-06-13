// backend/models/Category.js
const mongoose = require('mongoose');

const categorySchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true, // تأكد أن اسم التصنيف فريد
            trim: true,
        },
        // يمكنك إضافة حقول أخرى هنا لاحقاً إذا لزم الأمر، مثل description
    },
    {
        timestamps: true, // لإضافة حقلي createdAt و updatedAt تلقائياً
    }
);

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
