import type { Request, Response, NextFunction } from "express";
import {
  ValidationError,
  NotFoundError,
  UnauthorizedAccess,
  UnprocessableEntityError,
} from ".";

export default (
  err:
    | Error
    | ValidationError
    | NotFoundError
    | UnauthorizedAccess
    | UnprocessableEntityError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(err);
  res
    .status("statusCode" in err ? err.statusCode : 500)
    .setHeader("Content-Type", "application/json")
    .json({
      success: false,
      error: err.message,
      ...("errorObject" in err ? { details: err.errorObject } : {}),
    });
};
