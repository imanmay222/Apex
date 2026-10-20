#!/bin/bash
# Runs once, on first start with an empty data volume (official mongo image convention).
# Creates a least-privilege user for the app so it never connects as root.
set -euo pipefail

mongosh --quiet \
  -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin \
  --eval "
    const appDb = db.getSiblingDB('${MONGO_APP_DB}');
    appDb.createUser({
      user: '${MONGO_APP_USER}',
      pwd: '${MONGO_APP_PASSWORD}',
      roles: [{ role: 'readWrite', db: '${MONGO_APP_DB}' }],
    });
  "
echo "created app user '${MONGO_APP_USER}' on database '${MONGO_APP_DB}'"
