const mongoose = require("mongoose");
let Otp = require("./models/otp");
const Speakeasy = require("speakeasy");
let plivo = require("plivo");

async function otpVerify({
  email,
  address,
  phone,
  firstname,
  lastname,
  exp,
  cvv,
  cardNumber
}) {
  let client = new plivo.Client(
    "SAMDFIMJRIN2Q0NTE5OG",
    "ZWI5ODcyNWQ1NWU2Y2ZlMDU1ZjBmZjE0ZmE0NDZi"
  );

  var secret = await Speakeasy.generateSecret({ length: 20 }).base32;
  let otp = await Speakeasy.totp({
    secret,
    encoding: "base32"
  });

  let phoneToMessage = "+91" + phone;

  let messageResponse = await client.messages.create(
    "LDOOIT",
    phoneToMessage,
    "Your authentication OTP for DOO.it is " + otp
  );

  let storedOtp = await Otp.findOneAndUpdate(
    { phone },
    {
      phone,
      otp,
      email,
      address,
      secret,
      firstname,
      lastname,
      exp,
      cvv,
      cardNumber
    },
    { upsert: true }
  );
  return storedOtp;
}

module.exports = otpVerify;
