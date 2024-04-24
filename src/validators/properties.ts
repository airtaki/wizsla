import { body, oneOf } from "express-validator";

export const tempValidator = [
  oneOf([
    // Numeric value given
    body("temp")
      .not()
      .isEmpty().bail()
      .isNumeric().bail()
      .isInt({ min: 2200, max: 6500 }).bail()
      .custom((value, { req }) => {
        if (typeof value !== "number") {
          return Promise.reject("Temp must be a number!");
        }
        req.app.set("temp", value);
        return true;
      }),
    // String value given
    body("temp")
      .not()
      .isEmpty().bail()
      .isString().bail()
      .custom((value, { req }) => {
        if (typeof value !== "string" || !value.endsWith("K")) {
          return Promise.reject("Temp must be a string!");
        }
        const kelvin = parseInt(value, 10);
        if (kelvin < 2200 || kelvin > 6500) {
          return Promise.reject("Temp must be a string between 2200K and 6500K!");
        }
        req.app.set("temp", kelvin);
        return true;
      }),
  ], {
    message: "Temp must be either an integer between 2200 and 6500, or a string between 2200K and 6500K!",
    errorType: "least_errored"
  })
];

export const dimmingValidator = [
  oneOf([
    // Decimal value given
    body("dimming")
      .optional()
      .isNumeric().bail()
      .isInt({ min: 1, max: 100 }).bail()
      .custom((value, { req }) => {
        if (typeof value !== "number") {
          return Promise.reject("Dimming must be a number!");
        }
        req.app.set("dimming", value);
        return true;
      }),
    // Percentage given
    body("dimming")
      .optional()
      .isString().bail()
      .custom((value, { req }) => {
        if (typeof value !== "string" || !value.endsWith("%")) {
          return Promise.reject("Dimming must be percentage between 1% and 100%!");
        }
        const percentage = parseInt(value, 10);
        if (percentage < 1 || percentage > 100) {
          return Promise.reject("Dimming must be percentage between 1% and 100%!");
        }
        req.app.set("dimming", percentage);
        return true;
      }),
  ], {
    message: "Dimming must be either an integer between 1 and 100, or a percentage between 1% and 100%!",
    errorType: "least_errored"
  })
];

export const speedValidator = [
  oneOf([
    // Decimal value given
    body("speed")
      .optional()
      .isNumeric().bail()
      .isInt({ min: 10, max: 100 }).bail()
      .custom((value, { req }) => {
        if (typeof value !== "number") {
          return Promise.reject("Speed must be a number!");
        }
        req.app.set("speed", value);
        return true;
      }),
    // Percentage given
    body("speed")
      .optional()
      .isString().bail()
      .custom((value, { req }) => {
        if (typeof value !== "string" || !value.endsWith("%")) {
          return Promise.reject("Speed must be percentage between 10% and 100%!");
        }
        const percentage = parseInt(value, 10);
        if (percentage < 10 || percentage > 100) {
          return Promise.reject("Speed must be percentage between 10% and 100%!");
        }
        req.app.set("speed", percentage);
        return true;
      }),
  ], {
    message: "Speed must be either an integer between 10 and 100, or a percentage between 10% and 100%!",
    errorType: "least_errored"
  })
];
