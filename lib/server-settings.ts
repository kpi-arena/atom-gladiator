export interface IServerSettings {
  settings: {
    yaml: {
      format: {
        singleQuote: boolean;
        bracketSpacing: boolean;
        proseWrap: 'always' | 'never' | 'preserve';
        printWidth: number;
        enable: boolean;
      };
      trace: {
        server: 'verbose';
      };
      schemas: {
        [schema: string]: string;
      };
      validate: boolean;
      hover: boolean;
      completion: boolean;
      customTags: string[];
      schemaStore: {
        enable: boolean;
      };
    };
  };
}

export function getDefaultSettings(): IServerSettings {
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
