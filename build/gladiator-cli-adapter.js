"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const atom_1 = require("atom");
const path = __importStar(require("path"));
const util_1 = require("./util");
exports.CONFIG_FILE_REGEX = /(\\|\/)\.gladiator\.(yml)$/;
exports.CONFIG_FILE_NAME = '.gladiator.yml';
exports.PROBLEMSET_URL = '/api/v2/utils/schema/problemset-definition';
exports.VARIANTS_URL = '/api/v2/utils/schema/problemset-variants';
function isInstalled() {
    return getProcessPromise([], { silent: true })
        .then(() => {
        return true;
    })
        .catch(() => {
        return false;
    });
}
exports.isInstalled = isInstalled;
function getSchemaUri() {
    // return getProcessPromise(['schema', '-u'], { silent: true }).then(value => {
    //   let newVal = value.replace(/['"]+/g, '');
    //   newVal = newVal.replace(/\r?\n|\r/, '');
    //   console.log(JSON.stringify(newVal));
    //   return newVal;
    // });
    return new Promise((resolve, reject) => {
        const command = 'gladiator';
        const args = ['files', 'schema', '-u'];
        const stdout = (data) => resolve(data);
        const stderr = (data) => reject(data);
        const process = new atom_1.BufferedProcess({ command, args, stdout, stderr });
    }).then(value => value.replace(/\r?\n|\r/, ''));
}
exports.getSchemaUri = getSchemaUri;
function generateFilesToDir(view) {
    view.getInput('Enter the project directory', util_1.getProjectOrHomePath(), 'Enter the path of the directory in which the files will be generated.', (input) => {
        getProcessPromise(['files', 'generate', '-d', input], {}).then(() => {
            atom.open({
                pathsToOpen: [path.join(input, exports.CONFIG_FILE_NAME)],
            });
        });
    });
}
exports.generateFilesToDir = generateFilesToDir;
function getConfigFilePath(silent) {
    const scriptPath = getScriptPath();
    if (!scriptPath) {
        return new Promise((resolve, reject) => {
            if (!silent) {
                noScriptPathWarning();
            }
            reject();
        });
    }
    return getProcessPromise(['files', 'config-path'], {
        scriptPath,
        silent: true,
    });
}
exports.getConfigFilePath = getConfigFilePath;
function packProblemset(view, scriptPath) {
    if (!scriptPath) {
        scriptPath = getScriptPath();
    }
    if (!scriptPath) {
        noScriptPathWarning();
        return;
    }
    view.getInput('Name of the package', '', 'Enter the the name of the package without the .zip suffix.', (input) => {
        if (input.length > 0) {
            getProcessPromise(['problemset', 'pack', `${input}.zip`], {
                scriptPath,
            });
        }
        else {
            getProcessPromise(['problemset', 'pack', `package.zip`], {
                scriptPath,
            });
        }
    });
}
exports.packProblemset = packProblemset;
function pushProblemset(view, scriptPath) {
    if (!scriptPath) {
        scriptPath = getScriptPath();
    }
    if (!scriptPath) {
        noScriptPathWarning();
        return;
    }
    let pid = '';
    view.getInput('Problemset PID', '', 'Specify PID to be used for the problemset.', (pidInput) => {
        pid = pidInput;
        view.getInput('New password', '', 'Changes the current master password.', (password) => {
            const args = ['problemset', 'push'];
            if (pid.length > 0) {
                args.push('-p', pid);
            }
            if (password.length > 0) {
                args.push('--new-password', password);
            }
            getProcessPromise(args, { scriptPath });
        });
    });
}
exports.pushProblemset = pushProblemset;
function packDockerImage(scriptPath) {
    if (!scriptPath) {
        scriptPath = getScriptPath();
    }
    if (!scriptPath) {
        noScriptPathWarning();
        return;
    }
    getProcessPromise(['docker-image', 'pack'], { scriptPath });
}
exports.packDockerImage = packDockerImage;
function buildDockerImage(scriptPath) {
    if (!scriptPath) {
        scriptPath = getScriptPath();
    }
    if (!scriptPath) {
        noScriptPathWarning();
        return;
    }
    getProcessPromise(['docker-image', 'build', '-L'], { scriptPath });
}
exports.buildDockerImage = buildDockerImage;
function getGladiatorFormat() {
    return getProcessPromise(['files', 'gladiator-format'], { silent: true });
}
exports.getGladiatorFormat = getGladiatorFormat;
function noScriptPathWarning() {
    atom.notifications.addError(`Can't determine where to look for file`, {
        description: `Please open a file (or make an editor active).`,
    });
}
function getProcessPromise(args, opt) {
    return new Promise((resolve, reject) => {
        const options = {
            command: 'gladiator',
            args,
        };
        if (opt.scriptPath) {
            options.options = { cwd: opt.scriptPath };
        }
        let message = '';
        options.stdout = (data) => {
            message = message.concat(data, '\n');
            // atom.notifications.addSuccess(data);
            // resolve(data);
        };
        options.stderr = (data) => {
            message = message.concat(data, '\n');
            // atom.notifications.addError(data);
            // reject(data);
        };
        options.exit = (code) => {
            if (code === 0) {
                if (!opt.silent) {
                    atom.notifications.addSuccess('Success', {
                        detail: message,
                    });
                }
                resolve(message.trim());
            }
            else {
                if (!opt.silent) {
                    atom.notifications.addError('gladiator-cli error', {
                        description: message,
                    });
                }
                reject(message.trim());
            }
        };
        const process = new atom_1.BufferedProcess(options);
        process.onWillThrowError(err => {
            if (!opt.silent) {
                atom.notifications.addError('gladiator-cli error', {
                    description: err.error.message,
                    stack: err.error.stack,
                });
            }
            reject(err.error.message);
        });
    });
}
function getScriptPath() {
    const editor = atom.workspace.getActiveTextEditor();
    if (editor && editor.getPath()) {
        return path.dirname(editor.getPath());
    }
    return undefined;
}
