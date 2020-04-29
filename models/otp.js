"use strict";
const mongoose = require("mongoose");

const Schema = mongoose.Schema;

var Otp = new Schema(
  {
    phone: { type: String, unique: true },
    otp: String,
    email: String,
    address: String,
    secret: String,
    firstname: String,
    lastname: String,
    cardNumber: Number,
    exp: String,
    cvv: Number
  },
  {
    timestamps: true
  }
);
module.exports = mongoose.model("Otp", Otp);
