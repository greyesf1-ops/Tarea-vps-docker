# Despliegue en VPS con Docker Compose

Este proyecto queda listo para desplegarse con este flujo:

1. agregar una SSH Deployment Key al repo en GitHub
2. clonar el repo en la VPS
3. crear `.env`
4. ejecutar `docker compose up -d --build`
5. acceder por HTTPS con Let's Encrypt

## Requisitos previos

- VPS Linux con Docker y Docker Compose plugin instalados
- dominio o subdominio apuntando a la IP publica de la VPS
- puertos `80` y `443` abiertos en firewall

## 1. Agregar la deployment key

En tu VPS genera una llave SSH dedicada:

```bash
ssh-keygen -t ed25519 -C "deploy-key-support-intake" -f ~/.ssh/support_intake_deploy_key
```

Muestra la publica:

```bash
cat ~/.ssh/support_intake_deploy_key.pub
```

En GitHub:

- entra al repositorio
- `Settings`
- `Deploy keys`
- `Add deploy key`
- pega la clave publica
- habilita escritura solo si de verdad la necesitas

Crea o edita `~/.ssh/config`:

```sshconfig
Host github-support-intake
  HostName github.com
  User git
  IdentityFile ~/.ssh/support_intake_deploy_key
  IdentitiesOnly yes
```

## 2. Clonar el repo

```bash
git clone git@github-support-intake:TU_USUARIO/TU_REPO.git
cd TU_REPO
```

## 3. Crear el archivo `.env`

```bash
cp .env.example .env
```

Edita `.env` y define al menos:

```env
DOMAIN=tu-dominio.com
LE_EMAIL=tu-correo@dominio.com
OPENAI_API_KEY=tu_api_key
OPENAI_MODEL=gpt-4.1-mini
NEXT_PUBLIC_API_URL=/api
```

## 4. Levantar la aplicacion

```bash
docker compose up -d --build
```

O usando el helper:

```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

## 5. Verificar

Logs:

```bash
docker compose logs -f
```

Estado:

```bash
docker compose ps
```

La app debe quedar disponible en:

- `https://tu-dominio.com`

La API quedara publicada detras de:

- `https://tu-dominio.com/api`

## 6. Actualizar en produccion

```bash
git pull
docker compose up -d --build
```

## Notas importantes

- Let's Encrypt necesita que el dominio ya resuelva a la VPS antes del primer arranque.
- Caddy usa el puerto `80` para validacion ACME y luego sirve HTTPS en `443`.
- Los datos persistentes quedan en `./storage`.
- Los certificados quedan persistidos en los volumenes Docker `caddy_data` y `caddy_config`.
