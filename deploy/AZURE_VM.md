# Despliegue en Azure VM o VPS con SSL

Este proyecto queda preparado para desplegarse con `docker compose` en:

- una VPS Linux tradicional
- una Azure VM Linux

La terminacion HTTPS la hace Caddy con certificados automaticos de Let's Encrypt.

## 1. Crear la maquina en Azure

Recomendacion base:

- Ubuntu Server 22.04 LTS
- IP publica fija
- autenticacion por llave SSH
- puertos `80` y `443` abiertos

## 2. Configurar DNS

Apunta el registro `A` del dominio o subdominio hacia la IP publica de la VM.

Ejemplo:

- `notas.midominio.com -> 20.x.x.x`

Sin DNS correcto, Let's Encrypt no podra emitir el certificado.

## 3. Preparar la VM

Instala Docker y el plugin de Compose:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER
```

Despues vuelve a iniciar sesion SSH.

## 4. Subir el proyecto

Clona el repositorio o copia el proyecto a la VM:

```bash
git clone <tu-repo>
cd "<tu-carpeta>"
```

## 5. Crear el archivo de entorno para produccion

```bash
cp .env.docker.example .env.docker
```

Ajusta al menos:

```bash
DOMAIN=notas.midominio.com
LE_EMAIL=tu-correo@dominio.com
NEXT_PUBLIC_API_URL=/api
```

## 6. Levantar el stack

```bash
docker compose --env-file .env.docker up -d --build
```

## 7. Ver logs

```bash
docker compose --env-file .env.docker logs -f
```

## 8. Actualizar despliegue

```bash
git pull
docker compose --env-file .env.docker up -d --build
```

## Notas para Azure

- Si usas Azure VM, abre `80` y `443` tambien en el Network Security Group.
- Si quieres una ruta mas administrada que Docker Compose, Azure Container Apps suele ser mejor opcion para nuevos despliegues.
- Para este proyecto, `docker compose` encaja mejor en Azure VM que en Azure App Service multi-container.
