# Fix blank page on /inventory, /listings, and other routes (Render)

When you open direct URLs like `https://ecoloop-frontend-dab6.onrender.com/inventory` or `/listings`, the server looks for a file at that path. For a single-page app (SPA) there is only `index.html`, so you get a blank or 404 page unless the server is told to serve `index.html` for those paths.

## Option A: Add rewrite in Render Dashboard (fastest)

1. Open [Render Dashboard](https://dashboard.render.com/) and select your **ecoloop-frontend** static site.
2. Go to **Settings** → **Redirects/Rewrites** (or the **Redirects** tab).
3. Add a **Rewrite** rule:
   - **Source Path:** `/*`
   - **Destination Path:** `/index.html`
   - **Action:** **Rewrite** (not Redirect)
4. Save. Redeploy if needed.

After this, visiting `/inventory`, `/listings`, `/seller/create-listing/review`, or any other app route will serve `index.html`, and React Router will show the correct page.

## Option B: Use `render.yaml` (Blueprint)

This repo includes a `render.yaml` that defines the same rewrite. If you deploy via **Blueprint** (Infrastructure as Code), the rewrite is applied automatically. If you created the static site manually in the Dashboard, you can either switch to a Blueprint deploy or use Option A above.
