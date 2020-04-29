const localStrategy = require("passport-local").Strategy;
const bcrypt = require("bcrypt");
const Otp = require("./models/otp");
const Speakeasy = require("speakeasy");

async function deleteSavedOtp(phone) {
  let res = await Otp.deleteOne({ phone });
  return res;
}

async function initialize(passport, getUserByPhone, getUserById) {
  async function authenticateUser(phone, otp, done) {
    const user = await getUserByPhone(phone);
    if (user == null) {
      return done(null, false, { message: "No  user with the phone" });
    }
    try {
      let savedOtp = await Otp.findOne({ phone });

      var otpValidates = Speakeasy.totp.verify({
        secret: savedOtp.secret,
        encoding: "base32",
        token: otp,
        window: 6
      });

      if (!otpValidates) {
        await deleteSavedOtp(phone);
        return done(null, false, { message: "Otp Invalid" });
      } else {
        await deleteSavedOtp(phone);
        return done(null, user, { message: "Loggedin" });
      }
    } catch (err) {
      await deleteSavedOtp(phone);
      return done(err);
    }
  }

  passport.use(
    new localStrategy(
      {
        usernameField: "phone",
        passwordField: "otp"
      },
      authenticateUser
    )
  );

  passport.serializeUser((user, done) =>{
    done(null, user._id)
  });

  passport.deserializeUser((id, done) => {
    done(null, getUserById(id));
  });
}

module.exports = initialize;
