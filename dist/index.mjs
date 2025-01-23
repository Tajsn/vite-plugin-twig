import path from 'node:path';
import process from 'node:process';
import Twig from 'twig';
import { pathToFileURL } from 'url';


function defineConfig(options) {
  return options;
}

const cwd = process.cwd();
function warn(message) {
  console.log("\x1B[31m%s\x1B[0m", message);
}
async function retrieveConfigFromFile() {
  try {
const cwd = process.cwd();
    const configPath = path.resolve(cwd, 'twig.config.js');
    const configUrl = pathToFileURL(configPath).href;
    const { default: config } = await import(configUrl);
    return config;
  } catch {
    return;
  }
}
function configureTwig({ cache, extensions } = {}) {
  Twig.cache(cache || false);
  if (extensions?.filters) {
    Object.entries(extensions.filters).forEach(([key, fn]) => Twig.extendFilter(key, fn));
  }
  if (extensions?.functions) {
    Object.entries(extensions.functions).forEach(([key, fn]) => Twig.extendFunction(key, fn));
  }
}
async function parseHTML(html, ctx, { fileFilter, fragmentFilter, globals, settings } = {}) {
  const filename = ctx.path.replace(/^\/?/, "");
  if (typeof fileFilter === "function" && !fileFilter(filename))
    return html;
  const placeholders = retrieveTemplatePlaceholders(html, fragmentFilter);
  if (!placeholders.length)
    return html;
  const contents = await Promise.allSettled(placeholders.map(({ template, data }) => {
    const filepath = path.join(cwd, settings?.views || "", template);
    const context = { ...data, ...globals, settings };
    return renderTwigTemplate(filepath, context);
  }));
  return contents.reduce((output, res, i) => {
    if (res.status === "fulfilled") {
      output = output.replace(placeholders[i].placeholder, res.value);
    } else {
      warn(res.reason.message);
    }
    return output;
  }, html);
}
function retrieveTemplatePlaceholders(html, fragmentFilter) {
  const matches = html.matchAll(/<script\b[^>]*data-template="(?<template>[^>]+)"[^>]*>(?<data>[\s\S]+?)<\/script>/gmi);
  let fragments = [];
  try {
    [...matches].forEach(({ [0]: placeholder, groups = {} }) => {
      const data = JSON.parse(groups.data);
      if (typeof fragmentFilter !== "function" || fragmentFilter(placeholder, groups.template, data)) {
        fragments.push({
          data,
          placeholder,
          template: groups.template
        });
      }
    });
  } catch (error) {
    error instanceof Error && warn(error.message);
  }
  return fragments;
}
async function renderTwigTemplate(filepath, context) {
  return new Promise((resolve, reject) => {
    Twig.renderFile(filepath, context, (err, html) => {
      if (err) {
        reject(err);
      } else {
        resolve(html);
      }
    });
  });
}

async function viteTwigPlugin() {
  const config = await retrieveConfigFromFile();
  configureTwig(config);
  return {
    name: "vite-plugin-twig",
    transformIndexHtml: {
      order: "pre",
      handler: async (html, ctx) => {
        return await parseHTML(html, ctx, config);
      }
    },
    handleHotUpdate({ file, server }) {
      if (path.extname(file) === ".twig") {
        server.ws.send({ type: "full-reload" });
      }
    }
  };
}

export { viteTwigPlugin as default, defineConfig };
