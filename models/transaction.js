"use strict";
const mongoose = require("mongoose");

const Schema = mongoose.Schema;

var Transaction = new Schema(
  {
    phone: String ,
    price: Number,
    redirectUrl: String,
    completed: {type: Boolean, default: false}
  },
  {
    timestamps: true
  }
);
module.exports = mongoose.model("Transaction", Transaction);
