/** Error con mensaje pensado para mostrarse tal cual a la persona que edita. */
export class UserError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
