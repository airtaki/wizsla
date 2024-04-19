import { validationResult } from 'express-validator';
import { inspect } from 'util';
import type { Request, Response, NextFunction } from 'express';

export const validationHandler = (req: Request, res: Response, next: NextFunction) => {
  const result = validationResult(req);
  try {
    if (!result.isEmpty()) {
      console.log(inspect(result, false, null, true));
      req.app.set('errors', result.mapped());
      throw new Error("Validation error!");
    }
  } catch (err) {
    return next(err);
  }
  return next();
};
