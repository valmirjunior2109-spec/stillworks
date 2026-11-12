// A tiny app with signup, login and checkout, for trying stillworks and for its tests.
//   node examples/demo-app/server.mjs                 everything works
//   node examples/demo-app/server.mjs --break=signup  the kind of bug an AI agent ships: the signup API
//                                                     was "refactored" to read `emailAddress`, the form
//                                                     still sends `email`, and signup silently stops working.
// PORT=4173 by default; PORT=0 picks a free port. Prints "demo app ready on <url>" when listening.
import { createServer } from "node:http";

const broken = new Set(process.argv.filter((a) => a.startsWith("--break=")).flatMap((a) => a.slice(8).split(",")));
const users = new Map([["demo@example.com", "demo-password"]]);

const page = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Demo SaaS</title>
<style>
  body { font: 16px/1.5 system-ui, sans-serif; background: #0d0b12; color: #f2d7a0; margin: 0; display: grid; place-items: center; min-height: 100vh; }
  main { width: min(360px, 90vw); background: #17131f; border: 2px solid #9147ff; padding: 28px; box-shadow: 6px 6px 0 #9147ff; }
  h1 { margin: 0 0 16px; font-size: 24px; } label { display: block; margin: 12px 0 4px; font-size: 14px; }
  input { width: 100%; box-sizing: border-box; padding: 10px; background: #0d0b12; color: #f2d7a0; border: 1px solid #5a4a78; font: inherit; }
  button { margin-top: 18px; width: 100%; padding: 12px; background: #9147ff; color: #fff; border: 0; font: 600 16px system-ui; cursor: pointer; }
  nav a { color: #c18aff; margin-right: 12px; } p.note { color: #a99bc4; font-size: 14px; }
</style></head><body><main>${body}</main></body></html>`;

const form = (id, title, fields, button, endpoint, onSuccess) => page(title, `
<h1>${title}</h1>
<form id="${id}">
  ${fields.map(([label, name, type]) => `<label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" required>`).join("\n  ")}
  <button type="submit">${button}</button>
</form>
<script>
  document.getElementById("${id}").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    const res = await fetch("${endpoint}", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    if (!res.ok) { console.error("${title} failed:", res.status, await res.text()); return; }
    const json = await res.json();
    document.querySelector("main").innerHTML = ${onSuccess};
  });
</script>`);

const routes = {
  "GET /": () => page("Home", `<h1>Demo SaaS</h1><nav><a href="/signup">Sign up</a><a href="/login">Log in</a><a href="/checkout">Pricing</a></nav>
    <p class="note">A demo app for stillworks. Start it with --break=signup to see a broken journey.</p>`),
  "GET /signup": () => form("signup", "Create your account", [["Email", "email", "email"], ["Password", "password", "password"]], "Create account", "/api/signup",
    "`<h1>Welcome, ${json.email}!</h1><p class='note'>Your account is ready.</p>`"),
  "GET /login": () => form("login", "Log in", [["Email", "email", "email"], ["Password", "password", "password"]], "Log in", "/api/login",
    "`<h1>Dashboard</h1><p class='note'>Signed in as ${json.email}.</p>`"),
  "GET /checkout": () => form("checkout", "Pro plan · $19/month", [["Card number", "card", "text"]], "Pay $19", "/api/checkout",
    "`<h1>Payment successful</h1><p class='note'>Receipt ${json.receipt}.</p>`"),
  "POST /api/signup": (body) => {
    // The "refactor": the handler now reads `emailAddress`, but the form still sends `email`.
    const email = broken.has("signup") ? body.emailAddress.toLowerCase() : String(body.email).toLowerCase();
    if (users.has(email)) return [409, { error: "That email is already registered." }];
    users.set(email, body.password);
    return [201, { email }];
  },
  "POST /api/login": (body) => {
    const email = String(body.email).toLowerCase();
    if (broken.has("login") || users.get(email) !== body.password) return [401, { error: "Wrong email or password." }];
    return [200, { email }];
  },
  "POST /api/checkout": (body) => {
    if (broken.has("checkout") || String(body.card).replace(/\s/g, "") !== "4242424242424242") return [402, { error: "Card declined." }];
    return [200, { receipt: `R-${Date.now().toString(36)}` }];
  },
};

const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  const handler = routes[`${req.method} ${path}`];
  if (!handler) {
    res.writeHead(404, { "content-type": "text/plain" });
    return res.end("Not found");
  }
  try {
    if (req.method === "GET") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(handler());
    }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const [status, json] = handler(JSON.parse(raw || "{}"));
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(json));
  } catch (error) {
    console.error(`${req.method} ${path} crashed:`, error);
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: `${error.name}: ${error.message}` }));
  }
});

server.listen(Number(process.env.PORT ?? 4173), "127.0.0.1", () => {
  const { port } = server.address();
  console.log(`demo app ready on http://127.0.0.1:${port}${broken.size ? ` (broken: ${[...broken].join(", ")})` : ""}`);
});
