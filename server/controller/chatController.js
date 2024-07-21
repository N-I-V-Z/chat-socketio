const chatService = require('../services/chatService')


const getAll = async (req, res) => {
    try {
        const response = await chatService.getAll();
        res.status(200).send(response);
    } catch (error) {
        console.log("Internal server error:", error);
        res.status(500).send("Internal server error"); // Status 500 for internal server error
    }
};

module.exports = {
    getAll,
}