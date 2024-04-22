import type { Request, Response, NextFunction } from 'express';

export const response = (req: Request, res: Response, next: NextFunction) => {
  const data = req.app.get('data');
  res
    .status(res.statusCode || 200)
    .setHeader("Content-Type", "application/json")
    .json({
      success: true,
      ...data
    });
};
