const messageController = require('../controller/messageController')
const requireAccessToken = require("../middleware/requireAccessToken");
const router = require("express").Router();

router.use(requireAccessToken);

router.post('/getAllMessageOfRoom', messageController.getAllMessageOfRoom);

router.post('/addMessage', messageController.addMessage);

module.exports = router;
