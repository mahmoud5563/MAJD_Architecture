const express = require('express');
const router = express.Router();
const { auth, authorizeRoles } = require('../middleware/authMiddleware');
const Project = require('../models/Project');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const ContractAgreement = require('../models/ContractAgreement');
const ContractPayment = require('../models/ContractPayment');
const Contractor = require('../models/Contractor');
const Category = require('../models/Category');
const Treasury = require('../models/Treasury');
const Client = require('../models/Client');
const GeneralExpense = require('../models/GeneralExpense');
const Employee = require('../models/Employee');
const SalaryTransaction = require('../models/SalaryTransaction');
const EmployeeAdvance = require('../models/EmployeeAdvance');
const EmployeeOvertime = require('../models/EmployeeOvertime');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const SaleReturn = require('../models/SaleReturn');
const StockOperation = require('../models/StockOperation');
const Warehouse = require('../models/Warehouse');

// Function to clean data and remove invalid references
const cleanDataForImport = (data) => {
  const cleaned = { ...data };
  
  // Clean general expenses - remove those with invalid category or treasury references
  if (cleaned.generalExpenses) {
    const validCategoryIds = new Set(cleaned.categories?.map(c => c._id?.toString()) || []);
    const validTreasuryIds = new Set(cleaned.treasuries?.map(t => t._id?.toString()) || []);
    const validUserIds = new Set(cleaned.users?.map(u => u._id?.toString()) || []);
    
    cleaned.generalExpenses = cleaned.generalExpenses.filter(expense => {
      const hasValidCategory = expense.category && validCategoryIds.has(expense.category.toString());
      const hasValidTreasury = expense.treasury && validTreasuryIds.has(expense.treasury.toString());
      const hasValidUser = expense.createdBy && validUserIds.has(expense.createdBy.toString());
      
      return hasValidCategory && hasValidTreasury && hasValidUser;
    });
  }
  
  return cleaned;
};

// Export all data as JSON
router.get('/export', async (req, res) => {
  try {
    const data = {
      projects: await Project.find({}),
      transactions: await Transaction.find({}),
      users: await User.find({}),
      contractAgreements: await ContractAgreement.find({}),
      contractPayments: await ContractPayment.find({}),
      contractors: await Contractor.find({}),
      categories: await Category.find({}),
      treasuries: await Treasury.find({}),
      clients: await Client.find({}),
      generalExpenses: await GeneralExpense.find({}),
      employees: await Employee.find({}),
      employeeAdvances: await EmployeeAdvance.find({}),
      employeeOvertimes: await EmployeeOvertime.find({}),
      products: await Product.find({}),
      sales: await Sale.find({}),
      saleReturns: await SaleReturn.find({}),
      stockOperations: await StockOperation.find({}),
      warehouses: await Warehouse.find({}),
      salaryTransactions: await SalaryTransaction.find({}),
    };
    res.setHeader('Content-Disposition', 'attachment; filename=backup.json');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(data, null, 2));
  } catch (err) {
    res.status(500).json({ message: 'فشل في تصدير النسخة الاحتياطية', error: err.message });
  }
});

// Import all data from ZIP (backup.json + uploads)
router.post('/import', async (req, res) => {
  try {
    const data = req.body;
    if (!data) return res.status(400).json({ message: 'لا يوجد بيانات في الملف المرفوع.' });
    // استيراد البيانات (نفس الكود السابق)
    const cleanedData = cleanDataForImport(data);
    // حذف كل البيانات القديمة (تحذير: هذا يمسح كل شيء)
    await Promise.all([
      Project.deleteMany({}),
      Transaction.deleteMany({}),
      User.deleteMany({}),
      ContractAgreement.deleteMany({}),
      ContractPayment.deleteMany({}),
      Contractor.deleteMany({}),
      Category.deleteMany({}),
      Treasury.deleteMany({}),
      Client.deleteMany({}),
      GeneralExpense.deleteMany({}),
      Employee.deleteMany({}),
      EmployeeAdvance.deleteMany({}),
      EmployeeOvertime.deleteMany({}),
      Product.deleteMany({}),
      Sale.deleteMany({}),
      SaleReturn.deleteMany({}),
      StockOperation.deleteMany({}),
      Warehouse.deleteMany({}),
      SalaryTransaction.deleteMany({}),
    ]);
    // استيراد البيانات الجديدة
    if (cleanedData.users && cleanedData.users.length > 0) await User.insertMany(cleanedData.users);
    if (cleanedData.categories && cleanedData.categories.length > 0) await Category.insertMany(cleanedData.categories);
    if (cleanedData.treasuries && cleanedData.treasuries.length > 0) await Treasury.insertMany(cleanedData.treasuries);
    if (cleanedData.clients && cleanedData.clients.length > 0) await Client.insertMany(cleanedData.clients);
    if (cleanedData.contractors && cleanedData.contractors.length > 0) await Contractor.insertMany(cleanedData.contractors);
    if (cleanedData.projects && cleanedData.projects.length > 0) await Project.insertMany(cleanedData.projects);
    if (cleanedData.transactions && cleanedData.transactions.length > 0) await Transaction.insertMany(cleanedData.transactions);
    if (cleanedData.contractAgreements && cleanedData.contractAgreements.length > 0) await ContractAgreement.insertMany(cleanedData.contractAgreements);
    if (cleanedData.contractPayments && cleanedData.contractPayments.length > 0) await ContractPayment.insertMany(cleanedData.contractPayments);
    if (cleanedData.generalExpenses && cleanedData.generalExpenses.length > 0) await GeneralExpense.insertMany(cleanedData.generalExpenses);
    if (cleanedData.employees && cleanedData.employees.length > 0) await Employee.insertMany(cleanedData.employees);
    if (cleanedData.salaryTransactions && cleanedData.salaryTransactions.length > 0) await SalaryTransaction.insertMany(cleanedData.salaryTransactions);
    if (cleanedData.employeeAdvances && cleanedData.employeeAdvances.length > 0) await EmployeeAdvance.insertMany(cleanedData.employeeAdvances);
    if (cleanedData.employeeOvertimes && cleanedData.employeeOvertimes.length > 0) await EmployeeOvertime.insertMany(cleanedData.employeeOvertimes);
    if (cleanedData.products && cleanedData.products.length > 0) await Product.insertMany(cleanedData.products);
    if (cleanedData.sales && cleanedData.sales.length > 0) await Sale.insertMany(cleanedData.sales);
    if (cleanedData.saleReturns && cleanedData.saleReturns.length > 0) await SaleReturn.insertMany(cleanedData.saleReturns);
    if (cleanedData.stockOperations && cleanedData.stockOperations.length > 0) await StockOperation.insertMany(cleanedData.stockOperations);
    if (cleanedData.warehouses && cleanedData.warehouses.length > 0) await Warehouse.insertMany(cleanedData.warehouses);
    res.status(200).json({ message: 'تم استيراد النسخة الاحتياطية (بيانات + مرفقات) بنجاح.' });
  } catch (err) {
    res.status(500).json({ message: 'فشل في استيراد النسخة الاحتياطية', error: err.message });
  }
});

module.exports = router; 