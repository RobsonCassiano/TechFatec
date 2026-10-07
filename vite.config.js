import { defineConfig } from "vite"
import { readFileSync } from "node:fs"

const siteConfiguration = JSON.parse(
  readFileSync(new URL("./.figma/make/site.json", import.meta.url), "utf8"),
)

export default defineConfig({
  base: process.env.FIGMA_PUBLIC_URL ? `${process.env.FIGMA_PUBLIC_URL}/` : "/",
  plugins: [siteMetadataPlugin(siteConfiguration)],
  server: {
    host: process.env.FIGMA_DEV_SERVER_HOST || "0.0.0.0",

    port: Number.parseInt(process.env.PORT || "8443", 10),

    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },

  preview: {
    host: process.env.FIGMA_DEV_SERVER_HOST || "0.0.0.0",

    port: Number.parseInt(process.env.PORT || "8443", 10),
  },
})

function siteMetadataPlugin(configuration) {
  const robotsTxt =
    configuration.robots?.index === false ? "User-agent: *\nDisallow: /\n" : ""

  return {
    name: "figma-site-metadata",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!robotsTxt || request.url?.split("?")[0] !== "/robots.txt") {
          return next()
        }

        response.setHeader("Content-Type", "text/plain; charset=utf-8")
        response.end(robotsTxt)
      })
    },
    generateBundle() {
      if (robotsTxt) {
        this.emitFile({
          type: "asset",
          fileName: "robots.txt",
          source: robotsTxt,
        })
      }
    },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const tags = []
        if (configuration.description) {
          tags.push({
            tag: "meta",
            attrs: {
              name: "description",
              content: configuration.description,
            },
            injectTo: "head",
          })
        }
        if (configuration.robots?.index === false) {
          tags.push({
            tag: "meta",
            attrs: { name: "robots", content: "noindex, nofollow" },
            injectTo: "head",
          })
        }
        return { html, tags }
      },
    },
  }
}
