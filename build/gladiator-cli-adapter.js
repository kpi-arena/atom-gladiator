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
exports.CONFIG_FILE_REGEX = /([\\/])\.gladiator\.(yml)$/;
exports.CONFIG_FILE_NAME = '.gladiator.yml';
exports.PROBLEMSET_URL = '/api/v2/utils/schema/problemset-definition';
exports.VARIANTS_URL = '/api/v2/utils/schema/problemset-variants';
class GladiatorCliAdapter {
    constructor(getConsole) {
        this.getConsole = getConsole;
        this.schemaUriCache = null;
        this.formatCache = null;
    }
    async getSchemaUri() {
        if (this.schemaUriCache === null) {
            await this.checkCliPresence();
            const rawUri = await this.execute(['files', 'schema', '-u'], { silent: true });
            this.schemaUriCache = rawUri.replace(/\r?\n|\r/, '');
        }
        return this.schemaUriCache;
    }
    async generateFilesToDir(view) {
        await this.checkCliPresence();
        const input = await view.getInput('Enter the project directory', util_1.getProjectOrHomePath(), 'Enter the path of the directory in which the files will be generated.');
        if (input === null) {
            return;
        }
        this.execute(['files', 'generate', '-d', input], {}).then(() => {
            atom.open({
                pathsToOpen: [path.join(input, exports.CONFIG_FILE_NAME)],
            });
        });
    }
    async getConfigFilePath(silent) {
        await this.checkCliPresence();
        const scriptPath = getScriptPath();
        if (!scriptPath) {
            if (!silent) {
                noScriptPathWarning();
            }
            return Promise.reject();
        }
        return this.execute(['files', 'config-path'], {
            scriptPath,
            silent: true,
        });
    }
    async packProblemset(view, scriptPath) {
        await this.checkCliPresence();
        if (!scriptPath) {
            scriptPath = getScriptPath();
        }
        if (!scriptPath) {
            noScriptPathWarning();
            return;
        }
        const input = await view.getInput('Name of the package', '', 'Enter the the name of the package without the .zip suffix.');
        if (input === null) {
            return;
        }
        const packageName = input.length > 0 ? `${input}.zip` : 'package.zip';
        this.execute(['problemset', 'pack', packageName], {
            scriptPath,
        });
    }
    async pushProblemset(view, scriptPath) {
        await this.checkCliPresence();
        if (!scriptPath) {
            scriptPath = getScriptPath();
        }
        if (!scriptPath) {
            noScriptPathWarning();
            return;
        }
        const args = ['problemset', 'push'];
        // const pid = await view.getInput(
        //   'Problemset PID',
        //   '',
        //   'Specify PID to be used for the problemset.'
        // );
        //
        // if (pid) {
        //   args.push('-p', pid);
        // }
        //
        // const newPassword = await view.getInput(
        //   'New password',
        //   '',
        //   'Changes the current master password.'
        // );
        //
        // if (newPassword) {
        //   args.push('--new-password', newPassword);
        // }
        this.execute(args, { scriptPath });
    }
    async packDockerImage(scriptPath) {
        await this.checkCliPresence();
        if (!scriptPath) {
            scriptPath = getScriptPath();
        }
        if (!scriptPath) {
            noScriptPathWarning();
            return;
        }
        this.execute(['docker-image', 'pack'], { scriptPath });
    }
    async buildDockerImage(scriptPath) {
        await this.checkCliPresence();
        if (!scriptPath) {
            scriptPath = getScriptPath();
        }
        if (!scriptPath) {
            noScriptPathWarning();
            return;
        }
        this.execute(['docker-image', 'build'], { scriptPath });
    }
    async packSubmission(scriptPath) {
        await this.checkCliPresence();
        if (!scriptPath) {
            scriptPath = getScriptPath();
        }
        if (!scriptPath) {
            return noScriptPathWarning();
        }
        this.execute(['submission', 'pack'], { scriptPath });
    }
    async submitSubmission(scriptPath) {
        await this.checkCliPresence();
        if (!scriptPath) {
            scriptPath = getScriptPath();
        }
        if (!scriptPath) {
            return noScriptPathWarning();
        }
        this.execute(['submission', 'submit'], { scriptPath });
    }
    async getGladiatorFormat() {
        if (this.formatCache === null) {
            await this.checkCliPresence();
            this.formatCache = await this.execute(['files', 'gladiator-format'], { silent: true });
        }
        return this.formatCache;
    }
    async execute(args, opt) {
        const atomConsole = this.getConsole();
        if (!opt.silent && atomConsole !== null) {
            atomConsole.clear();
            atomConsole.stickBottom();
            atomConsole.notice('$ gladiator ' + args.join(' '));
        }
        const options = {
            command: 'gladiator',
            autoStart: false,
            args,
        };
        if (opt.scriptPath) {
            options.options = { cwd: opt.scriptPath };
        }
        return new Promise((resolve, reject) => {
            let message = '';
            options.stdout = (data) => {
                message = message.concat(data, '\n');
                if (!opt.silent && atomConsole !== null) {
                    atomConsole.raw(data, 'info', '\n');
                }
            };
            options.stderr = (data) => {
                message = message.concat(data, '\n');
                if (!opt.silent && atomConsole !== null) {
                    atomConsole.raw(data, 'error', '\n');
                }
            };
            options.exit = (code) => {
                if (code === 0) {
                    resolve(message.trim());
                }
                else {
                    reject(message.trim());
                }
            };
            const process = new atom_1.BufferedProcess(options);
            const handleError = (err) => {
                if (!opt.silent && atomConsole !== null) {
                    atomConsole.raw(err.message, 'error', '\n');
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
    async checkCliPresence() {
        if (this.cliPresent === undefined) {
            if (await this.isInstalled()) {
                this.cliPresent = true;
            }
            else {
                this.cliPresent = false;
                atom.notifications.addError('gladiator-cli is not available', {
                    description: 'Please [install Gladiator CLI](http://arena.pages.kpi.fei.tuke.sk/gladiator/gladiator-cli/installation.html).',
                    dismissable: true
                });
            }
        }
        return this.cliPresent;
    }
    async isInstalled() {
        try {
            await this.execute([], { silent: true });
            return true;
        }
        catch (_a) {
            return false;
        }
    }
}
exports.GladiatorCliAdapter = GladiatorCliAdapter;
function noScriptPathWarning() {
    atom.notifications.addError(`Can't determine where to look for file`, {
        description: `Please open a file (or make an editor active).`,
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