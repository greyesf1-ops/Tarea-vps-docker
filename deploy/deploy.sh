#!/usr/bin/env sh
set -eu

if [ ! -f .env ]; then
  echo "Falta el archivo .env en la raiz del proyecto."
  echo "Puedes crearlo con: cp .env.example .env"
  exit 1
fi

docker compose up -d --build
