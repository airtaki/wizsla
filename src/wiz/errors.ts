/** Base class for every error raised by the Wiz protocol layer. */
export class WizError extends Error {
  override name = 'WizError';

  constructor(
    message: string,
    /** `ip:port` of the bulb involved, when there is one. */
    readonly target?: string,
    /** Protocol method of the failed request, when there is one. */
    readonly method?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/** The bulb did not answer in time, or the packet could not be sent. */
export class WizUnreachableError extends WizError {
  override name = 'WizUnreachableError';
}

/** The bulb answered with something that is not a valid Wiz response. */
export class WizProtocolError extends WizError {
  override name = 'WizProtocolError';
}

/** The bulb understood the request and rejected it. */
export class WizCommandError extends WizError {
  override name = 'WizCommandError';

  constructor(
    message: string,
    readonly code: number | undefined,
    target?: string,
    method?: string,
  ) {
    super(message, target, method);
  }
}

/** The request was refused before sending: its parameters are invalid. */
export class WizInvalidParamsError extends WizError {
  override name = 'WizInvalidParamsError';
}
