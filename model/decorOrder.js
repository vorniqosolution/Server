const mongoose = require("mongoose");

const decorOrderSchema = new mongoose.Schema({
  package: { type: mongoose.Schema.Types.ObjectId, ref: "DecorPackage", required: true },
  
  // Dynamic Links
  guest: { type: mongoose.Schema.Types.ObjectId, ref: "Guest" },
  reservation: { type: mongoose.Schema.Types.ObjectId, ref: "Reservation" },
  
  price: { type: Number, required: true },
  instructions: { type: String, trim: true },
  // REMOVED: scheduledFor
  
  status: { 
    type: String, 
    enum: ["pending", "completed", "billed", "cancelled"], 
    default: "pending" 
  },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

module.exports = mongoose.model("DecorOrder", decorOrderSchema);