import { body, oneOf } from "express-validator";
import { getDeviceByIp, getDeviceByName } from "../helpers";
import { Device } from "../helpers/types";
import config from "config";

export const deviceValidator = [
  oneOf([
    // Device IP address given
    body("device")
      .not()
      .isEmpty().bail()
      .isString().bail()
      .isIP().bail()
      .custom((value, { req }) => {
        const device: Device | undefined = getDeviceByIp(config.get("devices"), value);
        if (!device) {
          return Promise.reject("Device not found!");
        }
        req.app.set("device", device);
        return true;
      }),
    // Device name given
    body("device")
      .not()
      .isEmpty().bail()
      .isString().bail()
      .isAlphanumeric().bail()
      .custom((value, { req }) => {
        const device: Device | undefined = getDeviceByName(config.get("devices"), value);
        if (!device) {
          return Promise.reject("Device not found!");
        }
        req.app.set("device", device);
        return true;
      }),
  ], {
    message: "Device must be either an IP address or a name!",
    errorType: "least_errored"
  })
];
