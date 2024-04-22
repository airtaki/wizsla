import { body, oneOf } from "express-validator";
import { getSceneById, getSceneByName } from "../helpers";
import { Scene } from "../helpers/types";
import config from "config";

export const sceneValidator = [
  oneOf([
    // Scene ID given
    body("scene")
      .not()
      .isEmpty().bail()
      .isNumeric().bail()
      .isInt({ min: 0, max: 32 }).bail()
      .custom((value, { req }) => {
        if (typeof value !== "number") {
          return Promise.reject("Scene not found!");
        }
        const scene: Scene | undefined = getSceneById(config.get('scenes'), value);
        if (!scene) {
          return Promise.reject("Scene not found!");
        }
        req.app.set("scene", scene);
        return true;
      }),
    // Scene name given
    body("scene")
      .not()
      .isEmpty().bail()
      .isString().bail()
      .isAlphanumeric('en-US', { ignore: ' -' }).bail()
      .custom((value, { req }) => {
        const scene: Scene | undefined = getSceneByName(config.get('scenes'), value);
        if (!scene) {
          return Promise.reject("Scene not found!");
        }
        req.app.set("scene", scene);
        return true;
      }),
  ], {
    message: "Scene must be either an ID or a name!",
    errorType: "least_errored",
  })
];
