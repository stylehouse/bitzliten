import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
const viteServerConfig = {
    name: 'log-request-middleware',
    configureServer(server) {
        server.middlewares.use((req, res, next) => {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET");
            res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
            res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
            next();
        });
    }
};

export default defineConfig({
	plugins: [sveltekit(), viteServerConfig],
	optimizeDeps: {
		exclude: ["@ffmpeg/ffmpeg","@ffmpeg/util"]
	},
	ssr: {
		noExternal: ['@ffmpeg/util']
	},
	// we don't seem to need these, see 'server.middlewares' above
	// server: {
	//   headers: {
	// 	"Cross-Origin-Opener-Policy": "same-origin",
	// 	"Cross-Origin-Embedder-Policy": "require-corp",
	//   },
	// },
});
