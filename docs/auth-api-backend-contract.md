# Auth API – backend contract for login

So that the **Network tab shows the right status** and the **correct response is visible**:

## POST /api/v1/auth/login

### 1. Correct credentials → success (200)

- **Status:** `200 OK`
- **Body:** `{ "message": "Login successful", "token": "<jwt>", "user": { "id", "name", "email", "userType": "buyer"|"seller", "username", "createdAt", "updatedAt" } }`
- **CORS:** Send `Access-Control-Allow-Origin: <frontend-origin>` (e.g. your Render frontend URL or `http://localhost:5173`) so the browser allows the frontend to read the response. Without this, the Network tab may show 200 but the app cannot read the body.

### 2. Wrong credentials → failure (401)

- **Status:** `401 Unauthorized` (do **not** return 200)
- **Body:** e.g. `{ "error": "Invalid email or password" }`

Then failed login attempts show as **401** in the Network tab (red/failed), and only successful logins show as **200** (success).
