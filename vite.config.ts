import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { dedupe: ['react', 'react-dom'], alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  optimizeDeps: { include: ['@base-ui/react/button', '@base-ui/react/context-menu', '@base-ui/react/dialog', '@base-ui/react/input', '@base-ui/react/menu', '@base-ui/react/merge-props', '@base-ui/react/scroll-area', '@base-ui/react/select', '@base-ui/react/separator', '@base-ui/react/switch', '@base-ui/react/tabs', '@base-ui/react/tooltip', '@base-ui/react/use-render', 'class-variance-authority', 'cn', 'react', 'react-dom', 'react/jsx-runtime', '@excalidraw/excalidraw', '@xyflow/react', '@dagrejs/dagre', '@excalidraw/mermaid-to-excalidraw', 'mermaid', 'shiki', 'roughjs', 'lucide-react', 'zustand', 'react-router-dom'] },
  server: { port: 5173, strictPort: true, watch: { ignored: ['**/decks/**', '**/schemas/**'] }, proxy: { '/api': 'http://127.0.0.1:5174', '/mcp': 'http://127.0.0.1:5174' } },
  test: { environment: 'node' },
})
