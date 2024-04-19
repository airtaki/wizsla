import udp from 'dgram';
import { Data, Device, Scene } from './types';

export const sendUdpCommand = async (data: Data, device: Device) => {
  return await new Promise((resolve, reject) => {
    const client = udp.createSocket('udp4');
    const timestamp = new Date;
    client.on('error', (error) => {
      client.close();
      reject(error);
    })
    .on('message', (message, { address, port }) => {
      let response: {result: {success: boolean}} = {result: {success: false}};
      try {
        response = JSON.parse(message.toString());
        if (response.result.success !== true) {
          throw new Error("Got a response without success === true!");
        }
        client.close();
      } catch (error) {
        reject(error);
        client.close();
      }
      resolve({
        timestamp,
        address,
        port,
        data,
        result: response.result
      });
    })
    .send(JSON.stringify({ ...data, id: device.id }), device.port, device.ip, (err) => {
      if (err) {
        console.log('Error:', err);
      }
    });
  });
};

export const getDeviceByIp = (devices: Device[], ip: string): Device => {
  const device = devices.find((device) => device.ip === ip);
  if (!device) {
    throw new Error(`Device with IP ${ip} not found!`);
  }
  return device;
};

export const getDeviceByName = (devices: Device[], name: string): Device => {
  const device = devices.find((device) => device.name.toLowerCase() === name.toLowerCase());
  if (!device) {
    throw new Error(`Device with name ${name} not found!`);
  }
  return device;
};

export const getSceneById = (scenes: Scene[], id: number): Scene => {
  const scene = scenes.find((scene) => scene.id === id);
  if (!scene) {
    throw new Error(`Scene with ID ${id} not found!`);
  }
  return scene;
};

export const getSceneByName = (scenes: Scene[], name: string): Scene => {
  const scene = scenes.find((scene) => scene.name.toLowerCase() === name.toLowerCase());
  if (!scene) {
    throw new Error(`Scene with name ${name} not found!`);
  }
  return scene;
};
