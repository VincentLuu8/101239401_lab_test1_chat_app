const express = require("express");
const auth = require("../middleware/auth");
const GroupMessage = require("../models/GroupMessage");
const PrivateMessage = require("../models/PrivateMessage");
const ROOMS = require("../config/rooms");

const router = express.Router();

router.get("/rooms", auth, (req, res) => {
  res.json({ rooms: ROOMS });
});

router.get("/group/:room", auth, async (req, res) => {
  const { room } = req.params;
  if (!ROOMS.includes(room)) return res.status(400).json({ message: "Unknown room." });

  const messages = await GroupMessage.find({ room })
    .sort({ date_sent: 1 })
    .limit(200);

  res.json({ room, messages });
});

router.get("/private/:otherUser", auth, async (req, res) => {
  const me = req.user.username;
  const other = req.params.otherUser;

  const messages = await PrivateMessage.find({
    $or: [
      { from_user: me, to_user: other },
      { from_user: other, to_user: me }
    ]
  })
    .sort({ date_sent: 1 })
    .limit(200);

  res.json({ with: other, messages });
});

module.exports = router;
