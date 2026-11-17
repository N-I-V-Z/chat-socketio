const userController = require("../controller/userController");
const requireAccessToken = require("../middleware/requireAccessToken");
const router = require("express").Router();

router.use(requireAccessToken);

router.get("/", userController.listUsers);
router.get("/me", userController.getCurrentUser);

module.exports = router;
