function setupConnectionHandlers(io, socket, connectedUsers) {
  const userId = socket.userId;
  const username = socket.username;
  socket.on('set-status', (data) => {
    const { status } = data; // 'online', 'away', 'offline'
    socket.status = status;
    io.emit('user-status-changed', {
      userId,
      username,
      status: 'online',
      timestamp: new Date().toISOString(),
    });
    console.log(`Usuario conectado: ${username} (${userId})`);
  });
  socket.on('get-online-users', () => {
    const onlineUsers = Object.entries(connectedUsers).map(([uId, sId]) => ({
      userId: uId,
      socketId: sId,
    }));
    socket.emit('online-users-list', onlineUsers);
  });
  socket.on('disconnect', () => {
    delete connectedUsers[userId];
    console.log(`Usuario desconectado: ${username} (${userId})`);
    console.log(`Usuarios conectados: ${Object.keys(connectedUsers).length}`);
    io.emit('user-went-offline', {
      userId,
      username,
      timestamp: new Date().toISOString(),
    });
  });
  socket.on('error', (error) => {
    console.error(`Error en socket ${socket.id}:`, error);
  });
}

module.exports = setupConnectionHandlers;
