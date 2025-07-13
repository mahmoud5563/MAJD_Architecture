// backend/routes/treasuries.js
const express = require('express');
const router = express.Router();
const Treasury = require('../models/Treasury'); // استيراد موديل الخزينة
const User = require('../models/User'); // لاستيراد موديل المستخدم
const Project = require('../models/Project'); // لاستيراد موديل المشروع
const Transaction = require('../models/Transaction'); // استيراد موديل المعاملات الجديد
const { auth, authorizeRoles } = require('../middleware/authMiddleware'); // استيراد الـ middleware
const ExcelJS = require('exceljs'); // لإضافة دعم تصدير Excel

// @route   POST /api/treasuries
// @desc    Add a new treasury
// @access  Private (Manager, Accountant Manager)
router.post('/', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => {
    const { name, initialBalance, description, type, date, reason, responsibleUser, project } = req.body;

    try {
        // التحقق من أن اسم الخزينة فريد
        let treasury = await Treasury.findOne({ name });
        if (treasury) {
            return res.status(400).json({ message: 'خزينة بهذا الاسم موجودة بالفعل.' });
        }

        // منطق التحقق الخاص بنوع "عهدة"
        if (type === 'عهدة') {
            if (!responsibleUser) {
                return res.status(400).json({ message: 'يجب تحديد مهندس مسؤول للعهدة.' });
            }
            if (!project) {
                return res.status(400).json({ message: 'يجب تحديد مشروع للعهدة.' });
            }

            // التحقق من وجود المهندس
            const existingEngineer = await User.findById(responsibleUser);
            if (!existingEngineer || existingEngineer.role !== 'مهندس') {
                return res.status(400).json({ message: 'المهندس المسؤول المحدد غير موجود أو ليس لديه دور مهندس.' });
            }
            // التحقق من وجود المشروع
            const existingProject = await Project.findById(project);
            if (!existingProject) {
                return res.status(400).json({ message: 'المشروع المحدد غير موجود.' });
            }
        }

        const newTreasury = new Treasury({
            name,
            initialBalance: initialBalance || 0,
            currentBalance: initialBalance || 0, // الرصيد الحالي يبدأ بالرصيد الأولي
            description,
            type,
            date,
            reason,
            responsibleUser: type === 'عهدة' ? responsibleUser : undefined, // حفظ فقط إذا كان النوع "عهدة"
            project: type === 'عهدة' ? project : undefined // حفظ فقط إذا كان النوع "عهدة"
        });

        await newTreasury.save();
        res.status(201).json({ message: 'تم إضافة الخزينة بنجاح.', treasury: newTreasury });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({  message : 'حدث خطأ في الخادم أثناء إضافة الخزينة.'});
    }
});

// @route   GET /api/treasuries
// @desc    Get all treasuries
// @access  Private (All authenticated users)
router.get('/', auth, async (req, res) => {
    try {
        // إضافة populate لجلب تفاصيل المهندس والمشروع المرتبطين
        const treasuries = await Treasury.find({})
            .populate('responsibleUser', 'username') // جلب اسم المستخدم للمهندس المسؤول
            .populate('project', 'projectName'); // جلب اسم المشروع المرتبط

        res.json(treasuries);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({  message : 'حدث خطأ في الخادم أثناء جلب الخزائن.'});
    }
});

// @route   GET /api/treasuries/:id
// @desc    Get treasury by ID
// @access  Private (All authenticated users)
router.get('/:id', auth, async (req, res) => {
    try {
        const treasury = await Treasury.findById(req.params.id)
            .populate('responsibleUser', 'username')
            .populate('project', 'projectName');

        if (!treasury) {
            return res.status(404).json({ message: 'الخزينة غير موجودة.' });
        }
        res.json(treasury);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف الخزينة غير صالح.' });
        }
        res.status(500).json({  message : 'حدث خطأ في الخادم أثناء جلب تفاصيل الخزينة.'});
    }
});

