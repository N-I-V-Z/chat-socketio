const messageController = require('../controller/messageController')
const router = require("express").Router();


router.post('/getAllMessageOfRoom', messageController.getAllMessageOfRoom);

router.post('/addMessage', messageController.addMessage);

module.exports = router;
