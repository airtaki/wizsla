import type { Request, Response, NextFunction } from 'express';
import * as wiz from '../services/wiz';

export const turnOn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.app.set('data', await wiz.turnOn(req.app.get('device'), req.app.get('dimming')));
    res.statusCode = 200;
  } catch (err) {
    return next(err);
  }
  return next();
};

export const turnOff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.app.set('data', await wiz.turnOff(req.app.get('device')));
    res.statusCode = 200;
  } catch (err) {
    return next(err);
  }
  return next();
};