// @route   GET /api/treasuries/:id/details
// @desc    Get full treasury details including all transactions
// @access  Private (Manager, Accountant Manager)
router.get('/:id/details', auth, async (req, res) => {
    try {
        const treasuryId = req.params.id;
        const treasury = await Treasury.findById(treasuryId)
            .populate('responsibleUser', 'username')
            .populate('project', 'projectName');

        if (!treasury) {
            return res.status(404).json({ message: 'الخزينة غير موجودة.' });
        }

        // جلب جميع المعاملات المرتبطة بهذه الخزينة
        const transactions = await Transaction.find({
            $or: [
                { treasury: treasuryId },
                { targetTreasury: treasuryId, type: 'تحويل' } // معاملات التحويل التي كانت هذه الخزينة هي الهدف
            ]
        })
        .populate('treasury', 'name')
        .populate('targetTreasury', 'name')
        .populate('recordedBy', 'username')
        .populate('category', 'name')
        .sort({ date: 1, createdAt: 1 }); // فرز حسب التاريخ ثم تاريخ الإنشاء

        // حساب الملخصات المالية من المعاملات
        let totalDeposits = 0;
        let totalWithdrawals = 0;
        let initialBalanceFromTransactions = treasury.initialBalance; // استخدم الرصيد الأولي المخزن في الموديل

        // ملاحظة: الرصيد الحالي يتم تحديثه في موديل الخزينة مباشرة عند كل معاملة POST.
        // يمكننا إعادة حسابه هنا للتأكد، ولكن يجب أن يكون مطابقاً لـ treasury.currentBalance

        transactions.forEach(trans => {
            if (trans.treasury._id.toString() === treasuryId.toString()) { // إذا كانت الخزينة هي المصدر
                if (trans.type === 'إيداع') {
                    // المبلغ المدفوع (إيداع)
                    totalDeposits += trans.amount;
                } else if (trans.type === 'مصروف') {
                    // المبلغ المصروف (صرف)
                    totalWithdrawals += trans.amount;
                } else if (trans.type === 'تحويل') {
                    // المبلغ المحول منها
                    totalWithdrawals += trans.amount;
                }
            } else if (trans.targetTreasury && trans.targetTreasury._id.toString() === treasuryId.toString() && trans.type === 'تحويل') {
                // المبلغ المحول إليها
                totalDeposits += trans.amount;
            }
        });

        const currentCalculatedBalance = initialBalanceFromTransactions + totalDeposits - totalWithdrawals;


        res.json({
            ...treasury.toObject(), // تحويل مستند Mongoose إلى كائن JavaScript عادي
            transactions,
            totalDeposits,
            totalWithdrawals,
            // currentBalance: currentCalculatedBalance // يمكن إرجاع هذا بدلاً من الموجود في الموديل للمقارنة
        });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف الخزينة غير صالح.' });
        }
        res.status(500).json({ massage: 'حدث خطأ في الخادم أثناء جلب تفاصيل الخزينة الكاملة.'});
    }
});


// @route   PUT /api/treasuries/:id
// @desc    Update a treasury
// @access  Private (Manager, Accountant Manager)
router.put('/:id', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => {
    const { name, initialBalance, description, type, date, reason, responsibleUser, project } = req.body;

    try {
        let treasury = await Treasury.findById(req.params.id);

        if (!treasury) {
            return res.status(404).json({ message: 'الخزينة غير موجودة.' });
        }

        // التحقق من تكرار اسم الخزينة عند التحديث
        const existingTreasury = await Treasury.findOne({ name });
        if (existingTreasury && existingTreasury._id.toString() !== req.params.id) {
            return res.status(400).json({ message: 'خزينة أخرى بهذا الاسم موجودة بالفعل.' });
        }

        // التحقق من تغيير النوع إلى "عهدة" وتوفير الحقول المطلوبة
        if (type === 'عهدة') {
            if (!responsibleUser) {
                return res.status(400).json({ message: 'يجب تحديد مهندس مسؤول للعهدة.' });
            }
            if (!project) {
                return res.status(400).json({ message: 'يجب تحديد مشروع للعهدة.' });
            }
            const existingEngineer = await User.findById(responsibleUser);
            if (!existingEngineer || existingEngineer.role !== 'مهندس') {
                return res.status(400).json({ message: 'المهندس المسؤول المحدد غير موجود أو ليس لديه دور مهندس.' });
            }
            const existingProject = await Project.findById(project);
            if (!existingProject) {
                return res.status(400).json({ message: 'المشروع المحدد غير موجود.' });
            }
        }

        treasury.name = name || treasury.name;
        
        // عند تغيير الرصيد الأولي: يجب إعادة حساب الرصيد الحالي
        if (initialBalance !== undefined && treasury.initialBalance !== initialBalance) {
            const balanceChange = initialBalance - treasury.initialBalance;
            treasury.initialBalance = initialBalance;
            treasury.currentBalance += balanceChange; // adjust current balance based on initial balance change
        }

        treasury.description = description || treasury.description;
        treasury.type = type || treasury.type;
        treasury.date = date || treasury.date;
        treasury.reason = reason || treasury.reason;

        // تحديث responsibleUser و project بناءً على النوع
        if (type === 'عهدة') {
            treasury.responsibleUser = responsibleUser;
            treasury.project = project;
        } else {
            treasury.responsibleUser = undefined;
            treasury.project = undefined;
        }


        await treasury.save();
        res.json({ message: 'تم تحديث الخزينة بنجاح.', treasury });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف الخزينة، المهندس، أو المشروع غير صالح.' });
        }
        res.status(500).json({ massage : 'حدث خطأ في الخادم أثناء تحديث الخزينة.'});
    }
});

