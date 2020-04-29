const bcrypt = require("bcrypt");
var mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: String,
  phone: String,
  address: String,
  secret: String,
  firstname: String,
  lastname: String,
  cardNumber: Number,
  exp: String,
  cvv: Number
});

userSchema.pre("save", function(next) {
  let user = this;
  if (!user.isModified("password")) {
    return next();
  }

  bcrypt.hash(user.password, 10, (err, hash) => {
    if (err) return err;

    user.password = hash;
    next();
  });
});

module.exports = mongoose.model("User", userSchema);
