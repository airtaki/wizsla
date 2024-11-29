import type { Request, Response, NextFunction, RequestHandler } from 'express';
import * as wiz from '../services/wiz';
import { Device, Scene } from '../helpers/types';

export const status: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const device: Device = req.app.get('device');
    req.app.set('response', await wiz.status(device));
  } catch (err) {
    return next(err);
  }
  return next();
};

export const turnOn: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const device: Device = req.app.get('device');
    const dimming: number | undefined = req.app.get('dimming');
    req.app.set('response', await wiz.turnOn(device, dimming));
  } catch (err) {
    return next(err);
  }
  return next();
};

export const turnOff: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const device: Device = req.app.get('device');
    req.app.set('response', await wiz.turnOff(device));
  } catch (err) {
    return next(err);
  }
  return next();
};

export const setParams: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const device: Device = req.app.get('device');
    const dimming: number | undefined = req.app.get('dimming');
    const speed: number | undefined = req.app.get('speed');
    req.app.set('response', await wiz.setParams(device, dimming, speed));
  } catch (err) {
    return next(err);
  }
  return next();
};

export const setScene: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const device: Device = req.app.get('device');
    const scene: Scene = req.app.get('scene');
    const dimming: number | undefined = req.app.get('dimming');
    const speed: number | undefined = req.app.get('speed');
    req.app.set('response', await wiz.setScene(device, scene, dimming, speed));
  } catch (err) {
    return next(err);
  }
  return next();
};

export const setRGB: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const device: Device = req.app.get('device');
    const r: number = req.app.get('r');
    const g: number = req.app.get('g');
    const b: number = req.app.get('b');
    const c: number | undefined = req.app.get('c');
    const w: number | undefined = req.app.get('w');
    const dimming: number | undefined = req.app.get('dimming');
    req.app.set('response', await wiz.setRGB(device, { r, g, b, c, w }, dimming));
  } catch (err) {
    return next(err);
  }
  return next();
};

export const setTemp: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const device: Device = req.app.get('device');
    const temp: number = req.app.get('temp');
    const dimming: number | undefined = req.app.get('dimming');
    req.app.set('response', await wiz.setTemp(device, temp, dimming));
  } catch (err) {
    return next(err);
  }
  return next();
};
