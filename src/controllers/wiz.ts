import type { Request, Response, NextFunction } from 'express';
import * as wiz from '../services/wiz';

export const turnOn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const device = req.app.get('device');
    const dimming = req.app.get('dimming');
    req.app.set('data', await wiz.turnOn(device, dimming));
  } catch (err) {
    return next(err);
  }
  return next();
};

export const turnOff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const device = req.app.get('device');
    req.app.set('data', await wiz.turnOff(device));
  } catch (err) {
    return next(err);
  }
  return next();
};

export const setScene = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const device = req.app.get('device');
    const scene = req.app.get('scene');
    const dimming = req.app.get('dimming');
    req.app.set('data', await wiz.setScene(device, scene, dimming));
  } catch (err) {
    return next(err);
  }
  return next();
};

