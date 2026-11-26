// A tiny app with signup, login, checkout, notes and a team page, for trying stillworks and for its tests.
//   node examples/demo-app/server.mjs                 everything works
//   node examples/demo-app/server.mjs --break=signup  the kind of bug an AI agent ships: the signup API
//                                                     was "refactored" to read `emailAddress`, the form
//                                                     still sends `email`, and signup silently stops working.
//   node examples/demo-app/server.mjs --break=save    the notes API answers 200 but stores nothing, like a
//                                                     Supabase insert blocked by row-level security whose
//                                                     error the code never reads. The "Saved" toast still shows.
//   node examples/demo-app/server.mjs --break=pages   what `stillworks check` finds with no setup: a "Docs" link to a page
//                                                     that doesn't exist, a JavaScript crash on /notes and a 500
//                                                     from the API /checkout calls when it loads.
//   node examples/demo-app/server.mjs --break=invite  inviting a teammate answers 200 and says "Invite sent", but
//                                                     the invite is never stored, like a roles check that quietly
//                                                     filters the insert away. The pending invite never shows up.
// PORT=4173 by default; PORT=0 picks a free port. Prints "demo app ready on <url>" when listening.
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

const broken = new Set(process.argv.filter((a) => a.startsWith("--break=")).flatMap((a) => a.slice(8).split(",")));
const users = new Map([["demo@example.com", "demo-password"]]);
const notes = [];
const invites = [];
const sessions = new Map();
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

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
  "GET /": () => page("Home", `<h1>Demo SaaS</h1><nav><a href="/signup">Sign up</a><a href="/login">Log in</a><a href="/checkout">Pricing</a><a href="/notes">Notes</a>${broken.has("pages") ? `<a href="/docs">Docs</a>` : ""}</nav>
    <p class="note">A demo app for stillworks. Start it with --break=signup to see a broken journey.</p>`),
  "GET /signup": () => form("signup", "Create your account", [["Email", "email", "email"], ["Password", "password", "password"]], "Create account", "/api/signup",
    "`<h1>Welcome, ${json.email}!</h1><p class='note'>Your account is ready.</p>`"),
  "GET /login": () => form("login", "Log in", [["Email", "email", "email"], ["Password", "password", "password"]], "Log in", "/api/login",
    "`<h1>Dashboard</h1><p class='note'>Signed in as ${json.email}.</p><nav><a href='/team'>Team</a></nav>`"),
  // Only for people who are logged in: the session cookie is set by /api/login.
  "GET /team": (_body, user) => user ? page("Team", `<h1>Team members</h1>
<ul id="members">
  <li>${escapeHtml(user)} · Owner</li>
  ${invites.map((email) => `<li>${escapeHtml(email)} · Invite pending</li>`).join("\n  ")}
</ul>
<form id="invite-form">
  <label for="email">Email</label><input id="email" name="email" type="email" required>
  <button type="submit">Send invite</button>
</form>
<p id="status" class="note" role="status"></p>
<script>
  document.getElementById("invite-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = new FormData(event.target).get("email");
    const res = await fetch("/api/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    if (res.ok) document.getElementById("status").textContent = "Invite sent to " + email + ".";
  });
</script>`) : page("Team", `<h1>Team members</h1><p class="note">Log in to see your team. <a href="/login">Log in</a></p>`),
  "GET /checkout": () =>
    form("checkout", "Pro plan · $19/month", [["Card number", "card", "text"]], "Pay $19", "/api/checkout",
      "`<h1>Payment successful</h1><p class='note'>Receipt ${json.receipt}.</p>`").replace(
      "</body>",
      // the page asks the API for the plan when it loads (a 500 with --break=pages)
      `<script>fetch("/api/plan", { method: "POST" });</script></body>`,
    ),
  "GET /notes": () => page("Notes", `<h1>Notes</h1>
<form id="notes-form">
  <label for="text">Note</label><input id="text" name="text" type="text" required>
  <button type="submit">Save note</button>
</form>
<p id="status" class="note" role="status"></p>
<ul id="notes">${notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>
${broken.has("pages") ? "<script>window.editor.mount('#notes');</script>" : ""}
<script>
  document.getElementById("notes-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = new FormData(event.target).get("text");
    const res = await fetch("/api/notes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
    // Like most AI-written Supabase code: the response is never checked for a real write.
    if (res.ok) document.getElementById("status").textContent = "Saved!";
  });
</script>`),
  "POST /api/plan": () => {
    if (broken.has("pages")) throw new TypeError("Cannot read properties of undefined (reading 'price')");
    return [200, { plan: "pro", price: 19 }];
  },
  "POST /api/notes": (body) => {
    // The bug: the write is rejected (think row-level security), but the handler still answers 200.
    if (!broken.has("save")) notes.push(String(body.text ?? ""));
    return [200, { saved: true }];
  },
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
    const token = randomUUID();
    sessions.set(token, email);
    return [200, { email }, { "set-cookie": `session=${token}; Path=/; HttpOnly; SameSite=Lax` }];
  },
  "POST /api/invites": (body, user) => {
    if (!user) return [401, { error: "Log in first." }];
    const email = String(body.email ?? "").toLowerCase();
    // The bug: the invite is filtered away (think a roles check that matches no rows), but the handler still answers 200.
    if (!broken.has("invite") && !invites.includes(email)) invites.push(email);
    return [200, { invited: email }];
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
  const token = /(?:^|;\s*)session=([^;]+)/.exec(req.headers.cookie ?? "")?.[1];
  const user = sessions.get(token);
  try {
    if (req.method === "GET") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(handler({}, user));
    }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const [status, json, headers = {}] = handler(JSON.parse(raw || "{}"), user);
    res.writeHead(status, { "content-type": "application/json", ...headers });
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
