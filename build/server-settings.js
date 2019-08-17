"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function getDefaultSettings() {
    return {
        settings: {
            yaml: {
                format: {
                    singleQuote: false,
                    bracketSpacing: true,
                    proseWrap: 'preserve',
                    printWidth: 80,
                    enable: false,
                },
                trace: {
                    server: 'verbose',
                },
                schemas: {},
                validate: true,
                hover: true,
                completion: true,
                customTags: [],
                schemaStore: {
                    enable: true,
                },
            },
        },
    };
}
exports.getDefaultSettings = getDefaultSettings;
//# sourceMappingURL=server-settings.js.map