// @route   DELETE /api/treasuries/:id
// @desc    Delete a treasury
// @access  Private (Manager, Accountant Manager)
router.delete('/:id', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => {
    try {
        const treasury = await Treasury.findById(req.params.id);

        if (!treasury) {
            return res.status(404).json({ message: 'الخزينة غير موجودة.' });
        }

        // التحقق مما إذا كانت الخزينة تحتوي على معاملات مالية قبل الحذف
        const associatedTransactions = await Transaction.countDocuments({
            $or: [{ treasury: req.params.id }, { targetTreasury: req.params.id }]
        });

        if (associatedTransactions > 0) {
            return res.status(400).json({ message: 'لا يمكن حذف هذه الخزينة لأنها تحتوي على معاملات مالية مرتبطة. يرجى حذف المعاملات المرتبطة أولاً أو تحويلها.' });
        }
        
        // لا يمكن حذف الخزينة الرئيسية (إذا كان هناك نوع رئيسي في المستقبل)
        // حالياً، لدينا "خزينة" و "عهدة" فقط.
        if (treasury.type === 'رئيسية') { // If we ever re-introduce a 'رئيسية' type
            return res.status(400).json({ message: 'لا يمكن حذف الخزينة الرئيسية.' });
        }


        await Treasury.deleteOne({ _id: req.params.id });
        res.json({ message: 'تم حذف الخزينة بنجاح.' });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف الخزينة غير صالح.' });
        }
        res.status(500).json({  message : 'حدث خطأ في الخادم أثناء حذف الخزينة.'});
    }
});

// @route   GET /api/treasuries/engineer/:engineerId
// @desc    Get treasuries (custodies) for a specific engineer
// @access  Private (Engineer can only see their own custodies)
router.get('/engineer/:engineerId', auth, async (req, res) => {
    try {
        // Check if the requesting user is the engineer or has higher privileges
        if (req.user.role === 'مهندس' && req.user.id !== req.params.engineerId) {
            return res.status(403).json({ message: 'ليس لديك صلاحية لعرض عهد مهندس آخر.' });
        }

        const treasuries = await Treasury.find({ 
            responsibleUser: req.params.engineerId,
            type: 'عهدة'
        })
        .populate('responsibleUser', 'username')
        .populate('project', 'projectName');

        res.json(treasuries);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'حدث خطأ في الخادم أثناء جلب عهد المهندس.' });
    }
});

