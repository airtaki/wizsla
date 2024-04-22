import { body } from "express-validator";

export const dimmingValidator = [
  body("dimming")
    .optional()
    .isNumeric().bail()
    .isInt({ min: 1, max: 100 }).bail()
    .withMessage("Dimming must be an integer between 1 and 100").bail()
    .custom((value, { req }) => {
      if (typeof value !== "number") {
        return Promise.reject("Dimming must be a number!");
      }
      req.app.set("dimming", value);
      return true;
    })
];

export const rgbValidator = [
  body("r")
    .not()
    .isEmpty().bail()
    .isNumeric().bail()
    .isInt({ min: 0, max: 255 }).bail()
    .withMessage("Red value must be an integer between 0 and 255").bail()
    .custom((value, { req }) => {
      if (typeof value !== "number") {
        return Promise.reject("Red value must be a number!");
      }
      req.app.set("r", value);
      return true;
    }),
  body("g")
    .not()
    .isEmpty().bail()
    .isNumeric().bail()
    .isInt({ min: 0, max: 255 }).bail()
    .withMessage("Green value must be an integer between 0 and 255").bail()
    .custom((value, { req }) => {
      if (typeof value !== "number") {
        return Promise.reject("Green value must be a number!");
      }
      req.app.set("g", value);
      return true;
    }),
  body("b")
    .not()
    .isEmpty().bail()
    .isNumeric().bail()
    .isInt({ min: 0, max: 255 }).bail()
    .withMessage("Blue value must be an integer between 0 and 255").bail()
    .custom((value, { req }) => {
      if (typeof value !== "number") {
        return Promise.reject("Blue value must be a number!");
      }
      req.app.set("b", value);
      return true;
    })
  ];

