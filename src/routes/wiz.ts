import express from "express";
import { deviceValidator } from "../validators/device";
import { sceneValidator } from "../validators/scene";
import { dimmingValidator, rgbValidator, speedValidator } from "../validators/properties";
import { validationHandler } from "../middlewares/validator-handler";
import * as controller from "../controllers/wiz";
import { response } from "../middlewares/response";
export const wizRouter = express.Router();

wizRouter.post("/turn-on", deviceValidator, dimmingValidator, validationHandler, controller.turnOn, response);
wizRouter.post("/turn-off", deviceValidator, validationHandler, controller.turnOff, response);
wizRouter.post("/set-scene", deviceValidator, sceneValidator, dimmingValidator, speedValidator, validationHandler, controller.setScene, response);
wizRouter.post("/rgb", deviceValidator, rgbValidator, dimmingValidator, validationHandler, controller.setRGB, response);
