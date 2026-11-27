import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { router } from './router'
import { FxProvider } from './lib/fx'
import { AuthProvider } from './lib/auth'
import './styles/global.css'
import './styles/mobile-social.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FxProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </FxProvider>
  </StrictMode>,
)
