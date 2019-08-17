"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class IncludeError extends Error {
    /**
     * @param _filePath - path to the file in the reference comment,
     * @param _range - range of the error,
     * @param _uri - URI of the document in which the error has to be shown.
     * @param _errType - type of reference error.
     */
    constructor(_filePath, _range, _uri, _errType) {
        super();
        this._filePath = _filePath;
        this._range = _range;
        this._uri = _uri;
        this._errType = _errType;
        /* Item at index + 1 is an error message to 'refErrType'. */
        this._errorMessages = [
            ['File not found.', 1],
            ['Reference causes infinite loop.', 1],
        ];
    }
    /** URI of the file in which the error is located. */
    get uri() {
        return this._uri;
    }
    /** Returns a Diagnostic pointing to the invalid reference. */
    get diagnostic() {
        return {
            severity: this._errorMessages[this._errType][1],
            message: this._errorMessages[this._errType][0],
            range: this._range,
        };
    }
}
exports.IncludeError = IncludeError;
//# sourceMappingURL=include-error.js.map