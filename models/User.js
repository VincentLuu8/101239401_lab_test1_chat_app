const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 25,
      match: /^[a-zA-Z0-9_]+$/
    },
    firstname: { type: String, required: true, trim: true, maxlength: 50 },
    lastname: { type: String, required: true, trim: true, maxlength: 50 },
    passwordHash: { type: String, required: true },
    createon: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

userSchema.index({ username: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);