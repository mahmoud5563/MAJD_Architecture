const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');
const Purchase = require('../models/Purchase');
const Treasury = require('../models/Treasury');
const Transaction = require('../models/Transaction');
const { auth } = require('../middleware/authMiddleware');
const ExcelJS = require('exceljs');

// إضافة مورد جديد
router.post('/', async (req, res) => {
  try {
    const supplier = new Supplier(req.body);
    await supplier.save();
    res.status(201).json(supplier);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// جلب كل الموردين
router.get('/', async (req, res) => {
  try {
    const suppliers = await Supplier.find({}).sort({ createdAt: -1 });
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// جلب مورد واحد
router.get('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'المورد غير موجود' });
    res.json(supplier);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// تعديل مورد
router.put('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!supplier) return res.status(404).json({ message: 'المورد غير موجود' });
    res.json(supplier);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// حذف مورد
router.delete('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'المورد غير موجود' });
    res.json({ message: 'تم حذف المورد بنجاح' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// تسديد نقدي للمورد
router.post('/:id/payment', auth, async (req, res) => {
  try {
    const { amount, treasuryId, date, notes } = req.body;
    const supplierId = req.params.id;

    // التحقق من وجود المورد
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      return res.status(404).json({ message: 'المورد غير موجود' });
    }

    // التحقق من وجود الخزينة
    const treasury = await Treasury.findById(treasuryId);
    if (!treasury) {
      return res.status(404).json({ message: 'الخزينة غير موجودة' });
    }

    // التحقق من الرصيد الكافي في الخزينة
    if (treasury.currentBalance < amount) {
      return res.status(400).json({ message: 'الرصيد في الخزينة غير كافٍ لإجراء هذه العملية' });
    }

    // جلب فواتير المشتريات للمورد
    const purchases = await Purchase.find({ supplier: supplierId });
    const totalPurchases = purchases.reduce((sum, p) => sum + (p.total || 0), 0);
    const paid = purchases.reduce((sum, p) => sum + (p.paid || 0), 0);
    const openingBalance = supplier.openingBalance || 0;
    const remainingAmount = totalPurchases + openingBalance - paid;

    // التحقق من أن المبلغ لا يتجاوز المتبقي
    if (amount > remainingAmount) {
      return res.status(400).json({ message: 'المبلغ المدخل أكبر من المتبقي للمورد' });
    }

    // خصم المبلغ من الخزينة
    treasury.currentBalance -= amount;
    await treasury.save();

    // إنشاء معاملة مالية
    const transaction = new Transaction({
      treasury: treasuryId,
      type: 'مصروف',
      amount: amount,
      description: `تسديد نقدي للمورد: ${supplier.name}${notes ? ` - ${notes}` : ''}`,
      date: date || new Date(),
      vendor: supplier.name,
      recordedBy: req.user ? req.user.id : undefined
    });
    await transaction.save();

    // توزيع المبلغ على الرصيد الافتتاحي أولاً، ثم على الفواتير المتبقية
    let remainingPayment = amount;
    // لا تعدل الرصيد الافتتاحي إطلاقًا، فقط وزع الدفعة على الفواتير إذا وجدت
    // توزيع المبلغ المتبقي على الفواتير (FIFO)
    if (remainingPayment > 0) {
      for (const purchase of purchases) {
        if (remainingPayment <= 0) break;
        const purchaseRemaining = (purchase.total || 0) - (purchase.paid || 0);
        if (purchaseRemaining > 0) {
          const paymentForThisPurchase = Math.min(remainingPayment, purchaseRemaining);
          purchase.paid = (purchase.paid || 0) + paymentForThisPurchase;
          remainingPayment -= paymentForThisPurchase;
          await purchase.save();
        }
      }
    }
    // لا تعدل supplier.openingBalance إطلاقًا

    res.json({
      message: 'تم تسديد المبلغ بنجاح',
      payment: {
        amount,
        treasury: treasury.name,
        date,
        notes
      }
    });

  } catch (err) {
    console.error('Error processing supplier payment:', err);
    res.status(500).json({ message: 'حدث خطأ أثناء تسديد المبلغ' });
  }
});

// @route   GET /api/suppliers/:id/statement-excel
// @desc    Export supplier statement as Excel with formatting
// @access  Private (authenticated)
router.get('/:id/statement-excel', auth, async (req, res) => {
  try {
    const supplierId = req.params.id;
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) return res.status(404).json({ message: 'المورد غير موجود' });
    // جلب الفواتير
    const purchases = await Purchase.find({ supplier: supplierId }).populate('treasury', 'name');
    // جلب الدفعات النقدية
    const supplierPayments = await Transaction.find({ type: 'مصروف', vendor: supplier.name }).populate('treasury', 'name');
    // إنشاء ملف Excel
    const workbook = new ExcelJS.Workbook();
    // --- ورقة ملخص الحساب ---
    const summarySheet = workbook.addWorksheet('ملخص الحساب');
    summarySheet.mergeCells('A1:E1');
    summarySheet.getCell('A1').value = `كشف حساب المورد: ${supplier.name}`;
    summarySheet.getCell('A1').font = { bold: true, size: 16 };
    summarySheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(2).values = [
      'الرصيد الافتتاحي',
      'إجمالي المشتريات',
      'الإجمالي',
      'المدفوع',
      'المتبقي'
    ];
    summarySheet.getRow(2).font = { bold: true };
    summarySheet.getRow(2).alignment = { horizontal: 'center' };
    summarySheet.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D1D1' } };
    // حساب القيم
    const opening = supplier.openingBalance || 0;
    const purchasesTotal = purchases.reduce((sum, p) => sum + (p.total || 0), 0);
    const total = opening + purchasesTotal;
    let paid = purchases.reduce((sum, p) => sum + (p.paid || 0), 0);
    paid += supplierPayments.reduce((sum, t) => sum + (t.amount || 0), 0);
    const remaining = total - paid;
    summarySheet.getRow(3).values = [
      opening,
      purchasesTotal,
      total,
      paid,
      remaining
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
    const invoicesSheet = workbook.addWorksheet('فواتير المشتريات');
    invoicesSheet.addRow(['#', 'تاريخ الفاتورة', 'رقم الفاتورة', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة', 'الخزينة', 'ملاحظات']);
    invoicesSheet.getRow(1).font = { bold: true };
    invoicesSheet.getRow(1).alignment = { horizontal: 'center' };
    invoicesSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D1D1' } };
    purchases.forEach((p, idx) => {
      invoicesSheet.addRow([
        idx + 1,
        p.date ? new Date(p.date).toLocaleDateString('ar-EG') : '',
        p.invoiceNumber || '-',
        p.total || 0,
        p.paid || 0,
        (p.total || 0) - (p.paid || 0),
        p.status || '-',
        p.treasury ? p.treasury.name : '-',
        p.notes || '-'
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
    const paymentsSheet = workbook.addWorksheet('الدفعات النقدية');
    paymentsSheet.addRow(['#', 'التاريخ', 'المبلغ المدفوع', 'الخزينة', 'الوصف']);
    paymentsSheet.getRow(1).font = { bold: true };
    paymentsSheet.getRow(1).alignment = { horizontal: 'center' };
    paymentsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D1D1' } };
    supplierPayments.forEach((p, idx) => {
      paymentsSheet.addRow([
        idx + 1,
        p.date ? new Date(p.date).toLocaleDateString('ar-EG') : '',
        p.amount || 0,
        p.treasury ? p.treasury.name : '-',
        p.description || '-'
      ]);
    });
    paymentsSheet.columns.forEach(col => { col.alignment = { horizontal: 'center' }; });
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
    let safeSupplierName = String(supplier.name || 'supplier').replace(/[^a-zA-Z0-9-_]/g, '_');
    const fileName = `supplier_statement_${safeSupplierName}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ message: 'حدث خطأ أثناء تصدير كشف الحساب.' });
  }
});

module.exports = router; 