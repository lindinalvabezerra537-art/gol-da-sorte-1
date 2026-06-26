---
name: API Server port fix
description: Why the api-server must run on port 8081, not 8080
---

The api-server artifact was originally configured on port 8080. Replit's `.replit` file had `localPort = 8080` with NO `externalPort`, meaning restart_workflow (which verifies ports externally) always failed with DIDNT_OPEN_A_PORT even though the server started fine locally.

Port 8081 has `externalPort = 8081` in `.replit` and works correctly with restart_workflow.

**Fix applied:** Changed artifact.toml `localPort` and `PORT` env var from 8080 to 8081.

**Why:** Replit's restart_workflow verifies ports via the external proxy. Only ports with an `externalPort` mapping in `.replit` pass this check.

**How to apply:** If the api-server ever needs to be reconfigured, always use port 8081 (or another port that has an externalPort mapping in .replit). Never use port 8080 for this artifact.
