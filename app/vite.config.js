import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createAssistantHandler } from './server/assistant-handler.js'

const envDirectory = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ mode }) => {
  const handler = createAssistantHandler(loadEnv(mode, envDirectory, ''))
  const mount = server => {
    server.middlewares.use((request, response, next) => {
      if (request.url?.split('?')[0] !== '/api/ask') return next()
      return handler(request, response)
    })
  }
  return {
    plugins: [react(), { name: 'moraplates-ask', configureServer: mount, configurePreviewServer: mount }],
  }
})
