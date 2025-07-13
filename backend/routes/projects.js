// backend/routes/projects.js
const express = require('express');
const router = express.Router();
const Project = require('../models/Project'); // استيراد موديل المشروع
const User = require('./../models/User'); // لاستيراد موديل المستخدم (للمهندسين)
const Client = require('./../models/Client'); // لاستيراد موديل العميل
const Transaction = require('./../models/Transaction'); // افتراض وجود هذا الموديل للمصروفات والإيرادات
const ContractAgreement = require('./../models/ContractAgreement'); // افتراض وجود هذا الموديل لاتفاقيات المقاولين
const ContractPayment = require('./../models/ContractPayment'); // افتراض وجود هذا الموديل لدفعات المقاولين
const Treasury = require('./../models/Treasury'); // إضافة موديل الخزينة/العهدة
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');

const { auth, authorizeRoles } = require('../middleware/authMiddleware'); // استيراد الـ middleware للتحقق من الصلاحيات

// @route   POST /api/projects
// @desc    Add a new project
// @access  Private (Manager, Accountant Manager)
router.post('/', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => {
    const {
        projectName,
        address,
        description,
        engineer,
        client,
        startDate,
        endDate,
        notes,
        status
    } = req.body;

    try {
        // التحقق من أن المهندس (إن وجد) موجود بالفعل في قاعدة البيانات ودوره 'مهندس'
        if (engineer) {
            const existingEngineer = await User.findById(engineer);
            if (!existingEngineer || existingEngineer.role !== 'مهندس') {
                return res.status(400).json({ message: 'المهندس المحدد غير موجود أو ليس لديه دور مهندس.' });
            }
        }

        // التحقق من أن العميل (إن وجد) موجود بالفعل في قاعدة البيانات
        if (client) {
            const existingClient = await Client.findById(client);
            if (!existingClient) {
                return res.status(400).json({ message: 'العميل المحدد غير موجود.' });
            }
        }

        const newProject = new Project({
            projectName,
            address,
            description,
            engineer,
            client,
            startDate,
            endDate,
            notes,
            status
        });

        const project = await newProject.save();
        res.status(201).json({ message: 'تم إضافة المشروع بنجاح.', project });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف المهندس أو العميل غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء إضافة المشروع.');
    }
});

// @route   GET /api/projects
// @desc    Get all projects (with optional filters)
// @access  Private (All authenticated users, with role-based filtering)
router.get('/', auth, async (req, res) => {
    try {
        const { name, status } = req.query; // جلب فلاتر البحث من الـ query parameters
        const filter = {};

        if (name) {
            filter.projectName = { $regex: name, $options: 'i' }; // بحث غير حساس لحالة الأحرف
        }
        if (status) {
            filter.status = status;
        }

        // منطق تصفية المشاريع بناءً على دور المستخدم
        if (req.user.role === 'مهندس') {
            console.log('User ID:', req.user.id);
            console.log('User Role:', req.user.role);
            
            // جلب المشاريع التي هو مهندسها
            const assignedProjects = await Project.find({ engineer: req.user.id }).select('_id');
            const assignedProjectIds = assignedProjects.map(p => p._id);
            console.log('Assigned Projects:', assignedProjectIds);

            // جلب المشاريع التي فيها عهدات مخصصة له
            const treasuriesWithProjects = await Treasury.find({ 
                responsibleUser: req.user.id,
                type: 'عهدة',
                project: { $exists: true, $ne: null }
            }).select('project');
            const treasuryProjectIds = treasuriesWithProjects.map(t => t.project);
            console.log('Treasury Projects:', treasuryProjectIds);

            // دمج معرفات المشاريع (إزالة التكرار)
            const allProjectIds = [...new Set([...assignedProjectIds, ...treasuryProjectIds])];
            console.log('All Project IDs:', allProjectIds);

            // إذا كان هناك مشاريع، أضف فلتر للمشاريع
            if (allProjectIds.length > 0) {
                filter._id = { $in: allProjectIds };
            } else {
                // إذا لم يكن له أي مشاريع، أعد مصفوفة فارغة
                console.log('No projects found, returning empty array');
                return res.json([]);
            }
        }
        // إذا كان المدير أو مدير الحسابات، لا نضيف فلتر للمهندس (يرون جميع المشاريع)

        console.log('Final Filter:', filter);
        const projects = await Project.find(filter)
            .populate('engineer', 'username') // جلب اسم المستخدم للمهندس
            .populate('client', 'clientName') // جلب اسم العميل للعميل
            .sort({ createdAt: -1 }); // ترتيب من الأحدث للأقدم

        console.log('Found Projects:', projects.length);
        res.json(projects);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء جلب المشاريع.');
    }
});

// @route   GET /api/projects/engineers
// @desc    Get a list of all engineers (for project assignment dropdown)
// @access  Private (Any authenticated user)
router.get('/engineers', auth, async (req, res) => {
    try {
        const engineers = await User.find({ role: 'مهندس' }).select('username');
        res.json(engineers);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء جلب المهندسين.');
    }
});

// @route   GET /api/projects/:id
// @desc    Get a single project by ID (for edit modal, etc.)
// @access  Private (Manager, Accountant Manager, Engineer (if assigned))
router.get('/:id', auth, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate('engineer', 'username')
            .populate('client', 'clientName');

        if (!project) {
            return res.status(404).json({ message: 'المشروع غير موجود.' });
        }

        // إذا كان المستخدم مهندسًا، تأكد من أنه المهندس المسؤول عن المشروع أو له عهدة في المشروع
        if (req.user.role === 'مهندس') {
            const isAssignedEngineer = project.engineer && project.engineer._id.toString() === req.user.id;
            
            // التحقق من وجود عهدة للمهندس في هذا المشروع
            const hasTreasury = await Treasury.findOne({
                responsibleUser: req.user.id,
                type: 'عهدة',
                project: req.params.id
            });

            if (!isAssignedEngineer && !hasTreasury) {
                return res.status(403).json({ message: 'ليس لديك صلاحية لعرض تفاصيل هذا المشروع.' });
            }
        }

        res.json(project);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف المشروع غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء جلب تفاصيل المشروع.');
    }
});

