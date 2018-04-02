#!/usr/bin/env bash

docker run -it --rm \
    -v "$PWD":/app \
    -w /app \
    --env NODE_ENV=test \
    --env REDIS_HOST=redis \
    --env NO_UPDATE_NOTIFIER=true \
    --env SPAWN_WRAP_SHIM_ROOT=/tmp \
    --init \
    --user $(id -u):$(id -g) \
    --network test-net \
    -p 8080:8080 \
    node:9.9.0-alpine \
    npx iamtest -c html --web 8080 $@
