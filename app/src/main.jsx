import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { router } from './router'
import { FxProvider } from './lib/fx'
import { AuthProvider } from './lib/auth'
import { configError } from './lib/supabase'
import './styles/global.css'
import './styles/mobile-social.css'

/** Shown instead of a blank page when the deploy's Supabase settings are wrong. */
function ConfigError({ problem }) {
  return (
    <main className="band"><div className="wrap narrow">
      <div className="card empty" role="alert">
        <svg className="mk" style={{ width: 64, height: 64 }} aria-hidden="true"><use href="#mark" /></svg>
        <h3>MoraPlates can't reach its database</h3>
        <p>{problem}</p>
        <p>Fix the environment variables where the app is hosted, then redeploy. Settings are read when the app is built.</p>
      </div>
    </div></main>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {configError ? <ConfigError problem={configError} /> : (
      <FxProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </FxProvider>
    )}
  </StrictMode>,
)
