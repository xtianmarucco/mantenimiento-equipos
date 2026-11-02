/** One broken rule, at the dotted path of the offending input field. */
export interface DomainValidationIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * Input that is well-formed but breaks a business rule only the application can check, for example
 * a reference to a record that does not exist or a rule against the stored record. Modules extend
 * it with their own error so the HTTP layer can answer 400 with the issues, like a schema failure.
 */
export class DomainValidationError extends Error {
  readonly issues: readonly DomainValidationIssue[];

  constructor(message: string, issues: readonly DomainValidationIssue[]) {
    super(message);
    this.name = new.target.name;
    this.issues = issues;
  }
}
