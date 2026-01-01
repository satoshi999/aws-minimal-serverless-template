import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Amplify } from 'aws-amplify'
import { Authenticator } from '@aws-amplify/ui-react'
import './index.css'
import App from './App.tsx'
import '@aws-amplify/ui-react/styles.css'

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
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
