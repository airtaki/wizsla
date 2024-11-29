import udp from 'dgram';
import { Data, Device, Scene, DeviceResponse, Result } from './types';
import { DeviceCommandError } from '../errors';

export const sendUdpCommand = async (device: Device, data: Data): Promise<{ timestamp: Date, result: Result }> => {
  return await new Promise((resolve, reject) => {
    const client = udp.createSocket('udp4');
    const timestamp = new Date;
    client.on('error', (error) => {
      client.close();
      reject(error);
    })
    .on('message', (message) => {
      try {
        const response: DeviceResponse = JSON.parse(message.toString());
        if (data.method !== 'getPilot' && response.result?.success !== true) {
          throw new DeviceCommandError("Got a response without success === true!", { response, data });
        }
        resolve({ timestamp, result: response.result });
      } catch (error) {
        reject(error);
      } finally {
        client.close();
      }
    })
    .send(JSON.stringify({ ...data, id: device.id }), device.port, device.ip, (err) => {
      if (err) {
        throw new DeviceCommandError("Failed to send command to device!", { err, data });
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
