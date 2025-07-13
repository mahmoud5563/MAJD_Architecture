const express = require('express');
const router = express.Router();
const GeneralExpense = require('../models/GeneralExpense');
const Transaction = require('../models/Transaction');
const Sale = require('../models/Sale');
const SaleReturn = require('../models/SaleReturn');
const Project = require('../models/Project');

// GET /api/general-accounts
// Query params: from, to, project, type (expense|revenue|all), source
router.get('/', async (req, res) => {
  try {
    const { from, to, project, type, source } = req.query;
    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) dateFilter.$lte = new Date(to);

    // 1. General Expenses (بدون project)
    let generalExpenseQuery = {};
    if (Object.keys(dateFilter).length) generalExpenseQuery.date = dateFilter;
    const generalExpenses = await GeneralExpense.find(generalExpenseQuery).lean();
    const generalExpenseResults = generalExpenses.map(e => ({
      _id: e._id,
      date: e.date,
      amount: e.amount,
      type: 'expense',
      source: 'general',
      reason: e.reason,
      project: null // لا يوجد ربط بمشروع
    }));

    // 2. Transactions (مصروفات/إيرادات مرتبطة بمشروع أو عامة)
    let transactionQuery = {};
    if (Object.keys(dateFilter).length) transactionQuery.date = dateFilter;
    if (project) transactionQuery.project = project;
    const transactions = await Transaction.find(transactionQuery).populate('project', 'projectName').lean();
    const transactionResults = transactions.map(t => ({
      _id: t._id,
      date: t.date,
      amount: t.amount,
      type: t.type === 'إيداع' ? 'revenue' : (t.type === 'مصروف' || t.type === 'دفعة مقاول' ? 'expense' : 'other'),
      source: 'transaction',
      reason: t.description,
      project: t.project ? t.project._id.toString() : null,
      vendor: t.vendor || null // إضافة معلومات المورد للمعاملات
    }));

    // 3. Sales (بدون project)
    let saleQuery = {};
    if (Object.keys(dateFilter).length) saleQuery.date = dateFilter;
    const sales = await Sale.find(saleQuery).lean();
    const saleResults = sales.map(s => ({
      _id: s._id,
      date: s.date,
      amount: s.total,
      type: 'revenue',
      source: 'sale',
      reason: 'فاتورة مبيعات',
      project: null // لا يوجد ربط بمشروع
    }));

    // 4. Sale Returns (بدون project)
    let saleReturnQuery = {};
    if (Object.keys(dateFilter).length) saleReturnQuery.date = dateFilter;
    const saleReturns = await SaleReturn.find(saleReturnQuery).lean();
    const saleReturnResults = saleReturns.map(r => ({
      _id: r._id,
      date: r.date,
      amount: -Math.abs(r.total),
      type: 'expense', // خصم من الإيراد
      source: 'saleReturn',
      reason: 'مرتجع مبيعات',
      project: null // لا يوجد ربط بمشروع
    }));

    // دمج كل النتائج
    let allResults = [
      ...generalExpenseResults,
      ...transactionResults,
      ...saleResults,
      ...saleReturnResults
    ];

    // فلترة حسب النوع إذا طلب
    if (type === 'expense') allResults = allResults.filter(r => r.type === 'expense');
    if (type === 'revenue') allResults = allResults.filter(r => r.type === 'revenue');

    // فلترة حسب المشروع (تؤثر فقط على معاملات المشاريع)
    if (project) {
      allResults = allResults.filter(r => r.project === project);
    }

    // فلترة حسب مصدر الحركة إذا طلب
    if (source) allResults = allResults.filter(r => r.source === source);

    // ترتيب حسب التاريخ تنازلي
    allResults.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(allResults);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الحسابات العامة' });
  }
});

module.exports = router;
 