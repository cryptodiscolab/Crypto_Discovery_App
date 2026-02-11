// vite.config.js
import { defineConfig } from "file:///E:/Disco%20Gacha/Disco_DailyApp/Raffle_Frontend/node_modules/vite/dist/node/index.js";
import react from "file:///E:/Disco%20Gacha/Disco_DailyApp/Raffle_Frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
var __vite_injected_original_dirname = "E:\\Disco Gacha\\Disco_DailyApp\\Raffle_Frontend";
var vite_config_default = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src"),
      "react": path.resolve(__vite_injected_original_dirname, "node_modules/react"),
      "react-dom": path.resolve(__vite_injected_original_dirname, "node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(__vite_injected_original_dirname, "node_modules/react/jsx-runtime"),
      "react/jsx-dev-runtime": path.resolve(__vite_injected_original_dirname, "node_modules/react/jsx-dev-runtime"),
      "react-dom/client": path.resolve(__vite_injected_original_dirname, "node_modules/react-dom/client"),
      "react-is": path.resolve(__vite_injected_original_dirname, "node_modules/react-is"),
      "lucide-react": path.resolve(__vite_injected_original_dirname, "node_modules/lucide-react")
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "react-dom/client", "react-is", "lucide-react"]
  },
  define: {
    "process.env": {},
    "global": "globalThis"
    // Helps with some legacy web3 libs
  },
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: false,
    cssCodeSplit: true,
    rollupOptions: {
      treeshake: false,
      // CRITICAL: Stop the recursive property tracer
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-web3": ["wagmi", "viem", "@rainbow-me/rainbowkit"],
          "vendor-ui": ["lucide-react", "react-hot-toast"]
        }
      },
      onwarn(warning, warn) {
        if (warning.code === "CIRCULAR_DEPENDENCY") return;
        if (warning.code === "EVAL") return;
        warn(warning);
      }
    },
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    }
  },
  optimizeDeps: {
    include: ["wagmi", "viem", "@rainbow-me/rainbowkit", "@pigment-css/react"],
    esbuildOptions: {
      target: "esnext"
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJFOlxcXFxEaXNjbyBHYWNoYVxcXFxEaXNjb19EYWlseUFwcFxcXFxSYWZmbGVfRnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkU6XFxcXERpc2NvIEdhY2hhXFxcXERpc2NvX0RhaWx5QXBwXFxcXFJhZmZsZV9Gcm9udGVuZFxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRTovRGlzY28lMjBHYWNoYS9EaXNjb19EYWlseUFwcC9SYWZmbGVfRnJvbnRlbmQvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYycpLFxuICAgICAgJ3JlYWN0JzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ25vZGVfbW9kdWxlcy9yZWFjdCcpLFxuICAgICAgJ3JlYWN0LWRvbSc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdub2RlX21vZHVsZXMvcmVhY3QtZG9tJyksXG4gICAgICAncmVhY3QvanN4LXJ1bnRpbWUnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnbm9kZV9tb2R1bGVzL3JlYWN0L2pzeC1ydW50aW1lJyksXG4gICAgICAncmVhY3QvanN4LWRldi1ydW50aW1lJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ25vZGVfbW9kdWxlcy9yZWFjdC9qc3gtZGV2LXJ1bnRpbWUnKSxcbiAgICAgICdyZWFjdC1kb20vY2xpZW50JzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ25vZGVfbW9kdWxlcy9yZWFjdC1kb20vY2xpZW50JyksXG4gICAgICAncmVhY3QtaXMnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnbm9kZV9tb2R1bGVzL3JlYWN0LWlzJyksXG4gICAgICAnbHVjaWRlLXJlYWN0JzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ25vZGVfbW9kdWxlcy9sdWNpZGUtcmVhY3QnKSxcbiAgICB9LFxuICAgIGRlZHVwZTogWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3QvanN4LXJ1bnRpbWUnLCAncmVhY3QvanN4LWRldi1ydW50aW1lJywgJ3JlYWN0LWRvbS9jbGllbnQnLCAncmVhY3QtaXMnLCAnbHVjaWRlLXJlYWN0J10sXG4gIH0sXG4gIGRlZmluZToge1xuICAgICdwcm9jZXNzLmVudic6IHt9LFxuICAgICdnbG9iYWwnOiAnZ2xvYmFsVGhpcycsIC8vIEhlbHBzIHdpdGggc29tZSBsZWdhY3kgd2ViMyBsaWJzXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgdGFyZ2V0OiAnZXNuZXh0JyxcbiAgICBtaW5pZnk6ICdlc2J1aWxkJyxcbiAgICBzb3VyY2VtYXA6IGZhbHNlLFxuICAgIGNzc0NvZGVTcGxpdDogdHJ1ZSxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICB0cmVlc2hha2U6IGZhbHNlLCAvLyBDUklUSUNBTDogU3RvcCB0aGUgcmVjdXJzaXZlIHByb3BlcnR5IHRyYWNlclxuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rczoge1xuICAgICAgICAgICd2ZW5kb3ItcmVhY3QnOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbScsICdyZWFjdC1yb3V0ZXItZG9tJ10sXG4gICAgICAgICAgJ3ZlbmRvci13ZWIzJzogWyd3YWdtaScsICd2aWVtJywgJ0ByYWluYm93LW1lL3JhaW5ib3draXQnXSxcbiAgICAgICAgICAndmVuZG9yLXVpJzogWydsdWNpZGUtcmVhY3QnLCAncmVhY3QtaG90LXRvYXN0J11cbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBvbndhcm4od2FybmluZywgd2Fybikge1xuICAgICAgICBpZiAod2FybmluZy5jb2RlID09PSAnQ0lSQ1VMQVJfREVQRU5ERU5DWScpIHJldHVybjtcbiAgICAgICAgaWYgKHdhcm5pbmcuY29kZSA9PT0gJ0VWQUwnKSByZXR1cm47XG4gICAgICAgIHdhcm4od2FybmluZyk7XG4gICAgICB9XG4gICAgfSxcbiAgICBjb21tb25qc09wdGlvbnM6IHtcbiAgICAgIGluY2x1ZGU6IFsvbm9kZV9tb2R1bGVzL10sXG4gICAgICB0cmFuc2Zvcm1NaXhlZEVzTW9kdWxlczogdHJ1ZVxuICAgIH1cbiAgfSxcbiAgb3B0aW1pemVEZXBzOiB7XG4gICAgaW5jbHVkZTogWyd3YWdtaScsICd2aWVtJywgJ0ByYWluYm93LW1lL3JhaW5ib3draXQnLCAnQHBpZ21lbnQtY3NzL3JlYWN0J10sXG4gICAgZXNidWlsZE9wdGlvbnM6IHtcbiAgICAgIHRhcmdldDogJ2VzbmV4dCcsXG4gICAgfVxuICB9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBbVUsU0FBUyxvQkFBb0I7QUFDaFcsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUZqQixJQUFNLG1DQUFtQztBQUt6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLE1BQ3BDLFNBQVMsS0FBSyxRQUFRLGtDQUFXLG9CQUFvQjtBQUFBLE1BQ3JELGFBQWEsS0FBSyxRQUFRLGtDQUFXLHdCQUF3QjtBQUFBLE1BQzdELHFCQUFxQixLQUFLLFFBQVEsa0NBQVcsZ0NBQWdDO0FBQUEsTUFDN0UseUJBQXlCLEtBQUssUUFBUSxrQ0FBVyxvQ0FBb0M7QUFBQSxNQUNyRixvQkFBb0IsS0FBSyxRQUFRLGtDQUFXLCtCQUErQjtBQUFBLE1BQzNFLFlBQVksS0FBSyxRQUFRLGtDQUFXLHVCQUF1QjtBQUFBLE1BQzNELGdCQUFnQixLQUFLLFFBQVEsa0NBQVcsMkJBQTJCO0FBQUEsSUFDckU7QUFBQSxJQUNBLFFBQVEsQ0FBQyxTQUFTLGFBQWEscUJBQXFCLHlCQUF5QixvQkFBb0IsWUFBWSxjQUFjO0FBQUEsRUFDN0g7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLGVBQWUsQ0FBQztBQUFBLElBQ2hCLFVBQVU7QUFBQTtBQUFBLEVBQ1o7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQSxJQUNYLGNBQWM7QUFBQSxJQUNkLGVBQWU7QUFBQSxNQUNiLFdBQVc7QUFBQTtBQUFBLE1BQ1gsUUFBUTtBQUFBLFFBQ04sY0FBYztBQUFBLFVBQ1osZ0JBQWdCLENBQUMsU0FBUyxhQUFhLGtCQUFrQjtBQUFBLFVBQ3pELGVBQWUsQ0FBQyxTQUFTLFFBQVEsd0JBQXdCO0FBQUEsVUFDekQsYUFBYSxDQUFDLGdCQUFnQixpQkFBaUI7QUFBQSxRQUNqRDtBQUFBLE1BQ0Y7QUFBQSxNQUNBLE9BQU8sU0FBUyxNQUFNO0FBQ3BCLFlBQUksUUFBUSxTQUFTLHNCQUF1QjtBQUM1QyxZQUFJLFFBQVEsU0FBUyxPQUFRO0FBQzdCLGFBQUssT0FBTztBQUFBLE1BQ2Q7QUFBQSxJQUNGO0FBQUEsSUFDQSxpQkFBaUI7QUFBQSxNQUNmLFNBQVMsQ0FBQyxjQUFjO0FBQUEsTUFDeEIseUJBQXlCO0FBQUEsSUFDM0I7QUFBQSxFQUNGO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsU0FBUyxRQUFRLDBCQUEwQixvQkFBb0I7QUFBQSxJQUN6RSxnQkFBZ0I7QUFBQSxNQUNkLFFBQVE7QUFBQSxJQUNWO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
