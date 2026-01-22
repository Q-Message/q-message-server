/**
 * Configura los handlers de conexión y desconexión para un socket
 * @param {Object} io - Instancia de Socket.IO
 * @param {Object} socket - Socket del usuario conectado
 * @param {Object} connectedUsers - Mapa de usuarios conectados
 */
function setupConnectionHandlers(io, socket, connectedUsers) {
  const userId = socket.userId;
  const username = socket.username;

  /**
   * EVENTO: set-status
   * Broadcast del estado de conectividad del usuario
   */
  socket.on('set-status', (data) => {
    const { status } = data; // 'online', 'away', 'offline'
    socket.status = status;

    // Notificar a todos los contactos
    io.emit('user-status-changed', {
      userId,
      username,
      status: 'online',
      timestamp: new Date().toISOString(),
    });
    console.log(`✅ Usuario conectado: ${username} (${userId})`);
  });

  /**
   * EVENTO: get-online-users
   * Cliente solicita lista de usuarios conectados
   */
  socket.on('get-online-users', () => {
    const onlineUsers = Object.entries(connectedUsers).map(([uId, sId]) => ({
      userId: uId,
      socketId: sId,
    }));
    socket.emit('online-users-list', onlineUsers);
  });

  /**
   * EVENTO: disconnect
   * Usuario se desconecta
   */
  socket.on('disconnect', () => {
    delete connectedUsers[userId];
    console.log(`❌ Usuario desconectado: ${username} (${userId})`);
    console.log(`📊 Usuarios conectados: ${Object.keys(connectedUsers).length}`);

    // Notificar a otros usuarios que este se desconectó
    io.emit('user-went-offline', {
      userId,
      username,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * EVENTO: error
   * Manejo de errores del socket
   */
  socket.on('error', (error) => {
    console.error(`⚠️ Error en socket ${socket.id}:`, error);
  });
}

module.exports = setupConnectionHandlers;
