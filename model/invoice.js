const mongoose = require("mongoose");

const invoiceItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  unitPrice: { type: Number, required: true },
  total: { type: Number, required: true },
});

const invoiceSchema = new mongoose.Schema(
  {
    // This is the field that is causing the error
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    guest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Guest",
      required: true,
    },
    items: [invoiceItemSchema],
    subtotal: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    additionaldiscount: { type: Number },
    grandTotal: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "paid", "cancelled"],
      default: "paid",
    },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date },
    // This is the field for storing the PDF path
    pdfPath: { type: String },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

invoiceSchema.pre("save", async function (next) {
  if (this.isNew && !this.invoiceNumber) {
    this.invoiceNumber = `HSQ-${Date.now()}`;
  }
  next();
});

module.exports = mongoose.model("Invoice", invoiceSchema);