// @route   GET /api/treasuries/excel
// @desc    Export all treasuries as Excel with formatting
// @access  Private (Manager, Accountant Manager)
router.get('/excel', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => {
    try {
        const treasuries = await Treasury.find({})
            .populate('responsibleUser', 'username')
            .populate('project', 'projectName');

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('الخزائن');
        // إعداد الصفحة
        sheet.pageSetup = {
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            orientation: 'landscape',
            paperSize: 9 // A4
        };
        // عنوان مع دمج الأعمدة
        sheet.mergeCells('A1:H1');
        sheet.getCell('A1').value = 'تقرير الخزائن';
        sheet.getCell('A1').font = { bold: true, size: 16 };
        sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(1).height = 24;
        // رؤوس الأعمدة
        const headers = [
            'اسم الخزينة',
            'النوع',
            'الرصيد الأولي',
            'الرصيد الحالي',
            'الوصف',
            'تاريخ الإنشاء',
            'المهندس المسؤول',
            'المشروع المرتبط'
        ];
        sheet.addRow(headers);
        const headerRow = sheet.getRow(2);
        headerRow.font = { bold: true, size: 13 };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D1D1' } };
        headerRow.height = 22;
        // بيانات الخزائن
        treasuries.forEach(t => {
            sheet.addRow([
                t.name,
                t.type,
                (t.initialBalance || 0).toFixed(2),
                (t.currentBalance || 0).toFixed(2),
                t.description || '-',
                t.date ? new Date(t.date).toLocaleDateString('ar-EG') : '-',
                t.responsibleUser ? t.responsibleUser.username : '-',
                t.project ? t.project.projectName : '-'
            ]);
        });
        // تنسيق الأعمدة
        sheet.columns = [
            { key: 'name', width: 20 },
            { key: 'type', width: 10 },
            { key: 'init', width: 14 },
            { key: 'curr', width: 14 },
            { key: 'desc', width: 22 },
            { key: 'date', width: 14 },
            { key: 'eng', width: 18 },
            { key: 'proj', width: 18 }
        ];
        // إضافة حدود ومحاذاة لكل الخلايا
        sheet.eachRow({ includeEmpty: false }, function(row, rowNumber) {
            row.eachCell({ includeEmpty: false }, function(cell) {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
            });
        });
        // محاذاة العنوان في الوسط
        sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
        // اسم الملف
        const fileName = `treasuries_report.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Excel export error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء تصدير تقرير الخزائن.' });
    }
});

// @route   GET /api/treasuries/:id/excel
// @desc    Export single treasury details as Excel with formatting (like frontend)
// @access  Private (Manager, Accountant Manager, Engineer if assigned)
router.get('/:id/excel', auth, async (req, res) => {
    try {
        const treasuryId = req.params.id;
        const treasury = await Treasury.findById(treasuryId)
            .populate('responsibleUser', 'username')
            .populate('project', 'projectName');
        if (!treasury) {
            return res.status(404).json({ message: 'الخزينة غير موجودة.' });
        }
        // جلب جميع المعاملات المرتبطة بهذه الخزينة
        const transactions = await Transaction.find({
            $or: [
                { treasury: treasuryId },
                { targetTreasury: treasuryId, type: 'تحويل' }
            ]
        })
        .populate('treasury', 'name')
        .populate('targetTreasury', 'name')
        .populate('recordedBy', 'username')
        .populate('category', 'name')
        .sort({ date: 1, createdAt: 1 });
        // جلب المصروفات العامة (للمديرين فقط)
        let generalExpenses = [];
        if (req.user.role !== 'مهندس') {
            generalExpenses = await require('../models/GeneralExpense').find({ treasury: treasuryId })
                .populate('createdBy', 'username');
        }
        // إعداد ملف Excel
        const workbook = new ExcelJS.Workbook();
        // ===== شيت 1: تفاصيل الخزينة =====
        const detailsSheet = workbook.addWorksheet('تفاصيل الخزينة');
        detailsSheet.mergeCells('A1:B1');
        detailsSheet.getCell('A1').value = 'تفاصيل الخزينة';
        detailsSheet.getCell('A1').font = { bold: true, size: 16 };
        detailsSheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
        detailsSheet.getRow(1).height = 24;
        let rowIdx = 3;
        const addDetail = (label, value) => {
            detailsSheet.getCell(`A${rowIdx}`).value = label;
            detailsSheet.getCell(`A${rowIdx}`).font = { bold: true };
            detailsSheet.getCell(`B${rowIdx}`).value = value;
            detailsSheet.getCell(`A${rowIdx}`).alignment = { horizontal: 'right' };
            detailsSheet.getCell(`B${rowIdx}`).alignment = { horizontal: 'right' };
            rowIdx++;
        };
        addDetail('اسم الخزينة:', treasury.name);
        addDetail('النوع:', treasury.type);
        addDetail('الرصيد الأولي:', (treasury.initialBalance || 0).toFixed(2));
        addDetail('الرصيد الحالي:', (treasury.currentBalance || 0).toFixed(2));
        addDetail('تاريخ الإنشاء:', treasury.date ? new Date(treasury.date).toLocaleDateString('ar-EG') : '-');
        addDetail('السبب:', treasury.reason || '-');
        addDetail('الوصف:', treasury.description || '-');
        if (treasury.type === 'عهدة') {
            addDetail('المهندس المسؤول:', treasury.responsibleUser ? treasury.responsibleUser.username : '-');
            addDetail('المشروع المرتبط:', treasury.project ? treasury.project.projectName : '-');
        }
        detailsSheet.columns = [ { width: 22 }, { width: 32 } ];
        detailsSheet.eachRow({ includeEmpty: false }, row => {
            row.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });
        // ===== شيت 2: سجل المعاملات =====
        const transactionsSheet = workbook.addWorksheet('سجل المعاملات');
        transactionsSheet.mergeCells('A1:F1');
        transactionsSheet.getCell('A1').value = 'سجل المعاملات';
        transactionsSheet.getCell('A1').font = { bold: true, size: 15 };
        transactionsSheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
        transactionsSheet.getRow(1).height = 22;
        const transHeaders = ['التاريخ', 'النوع', 'المبلغ', 'الوصف/السبب', 'التصنيف', 'خزينة الهدف'];
        transactionsSheet.addRow(transHeaders);
        const headerRow2 = transactionsSheet.getRow(2);
        headerRow2.font = { bold: true };
        headerRow2.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRow2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D1D1' } };
        headerRow2.height = 20;
        transactions.forEach(t => {
            transactionsSheet.addRow([
                t.date ? new Date(t.date).toLocaleDateString('ar-EG') : '-',
                t.type,
                (t.amount || 0).toFixed(2),
                t.description || '-',
                t.category && t.category.name ? t.category.name : '-',
                t.targetTreasury ? t.targetTreasury.name : '-'
            ]);
        });
        transactionsSheet.columns = [
            { width: 14 }, { width: 10 }, { width: 12 }, { width: 22 }, { width: 14 }, { width: 16 }
        ];
        transactionsSheet.eachRow({ includeEmpty: false }, (row, idx) => {
            row.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
        });
        // إجماليات في الأسفل
        let lastRow = transactionsSheet.lastRow.number + 2;
        transactionsSheet.getCell(`A${lastRow}`).value = 'إجمالي الإيداعات:';
        transactionsSheet.getCell(`A${lastRow}`).font = { bold: true };
        transactionsSheet.getCell(`B${lastRow}`).value = (transactions.filter(t => t.type === 'إيداع').reduce((sum, t) => sum + (t.amount || 0), 0)).toFixed(2);
        transactionsSheet.getCell(`A${lastRow+1}`).value = 'إجمالي المصروفات والتحويلات الصادرة:';
        transactionsSheet.getCell(`A${lastRow+1}`).font = { bold: true };
        transactionsSheet.getCell(`B${lastRow+1}`).value = (transactions.filter(t => t.type === 'مصروف' || t.type === 'تحويل').reduce((sum, t) => sum + (t.amount || 0), 0)).toFixed(2);
        // ===== شيت 3: المصروفات العامة =====
        if (req.user.role !== 'مهندس') {
            const expensesSheet = workbook.addWorksheet('المصروفات العامة');
            expensesSheet.mergeCells('A1:D1');
            expensesSheet.getCell('A1').value = 'المصروفات العامة';
            expensesSheet.getCell('A1').font = { bold: true, size: 15 };
            expensesSheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
            expensesSheet.getRow(1).height = 22;
            const expHeaders = ['التاريخ', 'المبلغ', 'الوصف', 'تم الإضافة بواسطة'];
            expensesSheet.addRow(expHeaders);
            const headerRow3 = expensesSheet.getRow(2);
            headerRow3.font = { bold: true };
            headerRow3.alignment = { horizontal: 'center', vertical: 'middle' };
            headerRow3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D1D1' } };
            headerRow3.height = 20;
            generalExpenses.forEach(e => {
                expensesSheet.addRow([
                    e.date ? new Date(e.date).toLocaleDateString('ar-EG') : '-',
                    (e.amount || 0).toFixed(2),
                    e.reason || '-',
                    e.createdBy ? e.createdBy.username : '-'
                ]);
            });
            expensesSheet.columns = [ { width: 14 }, { width: 12 }, { width: 22 }, { width: 18 } ];
            expensesSheet.eachRow({ includeEmpty: false }, (row, idx) => {
                row.eachCell(cell => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                });
            });
            // إجمالي المصروفات العامة
            let lastExpRow = expensesSheet.lastRow.number + 2;
            expensesSheet.getCell(`A${lastExpRow}`).value = 'إجمالي المصروفات العامة:';
            expensesSheet.getCell(`A${lastExpRow}`).font = { bold: true };
            expensesSheet.getCell(`B${lastExpRow}`).value = (generalExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)).toFixed(2);
        }
        // إعداد اسم الملف
        let safeName = String(treasury.name || 'treasury').replace(/[^a-zA-Z0-9-_]/g, '_');
        const fileName = `treasury_${safeName}_details.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Excel export error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء تصدير تفاصيل الخزينة.' });
    }
});

module.exports = router;
