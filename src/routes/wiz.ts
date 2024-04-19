import express from "express";
import { device as deviceValidator } from "../validators/device";
import { dimming as dimmingValidator } from "../validators/properties";
import { validationHandler } from "../middlewares/validator-handler";
import * as controller from "../controllers/wiz";
import { response } from "../middlewares/response";
export const wizRouter = express.Router();

wizRouter.post("/turn-on", deviceValidator, dimmingValidator, validationHandler, controller.turnOn, response);
wizRouter.post("/turn-off", deviceValidator, validationHandler, controller.turnOff, response);
