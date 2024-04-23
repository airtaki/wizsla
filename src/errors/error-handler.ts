import util from "util";
import type { Request, Response, NextFunction } from "express";

export default (err: Error, req: Request, res: Response, next: NextFunction) => {
  const statusCode = "statusCode" in err ? err.statusCode as number : 500;
  const errorObject: any = "errorObject" in err ? err.errorObject : {};
  const cookies = req.get("cookie");
  console.error(util.inspect({
    at: new Date(),
    error: err.name,
    message: err.message,
    method: req.method,
    url: req.url,
    headers: req.headers,
    ...(cookies ? { cookies } : {}),
    ...(Object.keys(req.body).length > 0 ? { body: req.body } : {}),
    ...(Object.keys(req.params).length > 0 ? { params: req.params } : {}),
    ...(Object.keys(req.query).length > 0 ? { query: req.query } : {}),
    ...(Object.keys(errorObject).length > 0 ? { errorObject } : {}),
    // Show stack in the log only for internal server errors:
    ...(statusCode >= 500 && statusCode < 600 ? { stack: err.stack } : {})
  }, true, null, true));
  res
    .status(statusCode)
    .setHeader("Content-Type", "application/json")
    .json({
      success: false,
      error: err.message,
      ...(Object.keys(errorObject).length > 0 ? { errorObject } : {})
    });
};
