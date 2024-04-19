import { body } from "express-validator";

export const dimming = [
  body("dimming")
    .optional()
    .isInt({ min: 1, max: 100 }).bail()
    .withMessage("Dimming must be an integer between 1 and 100").bail()
    .custom((value, { req }) => {
      req.app.set("dimming", value as number);
      return true;
    })
];


