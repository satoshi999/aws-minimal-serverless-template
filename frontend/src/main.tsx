import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Amplify } from 'aws-amplify'
import { Authenticator } from '@aws-amplify/ui-react'
import './index.css'
import App from './App.tsx'
import '@aws-amplify/ui-react/styles.css'
import { z } from "zod"

const PublicConfigSchema = z.object({
  cognito_user_pool_id: z.string().min(1),
  cognito_user_pool_client_id: z.string().min(1),
})

type PublicConfig = z.infer<typeof PublicConfigSchema>

async function fetchPublicConfig(): Promise<PublicConfig> {
  const res = await fetch("/api/public-config", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(
      `Failed to load public config: HTTP ${res.status} :${text}`
    )
  }

  const json = (await res.json())
  const config: PublicConfig = PublicConfigSchema.parse(json)
  return config
}

async function bootstrap() {
  try {
    const config = await fetchPublicConfig()
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: config.cognito_user_pool_id,
          userPoolClientId: config.cognito_user_pool_client_id,
        },
      },
    })

    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <Authenticator loginMechanisms={['email']}>
          {({ signOut }) => <App onSignOut={() => signOut?.()} />}
        </Authenticator>
      </StrictMode>,
    )
  } catch (e) {
    alert(e)
  }
}

bootstrap()