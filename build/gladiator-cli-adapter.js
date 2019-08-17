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
let cliPresenceChecked = false;
let cliPresent = false;
async function checkCliPresence() {
    if (cliPresenceChecked) {
        return cliPresent;
    }
    cliPresenceChecked = true;
    if (await isInstalled()) {
        cliPresent = true;
    }
    else {
        atom.notifications.addError('gladiator-cli is not available', {
            description: 'Please [install Gladiator CLI](http://arena.pages.kpi.fei.tuke.sk/gladiator/gladiator-cli/installation.html).',
            dismissable: true
        });
    }
    return cliPresent;
}
async function isInstalled() {
    try {
        await execute([], { silent: true });
        return true;
    }
    catch (_a) {
        return false;
    }
}
exports.isInstalled = isInstalled;
async function getSchemaUri() {
    await checkCliPresence();
    const rawUri = await execute(['files', 'schema', '-u'], { silent: true });
    return rawUri.replace(/\r?\n|\r/, '');
}
exports.getSchemaUri = getSchemaUri;
async function generateFilesToDir(view) {
    await checkCliPresence();
    view.getInput('Enter the project directory', util_1.getProjectOrHomePath(), 'Enter the path of the directory in which the files will be generated.', (input) => {
        execute(['files', 'generate', '-d', input], {}).then(() => {
            atom.open({
                pathsToOpen: [path.join(input, exports.CONFIG_FILE_NAME)],
            });
        });
    });
}
exports.generateFilesToDir = generateFilesToDir;
async function getConfigFilePath(silent) {
    await checkCliPresence();
    const scriptPath = getScriptPath();
    if (!scriptPath) {
        if (!silent) {
            noScriptPathWarning();
        }
        return Promise.reject();
    }
    return execute(['files', 'config-path'], {
        scriptPath,
        silent: true,
    });
}
exports.getConfigFilePath = getConfigFilePath;
async function packProblemset(view, scriptPath) {
    await checkCliPresence();
    if (!scriptPath) {
        scriptPath = getScriptPath();
    }
    if (!scriptPath) {
        noScriptPathWarning();
        return;
    }
    view.getInput('Name of the package', '', 'Enter the the name of the package without the .zip suffix.', (input) => {
        const packageName = input.length > 0 ? `${input}.zip` : 'package.zip';
        execute(['problemset', 'pack', packageName], {
            scriptPath,
        });
    });
}
exports.packProblemset = packProblemset;
async function pushProblemset(view, scriptPath) {
    await checkCliPresence();
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
            execute(args, { scriptPath });
        });
    });
}
exports.pushProblemset = pushProblemset;
async function packDockerImage(scriptPath) {
    await checkCliPresence();
    if (!scriptPath) {
        scriptPath = getScriptPath();
    }
    if (!scriptPath) {
        noScriptPathWarning();
        return;
    }
    execute(['docker-image', 'pack'], { scriptPath });
}
exports.packDockerImage = packDockerImage;
async function buildDockerImage(scriptPath) {
    await checkCliPresence();
    if (!scriptPath) {
        scriptPath = getScriptPath();
    }
    if (!scriptPath) {
        noScriptPathWarning();
        return;
    }
    execute(['docker-image', 'build', '-L'], { scriptPath });
}
exports.buildDockerImage = buildDockerImage;
async function getGladiatorFormat() {
    await checkCliPresence();
    return execute(['files', 'gladiator-format'], { silent: true });
}
exports.getGladiatorFormat = getGladiatorFormat;
function noScriptPathWarning() {
    atom.notifications.addError(`Can't determine where to look for file`, {
        description: `Please open a file (or make an editor active).`,
    });
}
function execute(args, opt) {
    return new Promise((resolve, reject) => {
        const options = {
            command: 'gladiator',
            autoStart: false,
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
        const handleError = (err) => {
            if (!opt.silent) {
                atom.notifications.addError('gladiator-cli error', {
                    description: err.message,
                    stack: err.stack,
                });
            }
            reject(err.message);
        };
        process.onWillThrowError(err => {
            err.handle();
            handleError(err.error);
        });
        try {
            process.start();
        }
        catch (e) {
            handleError(e);
        }
    });
}
function getScriptPath() {
    const editor = atom.workspace.getActiveTextEditor();
    if (editor && editor.getPath()) {
        return path.dirname(editor.getPath());
    }
    return undefined;
}
//# sourceMappingURL=gladiator-cli-adapter.js.map