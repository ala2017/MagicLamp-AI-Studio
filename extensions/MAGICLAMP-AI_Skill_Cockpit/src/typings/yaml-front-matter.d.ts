declare module 'yaml-front-matter' {
    interface YFMResult {
        __content: string;
        [key: string]: any;
    }
    export function loadFront(content: string, options?: object): YFMResult;
    export function safeLoadFront(content: string, options?: object): YFMResult;
}

declare module 'js-yaml' {
    const yaml: any;
    export = yaml;
}
