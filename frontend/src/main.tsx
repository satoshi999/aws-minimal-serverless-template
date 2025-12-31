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
      loginWith: {
        oauth: {
          domain: import.meta.env.VITE_COGNITO_DOMAIN,               // xxx.auth.ap-northeast-1.amazoncognito.com
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: [import.meta.env.VITE_REDIRECT_SIGNIN],    // 例: http://localhost:5173/
          redirectSignOut: [import.meta.env.VITE_REDIRECT_SIGNOUT],  // 同上
          responseType: 'code',
        },
      },
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Authenticator loginMechanisms={['email']} socialProviders={['google']}>
      {({ signOut }) => <App onSignOut={() => signOut?.()} />}
    </Authenticator>
  </StrictMode>,
)
