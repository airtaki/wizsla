import type { Request, Response, NextFunction } from 'express';
import * as wiz from '../services/wiz';
import { Device, Scene } from '../helpers/types';

export const turnOn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const device: Device = req.app.get('device');
    const dimming: number | undefined = req.app.get('dimming');
    req.app.set('data', await wiz.turnOn(device, dimming));
  } catch (err) {
    return next(err);
  }
  return next();
};

export const turnOff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const device: Device = req.app.get('device');
    req.app.set('data', await wiz.turnOff(device));
  } catch (err) {
    return next(err);
  }
  return next();
};

export const setScene = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const device: Device = req.app.get('device');
    const scene: Scene = req.app.get('scene');
    const dimming: number | undefined = req.app.get('dimming');
    const speed: number | undefined = req.app.get('speed');
    req.app.set('data', await wiz.setScene(device, scene, dimming, speed));
  } catch (err) {
    return next(err);
  }
  return next();
};

export const setRGB = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const device: Device = req.app.get('device');
    const r: number = req.app.get('r');
    const g: number = req.app.get('g');
    const b: number = req.app.get('b');
    const dimming: number | undefined = req.app.get('dimming');
    req.app.set('data', await wiz.setRGB(device, r, g, b, dimming));
  } catch (err) {
    return next(err);
  }
  return next();
};

export const setTemperature = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const device: Device = req.app.get('device');
    const temp: number = req.app.get('temp');
    const dimming: number | undefined = req.app.get('dimming');
    req.app.set('data', await wiz.setTemperature(device, temp, dimming));
  } catch (err) {
    return next(err);
  }
  return next();
};
