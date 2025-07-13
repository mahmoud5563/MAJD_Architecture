// backend/routes/clients.js
const express = require('express');
const router = express.Router();
const Client = require('../models/Client'); // استيراد موديل العميل
const { auth } = require('../middleware/authMiddleware'); // استيراد الـ middleware للتحقق من الصلاحيات
const ExcelJS = require('exceljs');
const Sale = require('../models/Sale');
const Transaction = require('../models/Transaction');

// @route   POST /api/clients
// @desc    Add a new client
// @access  Private (Manager, Accountant Manager)
router.post('/', auth, async (req, res) => {
    const { clientName, phoneNumber, email } = req.body;

    try {
        // التحقق مما إذا كان العميل موجودًا بالفعل بنفس الاسم
        let client = await Client.findOne({ clientName });
        if (client) {
            return res.status(400).json({ message: 'عميل بهذا الاسم موجود بالفعل.' });
        }

        const newClient = new Client({
            clientName,
            phoneNumber,
            email
        });

        await newClient.save();
        res.status(201).json({ message: 'تم إضافة العميل بنجاح.', client: newClient });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء إضافة العميل.');
    }
});

// @route   GET /api/clients
// @desc    Get all clients
// @access  Private (All authenticated users, but Engineer might have restricted view)
router.get('/', auth, async (req, res) => {
    try {
        // إذا كان المستخدم مهندسًا، فقد نحتاج إلى منطق خاص لجلب العملاء المرتبطين بمشاريعه
        // حالياً، سنقوم بجلب جميع العملاء. لاحقاً يمكننا تطبيق منطق التصفية هنا.
        const clients = await Client.find({}); // جلب جميع العملاء

        res.json(clients);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('حدث خطأ في الخادم أثناء جلب العملاء.');
    }
});

// @route   GET /api/clients/:id
// @desc    Get client by ID
// @access  Private (Manager, Accountant Manager, Engineer (if client related to his project))
router.get('/:id', auth, async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);

        if (!client) {
            return res.status(404).json({ message: 'العميل غير موجود.' });
        }

        // هنا يمكننا إضافة منطق للتحقق إذا كان المستخدم مهندسًا،
        // فهل هذا العميل مرتبط بأحد مشاريعه؟ (تتطلب استعلامات إضافية)

        res.json(client);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف العميل غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء جلب تفاصيل العميل.');
    }
});

// @route   PUT /api/clients/:id
// @desc    Update a client
// @access  Private (Manager, Accountant Manager)
router.put('/:id', auth, async (req, res) => {
    const { clientName, phoneNumber, email } = req.body;

    try {
        let client = await Client.findById(req.params.id);

        if (!client) {
            return res.status(404).json({ message: 'العميل غير موجود.' });
        }

        // التحقق من تكرار اسم العميل عند التحديث (إذا لم يكن هو العميل الحالي)
        const existingClient = await Client.findOne({ clientName });
        if (existingClient && existingClient._id.toString() !== req.params.id) {
            return res.status(400).json({ message: 'عميل آخر بهذا الاسم موجود بالفعل.' });
        }

        client.clientName = clientName || client.clientName;
        client.phoneNumber = phoneNumber || client.phoneNumber;
        client.email = email || client.email;

        await client.save();
        res.json({ message: 'تم تحديث العميل بنجاح.', client });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف العميل غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء تحديث العميل.');
    }
});

// @route   DELETE /api/clients/:id
// @desc    Delete a client
// @access  Private (Manager, Accountant Manager)
router.delete('/:id', auth, async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);

        if (!client) {
            return res.status(404).json({ message: 'العميل غير موجود.' });
        }

        // ************* ملاحظة هامة *************
        // قبل حذف العميل، يجب التحقق مما إذا كان العميل مرتبطًا بأي مشاريع.
        // إذا كان كذلك، يجب منع الحذف أو التعامل مع المشاريع المرتبطة (مثل إزالة العميل منها).
        // هذا يتطلب إضافة منطق للبحث في موديل Projects.
        // For example:
        // const projectsWithClient = await Project.find({ client: req.params.id });
        // if (projectsWithClient.length > 0) {
        //     return res.status(400).json({ message: 'لا يمكن حذف العميل لأنه مرتبط بمشاريع.' });
        // }
        // *****************************************

        await Client.deleteOne({ _id: req.params.id }); // استخدام deleteOne بدلاً من findByIdAndRemove
        res.json({ message: 'تم حذف العميل بنجاح.' });

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(400).json({ message: 'معرف العميل غير صالح.' });
        }
        res.status(500).send('حدث خطأ في الخادم أثناء حذف العميل.');
    }
});

