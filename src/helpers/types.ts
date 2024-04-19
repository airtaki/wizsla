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
}; 

export type Input = {
  device?: Device;
  scene?: Scene;
  dimming?: number;
};
