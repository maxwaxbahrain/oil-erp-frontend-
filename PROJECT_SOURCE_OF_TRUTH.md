# Oil ERP — single source of truth (frontend + backend)

**Use only the paths below for every code change, update, or deployment.**  
Future edits should reference this file so the app stays consistent and deployable to your domain.

---

## Canonical paths (authoritative)

| Role | Absolute path on disk |
|------|------------------------|
| **Frontend** (Vite + React) | `/Users/abdulqadeer/Desktop/desktop/screen shot /oil-erp-frontend` |
| **Backend** (FastAPI) | `/Users/abdulqadeer/Desktop/desktop/oil-erp-backend` |
| **Workspace file** (Cursor / VS Code: backend + frontend folders) | `/Users/abdulqadeer/Desktop/desktop/screen shot /oil-erp-frontend/zavi_erp_python.code-workspace` |

Do **not** treat other copies of `oil-erp-frontend` or alternate backends as the source unless this file is updated.

---

## Quick open (local “link”)

You can open this document directly:

- **Finder:** Go to folder  
  `Desktop` → `desktop` → `screen shot ` → `oil-erp-frontend` → **`PROJECT_SOURCE_OF_TRUTH.md`**
- **Browser / OS file URL:**  
  `file:///Users/abdulqadeer/Desktop/desktop/screen%20shot%20/oil-erp-frontend/PROJECT_SOURCE_OF_TRUTH.md`

---

## Local development (what to run)

**Terminal 1 — API (from backend path):**

```bash
cd "/Users/abdulqadeer/Desktop/desktop/oil-erp-backend"
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API docs: `http://127.0.0.1:8000/docs`
- Customers list: `http://127.0.0.1:8000/api/customers/`

**Terminal 2 — UI (from frontend path):**

```bash
cd "/Users/abdulqadeer/Desktop/desktop/screen shot /oil-erp-frontend"
npm run dev
```

- App: `http://localhost:5174` (port is set in `vite.config.ts`; if it fails, use the port Vite prints)

---

## Environment / API base (important for your domain)

- **Local dev:** Frontend uses same-origin `/api` with Vite proxy → FastAPI `:8000`. See `src/config/apiBase.ts` and `vite.config.ts`.
- **Production on your domain:** Build the frontend with **`VITE_API_BASE_URL`** pointing at your public API, e.g.  
  `https://api.yourdomain.com/api`  
  (must match how your FastAPI is mounted and HTTPS/CORS are configured).

Backend `.env` in **`oil-erp-backend`** controls **`DATABASE_URL`** (SQLite path). Use the correct server working directory or an absolute DB path in production.

---

## “Software complete” checklist (before pointing your domain)

Use this as your completion gate:

1. [ ] All changes live only under the two canonical paths in the table above.
2. [ ] `npm run build` succeeds in **`oil-erp-frontend`**.
3. [ ] Backend runs with production settings (no debug secrets; secure `SECRET_KEY`; DB backup).
4. [ ] `VITE_API_BASE_URL` set for production build; HTTPS API URL tested from the deployed site.
5. [ ] CORS on FastAPI allows your **frontend origin** (your domain), not only `*`, if you use cookies later.
6. [ ] Smoke test: login-critical flows + **Customers** + **Products** + one sales flow on the live URL.

**Release marker:** Bump a version string you track (e.g. footer in the app or `package.json` / API title) when this checklist passes.

---

## Instruction for assistants / future sessions

When the user asks for changes or updates:

1. Edit files **only** under  
   `.../oil-erp-frontend` or  
   `.../oil-erp-backend`.
2. Re-read this file if paths ever move; update **this file** if canonical locations change.

---

*Last created for unified frontend/backend workflow and domain deployment planning.*