// @route   GET /api/projects/:id/details
// @desc    Get full project details including associated financials
// @access  Private (Manager, Accountant Manager, Engineer (if assigned))
router.get('/:id/details', auth, async (req, res) => {
    console.log('=== Project Details GET Request START ===');
    console.log('Project ID:', req.params.id);
    console.log('User role:', req.user.role);
    console.log('User ID:', req.user.id);
    
    try {
        const projectId = req.params.id;
        const project = await Project.findById(projectId)
            .populate('engineer', 'username')
            .populate('client', 'clientName');

        if (!project) {
            console.log('Project not found with ID:', projectId);
            return res.status(404).json({ message: 'المشروع غير موجود.' });
        }

        console.log('Found project:', project);

        // إذا كان المستخدم مهندسًا، تأكد من أنه المهندس المسؤول عن المشروع
        if (req.user.role === 'مهندس' && project.engineer && project.engineer._id.toString() !== req.user.id) {
            return res.status(403).json({ message: 'ليس لديك صلاحية لعرض تفاصيل هذا المشروع.' });
        }

        // جلب جميع البيانات المالية بالتوازي لتحسين الأداء
        const [expenses, revenues, contractorAgreements] = await Promise.all([
            Transaction.find({ project: projectId, type: 'مصروف' }),
            Transaction.find({ project: projectId, type: 'إيداع' }),
            ContractAgreement.find({ project: projectId }).populate('contractor', 'contractorName')
        ]);

        console.log('Financial data found:');
        console.log('- Expenses count:', expenses.length);
        console.log('- Revenues count:', revenues.length);
        console.log('- Contractor agreements count:', contractorAgreements.length);

        // حساب إجمالي الإيرادات
        const totalRevenue = revenues.reduce((sum, r) => sum + r.amount, 0);

        // حساب إجمالي المبلغ المتفق عليه من جميع اتفاقيات المقاولين
        const totalAgreedContractorAmount = contractorAgreements.reduce((sum, ag) => sum + ag.agreedAmount, 0);

        // جلب دفعات المقاولين المرتبطة بالاتفاقيات
        const agreementIds = contractorAgreements.map(ag => (typeof ag._id === 'string' ? mongoose.Types.ObjectId(ag._id) : ag._id));
        console.log('Agreement IDs used for search:', agreementIds);
        let contractorPayments = await ContractPayment.find({ contractAgreement: { $in: agreementIds } })
            .populate('treasury', 'name')
            .populate({
                path: 'contractAgreement',
                populate: {
                    path: 'contractor',
                    select: 'contractorName'
                }
            });
        console.log('Contractor Payments RAW:', contractorPayments);

        // إذا لم نجد دفعات مرتبطة بالاتفاقية، نجلب الدفعات المرتبطة بالمشروع مباشرة
        if (contractorPayments.length === 0) {
            contractorPayments = await ContractPayment.find({ projectId: projectId })
                .populate('treasury', 'name')
                .populate({
                    path: 'contractAgreement',
                    populate: {
                        path: 'contractor',
                        select: 'contractorName'
                    }
                });
            console.log('No payments found by contractAgreement, fetched by projectId instead.');
        }
        // طباعة البيانات للتشخيص
        console.log('Agreements:', contractorAgreements);
        console.log('Contractor Payments:', contractorPayments);

        // حساب إجمالي المبلغ المدفوع للمقاولين
        const totalPaidContractorAmount = contractorPayments.reduce((sum, pay) => sum + pay.amount, 0);

        // حساب إجمالي المصروفات (يشمل المصروفات العادية ودفعات المقاولين)
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0) + totalPaidContractorAmount;

        console.log('Expenses details:');
        expenses.forEach((exp, index) => {
            console.log(`- Expense ${index + 1}:`, {
                id: exp._id,
                amount: exp.amount,
                description: exp.description,
                date: exp.date
            });
        });

        const netProfitLoss = totalRevenue - totalExpenses;

        console.log('Calculated financial data:');
        console.log('- Total revenue:', totalRevenue);
        console.log('- Total expenses:', totalExpenses);
        console.log('- Net profit/loss:', netProfitLoss);
        console.log('- Total agreed contractor amount:', totalAgreedContractorAmount);
        console.log('- Total paid contractor amount:', totalPaidContractorAmount);

        const responseData = {
            ...project.toObject(), // تحويل مستند Mongoose إلى كائن JavaScript عادي
            totalRevenue,
            totalExpenses, // الآن يشمل دفعات المقاولين
            netProfitLoss,
            totalAgreedContractorAmount,
            totalPaidContractorAmount,
            totalRemainingContractorAmount: totalAgreedContractorAmount - totalPaidContractorAmount
        };

        console.log('Project details response data:', responseData);
        console.log('=== Project Details GET Request END ===');

        res.json(responseData);

    } catch (err) {
        console.error('=== Project Details GET Error ===');
        console.error('Error message:', err.message);
        console.error('Error stack:', err.stack);
        
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف المشروع غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء جلب تفاصيل المشروع.');
    }
});

// @route   PUT /api/projects/:id
// @desc    Update a project
// @access  Private (Manager, Accountant Manager)
router.put('/:id', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => {
    const {
        projectName,
        address,
        description,
        engineer,
        client,
        startDate,
        endDate,
        notes,
        status
    } = req.body;

    try {
        let project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'المشروع غير موجود.' });
        }

        // تحديث البيانات
        project.projectName = projectName;
        project.address = address;
        project.description = description;
        project.engineer = engineer;
        project.client = client;
        project.startDate = startDate;
        project.endDate = endDate;
        project.notes = notes;
        project.status = status;

        await project.save();
        res.json({ message: 'تم تحديث المشروع بنجاح.', project });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف المهندس أو العميل غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء تحديث المشروع.');
    }
});

// @route   DELETE /api/projects/:id
// @desc    Delete a project
// @access  Private (Manager, Accountant Manager)
router.delete('/:id', auth, authorizeRoles('مدير', 'مدير حسابات'), async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'المشروع غير موجود.' });
        }

        // هنا يمكن إضافة منطق للتحقق مما إذا كان المشروع مرتبطًا بأي عناصر مالية
        // قبل الحذف لمنع فقدان البيانات.

        await Project.deleteOne({ _id: req.params.id });
        res.json({ message: 'تم حذف المشروع بنجاح.' });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف المشروع غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء حذف المشروع.');
    }
});

// @route   GET /api/projects/engineer/:engineerId
// @desc    Get projects for a specific engineer
// @access  Private (Engineer can only see their own projects)
router.get('/engineer/:engineerId', auth, async (req, res) => {
    try {
        // Check if the requesting user is the engineer or has higher privileges
        if (req.user.role === 'مهندس' && req.user.id !== req.params.engineerId) {
            return res.status(403).json({ message: 'ليس لديك صلاحية لعرض مشاريع مهندس آخر.' });
        }

        const projects = await Project.find({ 
            engineer: req.params.engineerId 
        })
        .populate('engineer', 'username')
        .populate('client', 'clientName')
        .sort({ createdAt: -1 });

        res.json(projects);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'حدث خطأ في الخادم أثناء جلب مشاريع المهندس.' });
    }
});

