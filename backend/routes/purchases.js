const express = require('express');
const router = express.Router();
const Purchase = require('../models/Purchase');
const Supplier = require('../models/Supplier');
const Treasury = require('../models/Treasury');
const Transaction = require('../models/Transaction');
const StockOperation = require('../models/StockOperation');

// إضافة فاتورة مشتريات جديدة
router.post('/', async (req, res) => {
  try {
    const { treasury, paid, supplier, date, notes, total, items, warehouse, status } = req.body;
    // تحقق من وجود الخزينة
    const treasuryDoc = await Treasury.findById(treasury);
    if (!treasuryDoc) return res.status(404).json({ message: 'الخزينة غير موجودة' });
    // تحقق من الرصيد الكافي
    const paidAmount = parseFloat(paid) || 0;
    if (paidAmount > 0 && treasuryDoc.currentBalance < paidAmount) {
      return res.status(400).json({ message: 'الرصيد في الخزينة غير كافٍ لإجراء هذه العملية.' });
    }
    // خصم الرصيد إذا كان هناك مدفوع
    if (paidAmount > 0) {
      treasuryDoc.currentBalance -= paidAmount;
      await treasuryDoc.save();
      // أضف معاملة مالية (مصروف)
      const transaction = new Transaction({
        treasury,
        type: 'مصروف',
        amount: paidAmount,
        description: `مشتريات من المورد: ${supplier}`,
        date: date || new Date(),
        category: undefined,
        vendor: supplier,
        paymentMethod: undefined
      });
      await transaction.save();
    }
    // احفظ فاتورة المشتريات
    const purchase = new Purchase({
      supplier,
      treasury,
      warehouse,
      date,
      notes,
      total,
      paid,
      status,
      items
    });
    await purchase.save();
    // أضف عمليات مخزنية لكل صنف
    if (warehouse && Array.isArray(items)) {
      for (const item of items) {
        if (item.product && item.quantity > 0) {
          await StockOperation.create({
            type: 'add',
            product: item.product,
            quantity: item.quantity,
            warehouse,
            date: date || new Date(),
            notes: `إضافة من فاتورة مشتريات رقم ${purchase.invoiceNumber}`
          });
        }
      }
    }
    res.status(201).json(purchase);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// جلب كل فواتير المشتريات
router.get('/', async (req, res) => {
  try {
    const purchases = await Purchase.find({})
      .populate('supplier')
      .populate('treasury')
      .sort({ date: -1 });
    res.json(purchases);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// جلب فواتير مورد معيّن (كشف حساب)
router.get('/supplier/:supplierId', async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.supplierId);
    if (!supplier) return res.status(404).json({ message: 'المورد غير موجود' });
    const purchases = await Purchase.find({ supplier: supplier._id })
      .populate('treasury')
      .sort({ date: 1 });
    // حساب الإجماليات
    const total = purchases.reduce((sum, p) => sum + (p.total || 0), 0);
    const paid = purchases.reduce((sum, p) => sum + (p.paid || 0), 0);
    const openingBalance = supplier.openingBalance || 0;
    const remaining = total + openingBalance - paid;
    // جلب المدفوعات الإضافية من جدول المعاملات
    const supplierPayments = await Transaction.find({
      type: 'مصروف',
      vendor: supplier.name
    });
    
    const paidFromTransactions = supplierPayments.reduce((sum, t) => {
      return sum + (t.amount || 0);
    }, 0);
    res.json({ supplier, purchases, total, paid, remaining, openingBalance: supplier.openingBalance, paidFromTransactions, supplierPayments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// تعديل فاتورة
router.put('/:id', async (req, res) => {
  try {
    const purchase = await Purchase.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!purchase) return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    res.json(purchase);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// حذف فاتورة
router.delete('/:id', async (req, res) => {
  try {
    const purchase = await Purchase.findByIdAndDelete(req.params.id);
    if (!purchase) return res.status(404).json({ message: 'الفاتورة غير موجودة' });
    res.json({ message: 'تم حذف الفاتورة بنجاح' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router; 