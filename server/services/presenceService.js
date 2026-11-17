const connectedSockets = new Map();

function connect(userId, socketId) {
  let socketIds = connectedSockets.get(userId);
  if (!socketIds) {
    socketIds = new Set();
    connectedSockets.set(userId, socketIds);
  }
  socketIds.add(socketId);
}

function disconnect(userId, socketId) {
  const socketIds = connectedSockets.get(userId);
  if (!socketIds) {
    return;
  }

  socketIds.delete(socketId);
  if (socketIds.size === 0) {
    connectedSockets.delete(userId);
  }
}

function getOnlineUserIds() {
  return new Set(connectedSockets.keys());
}

module.exports = {
  connect,
  disconnect,
  getOnlineUserIds,
};
