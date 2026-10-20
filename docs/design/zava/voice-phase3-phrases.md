# Zava Phase 3 — supported voice phrases (staging)

Deterministic router only — unknown phrases are **never** sent to the LLM.

Wake / polite words are stripped before matching: `zava`, `hey zava`, `ok zava`, `hi zava`,
`please`, `can you`, `could you`, trailing `please`, fillers `um` / `uh`.
Examples that still work: “Zava, what are the updates?”, “Please, what's the updates?”,
“Hey Zava, what are the vans doing?”, “Zava open collections please”,
“Can you tell me about Gamma Garage?”.

| Phrase (examples) | Action |
|---|---|
| what are the updates / updates / what's the update(s) (with or without “the”) | Speak cards one by one; highlight planet + speaking card |
| next / skip | Next card |
| repeat | Repeat current card |
| stop / mute | Stop speaking immediately |
| what are the vans doing / vans / show me the vans | Open `/agent/ops-map`; speak moving/stopped/offline counts |
| open \<module\> / go to \<module\> | Open Sales, Collections, Purchase, Inventory, Delivery, Finance, Expenses, Payroll, Reports, AI |
| go back / nexus / home | Open `/agent/nexus` |
| tell me about \<customer\> | Balance from `ar-summary` (same ledger closing as customer page). Wording: owes / owes nothing / has a credit. 0 matches → not found; 2+ → which one?; single fuzzy hit without query words in the name → “Did you mean …?” (Yes/No / voice yes/no) |
| yes / no | Only after a “Did you mean …?” confirm |
| *(anything else)* | "I didn't catch that." + 4 suggestion chips |

**Balances:** `GET /customers/ar-summary` returns **every** customer in `per_customer` (including $0). If AR loaded OK but an id is missing → treat as $0 (“owes nothing”). If AR request failed → “I couldn't load the balance.” Never “an unknown balance.”

**Safety:** open pages / read / speak only. No create, post, approve, send, or delete.
