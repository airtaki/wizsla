import { validationResult } from 'express-validator';
import { ValidationError } from '../errors';
import type { Request, Response, NextFunction } from 'express';

export const validationHandler = (req: Request, res: Response, next: NextFunction) => {
  const result = validationResult(req);
  try {
    if (!result.isEmpty()) {
      throw new ValidationError('Validation failed', result.array());
    }
  } catch (err) {
    return next(err);
  }
  return next();
};
