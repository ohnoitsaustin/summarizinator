import { Amplify } from 'aws-amplify'

const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID as string
const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID as string
const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN as string
const origin = window.location.origin

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId,
      userPoolClientId,
      loginWith: {
        oauth: {
          domain: cognitoDomain,
          scopes: ['email', 'profile', 'openid'],
          redirectSignIn: [origin + '/auth/callback'],
          redirectSignOut: [origin],
          responseType: 'code',
        },
        email: true,
      },
    },
  },
})
