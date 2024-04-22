
export class NotFoundError extends Error {
  public statusCode: number;

  constructor(message?: string) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
};

export class ValidationError extends Error {
  public statusCode: number;
  public errorObject?: any;

  constructor(message?: string, errorObject?: any) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.errorObject = errorObject;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
};

export class UnprocessableEntityError extends Error {
  public statusCode: number;

  constructor(message?: string) {
    super(message);
    this.name = 'UnprocessableEntityError';
    this.statusCode = 422;
    Object.setPrototypeOf(this, UnprocessableEntityError.prototype);
  }
};

export class UnauthorizedAccess extends Error {
  public statusCode: number;

  constructor(message?: string) {
    super(message);
    this.name = 'UnauthorizedAccess';
    this.statusCode = 401;
    Object.setPrototypeOf(this, UnauthorizedAccess.prototype);
  }
};
