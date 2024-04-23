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

export const status = async (device: Device) => {
  try {
    const data: Data = { method: "getPilot", params: {} };
    return await sendUdpCommand(device, data);
  } catch (error) {
    throw error;
  }
}

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

export const setScene = async (device: Device, scene: Scene, dimming?: number, speed?: number) => {
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
    return await sendUdpCommand(device, data);
  } catch (error) {
    throw error;
  }
};

export const setRGB = async (device: Device, red: number, green: number, blue: number, dimming?: number) => {
  try {
    const data: Data = {
      method: "setPilot",
      params: {
        state: true,
        dimming: dimming || undefined,
        r: red,
        g: green,
        b: blue
      }
    };
    return await sendUdpCommand(device, data);
  } catch (error) {
    throw error;
  }
}

export const setTemperature = async (device: Device, temperature: number, dimming?: number) => {
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
    return await sendUdpCommand(device, data);
  } catch (error) {
    throw error;
  }
};
