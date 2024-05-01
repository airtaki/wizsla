import type { Request, Response, NextFunction } from 'express';
import { AppResponse } from '../helpers/types';

export const response = (req: Request, res: Response, next: NextFunction) => {
  const response: AppResponse = req.app.get('response');
  res
    .status(res.statusCode || 200)
    .setHeader("Content-Type", "application/json")
    .json({
      success: true,
      ...response
    });
};
