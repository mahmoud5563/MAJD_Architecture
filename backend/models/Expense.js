// backend/models/Expense.js
const mongoose = require('mongoose');

const expenseSchema = mongoose.Schema(
    {
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Project',
        },
        treasuryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Treasury',
            required: true // اجعله مطلوبًا
        },
        amount: {
            type: Number,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        date: {
            type: Date,
            required: true,
        },
        categoryId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Category', // Assuming you have a Category model for expense categories
        },
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Contractor', // Assuming you have a Contractor model for vendors
        },
        attachment: {
            type: String, // URL or path to the attachment file
            required: false, // Attachment is optional
        },
        // NEW: Field to track which user created this expense
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            required: true, // Should always know who created it
            ref: 'User',    // Refers to the User model
        },
    },
    {
        timestamps: true, // Adds createdAt and updatedAt timestamps
    }
);

const Expense = mongoose.model('Expense', expenseSchema);

module.exports = Expense;
