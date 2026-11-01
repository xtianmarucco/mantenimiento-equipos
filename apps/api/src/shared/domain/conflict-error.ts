/**
 * The request clashes with the current state of the data, for example a unique value that is
 * already taken. Modules extend it with their own error so the HTTP layer can answer 409.
 */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
