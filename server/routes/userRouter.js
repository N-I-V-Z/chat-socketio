const userController = require('../controller/userController')
const router = require("express").Router();

router.post('/login', userController.login);

router.post('/register', userController.register);

router.post('/getAll', userController.getAll);

router.post('/getUserByUserId', userController.getUserByUserId);

module.exports = router;
