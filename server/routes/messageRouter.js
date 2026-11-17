const messageController = require("../controller/messageController");
const requireAccessToken = require("../middleware/requireAccessToken");
const router = require("express").Router();

router.use(requireAccessToken);

router.get("/", messageController.listMessages);
router.post("/", messageController.createMessage);

module.exports = router;
