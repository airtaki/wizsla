import { sendUdpCommand } from "../helpers";
import { AppResponse, Data, Device, Scene } from "../helpers/types";

export const status = async (device: Device): Promise<AppResponse> => {
  try {
    const data: Data = { method: "getPilot", params: {} };
    return await sendUdpCommand(device, data);
  } catch (error) {
    throw error;
  }
};

export const turnOn = async (device: Device, dimming?: number ): Promise<AppResponse> => {
  try {
    const data: Data = { method: "setPilot", params: { state: true }};
    if (dimming) data.params.dimming = dimming;
    await sendUdpCommand(device, data);
    return status(device);
  } catch (error) {
    throw error;
  }
};

export const turnOff = async (device: Device): Promise<AppResponse> => {
  try {
    const data: Data = { method: "setPilot", params: { state: false }};
    await sendUdpCommand(device, data);
    return status(device);
  } catch (error) {
    throw error;
  }
};

export const setScene = async (device: Device, scene: Scene, dimming?: number, speed?: number): Promise<AppResponse> => {
  try {
    const data: Data = {
      method: "setPilot",
      params: {
        state: true,
        dimming: dimming && scene.ad ? dimming : undefined,
        speed: speed && scene.as ? speed : undefined,
        sceneId: scene.id
      }
    };
    await sendUdpCommand(device, data);
    return status(device);
  } catch (error) {
    throw error;
  }
};

export const setRGB = async (device: Device, colors: { r: number, g: number, b: number, c?: number, w?: number }, dimming?: number): Promise<AppResponse> => {
  try {
    const data: Data = {
      method: "setPilot",
      params: {
        state: true,
        dimming: dimming || undefined,
        r: colors.r,
        g: colors.g,
        b: colors.b,
        c: colors.c || undefined,
        w: colors.w || undefined
      }
    };
    await sendUdpCommand(device, data);
    return status(device);
  } catch (error) {
    throw error;
  }
};

export const setTemp = async (device: Device, temperature: number, dimming?: number): Promise<AppResponse> => {
  try {
    const data: Data = {
      method: "setPilot",
      params: {
        state: true,
        temp: temperature,
        dimming: dimming || undefined,
        r: 0,
        g: 0,
        b: 0
      }
    };
    await sendUdpCommand(device, data);
    return status(device);
  } catch (error) {
    throw error;
  }
};
