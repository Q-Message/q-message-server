import { Server } from 'socket.io';

// 1. Mapa de usuarios conectados en memoria
export type ConnectedUsersMap = Record<string, string>;

// 2. Datos que guardamos dentro de cada socket (socket.data)
export interface SocketData {
  userId?: string;
  username?: string;
  status?: string;
  _handlersMounted?: boolean; // Flag interna para saber si ya se montaron los handlers
}

// Lo que el Cliente envía al Servidor (Input)
export interface MessagePayload {
  recipientId: string;
  content: string; 
  messageType?: string; // 'text', 'image', etc.
  encryptedContent?: string;
  iv?: string; // Vector de inicialización para AES/Kyber
}

// El paquete completo que maneja el Servidor y recibe el Destinatario (Output)
export interface MessagePacket {
  senderId: string;
  senderUsername: string;
  recipientId: string;
  content: string;
  messageType: string;
  encryptedContent?: string;
  timestamp: string; // ISO String
  delivered: boolean;
  iv?: string;       // Vector de inicialización
  isPending?: boolean; // Para marcar si fue recuperado del buzón offline
}

// Qué puede enviar tu App Android/Web al Node.js
export interface ClientToServerEvents {
  register: (userId: string) => void;
  'set-status': (data: { status: string }) => void;
  'get-online-users': () => void;
  
  // Mensajería
  'send-message': (data: MessagePayload) => void;
  'typing-indicator': (data: { recipientId: string; isTyping: boolean }) => void;
  'message-read': (data: { senderId: string; messageId: string }) => void;
}

// Qué envía Node.js a la App Android/Web
export interface ServerToClientEvents {
  pending_messages: (messages: MessagePacket[]) => void;
  'user-status-changed': (data: { userId: string; username: string; status: string; timestamp: string }) => void;
  'online-users-list': (users: { userId: string; socketId: string }[]) => void;
  'user-went-offline': (data: { userId: string; username: string; timestamp: string }) => void;

  // Respuestas de Mensajería
  'receive-message': (data: MessagePacket) => void;
  'message-delivered': (data: { messageId: string; recipientId: string; delivered: boolean }) => void;
  'message-pending': (data: { messageId: string; recipientId: string; delivered: boolean }) => void;
  'message-error': (data: { error: string }) => void;
  'user-typing': (data: { senderId: string; senderUsername: string; isTyping: boolean }) => void;
  'message-read-receipt': (data: { readBy: string; messageId: string; readAt: string }) => void;
}

// Eventos internos entre servidores (si usaras cluster, por ahora vacío)
export interface InterServerEvents {
  ping: () => void;
}

declare global {
  namespace Express {
    interface Request {
      io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
      connectedUsers: ConnectedUsersMap;
    }
  }
}