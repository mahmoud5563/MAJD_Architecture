// backend/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            match: [/.+\@.+\..+/, 'Please fill a valid email address'],
        },
        password: {
            type: String,
            required: true,
            minlength: 6,
        },
        role: {
            type: String,
            enum: ['admin', 'account_manager', 'engineer'],
            default: 'engineer',
        },
    },
    {
        timestamps: true,
    }
);

// تشفير كلمة المرور قبل الحفظ
userSchema.pre('save', async function (next) {
    // قم بالتشفير فقط إذا تم تعديل حقل كلمة المرور أو كان جديداً
    if (!this.isModified('password')) { // تحقق من أن حقل كلمة المرور قد تم تعديله
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        console.log(`[User Model Pre-save] Password for ${this.email} has been hashed.`); // لغرض التشخيص
        next();
    } catch (error) {
        console.error(`[User Model Pre-save] Error hashing password for ${this.email}:`, error); // لغرض التشخيص
        next(error);
    }
});

// مقارنة كلمة المرور المدخلة بكلمة المرور المشفرة
userSchema.methods.matchPassword = async function (enteredPassword) {
    if (!this.password) {
        console.log('[User Model MatchPassword] Stored password is null/undefined, cannot match.'); // لغرض التشخيص
        return false;
    }
    try {
        const isMatch = await bcrypt.compare(enteredPassword, this.password);
        console.log(`[User Model MatchPassword] Comparing "${enteredPassword}" with stored hash. Result: ${isMatch}`); // لغرض التشخيص
        return isMatch;
    } catch (error) {
        console.error('[User Model MatchPassword] Error during password comparison:', error); // لغرض التشخيص
        return false;
    }
};

const User = mongoose.model('User', userSchema);

module.exports = User;
