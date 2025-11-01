import { Request } from 'express';
import { UserResponse } from '../modules/users/dto/user.dto';

declare global {
  namespace Express {
    interface Request {
      user?: UserResponse;
    }
  }
}

export {};