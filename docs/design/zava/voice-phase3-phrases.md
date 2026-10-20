# Zava Phase 3 — supported voice phrases (staging)

Deterministic router only — unknown phrases are **never** sent to the LLM.

| Phrase (examples) | Action |
|---|---|
| what are the updates / updates / what's the update | Speak cards one by one; highlight planet + speaking card |
| next / skip | Next card |
| repeat | Repeat current card |
| stop / mute | Stop speaking immediately |
| what are the vans doing / vans / show me the vans | Open `/agent/ops-map`; speak moving/stopped/offline counts |
| open \<module\> / go to \<module\> | Open Sales, Collections, Purchase, Inventory, Delivery, Finance, Expenses, Payroll, Reports, AI |
| go back / nexus / home | Open `/agent/nexus` |
| tell me about \<customer\> | Balance from `ar-summary` (same as customer page). 0 or 2+ matches → disambiguate, never guess |
| *(anything else)* | "I didn't catch that." + 4 suggestion chips |

**Safety:** open pages / read / speak only. No create, post, approve, send, or delete.
