# TabNews: "Disse 'Salvo!'. Não salvou nada." (Supabase RLS)

Versão em português do [post do RLS](supabase-rls-post.md), para o TabNews (e LinkedIn em PT). Mesma regra: primeiro
a solução, a ferramenta aparece uma vez no fim.

---

**Título:** Seu formulário com Supabase diz "Salvo!" e não salvou nada. Por que apps feitos com IA fazem isso

Você pede para o agente uma página de anotações. Ele escreve o formulário, o insert e um toast bonito de "Salvo!". Você
testa, vê o toast e segue. Dois dias depois um usuário escreve: "minhas anotações somem quando eu recarrego".

Nada quebrou. Nenhum erro no console. Build verde. O toast só dizia a verdade sobre uma coisa: o botão foi clicado.

## O que aconteceu

O `supabase-js` não lança exceção quando a escrita falha. Ele devolve o erro:

```ts
const { error } = await supabase.from("notes").insert({ body });
toast("Salvo!"); // roda com ou sem `error`
```

E o motivo mais comum da falha num projeto novo é o **RLS (row-level security)**. A tabela está com RLS ligado, o que
está certo, mas ainda não existe política de `insert` para o usuário logado. O banco recusa a linha, o código nunca lê
`error` e a tela diz "Salvo!".

Agentes escrevem esse padrão o tempo todo porque ele parece completo: compila, passa no TypeScript e o caminho feliz
"funciona" numa olhada rápida.

## A correção

1. Leia o erro, sempre:

   ```ts
   const { error } = await supabase.from("notes").insert({ body });
   if (error) {
     toast.error("Não deu para salvar sua anotação");
     console.error(error);
     return;
   }
   toast("Salvo!");
   ```

2. Crie a política que falta. Para "cada usuário grava as próprias linhas":

   ```sql
   create policy "Usuário insere as próprias notas"
   on public.notes for insert
   to authenticated
   with check (auth.uid() = user_id);
   ```

   Faça o mesmo para `select`, senão o próximo bug é "salvei e não consigo ver".

3. Garanta que o insert manda `user_id` (ou que a coluna tem `default auth.uid()`).

## Como pegar isso antes do usuário

Print não pega: o toast está lá. Status 200 também pode não pegar. O que pega é fazer o que o usuário faz:
**salvar, recarregar e procurar o que foi salvo.**

São três passos num navegador real. Eu mantenho uma CLI open source,
[stillworks](https://github.com/valmirjunior2109-spec/stillworks?utm_source=tabnews_rls), que já traz exatamente esse
teste como receita:

```sh
npx stillworks install
npx stillworks run --url http://localhost:3000 --config read-the-data-back.ts
```

Quando falha, ela escreve um relatório para colar no Claude Code ou no Cursor: o passo que falhou, os erros do console,
as requisições que falharam com a resposta do servidor e um print. A receita está
[aqui](https://github.com/valmirjunior2109-spec/stillworks/blob/main/recipes/read-the-data-back.ts).

Se você constrói no Lovable ou no Bolt e não usa terminal, a mesma ferramenta roda como servidor MCP que o agente
chama, e tem um [check online grátis](https://getpublishub.com/check?utm_source=tabnews_rls) das páginas públicas.

## A regra geral

Quando o agente fizer uma escrita no banco, peça duas coisas: **tratar o erro** e **provar lendo o dado de volta**.
"Salvo!" é estado da tela, não do banco.
