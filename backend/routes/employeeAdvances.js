const express = require('express');
const router = express.Router();
const EmployeeAdvance = require('../models/EmployeeAdvance');
const Employee = require('../models/Employee');
const { auth } = require('../middleware/authMiddleware');

// @route   GET /api/employee-advances
// @desc    Get all employee advances
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const advances = await EmployeeAdvance.find({})
            .populate('employeeId', 'name')
            .populate('createdBy', 'name')
            .sort({ date: -1 });
        res.json(advances);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء جلب سلف الموظفين.');
    }
});

// @route   GET /api/employee-advances/employee/:employeeId
// @desc    Get advances for specific employee
// @access  Private
router.get('/employee/:employeeId', auth, async (req, res) => {
    try {
        const advances = await EmployeeAdvance.find({ employeeId: req.params.employeeId })
            .populate('employeeId', 'name')
            .populate('createdBy', 'name')
            .sort({ date: -1 });
        res.json(advances);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء جلب سلف الموظف.');
    }
});

// @route   POST /api/employee-advances
// @desc    Create new employee advance
// @access  Private
router.post('/', auth, async (req, res) => {
    try {
        const { employeeId, amount, description, date } = req.body;
        
        // التحقق من وجود الموظف
        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ message: 'الموظف غير موجود.' });
        }

        const advance = new EmployeeAdvance({
            employeeId,
            amount,
            description,
            date: date || new Date(),
            createdBy: req.user.id
        });

        await advance.save();
        
        const populatedAdvance = await EmployeeAdvance.findById(advance._id)
            .populate('employeeId', 'name')
            .populate('createdBy', 'name');

        res.json(populatedAdvance);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء إنشاء سلفة الموظف.');
    }
});

// @route   PUT /api/employee-advances/:id
// @desc    Update employee advance
// @access  Private
router.put('/:id', auth, async (req, res) => {
    try {
        const { amount, description, date } = req.body;
        
        const advance = await EmployeeAdvance.findById(req.params.id);
        if (!advance) {
            return res.status(404).json({ message: 'السلفة غير موجودة.' });
        }

        advance.amount = amount;
        advance.description = description;
        if (date) advance.date = date;

        await advance.save();
        
        const populatedAdvance = await EmployeeAdvance.findById(advance._id)
            .populate('employeeId', 'name')
            .populate('createdBy', 'name');

        res.json(populatedAdvance);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء تحديث سلفة الموظف.');
    }
});

// @route   DELETE /api/employee-advances/:id
// @desc    Delete employee advance
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const advance = await EmployeeAdvance.findById(req.params.id);
        if (!advance) {
            return res.status(404).json({ message: 'السلفة غير موجودة.' });
        }

        await EmployeeAdvance.findByIdAndDelete(req.params.id);
        res.json({ message: 'تم حذف السلفة بنجاح.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء حذف سلفة الموظف.');
    }
});

module.exports = router; 