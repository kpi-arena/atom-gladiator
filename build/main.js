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
const atom_languageclient_1 = require("atom-languageclient");
const fs_1 = require("fs");
const path = __importStar(require("path"));
const cli = __importStar(require("./gladiator-cli-adapter"));
const gladiator_config_1 = require("./gladiator-config");
const gladiator_connection_1 = require("./gladiator-connection");
const server_settings_1 = require("./server-settings");
const special_document_1 = require("./special-document");
const ui_1 = __importStar(require("./ui"));
class GladiatorConfClient extends atom_languageclient_1.AutoLanguageClient {
    constructor() {
        super(...arguments);
        this._connection = null;
        this._settings = server_settings_1.getDefaultSettings();
        this._configPath = null;
        this._subscriptions = new atom_1.CompositeDisposable();
        this._insertView = new ui_1.default();
        this._statusView = null;
        /**
         * Same as `super.startServer()`, but the method is private and doesn't allow
         * any changes to be made. This method is implemented  to set the connection
         * to `SuperConnection`.
         */
        this.startServer = async (projectPath) => {
            const process = await this.reportBusyWhile(`Starting ${this.getServerName()} for ${path.basename(projectPath)}`, async () => this.startServerProcess(projectPath));
            // @ts-ignore
            super.captureServerErrors(process, projectPath);
            const connection = new gladiator_connection_1.GladiatorConnection(
            // @ts-ignore
            super.createRpcConnection(process), this.logger);
            // @ts-ignore
            this.preInitialization(connection);
            const initializeParams = this.getInitializeParams(projectPath, process);
            // @ts-ignore
            const initialization = connection.initialize(initializeParams);
            this.reportBusyWhile(`${this.getServerName()} initializing for ${path.basename(projectPath)}`, () => initialization);
            const initializeResponse = await initialization;
            const newServer = {
                projectPath,
                process,
                connection,
                capabilities: initializeResponse.capabilities,
                disposable: new atom_1.CompositeDisposable(),
            };
            // @ts-ignore
            this.postInitialization(newServer);
            connection.initialized();
            connection.on('close', () => {
                // @ts-ignore
                if (!super._isDeactivating) {
                    // @ts-ignore
                    super._serverManager.stopServer(newServer);
                    // @ts-ignore
                    if (!super._serverManager.hasServerReachedRestartLimit(newServer)) {
                        this.logger.debug(`Restarting language server for project '${newServer.projectPath}'`);
                        // @ts-ignore
                        super._serverManager.startServer(projectPath);
                    }
                    else {
                        this.logger.warn(`Language server has exceeded auto-restart limit for project '${newServer.projectPath}'`);
                        atom.notifications.addError(`The ${this.name} language server has exited and exceeded the restart limit for project '${newServer.projectPath}'`);
                    }
                }
            });
            const configurationKey = this.getRootConfigurationKey();
            if (configurationKey) {
                newServer.disposable.add(atom.config.observe(configurationKey, config => {
                    const mappedConfig = this.mapConfigurationObject(config || {});
                    if (mappedConfig) {
                        connection.didChangeConfiguration({
                            settings: mappedConfig,
                        });
                    }
                }));
            }
            // @ts-ignore
            super.startExclusiveAdapters(newServer);
            // @ts-ignore
            return newServer;
        };
    }
    // @ts-ignore
    activate(state) {
        super.activate();
        if (!cli.isInstalled()) {
            atom.notifications.addFatalError('gladiator-cli is not installed');
        }
        this._subscriptions.add(
        /* Registering file watcher related to .gladiator.yml files. */
        atom.project.onDidChangeFiles(events => {
            for (const event of events) {
                if (event.path.match(cli.CONFIG_FILE_REGEX)) {
                    this.findAndSetConfig();
                }
            }
        }), atom.workspace.onDidChangeActiveTextEditor(editor => {
            this.findAndSetConfig();
        }), atom.commands.add('atom-workspace', {
            'gladiator:generate-files': () => cli.generateFilesToDir(this._insertView),
        }), atom.commands.add('atom-workspace', {
            'gladiator:pack-problemset': () => {
                if (this._configPath) {
                    cli.packProblemset(this._insertView, path.dirname(this._configPath));
                }
                else {
                    cli.packProblemset(this._insertView);
                }
            },
        }), atom.commands.add('atom-workspace', {
            'gladiator:push-problemset': () => {
                if (this._configPath) {
                    cli.pushProblemset(this._insertView, path.dirname(this._configPath));
                }
                else {
                    cli.pushProblemset(this._insertView);
                }
            },
        }), atom.commands.add('atom-workspace', {
            'gladiator:docker-image-pack': () => {
                if (this._configPath) {
                    cli.packDockerImage(path.dirname(this._configPath));
                }
                else {
                    cli.packDockerImage();
                }
            },
        }), atom.commands.add('atom-workspace', {
            'gladiator:docker-image-build': () => {
                if (this._configPath) {
                    cli.buildDockerImage(path.dirname(this._configPath));
                }
                else {
                    cli.buildDockerImage();
                }
            },
        }));
        atom.config.set('core.debugLSP', false);
        if (state.serverSettings) {
            this._settings = state.serverSettings;
        }
    }
    consumeStatusBar(statusBar) {
        this._statusView = new ui_1.GladiatorStatusView(statusBar);
        this.updateStatusBar();
    }
    serialize() {
        return {
            serverSettings: this._settings,
        };
    }
    deactivate() {
        this._subscriptions.dispose();
        return super.deactivate();
    }
    postInitialization(_server) {
        super.postInitialization(_server);
        this._connection = _server.connection;
        // this.findAndSetConfig();
    }
    getGrammarScopes() {
        return ['source.yaml', 'source.yml'];
    }
    getLanguageName() {
        return 'YAML';
    }
    getServerName() {
        return 'YAML lint';
    }
    getConnectionType() {
        return 'stdio';
    }
    startServerProcess(projectPath) {
        return super.spawnChildNode([
            path.join(__dirname, '../node_modules/yaml-language-server/out/server/src/server.js'),
            '--stdio',
        ]);
    }
    async findAndSetConfig() {
        const editorPath = atom.workspace.getActiveTextEditor()
            ? atom.workspace.getActiveTextEditor().getPath()
            : null;
        if (!editorPath) {
            /* Nothing is open. */
            this.unsetValues();
        }
        else if (!editorPath.match(cli.CONFIG_FILE_REGEX)) {
            return;
        }
        else if (this._connection &&
            this._connection.isRelated(editorPath) &&
            this._configPath) {
            /* Opened an related doc. */
            if (fs_1.existsSync(this._configPath)) {
                gladiator_config_1.getConfigValues(this._configPath)
                    .then(values => this.setValues(values, this._configPath))
                    .catch(() => this.unsetValues());
            }
            else {
                this.findAndSetConfig();
            }
        }
        else if (this._connection) {
            try {
                const configPath = await cli.getConfigFilePath(true);
                const configValues = await gladiator_config_1.getConfigValues(configPath);
                this.setValues(configValues, configPath);
            }
            catch (_a) {
                this.unsetValues();
            }
        }
        else {
            this.unsetValues();
        }
    }
    unsetValues() {
        this._configPath = null;
        if (this._statusView) {
            this._statusView.update();
        }
        if (this._connection) {
            this._connection.deleteSpecialDocs();
            this._connection.formatSubPath = null;
        }
        this.sendSettings({});
    }
    setValues(values, newPath) {
        if (this._configPath !== newPath) {
            this._configPath = newPath;
            atom.notifications.addSuccess(`Config file set active.`, {
                description: `${newPath}`,
            });
        }
        if (this._statusView) {
            this._statusView.update(newPath);
        }
        if (this._connection) {
            this._connection.formatSubPath = path.dirname(newPath);
        }
        this.setFiles(values, newPath);
        this.sendSettings(values);
    }
    sendSettings(values) {
        this._settings.settings.yaml.schemas = {};
        const configSchema = gladiator_config_1.getConfigSchema();
        if (configSchema) {
            this._settings.settings.yaml.schemas[configSchema] = cli.CONFIG_FILE_NAME;
        }
        if (values.problemsetSchema && values.problemsetPath) {
            this._settings.settings.yaml.schemas[values.problemsetSchema] =
                values.problemsetPath;
        }
        if (values.variantSchema && values.variantsPath) {
            this._settings.settings.yaml.schemas[values.variantSchema] =
                values.variantsPath;
        }
        if (this._connection) {
            this._connection.didChangeConfiguration(this._settings);
        }
    }
    setFiles(values, configPath) {
        if (this._connection) {
            this._connection.deleteSpecialDocs();
            if (values.problemsetPath) {
                this._connection.addSpecialDoc(new special_document_1.ComposedDocument(path.join(path.dirname(configPath), values.problemsetPath)), true);
            }
            if (values.variantsPath) {
                this._connection.addSpecialDoc(new special_document_1.ComposedDocument(path.join(path.dirname(configPath), values.variantsPath)), false);
            }
        }
    }
    updateStatusBar(rootPath) {
        if (rootPath && this._statusView) {
            this._statusView.update(rootPath);
        }
        else if (this._statusView) {
            this._statusView.update();
        }
    }
}
exports.GladiatorConfClient = GladiatorConfClient;
module.exports = new GladiatorConfClient();
