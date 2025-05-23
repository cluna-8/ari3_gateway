# COMPLETE-GATEWAY API Documentation

API Base URL: `http://141.227.128.125:3000`

## Table of Contents

- [Authentication](#authentication)
- [User Management](#user-management)
- [API Keys Management](#api-keys-management)
- [Permissions Management](#permissions-management)
- [Workflow and Nodes](#workflow-and-nodes)
- [Usage Statistics](#usage-statistics)
- [Prompt Patterns Management](#prompt-patterns-management)
- [Triage Agent](#triage-agent)
- [General API Queries](#general-api-queries)

## Authentication

### Login and get JWT token

```bash
curl -X POST "http://141.227.128.125:3000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

**Response:**

```json
{
  "message": "Login exitoso",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

**Status Codes:**
- `200 OK`: Successful login
- `400 Bad Request`: Missing username or password
- `401 Unauthorized`: Invalid credentials
- `500 Internal Server Error`: Server error

### Validate API key

```bash
curl -X GET "http://141.227.128.125:3000/auth/validate-key" \
  -H "X-API-Key: sk-test-12345abcdef"
```

**Response:**

```json
{
  "message": "API key válida",
  "user": "testuser",
  "userId": 2,
  "role": "cliente",
  "credito": 100.00,
  "permissions": [
    {
      "agente": "Asistente General",
      "modelo": "gpt-3.5-turbo"
    },
    {
      "agente": "Traductor",
      "modelo": "gpt-3.5-turbo"
    }
  ]
}
```

**Status Codes:**
- `200 OK`: Valid API key
- `401 Unauthorized`: Invalid or missing API key
- `403 Forbidden`: No credit available
- `500 Internal Server Error`: Server error

### Get API keys for authenticated user

```bash
curl -X GET "http://141.227.128.125:3000/auth/my-keys" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Response:**

```json
{
  "keys": [
    {
      "id": 1,
      "key_value": "sk-12345...",
      "nombre": "API Key Principal",
      "activo": true,
      "credito_disponible": 50.00,
      "fecha_creacion": "2025-05-19 08:30:00"
    }
  ]
}
```

**Status Codes:**
- `200 OK`: Success
- `401 Unauthorized`: Invalid or missing token
- `500 Internal Server Error`: Server error

## User Management

### List all users

```bash
curl -X GET "http://141.227.128.125:3000/admin/usuarios" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Response:**

```json
{
  "usuarios": [
    {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "activo": 1,
      "rol": "admin",
      "fecha_creacion": "2025-05-19 07:30:29"
    },
    {
      "id": 2,
      "username": "testuser",
      "email": "test@example.com",
      "activo": 1,
      "rol": "cliente",
      "fecha_creacion": "2025-05-19 08:20:15"
    }
  ]
}
```

**Status Codes:**
- `200 OK`: Success
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized (role not admin)
- `500 Internal Server Error`: Server error

### Get specific user information

```bash
curl -X GET "http://141.227.128.125:3000/admin/usuarios/2" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Response:**

```json
{
  "usuario": {
    "id": 2,
    "username": "testuser",
    "email": "test@example.com",
    "activo": 1,
    "role_id": 2,
    "rol": "cliente",
    "fecha_creacion": "2025-05-19 08:30:00"
  },
  "api_keys": [
    {
      "id": 1,
      "key_value": "sk-12345...",
      "nombre": "API Key Principal",
      "activo": 1,
      "credito_disponible": 50.00,
      "fecha_creacion": "2025-05-19 08:35:00"
    }
  ]
}
```

**Status Codes:**
- `200 OK`: Success
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `404 Not Found`: User not found
- `500 Internal Server Error`: Server error

### Create new user

```bash
curl -X POST "http://141.227.128.125:3000/admin/usuarios" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "username": "new_user",
    "password": "password123",
    "email": "new_user@example.com",
    "role_id": 2
  }'
```

**Response:**

```json
{
  "message": "Usuario creado correctamente",
  "id": 3,
  "username": "new_user",
  "email": "new_user@example.com",
  "role_id": 2
}
```

**Status Codes:**
- `201 Created`: User created successfully
- `400 Bad Request`: Incomplete data or username/email already exists
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `500 Internal Server Error`: Server error

### Update user

```bash
curl -X PUT "http://141.227.128.125:3000/admin/usuarios/2" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "username": "updated_username",
    "email": "updated_email@example.com",
    "activo": true
  }'
```

**Response:**

```json
{
  "message": "Usuario actualizado correctamente",
  "id": 2
}
```

**Status Codes:**
- `200 OK`: User updated successfully
- `400 Bad Request`: No fields to update or username/email already exists
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `404 Not Found`: User not found
- `500 Internal Server Error`: Server error

### Deactivate user (soft delete)

```bash
curl -X DELETE "http://141.227.128.125:3000/admin/usuarios/3" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Response:**

```json
{
  "message": "Usuario desactivado correctamente",
  "id": 3
}
```

**Status Codes:**
- `200 OK`: User deactivated successfully
- `400 Bad Request`: Cannot delete own user
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `404 Not Found`: User not found
- `500 Internal Server Error`: Server error

## API Keys Management

### List all API keys

```bash
curl -X GET "http://141.227.128.125:3000/admin/keys" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Response:**

```json
{
  "keys": [
    {
      "id": 1,
      "key_value": "sk-12345...",
      "nombre": "API Key Principal",
      "activo": 1,
      "credito_disponible": 100.00,
      "usuario_id": 2,
      "username": "testuser",
      "fecha_creacion": "2025-05-19 08:35:00"
    },
    {
      "id": 2,
      "key_value": "sk-67890...",
      "nombre": "API Key Secundaria",
      "activo": 1,
      "credito_disponible": 50.00,
      "usuario_id": 3,
      "username": "new_user",
      "fecha_creacion": "2025-05-20 10:15:00"
    }
  ]
}
```

**Status Codes:**
- `200 OK`: Success
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `500 Internal Server Error`: Server error

### Get specific API key

```bash
curl -X GET "http://141.227.128.125:3000/admin/keys/1" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Response:**

```json
{
  "key": {
    "id": 1,
    "key_value": "sk-12345...",
    "nombre": "API Key Principal",
    "activo": 1,
    "credito_disponible": 50.00,
    "usuario_id": 2,
    "username": "testuser",
    "fecha_creacion": "2025-05-19 08:35:00",
    "fecha_actualizacion": "2025-05-19 10:15:00"
  },
  "usos": [
    {
      "id": 1,
      "fecha": "2025-05-19 09:10:25",
      "agente": "Asistente General",
      "modelo": "gpt-3.5-turbo",
      "tokens_entrada": 12,
      "tokens_salida": 8,
      "costo_total": 0.000018
    }
  ]
}
```

**Status Codes:**
- `200 OK`: Success
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `404 Not Found`: API key not found
- `500 Internal Server Error`: Server error

### Create new API key for user

```bash
curl -X POST "http://141.227.128.125:3000/admin/usuarios/2/keys" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "nombre": "Production API Key",
    "credito_inicial": 100.00
  }'
```

**Response:**

```json
{
  "message": "API key creada correctamente",
  "id": 3,
  "key": "sk-abcdef1234567890",
  "nombre": "Production API Key",
  "credito_disponible": 100.00
}
```

**Status Codes:**
- `201 Created`: API key created successfully
- `400 Bad Request`: Missing name
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `404 Not Found`: User not found
- `500 Internal Server Error`: Server error

### Update API key

```bash
curl -X PUT "http://141.227.128.125:3000/admin/keys/2" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "nombre": "Updated Key Name",
    "activo": true
  }'
```

**Response:**

```json
{
  "message": "API key actualizada correctamente",
  "id": 2
}
```

**Status Codes:**
- `200 OK`: API key updated successfully
- `400 Bad Request`: No fields to update
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `404 Not Found`: API key not found
- `500 Internal Server Error`: Server error

### Add credit to an API key

```bash
curl -X POST "http://141.227.128.125:3000/admin/keys/2/credito" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "monto": 50.00
  }'
```

**Response:**

```json
{
  "message": "Crédito añadido correctamente",
  "id": 2,
  "monto_añadido": 50.00,
  "credito_actual": 100.00
}
```

**Status Codes:**
- `200 OK`: Credit added successfully
- `400 Bad Request`: Invalid amount
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `404 Not Found`: API key not found
- `500 Internal Server Error`: Server error

## Permissions Management

### View user permissions

```bash
curl -X GET "http://141.227.128.125:3000/admin/permisos/2" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Response:**

```json
{
  "usuario": {
    "id": 2,
    "username": "testuser"
  },
  "permisos": [
    {
      "id": 3,
      "agente_id": 1,
      "agente": "Asistente General",
      "modelo_id": 1,
      "modelo": "gpt-3.5-turbo",
      "habilitado": 1,
      "fecha_creacion": "2025-05-19 08:45:22"
    }
  ],
  "agentes_disponibles": [
    {"id": 1, "nombre": "Asistente General"},
    {"id": 2, "nombre": "Asistente Financiero"},
    {"id": 3, "nombre": "Traductor"}
  ],
  "modelos_disponibles": [
    {"id": 1, "nombre": "gpt-3.5-turbo", "proveedor": "OpenAI"},
    {"id": 2, "nombre": "gpt-4", "proveedor": "OpenAI"},
    {"id": 3, "nombre": "claude-2", "proveedor": "Anthropic"}
  ]
}
```

**Status Codes:**
- `200 OK`: Success
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `404 Not Found`: User not found
- `500 Internal Server Error`: Server error

### Assign permission

```bash
curl -X POST "http://141.227.128.125:3000/admin/permisos" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "usuario_id": 2,
    "agente_id": 1,
    "modelo_id": 1,
    "habilitado": true
  }'
```

**Response:**

```json
{
  "message": "Permiso asignado correctamente",
  "usuario_id": 2,
  "agente_id": 1,
  "modelo_id": 1,
  "habilitado": true
}
```

**Status Codes:**
- `201 Created`: Permission assigned successfully
- `400 Bad Request`: Incomplete data
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `404 Not Found`: User, agent, or model not found
- `500 Internal Server Error`: Server error

### Delete permission

```bash
curl -X DELETE "http://141.227.128.125:3000/admin/permisos/5" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Response:**

```json
{
  "message": "Permiso eliminado correctamente",
  "id": 5
}
```

**Status Codes:**
- `200 OK`: Permission deleted successfully
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `404 Not Found`: Permission not found
- `500 Internal Server Error`: Server error

### Create client permissions based on workflow

```bash
curl -X POST "http://141.227.128.125:3000/admin/workflow/cliente-permisos" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "usuario_id": 2,
    "conexiones": [
      {"agente_id": 1, "modelo_id": 1},
      {"agente_id": 3, "modelo_id": 1}
    ]
  }'
```

**Response:**

```json
{
  "message": "Permisos de cliente creados/actualizados correctamente",
  "usuario_id": 2,
  "resultados": [
    {"agente_id": 1, "modelo_id": 1, "accion": "creado", "id": 3},
    {"agente_id": 3, "modelo_id": 1, "accion": "actualizado", "id": 5}
  ]
}
```

**Status Codes:**
- `201 Created`: Permissions created successfully
- `400 Bad Request`: Incomplete data
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `404 Not Found`: User not found
- `500 Internal Server Error`: Server error

## Workflow and Nodes

### Get all workflow nodes (agents, security types, models)

```bash
curl -X GET "http://141.227.128.125:3000/admin/workflow/nodes" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Response:**

```json
{
  "agentes": [
    {"id": 1, "nombre": "agente_msg", "descripcion": "Agente que responde preguntas generales"},
    {"id": 2, "nombre": "agente_triaje", "descripcion": "Agente de triage médico"}
  ],
  "tipos_seguridad": [
    {"id": 1, "nombre": "api_key", "descripcion": "Autenticación mediante API key"},
    {"id": 2, "nombre": "oauth", "descripcion": "Autenticación mediante OAuth"}
  ],
  "modelos": [
    {"id": 1, "nombre": "gpt-4.1-mini", "proveedor": "azure", "tipo_seguridad_id": 1},
    {"id": 2, "nombre": "gpt-4o-mini", "proveedor": "openai", "tipo_seguridad_id": 1}
  ]
}
```

**Status Codes:**
- `200 OK`: Success
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `500 Internal Server Error`: Server error

### Get all workflow connections

```bash
curl -X GET "http://141.227.128.125:3000/admin/workflow/connections" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Response:**

```json
{
  "connections": [
    {
      "id": 1,
      "agente_id": 1,
      "agente_nombre": "agente_msg",
      "tipo_seguridad_id": 1,
      "tipo_seguridad": "api_key",
      "prompt_pattern": ".*",
      "descripcion": "Conexión predeterminada",
      "activo": 1,
      "modelos": [
        {"id": 1, "nombre": "gpt-4.1-mini", "proveedor": "azure"}
      ]
    }
  ]
}
```

**Status Codes:**
- `200 OK`: Success
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `500 Internal Server Error`: Server error

### Create workflow connection

```bash
curl -X POST "http://141.227.128.125:3000/admin/workflow/connect" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "agente_id": 1,
    "tipo_seguridad_id": 1,
    "modelo_id": 1,
    "prompt_pattern": ".*",
    "descripcion": "Default connection for agent"
  }'
```

**Response:**

```json
{
  "message": "Conexión creada correctamente",
  "pattern_id": 1,
  "modelo_id": 1
}
```

**Status Codes:**
- `201 Created`: Connection created successfully
- `400 Bad Request`: Incomplete data
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `500 Internal Server Error`: Server error

### Delete workflow connection

```bash
curl -X DELETE "http://141.227.128.125:3000/admin/workflow/disconnect" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "agente_id": 1,
    "tipo_seguridad_id": 1,
    "modelo_id": 1
  }'
```

**Response:**

```json
{
  "message": "Conexión eliminada correctamente",
  "agente_id": 1,
  "tipo_seguridad_id": 1,
  "modelo_id": 1
}
```

**Status Codes:**
- `200 OK`: Connection deleted successfully
- `400 Bad Request`: Incomplete data
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `404 Not Found`: Connection not found
- `500 Internal Server Error`: Server error

## Usage Statistics

### Get usage statistics

```bash
curl -X GET "http://141.227.128.125:3000/admin/uso?desde=2025-05-01&hasta=2025-05-21&usuario_id=2&limit=50" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Response:**

```json
{
  "registros": [
    {
      "id": 1,
      "fecha": "2025-05-19 09:10:25",
      "username": "testuser",
      "nombre_key": "API Key Principal",
      "agente": "Asistente General",
      "modelo": "gpt-3.5-turbo",
      "tokens_entrada": 12,
      "tokens_salida": 8,
      "costo_entrada": 0.000006,
      "costo_salida": 0.000012,
      "costo_total": 0.000018
    }
  ],
  "estadisticas": [
    {
      "fecha": "2025-05-19",
      "total_tokens_entrada": 1250,
      "total_tokens_salida": 850,
      "total_costo": 0.325
    }
  ],
  "totales": {
    "tokens_entrada": 1250,
    "tokens_salida": 850,
    "costo_total": 0.325
  },
  "count": 1
}
```

**Status Codes:**
- `200 OK`: Success
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `500 Internal Server Error`: Server error

### Get dashboard data

```bash
curl -X GET "http://141.227.128.125:3000/admin/dashboard" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Response:**

```json
{
  "usuarios": {
    "total": 10,
    "activos": 8
  },
  "api_keys": {
    "total": 15,
    "activas": 12,
    "credito_total": 750.50
  },
  "solicitudes_24h": {
    "total": 250,
    "tokens_entrada": 25000,
    "tokens_salida": 18000,
    "costo_total": 8.75
  },
  "solicitudes_por_modelo": [
    {
      "nombre": "gpt-3.5-turbo",
      "total": 180,
      "costo_total": 5.20
    },
    {
      "nombre": "gpt-4",
      "total": 70,
      "costo_total": 3.55
    }
  ],
  "solicitudes_por_agente": [
    {
      "nombre": "Asistente General",
      "total": 150
    },
    {
      "nombre": "Traductor",
      "total": 100
    }
  ],
  "solicitudes_por_dia": [
    {
      "fecha": "2025-05-19",
      "total": 250,
      "tokens_totales": 43000,
      "costo_total": 8.75
    }
  ]
}
```

**Status Codes:**
- `200 OK`: Success
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `500 Internal Server Error`: Server error

## Prompt Patterns Management

### List all prompt patterns

```bash
curl -X GET "http://141.227.128.125:3000/admin/patrones" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Response:**

```json
{
  "patrones": [
    {
      "id": 1,
      "agente": "Asistente General",
      "tipo_seguridad": "api_key",
      "prompt_pattern": ".*",
      "descripcion": "Patrón predeterminado para todas las consultas",
      "activo": 1,
      "fecha_creacion": "2025-05-19 12:30:45",
      "modelos_permitidos": [
        {"id": 1, "nombre": "gpt-3.5-turbo", "proveedor": "OpenAI"},
        {"id": 2, "nombre": "gpt-4", "proveedor": "OpenAI"}
      ]
    }
  ]
}
```

**Status Codes:**
- `200 OK`: Success
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `500 Internal Server Error`: Server error

### Get specific pattern

```bash
curl -X GET "http://141.227.128.125:3000/admin/patrones/1" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Response:**

```json
{
  "patron": {
    "id": 1,
    "agente_id": 1,
    "agente": "Asistente General",
    "tipo_seguridad_id": 1,
    "tipo_seguridad": "api_key",
    "prompt_pattern": ".*",
    "descripcion": "Patrón predeterminado para todas las consultas",
    "activo": 1,
    "fecha_creacion": "2025-05-19 12:30:45",
    "modelos_permitidos": [
      {"id": 1, "nombre": "gpt-3.5-turbo", "proveedor": "OpenAI"},
      {"id": 2, "nombre": "gpt-4", "proveedor": "OpenAI"}
    ]
  }
}
```

**Status Codes:**
- `200 OK`: Success
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `404 Not Found`: Pattern not found
- `500 Internal Server Error`: Server error

### Create new pattern

```bash
curl -X POST "http://141.227.128.125:3000/admin/patrones" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "agente_id": 1,
    "tipo_seguridad_id": 1,
    "prompt_pattern": ".*síntoma.*|.*dolor.*|.*enfermedad.*",
    "descripcion": "Pattern for medical queries",
    "modelos_ids": [1, 3]
  }'
```

**Response:**

```json
{
  "message": "Patrón creado correctamente",
  "id": 2,
  "prompt_pattern": ".*síntoma.*|.*dolor.*|.*enfermedad.*",
  "descripcion": "Pattern for medical queries",
  "modelos_ids": [1, 3]
}
```

**Status Codes:**
- `201 Created`: Pattern created successfully
- `400 Bad Request`: Incomplete or invalid data
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `500 Internal Server Error`: Server error

### Update pattern

```bash
curl -X PUT "http://141.227.128.125:3000/admin/patrones/2" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "prompt_pattern": ".*síntoma.*|.*dolor.*|.*medicina.*",
    "descripcion": "Updated pattern for medical queries",
    "modelos_ids": [1, 2, 3],
    "activo": true
  }'
```

**Response:**

```json
{
  "message": "Patrón actualizado correctamente",
  "id": 2
}
```

**Status Codes:**
- `200 OK`: Pattern updated successfully
- `400 Bad Request`: No fields to update
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `404 Not Found`: Pattern not found
- `500 Internal Server Error`: Server error

### Delete pattern

```bash
curl -X DELETE "http://141.227.128.125:3000/admin/patrones/3" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Response:**

```json
{
  "message": "Patrón eliminado correctamente",
  "id": 3
}
```

**Status Codes:**
- `200 OK`: Pattern deleted successfully
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Not authorized
- `404 Not Found`: Pattern not found
- `500 Internal Server Error`: Server error

## Triage Agent

The Triage Agent (`agente_triaje`) is unique because it functions as an on-demand service that can be started, stopped, and monitored. Unlike regular agents, it requires specifying an "action" parameter instead of a model.

### Control Actions for Triage Service

#### 1. Start triage service

Starts the on-demand triage service at the configured port (default: 5000).

```bash
curl -X POST "http://141.227.128.125:3000/api/query" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk-test-12345abcdef" \
  -d '{
    "metadata": {
      "agente": "agente_triaje",
      "type": "seguro"
    },
    "action": "start"
  }'
```

**Response:**

```json
{
  "status": "success",
  "message": "Servicio de triage iniciado correctamente",
  "url": "http://localhost:5000",
  "running": true
}
```

**Status Codes:**
- `200 OK`: Triage service started successfully
- `400 Bad Request`: Invalid data
- `401 Unauthorized`: Invalid or missing API key
- `403 Forbidden`: No permission or no credit
- `500 Internal Server Error`: Server error

#### 2. Stop triage service

Stops the running triage service.

```bash
curl -X POST "http://141.227.128.125:3000/api/query" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk-test-12345abcdef" \
  -d '{
    "metadata": {
      "agente": "agente_triaje",
      "type": "seguro"
    },
    "action": "stop"
  }'
```

**Response:**

```json
{
  "status": "success",
  "message": "Servicio de triage detenido correctamente",
  "running": false
}
```

**Status Codes:**
- `200 OK`: Triage service stopped successfully
- `400 Bad Request`: Invalid data
- `401 Unauthorized`: Invalid or missing API key
- `403 Forbidden`: No permission or no credit
- `500 Internal Server Error`: Server error

#### 3. Get triage service status

Returns the current status of the triage service including uptime and session information.

```bash
curl -X POST "http://141.227.128.125:3000/api/query" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk-test-12345abcdef" \
  -d '{
    "metadata": {
      "agente": "agente_triaje",
      "type": "seguro"
    },
    "action": "info"
  }'
```

**Response:**

```json
{
  "status": "success",
  "triageAppRunning": true,
  "triageAppUrl": "http://localhost:5000",
  "activeSessions": 2,
  "sessionCount": 10,
  "uptime": 3600,
  "config": {
    "port": 5000,
    "domain": "localhost",
    "botName": "ar1-healthcare-w1qo2sx"
  }
}
```

**Status Codes:**
- `200 OK`: Success
- `400 Bad Request`: Invalid data
- `401 Unauthorized`: Invalid or missing API key
- `403 Forbidden`: No permission or no credit
- `500 Internal Server Error`: Server error

### Additional Agent Types Comparison

| Feature | agent_msg | agent_triaje |
| ------- | --------- | ------------ |
| Primary Function | General chat processing | Medical triage service management |
| Required Params | `agente`, `type`, `model`, `prompt` | `agente`, `type`, `action` |
| Optional Params | `temperature`, `maxTokens` | `prompt` (for query action), `config` (for config action) |
| Actions | N/A (directly processes prompts) | `start`, `stop`, `info`, `query`, `config` |
| Service Type | Always available | On-demand (must be started) |
| Example Request | `{"metadata":{"agente":"agent_msg","type":"seguro","model":"gpt-4.1-mini"},"prompt":"Hello"}` | `{"metadata":{"agente":"agente_triaje","type":"seguro"},"action":"start"}` |

### Other Actions for Triage Agent

#### 4. Process medical query

Sends a medical query to the triage system and receives a redirect URL to the triage interface.

```bash
curl -X POST "http://141.227.128.125:3000/api/query" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk-test-12345abcdef" \
  -d '{
    "metadata": {
      "agente": "agente_triaje",
      "type": "seguro"
    },
    "action": "query",
    "prompt": "Tengo dolor de cabeza y fiebre desde hace 2 días"
  }'
```

**Response:**

```json
{
  "status": "success",
  "message": "Para realizar una evaluación de tus síntomas, te redirigiremos a nuestro sistema de triage. Por favor, haz clic en el enlace para continuar: http://localhost:5000",
  "redirectUrl": "http://localhost:5000",
  "sessionId": "session_1747644528975_a2b3c"
}
```

**Status Codes:**
- `200 OK`: Success
- `400 Bad Request`: Invalid data or missing prompt
- `401 Unauthorized`: Invalid or missing API key
- `403 Forbidden`: No permission or no credit
- `500 Internal Server Error`: Server error

#### 5. Update triage configuration

Updates the configuration of the triage service.

```bash
curl -X POST "http://141.227.128.125:3000/api/query" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk-test-12345abcdef" \
  -d '{
    "metadata": {
      "agente": "agente_triaje",
      "type": "seguro"
    },
    "action": "config",
    "config": {
      "port": 5001,
      "domain": "triage.example.com",
      "botName": "nuevo-bot-triage"
    }
  }'
```

**Response:**

```json
{
  "status": "success",
  "message": "Configuración de triage actualizada",
  "config": {
    "port": 5001,
    "domain": "triage.example.com",
    "botName": "nuevo-bot-triage"
  }
}
```

**Status Codes:**
- `200 OK`: Configuration updated successfully
- `400 Bad Request`: Invalid data
- `401 Unauthorized`: Invalid or missing API key
- `403 Forbidden`: No permission or no credit
- `500 Internal Server Error`: Server error

## General API Queries

### Get available options for client

```bash
curl -X GET "http://141.227.128.125:3000/api/options" \
  -H "X-API-Key: sk-test-12345abcdef"
```

**Response:**

```json
{
  "clientName": "testuser",
  "clientId": 2,
  "availableAgents": ["Asistente General", "Traductor"],
  "availableTypes": ["seguro", "no_seguro"],
  "availableModels": {
    "seguro": ["gpt-3.5-turbo"],
    "no_seguro": ["claude-2"]
  },
  "credito_disponible": 150.00
}
```

**Status Codes:**
- `200 OK`: Success
- `401 Unauthorized`: Invalid or missing API key
- `500 Internal Server Error`: Server error

### Send query to chat agent

```bash
curl -X POST "http://141.227.128.125:3000/api/query" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk-test-12345abcdef" \
  -d '{
    "metadata": {
      "agente": "agente_msg",
      "type": "seguro",
      "model": "gpt-4.1-mini"
    },
    "prompt": "¿Cuál es la capital de Francia?",
    "temperature": 0.7,
    "maxTokens": 800
  }'
```

**Response:**

```json
{
  "message": "La capital de Francia es París.",
  "metadata": {
    "agente": "agente_msg",
    "type": "seguro",
    "model": "gpt-4.1-mini",
    "prompt": "¿Cuál es la capital de Francia?"
  },
  "usage": {
    "input_tokens": 12,
    "output_tokens": 8,
    "total_tokens": 20,
    "input_cost": "0.000006",
    "output_cost": "0.000012",
    "total_cost": "0.000018"
  },
  "timestamp": "2025-05-20T15:42:31.247Z",
  "userId": "2"
}
```

**Status Codes:**
- `200 OK`: Success
- `400 Bad Request`: Missing metadata or prompt
- `401 Unauthorized`: Invalid or missing API key
- `403 Forbidden`: No permission or no credit
- `404 Not Found`: Agent or model not found
- `500 Internal Server Error`: Server error

### Get API information

```bash
curl -X GET "http://141.227.128.125:3000/api" \
  -H "X-API-Key: sk-test-12345abcdef"
```

**Response:**

```json
{
  "message": "API Gateway funcionando",
  "version": "1.0.0",
  "fecha": "2025-05-20T15:45:22.123Z",
  "endpoints": {
    "auth": "/auth",
    "api": "/api/query",
    "admin": "/admin"
  }
}
```

**Status Codes:**
- `200 OK`: Success
- `500 Internal Server Error`: Server error
