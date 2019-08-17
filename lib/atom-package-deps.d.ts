declare module 'atom-package-deps' {
  export function install(packageName: string, promptUser: boolean): Promise<boolean>;
}
