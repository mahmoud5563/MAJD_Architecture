const express = require('express');
const router = express.Router();
const EmployeeOvertime = require('../models/EmployeeOvertime');
const Employee = require('../models/Employee');
const { auth } = require('../middleware/authMiddleware');

// @route   GET /api/employee-overtimes
// @desc    Get all employee overtimes
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const overtimes = await EmployeeOvertime.find({})
            .populate('employeeId', 'name')
            .populate('createdBy', 'name')
            .sort({ date: -1 });
        res.json(overtimes);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء جلب أوفر تايم الموظفين.');
    }
});

// @route   GET /api/employee-overtimes/employee/:employeeId
// @desc    Get overtimes for specific employee
// @access  Private
router.get('/employee/:employeeId', auth, async (req, res) => {
    try {
        const overtimes = await EmployeeOvertime.find({ employeeId: req.params.employeeId })
            .populate('employeeId', 'name')
            .populate('createdBy', 'name')
            .sort({ date: -1 });
        res.json(overtimes);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء جلب أوفر تايم الموظف.');
    }
});

// @route   POST /api/employee-overtimes
// @desc    Create new employee overtime
// @access  Private
router.post('/', auth, async (req, res) => {
    try {
        const { employeeId, hours, rate, amount, description, date } = req.body;
        
        // التحقق من وجود الموظف
        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ message: 'الموظف غير موجود.' });
        }

        const overtime = new EmployeeOvertime({
            employeeId,
            hours,
            rate,
            amount,
            description,
            date: date || new Date(),
            createdBy: req.user.id
        });

        await overtime.save();
        
        const populatedOvertime = await EmployeeOvertime.findById(overtime._id)
            .populate('employeeId', 'name')
            .populate('createdBy', 'name');

        res.json(populatedOvertime);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء إنشاء أوفر تايم الموظف.');
    }
});

// @route   PUT /api/employee-overtimes/:id
// @desc    Update employee overtime
// @access  Private
router.put('/:id', auth, async (req, res) => {
    try {
        const { hours, rate, amount, description, date } = req.body;
        
        const overtime = await EmployeeOvertime.findById(req.params.id);
        if (!overtime) {
            return res.status(404).json({ message: 'الأوفر تايم غير موجود.' });
        }

        overtime.hours = hours;
        overtime.rate = rate;
        overtime.amount = amount;
        overtime.description = description;
        if (date) overtime.date = date;

        await overtime.save();
        
        const populatedOvertime = await EmployeeOvertime.findById(overtime._id)
            .populate('employeeId', 'name')
            .populate('createdBy', 'name');

        res.json(populatedOvertime);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء تحديث أوفر تايم الموظف.');
    }
});

// @route   DELETE /api/employee-overtimes/:id
// @desc    Delete employee overtime
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const overtime = await EmployeeOvertime.findById(req.params.id);
        if (!overtime) {
            return res.status(404).json({ message: 'الأوفر تايم غير موجود.' });
        }

        await EmployeeOvertime.findByIdAndDelete(req.params.id);
        res.json({ message: 'تم حذف الأوفر تايم بنجاح.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء حذف أوفر تايم الموظف.');
    }
});

module.exports = router; 