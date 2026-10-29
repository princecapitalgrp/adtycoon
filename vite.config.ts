import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    // Recharts is split out via React.lazy (Analytics tab) and is not needed at startup.
    chunkSizeWarningLimit: 600,
  },
  test: { environment: 'node' },
} as any);
