import { Plugin } from 'vite';

interface PluginOptions {
  cache?: boolean
  extensions?: {
    filters?: TwigExtensions
    functions?: TwigExtensions
  }
  fileFilter?: (filename: string) => boolean
  fragmentFilter?: TwigFragmentFilter
  globals?: { [key: string]: any }
  settings?: {
    views: any
    'twig options': any
  }
}

interface TwigExtensions {
  [name: string]: (...args: any[]) => any
}

type TwigFragmentFilter = (script: string, template: string, data: object) => boolean

declare function defineConfig(options: PluginOptions): PluginOptions;

declare function viteTwigPlugin(): Promise<Plugin>;

export { viteTwigPlugin as default, defineConfig };
