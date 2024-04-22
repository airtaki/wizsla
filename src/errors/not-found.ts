import type { Request, Response } from "express";

export default (req: Request, res: Response) => {
  res
    .status(404)
    .setHeader("Content-Type", "application/json")
    .json({
      success: false
    });
};
