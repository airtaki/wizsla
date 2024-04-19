import type { Request, Response, NextFunction } from 'express';

export const response = (req: Request, res: Response, next: NextFunction) => {
  const data = req.app.get('data');
  res
    .status(res.statusCode)
    .setHeader("Content-Type", "application/json")
    .json(data);
};
