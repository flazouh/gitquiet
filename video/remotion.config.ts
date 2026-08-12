/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { join } from "node:path";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from '@remotion/tailwind-v4';

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

// The paper background is a WebGL shader, and the renderer's default browser has
// no WebGL at all: without this every frame fails with "WebGL is not supported".
Config.setChromiumOpenGlRenderer("angle");

// The bundler does not read tsconfig paths, so the `@/` that shadcn writes into
// every component it installs has to be declared here as well.
Config.overrideWebpackConfig((config) => {
  const tailwind = enableTailwind(config);
  return {
    ...tailwind,
    resolve: {
      ...tailwind.resolve,
      alias: {
        ...tailwind.resolve?.alias,
        "@": join(process.cwd(), "src"),
      },
    },
  };
});
