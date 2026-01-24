import { Request, Response, NextFunction } from 'express';
import jwt, { VerifyErrors } from 'jsonwebtoken';
import * as logger from '../utils/logger';

export interface UserPayload {
  userId: string;
  username: string;
  iat?: number; 
  exp?: number; 
}

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

// Middleware de autenticación
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  
  const authHeader = req.headers['authorization'];
  
  // Compatibilidad de IP
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  
  const token = authHeader && typeof authHeader === 'string' ? authHeader.split(' ')[1] : null;

  if (!token) {
    logger.logFailedAttempt('unknown', ip as string, 'No token provided');
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  if (!process.env.JWT_SECRET) {
    console.error('❌ CRÍTICO: JWT_SECRET no está configurado');
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET as string, (err: VerifyErrors | null, decoded: any) => {
    
    if (err) {
      const failedUser = jwt.decode(token) as UserPayload | null;
      const username = failedUser?.username || 'unknown';

      logger.logFailedAttempt(username, ip as string, `Token error: ${err.name}`);
      
      if (err.name === 'TokenExpiredError') {
         res.status(401).json({ error: 'Token expired' });
         return;
      }
      if (err.name === 'JsonWebTokenError') {
         res.status(401).json({ error: 'Invalid token' });
         return;
      }
       res.status(401).json({ error: 'Token verification failed' });
       return;
    }

    const user = decoded as UserPayload;

    req.user = user;
    
    logger.logAccess(user.username, req.path, ip as string, req.method);
    
    next();
  });
}