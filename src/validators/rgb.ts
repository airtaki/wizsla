import { body, oneOf } from "express-validator";

export const rgbValidator = [
  oneOf([
    // Decimal value given
    body("r")
      .not()
      .isEmpty().bail()
      .isNumeric().bail()
      .isInt({ min: 0, max: 255 }).bail()
      .custom((value, { req }) => {
        if (typeof value !== "number") {
          return Promise.reject("Red value must be a number!");
        }
        req.app.set("r", value);
        return true;
      }),
    // Hexadecimal value given
    body("r")
      .not()
      .isEmpty().bail()
      .isHexadecimal().bail()
      .custom((value, { req }) => {
        if (!/^[0-9a-fA-F]{2}$/.test(value)) {
          return Promise.reject("Red value must be a hexadecimal number between 00 and FF!");
        }
        req.app.set("r", parseInt(value, 16));
        return true;
      }),
    // Percentage given
    body("r")
      .not()
      .isEmpty().bail()
      .isString().bail()
      .custom((value, { req }) => {
        if (typeof value !== "string" || !value.endsWith("%")) {
          return Promise.reject("Red value must be percentage between 0% and 100%!");
        }
        const percentage = parseInt(value, 10);
        if (percentage < 0 || percentage > 100) {
          return Promise.reject("Red value must be percentage between 0% and 100%!");
        }
        req.app.set("r", Math.round(percentage * 255 / 100));
        return true;
      }),
  ], {
    message: "Red value must be either an integer between 0 and 255, a hexadecimal number between 00 and FF, or a percentage between 0% and 100%!",
    errorType: "least_errored"
  }),

  oneOf([
    // Decimal value given
    body("g")
      .not()
      .isEmpty().bail()
      .isNumeric().bail()
      .isInt({ min: 0, max: 255 }).bail()
      .custom((value, { req }) => {
        if (typeof value !== "number") {
          return Promise.reject("Green value must be a number!");
        }
        req.app.set("g", value);
        return true;
      }),
    // Hexadecimal value given
    body("g")
      .not()
      .isEmpty().bail()
      .isHexadecimal().bail()
      .custom((value, { req }) => {
        if (!/^[0-9a-fA-F]{2}$/.test(value)) {
          return Promise.reject("Green value must be a hexadecimal number between 00 and FF!");
        }
        req.app.set("g", parseInt(value, 16));
        return true;
      }),
    // Percentage given
    body("g")
      .not()
      .isEmpty().bail()
      .isString().bail()
      .custom((value, { req }) => {
        if (typeof value !== "string" || !value.endsWith("%")) {
          return Promise.reject("Green value must be percentage between 0% and 100%!");
        }
        const percentage = parseInt(value, 10);
        if (percentage < 0 || percentage > 100) {
          return Promise.reject("Green value must be percentage between 0% and 100%!");
        }
        req.app.set("g", Math.round(percentage * 255 / 100));
        return true;
      }),
  ], {
    message: "Green value must be either an integer between 0 and 255, a hexadecimal number between 00 and FF, or a percentage between 0% and 100%!",
    errorType: "least_errored"
  }),

  oneOf([
    // Decimal value given
    body("b")
      .not()
      .isEmpty().bail()
      .isNumeric().bail()
      .isInt({ min: 0, max: 255 }).bail()
      .custom((value, { req }) => {
        if (typeof value !== "number") {
          return Promise.reject("Blue value must be a number!");
        }
        req.app.set("b", value);
        return true;
      }),
    // Hexadecimal value given
    body("b")
      .not()
      .isEmpty().bail()
      .isHexadecimal().bail()
      .custom((value, { req }) => {
        if (!/^[0-9a-fA-F]{2}$/.test(value)) {
          return Promise.reject("Blue value must be a hexadecimal number between 00 and FF!");
        }
        req.app.set("b", parseInt(value, 16));
        return true;
      }),
    // Percentage given
    body("b")
      .not()
      .isEmpty().bail()
      .isString().bail()
      .custom((value, { req }) => {
        if (typeof value !== "string" || !value.endsWith("%")) {
          return Promise.reject("Blue value must be percentage between 0% and 100%!");
        }
        const percentage = parseInt(value, 10);
        if (percentage < 0 || percentage > 100) {
          return Promise.reject("Blue value must be percentage between 0% and 100%!");
        }
        req.app.set("b", Math.round(percentage * 255 / 100));
        return true;
      }),
  ], {
    message: "Blue value must be either an integer between 0 and 255, a hexadecimal number between 00 and FF, or a percentage between 0% and 100%!",
    errorType: "least_errored"
  }),

  oneOf([
    // Decimal value given
    body("c")
      .optional()
      .isNumeric().bail()
      .isInt({ min: 0, max: 255 }).bail()
      .custom((value, { req }) => {
        if (typeof value !== "number") {
          return Promise.reject("Cold value must be a number!");
        }
        req.app.set("c", value);
        return true;
      }),
    // Hexadecimal value given
    body("c")
      .optional()
      .isHexadecimal().bail()
      .custom((value, { req }) => {
        if (!/^[0-9a-fA-F]{2}$/.test(value)) {
          return Promise.reject("Cold value must be a hexadecimal number between 00 and FF!");
        }
        req.app.set("c", parseInt(value, 16));
        return true;
      }),
    // Percentage given
    body("c")
      .optional()
      .isString().bail()
      .custom((value, { req }) => {
        if (typeof value !== "string" || !value.endsWith("%")) {
          return Promise.reject("Cold value must be percentage between 0% and 100%!");
        }
        const percentage = parseInt(value, 10);
        if (percentage < 0 || percentage > 100) {
          return Promise.reject("Cold value must be percentage between 0% and 100%!");
        }
        req.app.set("c", Math.round(percentage * 255 / 100));
        return true;
      }),
  ], {
    message: "Cold value must be either an integer between 0 and 255, a hexadecimal number between 00 and FF, or a percentage between 0% and 100%!",
    errorType: "least_errored"
  }),

  oneOf([
    // Decimal value given
    body("w")
      .optional()
      .isNumeric().bail()
      .isInt({ min: 0, max: 255 }).bail()
      .custom((value, { req }) => {
        if (typeof value !== "number") {
          return Promise.reject("Warm value must be a number!");
        }
        req.app.set("w", value);
        return true;
      }),
    // Hexadecimal value given
    body("w")
      .optional()
      .isHexadecimal().bail()
      .custom((value, { req }) => {
        if (!/^[0-9a-fA-F]{2}$/.test(value)) {
          return Promise.reject("Warm value must be a hexadecimal number between 00 and FF!");
        }
        req.app.set("w", parseInt(value, 16));
        return true;
      }),
    // Percentage given
    body("w")
      .optional()
      .isString().bail()
      .custom((value, { req }) => {
        if (typeof value !== "string" || !value.endsWith("%")) {
          return Promise.reject("Warm value must be percentage between 0% and 100%!");
        }
        const percentage = parseInt(value, 10);
        if (percentage < 0 || percentage > 100) {
          return Promise.reject("Warm value must be percentage between 0% and 100%!");
        }
        req.app.set("w", Math.round(percentage * 255 / 100));
        return true;
      }),
  ], {
    message: "Warm value must be either an integer between 0 and 255, a hexadecimal number between 00 and FF, or a percentage between 0% and 100%!",
    errorType: "least_errored"
  })
];
