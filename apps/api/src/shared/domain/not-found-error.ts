/**
 * A requested record does not exist. Modules extend it with their own error so the HTTP layer can
 * answer 404 without knowing about each module.
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
