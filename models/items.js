var mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  id: Number,
  sku: Number,
  title: String,
  description: String,
  availableSizes: [String],
  style: String,
  price: Number,
  installments: Number,
  currencyId: String,
  currencyFormat: String,
  isFreeShipping: Boolean
});

module.exports = mongoose.model("Item", itemSchema);
