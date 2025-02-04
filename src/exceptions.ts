export class CmdError extends Error {
  stdout?: string | null;
  stderr?: string | null;
  code?: number | null;

  constructor(
    message: string,
    options: ErrorOptions & { stdout?: string | null; stderr?: string | null; code?: number | null }
  ) {
    super(message, options);
    this.name = this.constructor.name;
    this.message = message;
    this.code = options.code;
    this.stdout = options.stdout;
    this.stderr = options.stderr;

    Error.captureStackTrace(this, this.constructor);
  }
}
