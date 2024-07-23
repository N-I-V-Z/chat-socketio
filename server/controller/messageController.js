const messageService = require("../services/messageService");

const getAllMessageOfRoom = async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;
    const response = await messageService.getAllMessageOfRoom(
      senderId,
      receiverId
    );

    res
      .status(response ? 200 : 404)
      .send({ err: response ? 0 : 1, data: response ?? null });
  } catch (error) {
    console.log("Internal server error:", error);
    res.status(500).send("Internal server error"); // Status 500 for internal server error
  }
};

const addMessage = async (req, res) => {
  try {
    const { senderId, receiverId, message } = req.body;
    const response = await messageService.addMessage(
      senderId,
      receiverId,
      message
    );

    res
      .status(response ? 200 : 404)
      .send({ err: response ? 0 : 1 });
  } catch (error) {
    console.log("Internal server error:", error);
    res.status(500).send("Internal server error"); // Status 500 for internal server error
  }
};

module.exports = {
  getAllMessageOfRoom,
  addMessage,
};
