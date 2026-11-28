import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createAssistantHandler } from './server/assistant-handler.js'
import { createPhotoHandler } from './server/photo-handler.js'

const envDirectory = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDirectory, '')
  const ask = createAssistantHandler(env)
  const photo = createPhotoHandler(env)
  const mount = server => {
    server.middlewares.use((request, response, next) => {
      const path = request.url?.split('?')[0]
      if (path === '/api/ask') return ask(request, response)
      if (path === '/api/photo') return photo(request, response)
      return next()
    })
  }
  return {
    plugins: [react(), { name: 'moraplates-api', configureServer: mount, configurePreviewServer: mount }],
  }
})
