import path from "path";
import { fileURLToPath } from "url";
const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
export default {
  serverExternalPackages: ["telegram"],
  poweredByHeader: false,
  webpack(config) {
    config.resolve.alias["@"] = root;
    return config;
  },
};
