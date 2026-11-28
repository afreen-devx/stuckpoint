// Lets plain Node run the app's TypeScript files, which import each other without the .ts ending.
// Used by: npm run ai:check
import { register } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

if (import.meta.url.endsWith("?hook") === false) register(new URL(import.meta.url + "?hook"));

export async function resolve(spec, ctx, next) {
  if ((spec.startsWith(".") || spec.startsWith("/")) && !/\.[mc]?[jt]s$/.test(spec) && ctx.parentURL) {
    const url = new URL(spec + ".ts", ctx.parentURL);
    if (existsSync(fileURLToPath(url))) return next(url.href, ctx);
  }
  return next(spec, ctx);
}

