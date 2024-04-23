import { sendUdpCommand } from "../helpers";
import { Data, Device, Scene } from "../helpers/types";

export const getInfo = async (device: Device) => {
  try {
    const data: Data = { method: "getPilot", params: {} };
    return await sendUdpCommand(device, data);
  } catch (error) {
    console.error("Error:", error);
  }
};

export const turnOn = async (device: Device, dimming?: number ) => {
  try {
    const data: Data = { method: "setPilot", params: { state: true }};
    if (dimming) data.params.dimming = dimming;
    return await sendUdpCommand(device, data);
  } catch (error) {
    throw error;
  }
};

export const turnOff = async (device: Device) => {
  try {
    const data: Data = { method: "setPilot", params: { state: false }};
    return await sendUdpCommand(device, data);
  } catch (error) {
    throw error;
  }
};

export const setScene = async (device: Device, scene: Scene, dimming?: number) => {
  try {
    const data: Data = {
      method: "setPilot",
      params: {
        state: true,
        dimming: dimming || undefined,
        sceneId: scene.id
      }
    };
    return await sendUdpCommand(device, data);
  } catch (error) {
    throw error;
  }
};

export const setRGB = async (device: Device, r: number, g: number, b: number, dimming?: number) => {
  try {
    const data: Data = {
      method: "setPilot",
      params: {
        state: true,
        dimming: dimming || undefined,
        r, g, b
      }
    };
    return await sendUdpCommand(device, data);
  } catch (error) {
    throw error;
  }
}
