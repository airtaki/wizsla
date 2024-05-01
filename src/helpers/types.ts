
export type Params = {
  temp?: number;
  state?: boolean;
  sceneId?: number;
  speed?: number;
  dimming?: number;
  r?: number;
  g?: number;
  b?: number;
  c?: number;
  w?: number;
};

export type Result = Params & {
  success: boolean;
  mac?: string;
  rssi?: number;
};

export type Data = {
  method: string;
  id?: number;
  params: Params;
};

export type Device = {
  id: number;
  name: string;
  ip: string;
  port: number;
};

export type DeviceResponse = {
  method: string;
  id?: number;
  env?: string;
  result: Result;
};

export type AppResponse = {
  timestamp: Date;
  result: Result;
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
