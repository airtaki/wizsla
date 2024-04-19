import { sendUdpCommand } from "../helpers";
import { Data, Device, Scene } from "../helpers/types";

export const getInfo = async (device: Device) => {
  try {
    const data: Data = { method: "getPilot", params: {} };
    return await sendUdpCommand(data, device);
  } catch (error) {
    console.error("Error:", error);
  }
};

export const turnOn = async (device: Device, dimming?: number ) => {
  try {
    const data: Data = { method: "setPilot", params: { state: true }};
    if (dimming) data.params.dimming = dimming;
    return await sendUdpCommand(data, device);
  } catch (error) {
    console.error("Error:", error);
  }
};

export const turnOff = async (device: Device) => {
  try {
    const data: Data = { method: "setPilot", params: { state: false }};
    return await sendUdpCommand(data, device);
  } catch (error) {
    console.error("Error:", error);
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
    return await sendUdpCommand(data, device);
  } catch (error) {
    console.error("Error:", error);
  }
};