// @route   GET /api/projects/:id/contractor-statement-excel
// @desc    Export contractor statement as Excel with formatting
// @access  Private (Manager, Accountant Manager, Engineer (if assigned))
router.get('/:id/contractor-statement-excel', auth, async (req, res) => {
    try {
        const projectId = req.params.id;
        const project = await Project.findById(projectId)
            .populate('engineer', 'username')
            .populate('client', 'clientName');
        if (!project) {
            return res.status(404).json({ message: 'المشروع غير موجود.' });
        }
        if (req.user.role === 'مهندس' && project.engineer && project.engineer._id.toString() !== req.user.id) {
            return res.status(403).json({ message: 'ليس لديك صلاحية لعرض تفاصيل هذا المشروع.' });
        }
        // جلب اتفاقيات ومدفوعات المقاولين
        const contractorAgreements = await ContractAgreement.find({ project: projectId }).populate('contractor', 'contractorName');
        // تأكد أن جميع الـ _id من نوع ObjectId
        const agreementIds = contractorAgreements.map(ag => (typeof ag._id === 'string' ? mongoose.Types.ObjectId(ag._id) : ag._id));
        console.log('Agreement IDs used for search:', agreementIds);
        // جلب دفعات المقاولين المرتبطة بالاتفاقيات
        let contractorPayments = await ContractPayment.find({ contractAgreement: { $in: agreementIds } })
            .populate('treasury', 'name')
            .populate({
                path: 'contractAgreement',
                populate: {
                    path: 'contractor',
                    select: 'contractorName'
                }
            });
        console.log('Contractor Payments RAW:', contractorPayments);
        let treasuryIds = [];
        if (contractorAgreements.length > 0) {
            const agreementIds = contractorAgreements.map(ag => ag._id);
            contractorPayments = await ContractPayment.find({ contractAgreement: { $in: agreementIds } });
            treasuryIds = contractorPayments.map(pay => pay.treasury).filter(Boolean);
        }
        // جلب أسماء الخزن دفعة واحدة
        let treasuriesMap = {};
        if (treasuryIds.length > 0) {
            const treasuries = await Treasury.find({ _id: { $in: treasuryIds } });
            treasuriesMap = treasuries.reduce((acc, t) => {
                acc[t._id.toString()] = t.name;
                return acc;
            }, {});
        }
        // إنشاء ملف Excel
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('كشف حساب مقاول');
        let rowIdx = 1;
        // لكل اتفاقية
        contractorAgreements.forEach((ag, idx) => {
            // عنوان الاتفاقية مع padding
            const titleRow = sheet.getRow(rowIdx);
            titleRow.getCell(2).value = `الاتفاقية: ${(ag.description || 'اتفاقية بدون وصف')} (${idx+1})`;
            titleRow.font = { bold: true, size: 16 };
            titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
            titleRow.height = 28;
            sheet.mergeCells(rowIdx, 2, rowIdx, 5); // دمج فقط الأعمدة الحقيقية
            for (let c = 2; c <= 5; c++) {
                titleRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
            }
            rowIdx++;
            // بيانات الاتفاقية مع padding
            sheet.getRow(rowIdx).values = ['', 'المبلغ المتفق عليه', ag.agreedAmount + ' ج.م', '', ''];
            sheet.getRow(rowIdx).font = { bold: true };
            for (let c = 1; c <= 5; c++) {
                sheet.getRow(rowIdx).getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
            }
            rowIdx++;
            const agPayments = contractorPayments.filter(pay => pay.contractAgreement.toString() === ag._id.toString());
            const totalPaid = agPayments.reduce((sum, pay) => sum + (pay.amount || 0), 0);
            sheet.getRow(rowIdx).values = ['', 'المتبقي من الاتفاقية', (ag.agreedAmount - totalPaid) + ' ج.م', '', ''];
            sheet.getRow(rowIdx).font = { bold: true };
            for (let c = 1; c <= 5; c++) {
                sheet.getRow(rowIdx).getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
            }
            rowIdx++;
            // صف فارغ
            rowIdx++;
            // رؤوس الجدول مع padding
            const headerRow = sheet.getRow(rowIdx);
            headerRow.values = ['', 'التاريخ', 'المبلغ', 'الخزنة', 'الوصف', ''];
            headerRow.font = { bold: true, size: 13 };
            headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D1D1' } };
            headerRow.height = 22;
            for (let c = 1; c <= 6; c++) {
                headerRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
            }
            rowIdx++;
            // بيانات الدفعات مع padding
            if (agPayments.length > 0) {
                agPayments.forEach(pay => {
                    const row = sheet.getRow(rowIdx);
                    row.values = [
                        '',
                        pay.date ? new Date(pay.date).toLocaleDateString('ar-EG') : '',
                        pay.amount + ' ج.م',
                        pay.treasury && treasuriesMap[pay.treasury.toString()] ? treasuriesMap[pay.treasury.toString()] : '-',
                        pay.description || '-',
                        ''
                    ];
                    for (let c = 1; c <= 6; c++) {
                        row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
                    }
                    rowIdx++;
                });
            } else {
                sheet.getRow(rowIdx).values = ['', 'لا توجد دفعات لهذه الاتفاقية', '', '', '', ''];
                for (let c = 1; c <= 6; c++) {
                    sheet.getRow(rowIdx).getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
                }
                rowIdx++;
            }
            // صف فارغ بين الاتفاقيات
            rowIdx++;
        });
        // حدود الأعمدة بعرض مناسب مع padding
        sheet.columns = [
            { key: 'pad1', width: 4 },
            { key: 'date', width: 15 },
            { key: 'amount', width: 15 },
            { key: 'treasury', width: 20 },
            { key: 'desc', width: 25 },
            { key: 'pad2', width: 4 }
        ];
        // إضافة حدود ومحاذاة لكل الخلايا
        sheet.eachRow({ includeEmpty: false }, function(row) {
            row.eachCell({ includeEmpty: false }, function(cell) {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
        });
        // تأكيد المحاذاة لكل الخلايا حتى الفارغة
        sheet.eachRow({ includeEmpty: true }, function(row) {
            for (let c = 1; c <= 6; c++) {
                row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
            }
        });
        // اسم ملف الإكسيل
        let safeProjectName = String(project.projectName || 'project').replace(/[^a-zA-Z0-9-_]/g, '_');
        const fileName = `contractor_statement_${safeProjectName}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Excel export error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء تصدير كشف الحساب.' });
    }
});

// @route   GET /api/projects/:id/expenses-excel
// @desc    Export project expenses as Excel with formatting
// @access  Private (Manager, Accountant Manager, Engineer (if assigned))
router.get('/:id/expenses-excel', auth, async (req, res) => {
    try {
        const projectId = req.params.id;
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'المشروع غير موجود.' });
        }
        // تحقق من الصلاحيات كما في التفاصيل
        if (req.user.role === 'مهندس' && project.engineer && project.engineer.toString() !== req.user.id) {
            return res.status(403).json({ message: 'ليس لديك صلاحية لعرض تفاصيل هذا المشروع.' });
        }
        // جلب المصروفات
        const expenses = await Transaction.find({ project: projectId, type: 'مصروف' })
            .populate('treasury', 'name')
            .populate('category', 'name');
        // إنشاء ملف Excel
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('مصروفات المشروع');
        sheet.pageSetup = {
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            orientation: 'landscape',
            paperSize: 9 // A4
        };
        let rowIdx = 1;
        // رؤوس الأعمدة مع أعمدة padding
        const headers = ['', 'المبلغ', 'الوصف', 'التصنيف', 'التاريخ', 'الخزنة', ''];
        const headerRow = sheet.getRow(rowIdx);
        headerRow.values = headers;
        headerRow.font = { bold: true, size: 13 };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D1D1' } };
        headerRow.height = 22;
        for (let c = 1; c <= 7; c++) {
            headerRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
        }
        rowIdx++;
        // بيانات المصروفات مع أعمدة padding
        let total = 0;
        expenses.forEach(exp => {
            const row = sheet.getRow(rowIdx);
            row.values = [
                '',
                exp.amount + ' ج.م',
                exp.description || '-',
                (exp.category && exp.category.name) || '-',
                exp.date ? new Date(exp.date).toLocaleDateString('ar-EG') : '-',
                (exp.treasury && exp.treasury.name) || '-',
                ''
            ];
            for (let c = 1; c <= 7; c++) {
                row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
            }
            total += exp.amount;
            rowIdx++;
        });
        // صف الإجمالي مع أعمدة padding
        const totalRow = sheet.getRow(rowIdx);
        totalRow.values = ['', '', '', '', 'الإجمالي:', total.toFixed(2) + ' ج.م', ''];
        totalRow.font = { bold: true };
        for (let c = 1; c <= 7; c++) {
            totalRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
        }
        // حدود الأعمدة بعرض مناسب مع padding
        sheet.columns = [
            { key: 'pad1', width: 4 },
            { key: 'amount', width: 12 },
            { key: 'desc', width: 18 },
            { key: 'cat', width: 14 },
            { key: 'date', width: 12 },
            { key: 'treasury', width: 14 },
            { key: 'pad2', width: 4 }
        ];
        // عنوان مع دمج الأعمدة الجديدة
        rowIdx = 1;
        const titleRow = sheet.getRow(rowIdx);
        let projectTitle = `مصروفات المشروع: ${project.projectName || ''}`;
        if (projectTitle.length > 40) projectTitle = projectTitle.slice(0, 37) + '...';
        titleRow.getCell(2).value = projectTitle;
        titleRow.font = { bold: true, size: 14 };
        titleRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        titleRow.height = 24;
        sheet.mergeCells(rowIdx, 2, rowIdx, 6); // دمج فقط الأعمدة الحقيقية
        for (let c = 2; c <= 6; c++) {
            titleRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        }
        // إضافة حدود ومحاذاة لكل الخلايا
        sheet.eachRow({ includeEmpty: false }, function(row) {
            row.eachCell({ includeEmpty: false }, function(cell) {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
        });
        // تأكيد المحاذاة لكل الخلايا حتى الفارغة
        sheet.eachRow({ includeEmpty: true }, function(row) {
            for (let c = 1; c <= 7; c++) {
                row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
            }
        });
        // اسم ملف الإكسيل
        let safeProjectName = String(project.projectName || 'project').replace(/[^a-zA-Z0-9-_]/g, '_');
        const fileName = `expenses_${safeProjectName}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Excel export error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء تصدير المصروفات.' });
    }
});

// @route   GET /api/projects/:id/revenues-excel
// @desc    Export project revenues as Excel with formatting
// @access  Private (Manager, Accountant Manager, Engineer (if assigned))
router.get('/:id/revenues-excel', auth, async (req, res) => {
    try {
        const projectId = req.params.id;
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'المشروع غير موجود.' });
        }
        // تحقق من الصلاحيات كما في التفاصيل
        if (req.user.role === 'مهندس' && project.engineer && project.engineer.toString() !== req.user.id) {
            return res.status(403).json({ message: 'ليس لديك صلاحية لعرض تفاصيل هذا المشروع.' });
        }
        // جلب الإيرادات
        const revenues = await Transaction.find({ project: projectId, type: 'إيداع' })
            .populate('treasury', 'name');
        // إنشاء ملف Excel
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('إيرادات المشروع');
        sheet.pageSetup = {
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            orientation: 'landscape',
            paperSize: 9 // A4
        };
        let rowIdx = 1;
        // رؤوس الأعمدة مع أعمدة padding
        const headers = ['', 'المبلغ', 'الوصف', 'التاريخ', 'طريقة التحويل', 'الخزنة', ''];
        const headerRow = sheet.getRow(rowIdx);
        headerRow.values = headers;
        headerRow.font = { bold: true, size: 13 };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D1D1' } };
        headerRow.height = 22;
        for (let c = 1; c <= 7; c++) {
            headerRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
        }
        rowIdx++;
        // بيانات الإيرادات مع أعمدة padding
        let total = 0;
        revenues.forEach(rev => {
            const row = sheet.getRow(rowIdx);
            row.values = [
                '',
                rev.amount + ' ج.م',
                rev.description || '-',
                rev.date ? new Date(rev.date).toLocaleDateString('ar-EG') : '-',
                rev.paymentMethod || '-',
                (rev.treasury && rev.treasury.name) || '-',
                ''
            ];
            for (let c = 1; c <= 7; c++) {
                row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
            }
            total += rev.amount;
            rowIdx++;
        });
        // صف الإجمالي مع أعمدة padding
        const totalRow = sheet.getRow(rowIdx);
        totalRow.values = ['', '', '', '', 'الإجمالي:', total.toFixed(2) + ' ج.م', ''];
        totalRow.font = { bold: true };
        for (let c = 1; c <= 7; c++) {
            totalRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
        }
        // حدود الأعمدة بعرض مناسب مع padding
        sheet.columns = [
            { key: 'pad1', width: 4 },
            { key: 'amount', width: 12 },
            { key: 'desc', width: 18 },
            { key: 'date', width: 12 },
            { key: 'method', width: 14 },
            { key: 'treasury', width: 14 },
            { key: 'pad2', width: 4 }
        ];
        // عنوان مع دمج الأعمدة الجديدة
        rowIdx = 1;
        const titleRow = sheet.getRow(rowIdx);
        let projectTitle = `إيرادات المشروع: ${project.projectName || ''}`;
        if (projectTitle.length > 40) projectTitle = projectTitle.slice(0, 37) + '...';
        titleRow.getCell(2).value = projectTitle;
        titleRow.font = { bold: true, size: 14 };
        titleRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        titleRow.height = 24;
        sheet.mergeCells(rowIdx, 2, rowIdx, 6); // دمج فقط الأعمدة الحقيقية
        for (let c = 2; c <= 6; c++) {
            titleRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        }
        // إضافة حدود ومحاذاة لكل الخلايا
        sheet.eachRow({ includeEmpty: false }, function(row) {
            row.eachCell({ includeEmpty: false }, function(cell) {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
        });
        // تأكيد المحاذاة لكل الخلايا حتى الفارغة
        sheet.eachRow({ includeEmpty: true }, function(row) {
            for (let c = 1; c <= 7; c++) {
                row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
            }
        });
        // اسم ملف الإكسيل
        let safeProjectName = String(project.projectName || 'project').replace(/[^a-zA-Z0-9-_]/g, '_');
        const fileName = `revenues_${safeProjectName}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Excel export error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء تصدير الإيرادات.' });
    }
});

// @route   GET /api/projects/:id/financial-movement-excel
// @desc    Export project financial movement as Excel with formatting
// @access  Private (Manager, Accountant Manager, Engineer (if assigned))
router.get('/:id/financial-movement-excel', auth, async (req, res) => {
    try {
        const projectId = req.params.id;
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'المشروع غير موجود.' });
        }
        // تحقق من الصلاحيات كما في التفاصيل
        if (req.user.role === 'مهندس' && project.engineer && project.engineer.toString() !== req.user.id) {
            return res.status(403).json({ message: 'ليس لديك صلاحية لعرض تفاصيل هذا المشروع.' });
        }
        
        // جلب جميع الحركات المالية
        const [revenues, expenses, contractorPayments] = await Promise.all([
            Transaction.find({ project: projectId, type: 'إيداع' }).populate('treasury', 'name'),
            Transaction.find({ project: projectId, type: 'مصروف' }).populate('treasury', 'name'),
            ContractPayment.find({ projectId: projectId }).populate('treasury', 'name')
        ]);

        // تجميع جميع الأنشطة
        const allActivities = [];
        
        // إضافة الإيرادات
        revenues.forEach(rev => {
            allActivities.push({
                type: 'إيداع',
                date: rev.date,
                description: rev.description || '-',
                amount: rev.amount,
                treasury: rev.treasury ? rev.treasury.name : '-',
                createdAt: rev.createdAt
            });
        });

        // إضافة المصروفات
        expenses.forEach(exp => {
            allActivities.push({
                type: 'مصروف',
                date: exp.date,
                description: exp.description || '-',
                amount: exp.amount,
                treasury: exp.treasury ? exp.treasury.name : '-',
                createdAt: exp.createdAt
            });
        });

        // إضافة دفعات المقاولين
        contractorPayments.forEach(pay => {
            allActivities.push({
                type: 'دفعة مقاول',
                date: pay.date,
                description: pay.description || '-',
                amount: pay.amount,
                treasury: pay.treasury ? pay.treasury.name : '-',
                createdAt: pay.createdAt
            });
        });

        // ترتيب حسب التاريخ
        allActivities.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            if (dateA.getTime() !== dateB.getTime()) {
                return dateA.getTime() - dateB.getTime();
            } else {
                const creationA = new Date(a.createdAt || a.date);
                const creationB = new Date(b.createdAt || b.date);
                return creationA.getTime() - creationB.getTime();
            }
        });

        // إنشاء ملف Excel
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('الحركة المالية');
        sheet.pageSetup = {
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            orientation: 'landscape',
            paperSize: 9 // A4
        };
        let rowIdx = 1;
        
        // رؤوس الأعمدة مع أعمدة padding
        const headers = ['', 'التاريخ', 'النوع', 'الوصف', 'المبلغ', 'الرصيد بعد العملية', ''];
        const headerRow = sheet.getRow(rowIdx);
        headerRow.values = headers;
        headerRow.font = { bold: true, size: 13 };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D1D1' } };
        headerRow.height = 22;
        for (let c = 1; c <= 7; c++) {
            headerRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
        }
        rowIdx++;

        // حساب الرصيد الجاري وعرض البيانات
        let runningBalance = 0;
        let totalRevenue = 0;
        let totalExpenses = 0;

        allActivities.forEach(activity => {
            const row = sheet.getRow(rowIdx);
            
            // حساب الرصيد الجاري
            if (activity.type === 'إيداع') {
                runningBalance += activity.amount;
                totalRevenue += activity.amount;
            } else {
                runningBalance -= activity.amount;
                totalExpenses += activity.amount;
            }

            // تحديد نوع العرض
            let typeDisplay = activity.type;
            if (activity.type === 'إيداع') {
                typeDisplay = 'إيراد';
            } else if (activity.type === 'مصروف') {
                typeDisplay = 'مصروف';
            } else if (activity.type === 'دفعة مقاول') {
                typeDisplay = 'دفعة مقاول';
            }

            row.values = [
                '',
                activity.date ? new Date(activity.date).toLocaleDateString('ar-EG') : '-',
                typeDisplay,
                activity.description,
                (activity.type === 'إيداع' ? '+' : '-') + activity.amount.toFixed(2) + ' ج.م',
                runningBalance.toFixed(2) + ' ج.م',
                ''
            ];

            // تلوين الخلايا حسب النوع
            const typeCell = row.getCell(3);
            const amountCell = row.getCell(5);
            const balanceCell = row.getCell(6);

            if (activity.type === 'إيداع') {
                typeCell.font = { color: { argb: 'FF28A745' }, bold: true };
                amountCell.font = { color: { argb: 'FF28A745' }, bold: true };
            } else {
                typeCell.font = { color: { argb: 'FFDC3545' }, bold: true };
                amountCell.font = { color: { argb: 'FFDC3545' }, bold: true };
            }

            if (runningBalance >= 0) {
                balanceCell.font = { color: { argb: 'FF28A745' }, bold: true };
            } else {
                balanceCell.font = { color: { argb: 'FFDC3545' }, bold: true };
            }

            for (let c = 1; c <= 7; c++) {
                row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
            }
            rowIdx++;
        });

        // صف الإجماليات مع أعمدة padding
        const summaryRow1 = sheet.getRow(rowIdx);
        summaryRow1.values = ['', '', '', '', 'إجمالي الإيرادات:', totalRevenue.toFixed(2) + ' ج.م', ''];
        summaryRow1.font = { bold: true };
        summaryRow1.getCell(5).font = { color: { argb: 'FF28A745' }, bold: true };
        summaryRow1.getCell(6).font = { color: { argb: 'FF28A745' }, bold: true };
        for (let c = 1; c <= 7; c++) {
            summaryRow1.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
        }
        rowIdx++;

        const summaryRow2 = sheet.getRow(rowIdx);
        summaryRow2.values = ['', '', '', '', 'إجمالي المصروفات:', totalExpenses.toFixed(2) + ' ج.م', ''];
        summaryRow2.font = { bold: true };
        summaryRow2.getCell(5).font = { color: { argb: 'FFDC3545' }, bold: true };
        summaryRow2.getCell(6).font = { color: { argb: 'FFDC3545' }, bold: true };
        for (let c = 1; c <= 7; c++) {
            summaryRow2.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
        }
        rowIdx++;

        const netProfitLoss = totalRevenue - totalExpenses;
        const summaryRow3 = sheet.getRow(rowIdx);
        summaryRow3.values = ['', '', '', '', 'صافي الربح/الخسارة:', netProfitLoss.toFixed(2) + ' ج.م', ''];
        summaryRow3.font = { bold: true };
        const netColor = netProfitLoss >= 0 ? 'FF28A745' : 'FFDC3545';
        summaryRow3.getCell(6).font = { color: { argb: netColor }, bold: true };
        for (let c = 1; c <= 7; c++) {
            summaryRow3.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
        }

        // حدود الأعمدة بعرض مناسب مع padding
        sheet.columns = [
            { key: 'pad1', width: 4 },
            { key: 'date', width: 12 },
            { key: 'type', width: 12 },
            { key: 'desc', width: 20 },
            { key: 'amount', width: 15 },
            { key: 'balance', width: 15 },
            { key: 'pad2', width: 4 }
        ];

        // عنوان مع دمج الأعمدة الجديدة
        rowIdx = 1;
        const titleRow = sheet.getRow(rowIdx);
        let projectTitle = `الحركة المالية للمشروع: ${project.projectName || ''}`;
        if (projectTitle.length > 40) projectTitle = projectTitle.slice(0, 37) + '...';
        titleRow.getCell(2).value = projectTitle;
        titleRow.font = { bold: true, size: 14 };
        titleRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        titleRow.height = 24;
        sheet.mergeCells(rowIdx, 2, rowIdx, 6); // دمج فقط الأعمدة الحقيقية
        for (let c = 2; c <= 6; c++) {
            titleRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        }

        // إضافة حدود ومحاذاة لكل الخلايا
        sheet.eachRow({ includeEmpty: false }, function(row) {
            row.eachCell({ includeEmpty: false }, function(cell) {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
        });

        // تأكيد المحاذاة لكل الخلايا حتى الفارغة
        sheet.eachRow({ includeEmpty: true }, function(row) {
            for (let c = 1; c <= 7; c++) {
                row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
            }
        });

        // اسم ملف الإكسيل
        let safeProjectName = String(project.projectName || 'project').replace(/[^a-zA-Z0-9-_]/g, '_');
        const fileName = `financial_movement_${safeProjectName}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Excel export error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء تصدير الحركة المالية.' });
    }
});

// @route   GET /api/projects/:id/full-details-excel
// @desc    Export full project details as Excel with formatting
// @access  Private (Manager, Accountant Manager, Engineer (if assigned))
router.get('/:id/full-details-excel', auth, async (req, res) => {
    try {
        const projectId = req.params.id;
        const project = await Project.findById(projectId)
            .populate('engineer', 'username')
            .populate('client', 'clientName');
        if (!project) {
            return res.status(404).json({ message: 'المشروع غير موجود.' });
        }
        // تحقق من الصلاحيات كما في التفاصيل
        if (req.user.role === 'مهندس' && project.engineer && project.engineer.toString() !== req.user.id) {
            return res.status(403).json({ message: 'ليس لديك صلاحية لعرض تفاصيل هذا المشروع.' });
        }

        // جلب جميع البيانات
        const [expenses, revenues, contractorAgreements, contractorPayments] = await Promise.all([
            Transaction.find({ project: projectId, type: 'مصروف' }).populate('treasury', 'name').populate('category', 'name'),
            Transaction.find({ project: projectId, type: 'إيداع' }).populate('treasury', 'name'),
            ContractAgreement.find({ project: projectId }).populate('contractor', 'contractorName'),
            ContractPayment.find({ projectId: projectId }).populate('treasury', 'name').populate({
                path: 'contractAgreement',
                populate: {
                    path: 'contractor',
                    select: 'contractorName'
                }
            })
        ]);
        // طباعة البيانات للتشخيص
        console.log('Agreements:', contractorAgreements);
        console.log('Contractor Payments:', contractorPayments);

        // إنشاء ملف Excel
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();

        // ===== شيت تفاصيل المشروع =====
        const projectSheet = workbook.addWorksheet('تفاصيل المشروع');
        projectSheet.pageSetup = {
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            orientation: 'landscape',
            paperSize: 9
        };

        // عنوان الشيت
        const projectTitleRow = projectSheet.getRow(1);
        projectTitleRow.getCell(2).value = `تفاصيل المشروع: ${project.projectName || ''}`;
        projectTitleRow.font = { bold: true, size: 16 };
        projectTitleRow.alignment = { horizontal: 'center', vertical: 'middle' };
        projectTitleRow.height = 28;
        projectSheet.mergeCells(1, 2, 1, 5);

        // بيانات المشروع
        const projectData = [
            ['اسم المشروع', project.projectName || '-'],
            ['العنوان', project.address || '-'],
            ['المهندس', project.engineer ? project.engineer.username : '-'],
            ['العميل', project.client ? project.client.clientName : '-'],
            ['تاريخ البدء', project.startDate ? new Date(project.startDate).toLocaleDateString('ar-EG') : '-'],
            ['تاريخ الانتهاء', project.endDate ? new Date(project.endDate).toLocaleDateString('ar-EG') : '-'],
            ['الحالة', project.status || '-'],
            ['الوصف', project.description || '-'],
            ['ملاحظات', project.notes || '-']
        ];

        let rowIdx = 3;
        projectData.forEach(([label, value]) => {
            const row = projectSheet.getRow(rowIdx);
            row.values = ['', label, value, '', ''];
            row.getCell(2).font = { bold: true };
            for (let c = 1; c <= 5; c++) {
                row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
            }
            rowIdx++;
        });

        // تنسيق أعمدة المشروع
        projectSheet.columns = [
            { key: 'pad1', width: 4 },
            { key: 'label', width: 20 },
            { key: 'value', width: 30 },
            { key: 'pad2', width: 4 },
            { key: 'pad3', width: 4 }
        ];

        // ===== شيت المصروفات =====
        const expensesSheet = workbook.addWorksheet('المصروفات');
        expensesSheet.pageSetup = {
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            orientation: 'landscape',
            paperSize: 9
        };

        // عنوان شيت المصروفات
        const expensesTitleRow = expensesSheet.getRow(1);
        expensesTitleRow.getCell(2).value = `مصروفات المشروع: ${project.projectName || ''}`;
        expensesTitleRow.font = { bold: true, size: 14 };
        expensesTitleRow.alignment = { horizontal: 'center', vertical: 'middle' };
        expensesTitleRow.height = 24;
        expensesSheet.mergeCells(1, 2, 1, 6);

        // رؤوس أعمدة المصروفات
        const expensesHeaders = ['', 'المبلغ', 'الوصف', 'التصنيف', 'التاريخ', 'البائع', 'الخزنة', ''];
        const expensesHeaderRow = expensesSheet.getRow(3);
        expensesHeaderRow.values = expensesHeaders;
        expensesHeaderRow.font = { bold: true, size: 13 };
        expensesHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
        expensesHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D1D1' } };
        expensesHeaderRow.height = 22;

        rowIdx = 4;
        let totalExpenses = 0;
        expenses.forEach(exp => {
            const row = expensesSheet.getRow(rowIdx);
            row.values = [
                '',
                exp.amount + ' ج.م',
                exp.description || '-',
                (exp.category && exp.category.name) || '-',
                exp.date ? new Date(exp.date).toLocaleDateString('ar-EG') : '-',
                exp.vendor || '-',
                (exp.treasury && exp.treasury.name) || '-',
                ''
            ];
            for (let c = 1; c <= 8; c++) {
                row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
            }
            totalExpenses += exp.amount;
            rowIdx++;
        });

        // إجمالي المصروفات
        const expensesTotalRow = expensesSheet.getRow(rowIdx);
        expensesTotalRow.values = ['', '', '', '', '', 'الإجمالي:', totalExpenses.toFixed(2) + ' ج.م', ''];
        expensesTotalRow.font = { bold: true };
        for (let c = 1; c <= 8; c++) {
            expensesTotalRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
        }

        // تنسيق أعمدة المصروفات
        expensesSheet.columns = [
            { key: 'pad1', width: 4 },
            { key: 'amount', width: 12 },
            { key: 'desc', width: 18 },
            { key: 'cat', width: 14 },
            { key: 'date', width: 12 },
            { key: 'vendor', width: 12 },
            { key: 'treasury', width: 14 },
            { key: 'pad2', width: 4 }
        ];

        // ===== شيت الإيرادات =====
        const revenuesSheet = workbook.addWorksheet('الإيرادات');
        revenuesSheet.pageSetup = {
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            orientation: 'landscape',
            paperSize: 9
        };

        // عنوان شيت الإيرادات
        const revenuesTitleRow = revenuesSheet.getRow(1);
        revenuesTitleRow.getCell(2).value = `إيرادات المشروع: ${project.projectName || ''}`;
        revenuesTitleRow.font = { bold: true, size: 14 };
        revenuesTitleRow.alignment = { horizontal: 'center', vertical: 'middle' };
        revenuesTitleRow.height = 24;
        revenuesSheet.mergeCells(1, 2, 1, 6);

        // رؤوس أعمدة الإيرادات
        const revenuesHeaders = ['', 'المبلغ', 'الوصف', 'التاريخ', 'طريقة التحويل', 'الخزنة', ''];
        const revenuesHeaderRow = revenuesSheet.getRow(3);
        revenuesHeaderRow.values = revenuesHeaders;
        revenuesHeaderRow.font = { bold: true, size: 13 };
        revenuesHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
        revenuesHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D1D1' } };
        revenuesHeaderRow.height = 22;

        rowIdx = 4;
        let totalRevenue = 0;
        revenues.forEach(rev => {
            const row = revenuesSheet.getRow(rowIdx);
            row.values = [
                '',
                rev.amount + ' ج.م',
                rev.description || '-',
                rev.date ? new Date(rev.date).toLocaleDateString('ar-EG') : '-',
                rev.paymentMethod || '-',
                (rev.treasury && rev.treasury.name) || '-',
                ''
            ];
            for (let c = 1; c <= 7; c++) {
                row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
            }
            totalRevenue += rev.amount;
            rowIdx++;
        });

        // إجمالي الإيرادات
        const revenuesTotalRow = revenuesSheet.getRow(rowIdx);
        revenuesTotalRow.values = ['', '', '', '', 'الإجمالي:', totalRevenue.toFixed(2) + ' ج.م', ''];
        revenuesTotalRow.font = { bold: true };
        for (let c = 1; c <= 7; c++) {
            revenuesTotalRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
        }

        // تنسيق أعمدة الإيرادات
        revenuesSheet.columns = [
            { key: 'pad1', width: 4 },
            { key: 'amount', width: 12 },
            { key: 'desc', width: 18 },
            { key: 'date', width: 12 },
            { key: 'method', width: 14 },
            { key: 'treasury', width: 14 },
            { key: 'pad2', width: 4 }
        ];

        // ===== شيت دفعات المقاولين =====
        const contractorsSheet = workbook.addWorksheet('دفعات المقاولين');
        contractorsSheet.pageSetup = {
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            orientation: 'landscape',
            paperSize: 9
        };

        // عنوان شيت المقاولين
        const contractorsTitleRow = contractorsSheet.getRow(1);
        contractorsTitleRow.getCell(2).value = `دفعات المقاولين - المشروع: ${project.projectName || ''}`;
        contractorsTitleRow.font = { bold: true, size: 14 };
        contractorsTitleRow.alignment = { horizontal: 'center', vertical: 'middle' };
        contractorsTitleRow.height = 24;
        contractorsSheet.mergeCells(1, 2, 1, 8);

        // رؤوس أعمدة المقاولين
        const contractorsHeaders = ['', 'المقاول', 'المبلغ المتفق عليه', 'المدفوع', 'المتبقي', 'تاريخ الدفعة', 'مبلغ الدفعة', 'الخزنة', 'الوصف', ''];
        const contractorsHeaderRow = contractorsSheet.getRow(3);
        contractorsHeaderRow.values = contractorsHeaders;
        contractorsHeaderRow.font = { bold: true, size: 13 };
        contractorsHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
        contractorsHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D1D1' } };
        contractorsHeaderRow.height = 22;

        rowIdx = 4;
        let totalContractorPayments = 0;
        contractorPayments.forEach(pay => {
            const row = contractorsSheet.getRow(rowIdx);
            let contractorName = '-';
            let agreedAmount = 0;
            let paidAmount = 0;
            let remainingAmount = 0;
            if (pay.contractAgreement) {
                contractorName = pay.contractAgreement.contractor && pay.contractAgreement.contractor.contractorName ? pay.contractAgreement.contractor.contractorName : '-';
                agreedAmount = pay.contractAgreement.agreedAmount || 0;
                paidAmount = pay.contractAgreement.paidAmount || 0;
                remainingAmount = agreedAmount - paidAmount;
            } else if (contractorAgreements.length > 0) {
                // إذا لم يوجد contractAgreement، استخدم أول اتفاقية للمشروع
                contractorName = contractorAgreements[0].contractor && contractorAgreements[0].contractor.contractorName ? contractorAgreements[0].contractor.contractorName : '-';
                agreedAmount = contractorAgreements[0].agreedAmount || 0;
                paidAmount = contractorAgreements[0].paidAmount || 0;
                remainingAmount = agreedAmount - paidAmount;
            }
            row.values = [
                '',
                contractorName,
                agreedAmount ? agreedAmount.toFixed(2) + ' ج.م' : '-',
                paidAmount ? paidAmount.toFixed(2) + ' ج.م' : '-',
                remainingAmount ? remainingAmount.toFixed(2) + ' ج.م' : '-',
                pay.date ? new Date(pay.date).toLocaleDateString('ar-EG') : '-',
                pay.amount + ' ج.م',
                (pay.treasury && pay.treasury.name) || '-',
                pay.description || '-',
                ''
            ];
            for (let c = 1; c <= 10; c++) {
                row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
            }
            totalContractorPayments += pay.amount;
            rowIdx++;
        });

        // إجمالي دفعات المقاولين
        const contractorsTotalRow = contractorsSheet.getRow(rowIdx);
        contractorsTotalRow.values = ['', '', '', '', '', '', 'الإجمالي:', totalContractorPayments.toFixed(2) + ' ج.م', '', ''];
        contractorsTotalRow.font = { bold: true };
        for (let c = 1; c <= 10; c++) {
            contractorsTotalRow.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
        }

        // تنسيق أعمدة المقاولين
        contractorsSheet.columns = [
            { key: 'pad1', width: 4 },
            { key: 'contractor', width: 15 },
            { key: 'agreed', width: 15 },
            { key: 'paid', width: 12 },
            { key: 'remaining', width: 12 },
            { key: 'date', width: 12 },
            { key: 'amount', width: 12 },
            { key: 'treasury', width: 12 },
            { key: 'desc', width: 15 },
            { key: 'pad2', width: 4 }
        ];

        // ===== شيت الحركة المالية =====
        const movementSheet = workbook.addWorksheet('الحركة المالية');
        movementSheet.pageSetup = {
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            orientation: 'landscape',
            paperSize: 9
        };

        // عنوان شيت الحركة المالية
        const movementTitleRow = movementSheet.getRow(1);
        movementTitleRow.getCell(2).value = `الحركة المالية للمشروع: ${project.projectName || ''}`;
        movementTitleRow.font = { bold: true, size: 14 };
        movementTitleRow.alignment = { horizontal: 'center', vertical: 'middle' };
        movementTitleRow.height = 24;
        movementSheet.mergeCells(1, 2, 1, 6);

        // رؤوس أعمدة الحركة المالية
        const movementHeaders = ['', 'التاريخ', 'النوع', 'الوصف', 'المبلغ', 'الرصيد بعد العملية', ''];
        const movementHeaderRow = movementSheet.getRow(3);
        movementHeaderRow.values = movementHeaders;
        movementHeaderRow.font = { bold: true, size: 13 };
        movementHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
        movementHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D1D1' } };
        movementHeaderRow.height = 22;

        // تجميع جميع الأنشطة
        const allActivities = [];
        revenues.forEach(rev => {
            allActivities.push({
                type: 'إيداع',
                date: rev.date,
                description: rev.description || '-',
                amount: rev.amount,
                createdAt: rev.createdAt
            });
        });
        expenses.forEach(exp => {
            allActivities.push({
                type: 'مصروف',
                date: exp.date,
                description: exp.description || '-',
                amount: exp.amount,
                createdAt: exp.createdAt
            });
        });
        contractorPayments.forEach(pay => {
            allActivities.push({
                type: 'دفعة مقاول',
                date: pay.date,
                description: pay.description || '-',
                amount: pay.amount,
                createdAt: pay.createdAt
            });
        });

        // ترتيب حسب التاريخ
        allActivities.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            if (dateA.getTime() !== dateB.getTime()) {
                return dateA.getTime() - dateB.getTime();
            } else {
                const creationA = new Date(a.createdAt || a.date);
                const creationB = new Date(b.createdAt || b.date);
                return creationA.getTime() - creationB.getTime();
            }
        });

        rowIdx = 4;
        let runningBalance = 0;
        allActivities.forEach(activity => {
            const row = movementSheet.getRow(rowIdx);
            
            if (activity.type === 'إيداع') {
                runningBalance += activity.amount;
            } else {
                runningBalance -= activity.amount;
            }

            let typeDisplay = activity.type;
            if (activity.type === 'إيداع') typeDisplay = 'إيراد';
            else if (activity.type === 'مصروف') typeDisplay = 'مصروف';
            else if (activity.type === 'دفعة مقاول') typeDisplay = 'دفعة مقاول';

            row.values = [
                '',
                activity.date ? new Date(activity.date).toLocaleDateString('ar-EG') : '-',
                typeDisplay,
                activity.description,
                (activity.type === 'إيداع' ? '+' : '-') + activity.amount.toFixed(2) + ' ج.م',
                runningBalance.toFixed(2) + ' ج.م',
                ''
            ];

            // تلوين الخلايا
            const typeCell = row.getCell(3);
            const amountCell = row.getCell(5);
            const balanceCell = row.getCell(6);

            if (activity.type === 'إيداع') {
                typeCell.font = { color: { argb: 'FF28A745' }, bold: true };
                amountCell.font = { color: { argb: 'FF28A745' }, bold: true };
            } else {
                typeCell.font = { color: { argb: 'FFDC3545' }, bold: true };
                amountCell.font = { color: { argb: 'FFDC3545' }, bold: true };
            }

            if (runningBalance >= 0) {
                balanceCell.font = { color: { argb: 'FF28A745' }, bold: true };
            } else {
                balanceCell.font = { color: { argb: 'FFDC3545' }, bold: true };
            }

            for (let c = 1; c <= 7; c++) {
                row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
            }
            rowIdx++;
        });

        // تنسيق أعمدة الحركة المالية
        movementSheet.columns = [
            { key: 'pad1', width: 4 },
            { key: 'date', width: 12 },
            { key: 'type', width: 12 },
            { key: 'desc', width: 20 },
            { key: 'amount', width: 15 },
            { key: 'balance', width: 15 },
            { key: 'pad2', width: 4 }
        ];

        // ===== شيت الملخص المالي =====
        const summarySheet = workbook.addWorksheet('الملخص المالي');
        summarySheet.pageSetup = {
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            orientation: 'portrait',
            paperSize: 9
        };

        // عنوان شيت الملخص
        const summaryTitleRow = summarySheet.getRow(1);
        summaryTitleRow.getCell(2).value = `الملخص المالي للمشروع: ${project.projectName || ''}`;
        summaryTitleRow.font = { bold: true, size: 16 };
        summaryTitleRow.alignment = { horizontal: 'center', vertical: 'middle' };
        summaryTitleRow.height = 28;
        summarySheet.mergeCells(1, 2, 1, 5);

        // بيانات الملخص
        const totalExpensesWithContractors = totalExpenses + totalContractorPayments;
        const netProfitLoss = totalRevenue - totalExpensesWithContractors;

        const summaryData = [
            ['إجمالي الإيرادات', totalRevenue.toFixed(2) + ' ج.م'],
            ['إجمالي المصروفات العادية', totalExpenses.toFixed(2) + ' ج.م'],
            ['إجمالي دفعات المقاولين', totalContractorPayments.toFixed(2) + ' ج.م'],
            ['إجمالي المصروفات الكلي', totalExpensesWithContractors.toFixed(2) + ' ج.م'],
            ['صافي الربح/الخسارة', netProfitLoss.toFixed(2) + ' ج.م']
        ];

        rowIdx = 3;
        summaryData.forEach(([label, value]) => {
            const row = summarySheet.getRow(rowIdx);
            row.values = ['', label, value, '', ''];
            row.getCell(2).font = { bold: true };
            row.getCell(3).font = { bold: true };
            
            // تلوين صافي الربح/الخسارة
            if (label === 'صافي الربح/الخسارة') {
                const color = netProfitLoss >= 0 ? 'FF28A745' : 'FFDC3545';
                row.getCell(3).font = { color: { argb: color }, bold: true };
            }
            
            for (let c = 1; c <= 5; c++) {
                row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
            }
            rowIdx++;
        });

        // تنسيق أعمدة الملخص
        summarySheet.columns = [
            { key: 'pad1', width: 4 },
            { key: 'label', width: 25 },
            { key: 'value', width: 20 },
            { key: 'pad2', width: 4 },
            { key: 'pad3', width: 4 }
        ];

        // تطبيق الحدود والمحاذاة على جميع الشيتات
        [projectSheet, expensesSheet, revenuesSheet, contractorsSheet, movementSheet, summarySheet].forEach(sheet => {
            sheet.eachRow({ includeEmpty: false }, function(row) {
                row.eachCell({ includeEmpty: false }, function(cell) {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                });
            });
        });

        // اسم ملف الإكسيل
        let safeProjectName = String(project.projectName || 'project').replace(/[^a-zA-Z0-9-_]/g, '_');
        const fileName = `full_project_details_${safeProjectName}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Excel export error:', err);
        res.status(500).json({ message: 'حدث خطأ أثناء تصدير تفاصيل المشروع.' });
    }
});

module.exports = router;
