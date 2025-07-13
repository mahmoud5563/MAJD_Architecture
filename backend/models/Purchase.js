const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: false },
  name: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  total: { type: Number, required: true }
});

const PurchaseSchema = new mongoose.Schema({
  invoiceNumber: { type: Number, unique: true }, // رقم الفاتورة التسلسلي
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  date: { type: Date, default: Date.now },
  total: { type: Number, required: true },
  paid: { type: Number, default: 0 },
  notes: { type: String },
  status: { type: String, enum: ['مدفوع', 'أجل'], default: 'أجل' },
  createdAt: { type: Date, default: Date.now },
  treasury: { type: mongoose.Schema.Types.ObjectId, ref: 'Treasury', required: true },
  items: [purchaseItemSchema]
});

// توليد رقم فاتورة تسلسلي تلقائي
PurchaseSchema.pre('save', async function(next) {
  if (this.isNew) {
    const last = await mongoose.model('Purchase').findOne({}, {}, { sort: { invoiceNumber: -1 } });
    this.invoiceNumber = last && last.invoiceNumber ? last.invoiceNumber + 1 : 1;
  }
  next();
});

module.exports = mongoose.model('Purchase', PurchaseSchema); 