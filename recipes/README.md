# Recipes

Journeys for the bugs that slip past a green build. Each file runs as is against the [demo app](../examples/demo-app/server.mjs), so you can see it pass and fail before adapting it.

| Recipe | Catches | Try it |
| --- | --- | --- |
| [read-the-data-back.ts](read-the-data-back.ts) | A form that says "Saved!" while nothing was saved, e.g. a **Supabase insert blocked by row-level security (RLS)** whose error the code never reads | `node examples/demo-app/server.mjs --break=save` |
| [login-with-test-account.ts](login-with-test-account.ts) | A broken login, using a test account from environment variables (never a real password in the file) | `node examples/demo-app/server.mjs` |

Then:

```sh
npx stillworks run --url http://127.0.0.1:4173 --config recipes/read-the-data-back.ts
```

Want a recipe for your stack (Clerk, Stripe Checkout in test mode, magic links)? [Open a journey request](https://github.com/valmirjunior2109-spec/stillworks/issues/new?template=journey_request.yml).
