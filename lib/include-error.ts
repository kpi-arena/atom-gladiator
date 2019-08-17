import {
  Diagnostic,
  DiagnosticSeverity,
  Range,
} from 'vscode-languageserver-protocol';

/**
 * 0 - `include` file couldn't be loaded.
 * 1 - Infinite loop caused by `include` comments.
 */
declare type RefErrType = 0 | 1;

export class IncludeError extends Error {
  /* Item at index + 1 is an error message to 'refErrType'. */
  private readonly _errorMessages: Array<[string, DiagnosticSeverity]> = [
    ['File not found.', 1],
    ['Reference causes infinite loop.', 1],
  ];

  /**
   * @param _filePath - path to the file in the reference comment,
   * @param _range - range of the error,
   * @param _uri - URI of the document in which the error has to be shown.
   * @param _errType - type of reference error.
   */
  constructor(
    private _filePath: string,
    private _range: Range,
    private _uri: string,
    private _errType: RefErrType,
  ) {
    super();
  }

  /** URI of the file in which the error is located. */
  public get uri(): string {
    return this._uri;
  }

  /** Returns a Diagnostic pointing to the invalid reference. */
  public get diagnostic(): Diagnostic {
    return {
      severity: this._errorMessages[this._errType][1],
      message: this._errorMessages[this._errType][0],
      range: this._range,
    };
  }
}
