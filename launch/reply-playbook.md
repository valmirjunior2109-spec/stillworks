# Replying where people are already stuck

Launch posts ("Show HN", "I built…") brought no one. People with a broken app do read replies to their own question.
So the main channel is: find someone whose AI-built app just broke, help them fix it, and mention stillworks only if
it would have caught that bug.

## Rules

1. **Fix first.** The reply has to be useful even if they never click anything. If you can't help with the bug,
   don't reply.
2. **Link last, and only when it fits.** One link, at the end, only if stillworks would have caught this exact bug.
   No link in at least half of the replies. Never in a sub whose rules forbid it.
3. **Say it's yours.** "a small open source tool I maintain". Never pretend to be a happy user.
4. **Never expose their app.** Don't post screenshots, URLs or results of someone else's app. If you offer to check
   it, do it in private and only with their permission.
5. **Answer as Valmir**, not as "the Publishub team". Come back to the thread the next day.
6. Track it: one line per reply in a spreadsheet (date, link, bug type, link included y/n, they replied y/n).

Goal: 3 good replies a day, every day, for two weeks. Then check which kind of bug and which place brought visits
(UTM `utm_source=reddit_reply`, `discord_reply`, …) in /admin.

## Where to look

| Place | Search |
| --- | --- |
| Reddit: r/lovable, r/boltnewbuilders, r/cursor, r/ClaudeAI, r/vibecoding, r/Supabase, r/nextjs | "signup not working", "login broken", "worked yesterday", "after the AI changed", "saved but", "RLS", "button does nothing", "stripe webhook" |
| Lovable, Bolt, Cursor and Supabase Discords | #help / #support channels, same words |
| X / Threads | "lovable broke", "cursor broke my", "claude code deleted" |
| Stack Overflow | `supabase` + `row-level-security`, `nextjs` + `middleware` + auth redirects |
| GitHub issues of templates and starters people fork | "login loop", "signup 500" |

## Bugs stillworks catches, and what to say

| What they describe | The usual cause | Mention |
| --- | --- | --- |
| "It says saved, but it's gone after reload" | Supabase RLS with no insert policy, `error` never read | the [read-the-data-back recipe](../recipes/read-the-data-back.ts) |
| "The signup button does nothing" | API renamed a field, the form still sends the old one; 500 swallowed | a signup journey; the report shows the failed request and its response |
| "Login loops back to the login page" | middleware or redirect changed by the agent | a login journey with a test account ([recipe](../recipes/login-with-test-account.ts)) |
| "A page is blank after the last change" | uncaught JavaScript error | `npx stillworks check <url>`, zero setup |
| "Works locally, broken after deploy" | env var missing in production, 5xx from the API | `check` against the deployed URL, or the hosted MCP server from Lovable/Bolt |

## Templates

Adapt every time. A reply that reads like a template gets ignored or removed.

**English, with link**

> That "Saved!" with nothing in the table is almost always RLS: the insert is rejected and supabase-js returns the
> error instead of throwing, so the toast still shows. Check `error` before the toast, and add an insert policy:
> `create policy "own rows" on public.notes for insert to authenticated with check (auth.uid() = user_id);`
> (plus one for select).
>
> To catch it next time: save, reload, check it's still there. I maintain a small open source tool that does exactly
> that in a real browser after each AI change, if it helps: https://github.com/valmirjunior2109-spec/stillworks?utm_source=reddit_reply

**English, no link**

> Look at the network tab when you click it: I'd bet `POST /api/signup` returns a 500. Agents often rename a field
> on the API side (`email` → `emailAddress`) and leave the form alone. Paste the response body to your agent and ask it
> to fix the API without touching the form.

**Português, com link**

> Esse "Salvo!" sem nada na tabela quase sempre é RLS: o insert é recusado e o supabase-js devolve o erro em vez de
> lançar, então o toast aparece mesmo assim. Leia o `error` antes do toast e crie a política de insert:
> `create policy "proprias linhas" on public.notes for insert to authenticated with check (auth.uid() = user_id);`
> (e uma de select).
>
> Para pegar da próxima vez: salvar, recarregar e ver se continua lá. Eu mantenho uma ferramenta open source que faz
> isso num navegador real depois de cada mudança da IA, se ajudar: https://github.com/valmirjunior2109-spec/stillworks?utm_source=tabnews_reply

## When someone answers "can you check mine?"

Yes, in private. Ask for the URL and which flow matters (signup, login, checkout). Run `npx stillworks check` and, if
they share a test account, a login journey. Send them the report. Then, and only then: "if you want this on every
change, I'm taking a few Founding Customers and I set up the journeys with each one" with the
`utm_source=reply_founding` link to https://getpublishub.com/#pricing.

Write what they said, word for word, in Notion → PublisHub → Evidência de usuário.
