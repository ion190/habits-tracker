# REST API Lab 7 Implementation

## Status: In Progress ✅

✅ **1.** Create TODO-REST-API.md with steps  
⏳ **2.** Create backend/package.json (Express + deps)  
⏳ **3.** Create backend/types.ts (data models from frontend)  
⏳ **4.** Create backend/server.ts (REST routes, JWT, pagination, proper codes)  
⏳ **5.** Create backend/openapi.yaml (API spec)  
⏳ **6.** `cd backend && npm install`  
⏳ **7.** Test server: `cd backend && npm run dev` (port 3001)  
⏳ **8.** Verify curl tests (habits list/create, /token, pagination, expiry)  
⏳ **9.** Test Swagger: http://localhost:3001/api-docs  
✅ **10.** attempt_completion

**Principles Applied:**
- Nouns: /habits, /tasks (no verbs)
- Verbs: GET/POST/PUT/PATCH/DELETE
- Status: 201/204/400/401/403/404/409
- Pagination: ?limit=10&amp;offset=0 + metadata
- JWT: exp=60s, Bearer auth
- Naming: lowercase plural hyphens
- No deep nesting

