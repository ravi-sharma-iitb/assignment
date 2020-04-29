if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}

let plivo = require("plivo");
const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const session = require("express-session");
const passport = require("passport");
const mongoose = require("mongoose");
var cors = require("cors");
var cookieParser = require("cookie-parser");
const Speakeasy = require("speakeasy");
let Otp = require("./models/otp");
let Transaction = require("./models/transaction");

let otpVerify = require("./OtpVerify");

let whitelist = [];

app.use(
  cors({
    origin: function(origin, callback) {
      if (whitelist.indexOf(origin) == -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true
  })
);

const User = require("./models/user");
const Item = require("./models/items");

mongoose.Promise = global.Promise;

mongoose.connect("mongodb://localhost:27017/payment", () => {
  console.log("Successfully connected to database");
});

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePublicKey = process.env.STRIPE_PUBLIC_KEY;

const initializepassport = require("./passport-config");

const stripe = require("stripe")(stripeSecretKey);
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 60000 * 60 * 24 * 7 }
  })
);

initializepassport(
  passport,
  async phone => {
    try {
      let user = await User.findOne({ phone });
      return user;
    } catch (err) {
      throw err;
    }
  },
  async id => {
    try {
      let user = await User.findById(id);
      return user;
    } catch (err) {
      throw err;
    }
  }
);

app.use(passport.initialize());
app.use(passport.session());

app.post(
  "/login",
  checkNotAuthenticated,
  passport.authenticate("local"),
  async (req, res) => {
    if (req.isAuthenticated()) {
      let user = await req.user;
      res.send({ message: "Logged in", verified: true, user });
    } else {
      res.send({ message: "Not Logged in", verified: false });
    }
  }
);

app.get("/products", async (req, res) => {
  try {
    let products = await Item.find({});
    return res.send({ products });
  } catch (err) {
    res.status(500).send({ message: "Error Occured!" });
  }
});

app.get("/stripePublicKey", (req, res) => {
  res.send({ stripePublicKey });
});

app.post("/purchase", checkAuthenticated, (req, res) => {
  stripe.charges
    .create({
      amount: req.body.total,
      source: req.body.stripeTokenId,
      currency: "INR",
      description: "test description"
    })
    .then(response => {
      res.json({ message: "Success", response });
    })
    .catch(err => {
      res.status(500).end();
    });
});

app.post("/logout", checkAuthenticated, (req, res) => {
  req.logout();
  res.send({ message: "Logout Done", done: true });
});

app.post("/register", checkNotAuthenticated, async (req, res) => {
  try {
    if (
      !req.body.email ||
      !req.body.address ||
      !req.body.phone ||
      !req.body.firstname ||
      !req.body.lastname ||
      !req.body.cardNumber ||
      !req.body.exp ||
      !req.body.cvv
    ) {
      res.send({ message: "Incomplete Credentials", done: false });
    } else {
      let user = await User.findOne({ phone: req.body.phone });
      if (user) {
        res.send({ message: "Already Registered", done: false });
      } else {
        await otpVerify({
          email: req.body.email,
          address: req.body.address,
          phone: req.body.phone,
          firstname: req.body.firstname,
          lastname: req.body.lastname,
          cardNumber: req.body.cardNumber,
          exp: req.body.exp,
          cvv: req.body.cvv
        });
        res.send({ message: "otp-send", done: true });
      }
    }
  } catch (err) {
    console.log("err :>> ", err);
    await deleteSavedOtp(req.body.phone);
    res.status(500).send(err.message);
  }
});

app.get("/verify", async (req, res) => {
  if (req.isAuthenticated()) {
    let user = await req.user;
    res.json({ verify: true, message: "Logged In", user });
  } else {
    res.send({ verify: false, message: "Not Logged In" });
  }
});

async function deleteSavedOtp(phone) {
  let res = await Otp.deleteOne({ phone });
  return res;
}

app.post("/signup-otp", async (req, res, next) => {
  try {
    let savedOtp = await Otp.findOne({ phone: req.body.phone });

    if (!savedOtp) {
      throw new Error("Phone Not Registered!");
    }

    let user = await User.findOne({ email: savedOtp.email });
    if (!user) {
      let user = await new User({
        email: savedOtp.email,
        secret: savedOtp.secret,
        address: savedOtp.address,
        phone: savedOtp.phone,
        firstname: savedOtp.firstname,
        lastname: savedOtp.lastname,
        cardNumber: savedOtp.cardNumber,
        exp: savedOtp.exp,
        cvv: savedOtp.cvv
      });
      await user.save();
      passport.authenticate("local", async (err, user, info) => {
        console.log("info :>> ", info);
        if (err) {
          await user.deleteOne({ phone: req.body.phone });
          res.send({ verified: false, message: err.message });
        } else if (!user) {
          await user.deleteOne({ phone: req.body.phone });
          res.send({ verified: false, message: "User Not Verified" });
        } else {
          req.logIn(user, err => {
            if (err) {
              throw err;
            } else {
              res.send({ verified: true, message: "User Registered" , user});
            }
          });
        }
      })(req, res, next);
    } else {
      res.send({ message: "User Already Exist", done: false });
    }
  } catch (err) {
    deleteSavedOtp(req.body.phone);
    res.status(500).send(err.message);
  }
});

app.post("/transaction", async (req, res) => {
  try {
    if (!req.body.phone || !req.body.price || !req.body.redirectUrl) {
      res.send({ message: "Incomplete Credentials", done: false });
    } else {
      let currentTransaction = await new Transaction({
        phone: req.body.phone,
        price: req.body.price,
        redirectUrl: req.body.redirectUrl
      });
      await currentTransaction.save();
      res.send({
        message: "Transaction Registered",
        transactionId: currentTransaction._id,
        done: true
      });
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/transaction/:transactionId", async (req, res) => {
  try {
    let transaction = await Transaction.findById(req.params.transactionId);
    res.send({ message: "transaction Found", transaction });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/checkout", async (req, res) => {
  try {
    if (!req.body.transactionId) {
      res.send({ message: "Incomplete Credentials", done: false });
    }
    let transactionResponse = await Transaction.findByIdAndUpdate(
      req.body.transactionId,
      { completed: true }
    );
    res.send({
      message: "Transaction Complete",
      done: true,
      transaction: transactionResponse
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/login-otp", async (req, res) => {
  try {
    let phone = req.body.phone;
    if (!phone) {
      throw new Error("Phone not provided!");
    }
    let user = await User.findOne({ phone });
    if (!user) {
      res.send({ message: "Phone Not Present", done: false });
    } else {
      await otpVerify({
        email: user.email,
        address: user.address,
        phone: user.phone
      });
      res.send({ message: "Otp Send", done: true });
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
});

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.send({ message: "Please login", verified: false });
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    res.json({ message: "Alreagy Loggedin", verified: true });
  }
  return next();
}

app.listen(5000);
