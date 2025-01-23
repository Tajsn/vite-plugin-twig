'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const path = require('node:path');
const process = require('node:process');
const Twig = require('twig');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e["default"] : e; }

const path__default = /*#__PURE__*/_interopDefaultLegacy(path);
const process__default = /*#__PURE__*/_interopDefaultLegacy(process);
const Twig__default = /*#__PURE__*/_interopDefaultLegacy(Twig);

function defineConfig(options) {
  return options;
}

const cwd = process__default.cwd();
function warn(message) {
  console.log("\x1B[31m%s\x1B[0m", message);
}
async function retrieveConfigFromFile() {
  try {
    const { default: config } = await import(`${cwd}/twig.config`);
    return config;
  } catch {
    return;
  }
}
function configureTwig({ cache, extensions } = {}) {
  Twig__default.cache(cache || false);
  if (extensions?.filters) {
    Object.entries(extensions.filters).forEach(([key, fn]) => Twig__default.extendFilter(key, fn));
  }
  if (extensions?.functions) {
    Object.entries(extensions.functions).forEach(([key, fn]) => Twig__default.extendFunction(key, fn));
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
    const filepath = path__default.join(cwd, settings?.views || "", template);
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
    Twig__default.renderFile(filepath, context, (err, html) => {
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
      if (path__default.extname(file) === ".twig") {
        server.ws.send({ type: "full-reload" });
      }
    }
  };
}

exports["default"] = viteTwigPlugin;
exports.defineConfig = defineConfig;
