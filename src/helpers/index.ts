import udp from 'dgram';
import { Data, Device, Scene } from './types';
import { DeviceCommandError } from '../errors';

export const sendUdpCommand = async (data: Data, device: Device) => {
  return await new Promise((resolve, reject) => {
    const client = udp.createSocket('udp4');
    const timestamp = new Date;
    client.on('error', (error) => {
      client.close();
      reject(error);
    })
    .on('message', (message) => {
      let response: {result: { success: boolean }} = {result: { success: false }};
      try {
        response = JSON.parse(message.toString());
        if (response?.result?.success !== true) {
          throw new DeviceCommandError("Got a response without success === true!", response);
        }
        resolve({ timestamp, response });
      } catch (error) {
        reject(error);
      } finally {
        client.close();
      }
    })
    .send(JSON.stringify({ ...data, id: device.id }), device.port, device.ip, (err) => {
      if (err) {
        throw new DeviceCommandError("Failed to send command to device!", err);
      }
    });
  });
};

export const getDeviceByIp = (devices: Device[], ip: string): Device | undefined => {
  return devices.find((device) => device.ip === ip);
};

export const getDeviceByName = (devices: Device[], name: string): Device | undefined => {
  return devices.find((device) => device.name.toLowerCase() === name.toLowerCase());
};

export const getSceneById = (scenes: Scene[], id: number): Scene | undefined => {
  return scenes.find((scene) => scene.id === id);
};

export const getSceneByName = (scenes: Scene[], name: string): Scene | undefined => {
  return scenes.find((scene) => scene.name.toLowerCase() === name.toLowerCase());
};