// @route   GET /api/clients/:id/statement-excel
// @desc    Export client statement as Excel with formatting
// @access  Private (authenticated)
router.get('/:id/statement-excel', auth, async (req, res) => {
  try {
    const clientId = req.params.id;
    const client = await Client.findById(clientId);
    if (!client) return res.status(404).json({ message: 'العميل غير موجود' });
    // جلب الفواتير (المبيعات)
    const sales = await Sale.find({ client: clientId }).populate('treasury', 'name');
    // جلب الدفعات النقدية
    const clientPayments = await Transaction.find({ type: 'إيداع', vendor: client.clientName, description: { $not: /فاتورة/ } }).populate('treasury', 'name');
    // إنشاء ملف Excel
    const workbook = new ExcelJS.Workbook();
    // --- ورقة ملخص الحساب ---
    const summarySheet = workbook.addWorksheet('ملخص الحساب');
    summarySheet.mergeCells('A1:E1');
    summarySheet.getCell('A1').value = `كشف حساب العميل: ${client.clientName}`;
    summarySheet.getCell('A1').font = { bold: true, size: 16 };
    summarySheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(2).values = [
      'الرصيد الافتتاحي',
      'إجمالي المبيعات',
      'الإجمالي',
      'المدفوع',
      'المتبقي'
    ];
    summarySheet.getRow(2).font = { bold: true };
    summarySheet.getRow(2).alignment = { horizontal: 'center' };
    summarySheet.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D1D1' } };
    // حساب القيم
    const opening = Number(client.openingBalance) || 0;
    const salesTotal = sales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
    const total = opening + salesTotal;
    let paid = sales.reduce((sum, s) => sum + (Number(s.paid) || 0), 0);
    paid += clientPayments.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const remaining = total - paid;
    summarySheet.getRow(3).values = [
      opening.toFixed(2),
      salesTotal.toFixed(2),
      total.toFixed(2),
      paid.toFixed(2),
      remaining.toFixed(2)
    ];
    summarySheet.getRow(3).alignment = { horizontal: 'center' };
    // حدود
    for (let r = 2; r <= 3; r++) {
      for (let c = 1; c <= 5; c++) {
        summarySheet.getRow(r).getCell(c).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    }
    // --- ورقة الفواتير ---
    const invoicesSheet = workbook.addWorksheet('فواتير المبيعات');
    invoicesSheet.addRow(['#', 'تاريخ الفاتورة', 'رقم الفاتورة', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة', 'الخزينة', 'ملاحظات']);
    invoicesSheet.getRow(1).font = { bold: true };
    invoicesSheet.getRow(1).alignment = { horizontal: 'center' };
    invoicesSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D1D1' } };
    sales.forEach((s, idx) => {
      invoicesSheet.addRow([
        idx + 1,
        s.date ? new Date(s.date).toLocaleDateString('ar-EG') : '',
        s.invoiceNumber || '-',
        s.total || 0,
        s.paid || 0,
        (s.total || 0) - (s.paid || 0),
        s.status || '-',
        s.treasury ? s.treasury.name : '-',
        s.notes || '-'
      ]);
    });
    invoicesSheet.columns.forEach(col => { col.alignment = { horizontal: 'center' }; });
    invoicesSheet.eachRow((row, rowNumber) => {
      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
    // --- ورقة الدفعات النقدية ---
    const paymentsSheet = workbook.addWorksheet('الدفعات النقدية', { properties: { tabColor: { argb: 'FFD1D1D1' }, rtl: true } });
    paymentsSheet.views = [{ rightToLeft: true }];
    // دمج خلايا العنوان
    paymentsSheet.mergeCells('A1:E1');
    paymentsSheet.getCell('A1').value = 'جدول الدفعات النقدية للعميل';
    paymentsSheet.getCell('A1').font = { bold: true, size: 15 };
    paymentsSheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    // رأس الجدول
    paymentsSheet.addRow([]); // سطر فراغ
    paymentsSheet.addRow(['#', 'التاريخ', 'المبلغ المدفوع', 'الخزنة', 'الوصف']);
    paymentsSheet.getRow(3).font = { bold: true };
    paymentsSheet.getRow(3).alignment = { horizontal: 'center' };
    paymentsSheet.getRow(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D1D1' } };
    // البيانات
    clientPayments.forEach((p, idx) => {
      paymentsSheet.addRow([
        idx + 1,
        p.date ? new Date(p.date).toLocaleDateString('ar-EG') : '',
        Number(p.amount || 0).toFixed(2),
        p.treasury ? p.treasury.name : '-',
        p.description || '-'
      ]);
    });
    // محاذاة الأعمدة من اليمين
    paymentsSheet.columns.forEach(col => { col.alignment = { horizontal: 'right' }; });
    // العنوان يبقى في الوسط
    paymentsSheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    paymentsSheet.eachRow((row, rowNumber) => {
      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
    // اسم الملف
    let safeClientName = String(client.clientName || 'client').replace(/[^a-zA-Z0-9-_]/g, '_');
    const fileName = `client_statement_${safeClientName}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ message: 'حدث خطأ أثناء تصدير كشف الحساب.' });
  }
});

// @route   POST /api/clients/:id/payment
// @desc    استلام نقدية عامة من العميل (إيداع في الخزنة)
// @access  Private (authenticated)
router.post('/:id/payment', auth, async (req, res) => {
  try {
    const { amount, treasuryId, date, notes } = req.body;
    const clientId = req.params.id;

    // التحقق من وجود العميل
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ message: 'العميل غير موجود' });
    }

    // التحقق من وجود الخزنة
    const treasury = await require('../models/Treasury').findById(treasuryId);
    if (!treasury) {
      return res.status(404).json({ message: 'الخزنة غير موجودة' });
    }

    // إضافة المبلغ للخزنة
    treasury.currentBalance += Number(amount);
    await treasury.save();

    // إنشاء معاملة مالية
    const transaction = new Transaction({
      treasury: treasuryId,
      type: 'إيداع',
      amount: Number(amount),
      description: `استلام نقدية من العميل: ${client.clientName}${notes ? ` - ${notes}` : ''}`,
      date: date || new Date(),
      vendor: client.clientName,
      recordedBy: req.user ? req.user.id : undefined
    });
    await transaction.save();

    // توزيع الدفعة على الرصيد الافتتاحي أولاً ثم الفواتير
    let remainingPayment = Number(amount);
    // 1. الرصيد الافتتاحي
    let openingPaid = client.openingPaid || 0; // سنحتاج حقل جديد أو حساب ديناميكي
    const openingBalance = Number(client.openingBalance) || 0;
    let openingRemaining = openingBalance - openingPaid;
    let paidFromOpening = 0;
    if (openingRemaining > 0) {
      paidFromOpening = Math.min(remainingPayment, openingRemaining);
      openingPaid += paidFromOpening;
      remainingPayment -= paidFromOpening;
      // يمكن حفظ openingPaid في client إذا أردت تتبع المسدد من الرصيد الافتتاحي
      // client.openingPaid = openingPaid;
      // await client.save();
    }
    // 2. الفواتير الآجلة
    if (remainingPayment > 0) {
      const Sale = require('../models/Sale');
      // جلب الفواتير الآجلة ذات الرصيد المتبقي
      const sales = await Sale.find({ client: clientId, paymentType: 'أجل', balance: { $gt: 0 } }).sort({ date: 1 });
      for (const sale of sales) {
        if (remainingPayment <= 0) break;
        const saleRemaining = sale.balance;
        if (saleRemaining > 0) {
          const paymentForThisSale = Math.min(remainingPayment, saleRemaining);
          sale.paidAmount = (sale.paidAmount || 0) + paymentForThisSale;
          sale.balance = sale.total - sale.paidAmount;
          if (sale.balance <= 0) {
            sale.balance = 0;
            sale.status = 'مدفوع';
          }
          remainingPayment -= paymentForThisSale;
          await sale.save();
        }
      }
    }

    res.json({
      message: 'تم استلام المبلغ بنجاح',
      payment: {
        amount,
        treasury: treasury.name,
        date,
        notes,
        paidFromOpening
      }
    });
  } catch (err) {
    console.error('Error processing client payment:', err);
    res.status(500).json({ message: 'حدث خطأ أثناء استلام المبلغ' });
  }
});

module.exports = router;
