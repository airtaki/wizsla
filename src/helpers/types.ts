import e from "express";

export type Data = {
  method: string;
  id?: number;
  params: {
    state?: boolean;
    sceneId?: number;
    play?: boolean;
    speed?: number;
    r?: number;
    g?: number;
    b?: number;
    c?: number;
    w?: number;
    temp?: number;
    dimming?: number;
  };
};

export type Device = {
  id: number;
  name: string;
  ip: string;
  port: number;
};

export type Scene = {
  id: number;
  name: string;
  rgbtw: boolean;
  tw: boolean;
  dw: boolean;
  as: boolean;
  ad: boolean;
}; 

export type Input = {
  device?: Device;
  scene?: Scene;
  dimming?: number;
};

export type DeviceResponse = {
  method?: string;
  id?: number;
  env?: string;
  result?: {
    success: boolean;
    mac?: string;
    rssi?: number;
    state?: boolean;
    sceneId?: number;
    speed?: number;
    dimming?: number;
  };
};
