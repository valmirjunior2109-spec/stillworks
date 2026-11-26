# Post: "It said Saved. Nothing was saved." (Supabase RLS)

For dev.to, Hashnode, Medium and the blog on getpublishub.com. A shorter version for Reddit is at the bottom.
It teaches the fix first; stillworks shows up once, as the way to catch it next time. Use the UTM links as written.

Tags (dev.to): `supabase`, `webdev`, `ai`, `testing`

---

**Title:** Your Supabase form says "Saved!" and nothing was saved. Here's why AI-built apps do this.

You ask your agent for a "notes" page. It writes the form, the insert, a nice "Saved!" toast. You try it, see the toast,
move on. Two days later a user writes: "my notes disappear when I reload."

Nothing crashed. No error in the console. The build is green. The toast was telling the truth about one thing only:
the button was clicked.

## What happened

`supabase-js` doesn't throw when a write fails. It returns the error:

```ts
const { error } = await supabase.from("notes").insert({ body });
toast("Saved!"); // runs whether or not `error` is set
```

And the most common reason the write fails in a new project is **row-level security (RLS)**. You (or your agent)
turned RLS on for the table, which is right, but there's no `insert` policy for the logged-in user yet. The database
refuses the row, the code never reads `error`, and the UI says "Saved!".

Agents write this pattern all the time because it looks complete: it compiles, it type-checks, and the happy path
"works" in a quick look.

## The fix

1. Check the error, every time:

   ```ts
   const { error } = await supabase.from("notes").insert({ body });
   if (error) {
     toast.error("Couldn't save your note");
     console.error(error);
     return;
   }
   toast("Saved!");
   ```

2. Add the policy the table is missing. For "each user writes their own rows":

   ```sql
   create policy "Users insert their own notes"
   on public.notes for insert
   to authenticated
   with check (auth.uid() = user_id);
   ```

   Do the same for `select`, or the next bug is "I saved it and I can't see it."

3. Make sure the insert sends `user_id` (or that the column defaults to `auth.uid()`).

## How to catch it before a user does

A screenshot won't catch it: the toast is right there. A 200 response won't either: depending on how you call it,
the request itself can look fine. What catches it is what a user does: **save, reload, look for the thing you saved.**

That's a three-line browser test, and you don't need to write a test suite for it. I maintain an open source CLI,
[stillworks](https://github.com/valmirjunior2109-spec/stillworks?utm_source=devto_rls), that ships this exact check as a
recipe:

```ts
{ name: "Save it", run: ({ page }) => page.getByRole("button", { name: /save/i }).click() },
{ name: "See the success message", run: ({ page }) => page.getByText(/saved/i).first().waitFor() },
{ name: "Reload the page", run: ({ page }) => page.reload() },
{ name: "See the note after reloading", run: ({ page }) => page.getByText(note).waitFor() },
```

```sh
npx stillworks install
npx stillworks run --url http://localhost:3000 --config read-the-data-back.ts
```

When it fails, it writes a report you paste back into Claude Code or Cursor: the step that failed, the console errors,
the failed requests with the server's response, and a screenshot. The recipe is
[here](https://github.com/valmirjunior2109-spec/stillworks/blob/main/recipes/read-the-data-back.ts).

If you build in Lovable or Bolt: connect the project to GitHub and the same check runs on every deploy with the
stillworks GitHub Action. There's also a [free online check](https://getpublishub.com/check?utm_source=devto_rls) for public pages.

## The general rule

When an agent builds a write, ask it for two things: **handle the error** and **prove it by reading the data back.**
"Saved!" is a UI state, not a database state.

---

## Reddit version (r/Supabase, r/lovable, r/vibecoding)

Read each subreddit's rules on self-promotion first. Lead with the fix; the link is optional and goes last.

**Title:** PSA: if your Supabase form says "Saved!" but the data is gone after reload, it's probably RLS + an unchecked `error`

> supabase-js returns errors instead of throwing, so `await supabase.from("x").insert(...)` followed by a success
> toast shows "Saved!" even when RLS rejected the row. AI agents write this pattern a lot.
>
> Fix: check `error` before showing success, and add an insert policy, e.g.
> `create policy "own rows" on public.notes for insert to authenticated with check (auth.uid() = user_id);`
> (and a select one, or you won't see your rows).
>
> To catch it next time: save, reload the page, check the thing is still there. I wrote that up as a free recipe in a
> small open source tool I maintain (stillworks), happy to share if useful, but the two fixes above are what matter.
