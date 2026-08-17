# Deployment research notes

## Netlify
Official source: https://docs.netlify.com/build/environment-variables/overview/

Netlify supports site and shared environment variables, scopes, deploy-context values, UI/CLI/API configuration, and secret marking through its Secrets Controller. Site variables can override shared variables. Production and preview contexts can use separate values. Production secrets such as DATABASE_URL, JWT/auth secrets, Resend keys, Twilio tokens, and license-server secrets must be configured in Netlify’s environment-variable UI or secret management, never in frontend source or netlify.toml.

## Vercel
Official source: https://vercel.com/docs/environment-variables

Vercel environment variables are configured outside source code, encrypted at rest, and available during the build step or function execution. They can be separated by environment such as Development, Preview, and Production. Changes apply to new deployments, so a deployment must be redeployed after changing DATABASE_URL or secrets. Server-only values such as DATABASE_URL, auth secrets, provider credentials, and license-server secrets must not use client-exposed VITE variables.

## cPanel Application Manager
Official source: https://docs.cpanel.net/cpanel/software/application-manager/

cPanel Application Manager registers a Node.js app with an application name, deployment domain, base URL, source path, and Development or Production environment. Environment variables can be added through the application’s Environment Variables section, provided the hosting provider has the required Apache environment module. Values are entered as variable name/value pairs and saved in the application configuration. This is the appropriate place for DATABASE_URL, auth secrets, provider keys, and license-server secrets; do not commit them into the uploaded project files.
