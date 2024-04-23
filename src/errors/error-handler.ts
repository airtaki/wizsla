import util from "util";
import type { Request, Response, NextFunction } from "express";

export default (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(util.inspect(err, true, null, true));
  res
    .status("statusCode" in err ? err.statusCode as number : 500)
    .setHeader("Content-Type", "application/json")
    .json({
      success: false,
      error: err.message,
      ...("errorObject" in err ? { details: err.errorObject } : {}),
    });
};
