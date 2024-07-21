const chatController = require('../controller/chatController')
const router = require("express").Router();

router.post('/getAll', chatController.getAll);

module.exports = router;
