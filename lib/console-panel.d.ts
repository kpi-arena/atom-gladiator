declare module 'console-panel' {
  export type MessageLevel = 'error' | 'warn' | 'notice' | 'info' | 'debug';

  export interface ConsoleManager {
    toggle(): void;
    stickBottom(): void;
    stickTop(): void;
    clear(): void;
    log(message: string, level: MessageLevel): void;
    error(message: string): void;
    warn(message: string): void;
    notice(message: string): void;
    debug(message: string): void;
    raw(rawText: string, level: MessageLevel, lineEnding: string | null): void;
  }
}