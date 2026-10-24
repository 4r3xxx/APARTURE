# Deploying to Vercel

This repository uses Vercel Services to deploy the Next.js client and Socket.IO signaling server under one origin. Redis stores room membership and coordinates Socket.IO broadcasts across function instances.

## One-time Vercel setup

1. Import `4r3xxx/APARTURE` into Vercel.
2. In the project settings, choose **Services** as the framework. Services is currently a Vercel beta feature.
3. Add a Redis integration from the Vercel Marketplace and make sure its connection URL is exposed to the project as `REDIS_URL` for production and preview deployments.
4. Deploy the `main` branch. `vercel.json` routes the site to the `web` service and `/server/*` to the Socket.IO service.

The app uses the same deployment origin for the site and signaling server. No production `NEXT_PUBLIC_SIGNALING_URL` or `CLIENT_ORIGIN` is needed. The client uses `/server/socket.io`; Redis is required so booth creation, joining, and ready status work when Vercel assigns connections to different instances.

## CLI deployment

From the repository root, link the repository to the Vercel project and deploy:

```sh
vercel link
vercel --prod
```

For local development, the existing `client/.env.local` and `server/.env` files can keep pointing to `http://localhost:4000`. The checked-in `.env.example` files contain only non-secret defaults.
