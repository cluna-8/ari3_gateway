# COMPLETE-GATEWAY - Documentación Técnica

Este documento proporciona una descripción completa del sistema COMPLETE-GATEWAY, un gateway modular para servicios de IA que integra diferentes modelos de lenguaje a través de una API unificada. El sistema incluye capacidades de autenticación, enrutamiento inteligente y un innovador agente de triage médico.

## Estructura de Archivos

```
COMPLETE-GATEWAY/ 
├── auth/ 
│   ├── app.js                 # Módulo de autenticación con API keys
│   └── config.json            # Configuración de usuarios y API keys
├── router/ 
│   ├── router.js              # Lógica de enrutamiento de solicitudes
│   ├── router-triage-adapter.js # Adaptador para el agente de triage
│   └── config.json            # Configuración de agentes y permisos por cliente
├── agents/    
│   ├── agent_msg.js           # Módulo principal para procesamiento de mensajes
│   ├── agent_triaje.js        # Agente de triage médico
│   ├── triage_config.json     # [AUTO-GENERADO] Configuración del triage
│   └── models/ 
│        ├── azure-openai.js   # Cliente para modelos Azure OpenAI (seguros)
│        ├── openai.js         # Cliente para modelos OpenAI (no seguros)
│        └── config.yml        # Configuración de modelos y API keys
├── triage-standalone.js       # Aplicación independiente para el triage
├── webchat_direct.html        # Plantilla HTML para el chat de triage
├── index.js                   # Archivo principal que integra todos los módulos
├── package.json               # Dependencias del proyecto
└── README.md                  # Documentación básica
```

## Descripción de Componentes Principales

### 1. Módulo de Autenticación (`auth/`)

**Archivos principales:**
- `app.js`: Proporciona funcionalidades de autenticación mediante API keys y JWT.
- `config.json`: Almacena configuración de usuarios y API keys.

**Funcionalidad:**
- Autenticación mediante API keys o tokens JWT
- Validación de permisos
- Manejo de sesiones de usuario

### 2. Módulo de Enrutamiento (`router/`)

**Archivos principales:**
- `router.js`: Maneja el enrutamiento de solicitudes a los agentes apropiados.
- `router-triage-adapter.js`: Adaptador que conecta el sistema de enrutamiento con el agente de triage.
- `config.json`: Configuración de agentes, clientes y permisos.

**Funcionalidad:**
- Direccionamiento inteligente de solicitudes según metadatos
- Validación de permisos de cliente para diferentes agentes
- Procesamiento de consultas con diferentes tipos de seguridad

### 3. Módulo de Agentes (`agents/`)

#### 3.1 Agente de Mensajes General (`agent_msg.js`)

**Funcionalidad:**
- Procesamiento de mensajes de texto general
- Consultas a modelos de IA (Azure OpenAI y OpenAI)
- Cálculo de costos y seguimiento de uso

#### 3.2 Agente de Triage Médico (`agent_triaje.js`)

**Funcionalidad:**
- Administración de un servicio de triage médico on-demand
- Iniciado/detención del servicio mediante API
- Interfaz web para evaluación de síntomas médicos
- Configuración dinámica de dominio y puerto
- Registro de sesiones de triage

### 4. Clientes de Modelos (`agents/models/`)

**Archivos principales:**
- `azure-openai.js`: Cliente para modelos Azure OpenAI (considerados "seguros").
- `openai.js`: Cliente para modelos OpenAI (considerados "no seguros").
- `config.yml`: Configuración de modelos y API keys.

**Funcionalidad:**
- Conexión con diferentes proveedores de IA
- Formateo de mensajes según el proveedor
- Cálculo de costos y uso de tokens

### 5. Aplicaciones de Triage

**Archivos principales:**
- `triage-standalone.js`: Aplicación independiente para ejecutar el servicio de triage.
- `webchat_direct.html`: Interfaz de usuario para el chat de triage médico.
- `index.js`: Archivo principal que integra todos los módulos.

## Agente de Triage Médico

El agente de triage médico es un componente innovador que proporciona una evaluación inicial de síntomas médicos mediante un chat interactivo. Este agente implementa un enfoque "on-demand", donde el servicio de chat se inicia según sea necesario y puede ser configurado dinámicamente.

### Características

- **Servicio On-Demand**: El servicio de triage se inicia solo cuando es necesario, optimizando recursos.
- **Interfaz Web Integrada**: Proporciona una interfaz web accesible para la evaluación de síntomas.
- **Configuración Dinámica**: Permite cambiar el dominio y puerto donde se ejecuta el servicio.
- **Seguimiento de Sesiones**: Registro de sesiones activas y estadísticas de uso.
- **Integración con Azure Health Bot**: Se conecta con un bot de salud para proporcionar evaluaciones médicas profesionales.

### Funcionamiento

1. Cuando un usuario solicita una evaluación médica, el agente inicia automáticamente el servicio de triage si no está activo.
2. El usuario es redirigido a una interfaz web donde puede interactuar con un bot especializado en evaluación médica.
3. El sistema registra la sesión y proporciona estadísticas y seguimiento.
4. El servicio puede configurarse para funcionar en diferentes dominios y puertos según las necesidades.

## Endpoints de API

### 1. Autenticación

#### a. Login para obtener Token JWT

```
POST /auth/login
```
**Body:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

#### b. Validar API Key

```
GET /auth/validate-key
```
**Headers:**
```
X-API-Key: ak_123456abcdef
```

### 2. Procesamiento de Consultas

#### a. Consulta General a Agentes

```
POST /api/query
```
**Headers:**
```
Content-Type: application/json
X-API-Key: ak_123456abcdef
```
**Body:**
```json
{
  "metadata": {
    "agente": "agente_msg",
    "type": "seguro",
    "model": "gpt-4.1-mini"
  },
  "prompt": "¿Cuál es la capital de Francia?"
}
```

#### b. Consultas al Agente de Triage

```
POST /api/query
```
**Headers:**
```
Content-Type: application/json
X-API-Key: ak_123456abcdef
```
**Body (iniciar servicio):**
```json
{
  "metadata": {
    "agente": "agente_triaje",
    "type": "seguro"
  },
  "action": "start"
}
```

**Body (detener servicio):**
```json
{
  "metadata": {
    "agente": "agente_triaje",
    "type": "seguro"
  },
  "action": "stop"
}
```

**Body (obtener información):**
```json
{
  "metadata": {
    "agente": "agente_triaje",
    "type": "seguro"
  },
  "action": "info"
}
```

**Body (consulta médica):**
```json
{
  "metadata": {
    "agente": "agente_triaje",
    "type": "seguro"
  },
  "action": "query",
  "prompt": "Tengo dolor de cabeza y fiebre desde hace 2 días"
}
```

**Body (actualizar configuración):**
```json
{
  "metadata": {
    "agente": "agente_triaje",
    "type": "seguro"
  },
  "action": "config",
  "config": {
    "domain": "triage.midominio.com",
    "port": 8080
  }
}
```

### 3. Opciones y Estadísticas

#### a. Obtener Opciones Disponibles

```
GET /api/options
```
**Headers:**
```
X-API-Key: ak_123456abcdef
```

## Ejemplos de Comandos Curl

### 1. Iniciar el Servicio de Triage

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_123456abcdef" \
  -d '{
    "metadata": {
      "agente": "agente_triaje",
      "type": "seguro"
    },
    "action": "start"
  }'
```

### 2. Obtener Información del Servicio

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_123456abcdef" \
  -d '{
    "metadata": {
      "agente": "agente_triaje",
      "type": "seguro"
    },
    "action": "info"
  }'
```

### 3. Realizar una Consulta Médica

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_123456abcdef" \
  -d '{
    "metadata": {
      "agente": "agente_triaje",
      "type": "seguro"
    },
    "action": "query",
    "prompt": "Tengo dolor de cabeza y fiebre desde hace 2 días"
  }'
```

### 4. Realizar una Consulta General

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ak_123456abcdef" \
  -d '{
    "metadata": {
      "agente": "agente_msg",
      "type": "seguro",
      "model": "gpt-4.1-mini"
    },
    "prompt": "¿Cuál es la capital de Francia?"
  }'
```

## Interfaz de Triage

La interfaz web del triage médico es accesible en:

```
http://localhost:3000/agents/triage
```

Esta interfaz permite:
- Ver el estado actual del servicio
- Iniciar/detener el servicio manualmente
- Configurar dominio, puerto y parámetros del bot
- Ver estadísticas de sesiones

## Configuración 

### 1. Configuración de Agentes (`router/config.json`)

```json
{
  "agents": {
    "agente_msg": {
      "description": "Agente que responde preguntas generales usando modelos de IA",
      "script": "agent_msg.js",
      "tipos_permitidos": ["seguro", "no_seguro"],
      "modelos_seguros": ["gpt-4.1-mini"],
      "modelos_no_seguros": ["gpt-4o-mini"]
    },
    "agente_triaje": {
      "description": "Agente de triage médico que evalúa síntomas iniciales",
      "script": "agent_triaje.js",
      "tipos_permitidos": ["seguro"],
      "modelos_seguros": ["gpt-4.1-mini"],
      "modelos_no_seguros": []
    }
  }
}
```

### 2. Configuración de Modelos (`agents/models/config.yml`)

```yaml
models:
  gpt-4o-mini:
    provider: openai
    api_key: XXXXXXXXXXXX
    temperature: 0.7
    pricing:
      input: 5.e-7
      output: 0.0000015
  gpt-4.1-mini:
    provider: azure
    api_key: XXXXXXXXXXXX
    endpoint: https://your-azure-endpoint.openai.azure.com/
    api_version: 2025-01-01-preview
    deployment_id: gpt-4.1-mini
    temperature: 0.7
    pricing:
      input: 4.e-7
      output: 4.e-7
```

### 3. Configuración del Triage (`agents/triage_config.json`)

Este archivo se genera automáticamente y almacena la configuración del servicio de triage:

```json
{
  "port": 5000,
  "domain": "localhost",
  "botName": "ar1-healthcare-w1qo2sx",
  "webchatSecret": "XXXXXXXXXXXX"
}
```

## Seguridad y Clasificación de Modelos

El sistema clasifica los modelos en dos categorías de seguridad:

1. **Modelos Seguros (Azure OpenAI):**
   - Accesibles con `type: "seguro"`
   - Ejemplo: `gpt-4.1-mini`
   - Restringidos para información sensible o médica

2. **Modelos No Seguros (OpenAI estándar):**
   - Accesibles con `type: "no_seguro"`
   - Ejemplo: `gpt-4o-mini`
   - No recomendados para información médica o sensible

El agente de triage está configurado para funcionar exclusivamente con modelos seguros (Azure OpenAI) debido a la naturaleza sensible de la información médica.

## Extensibilidad

El sistema está diseñado para ser altamente extensible:

1. **Nuevos Agentes:**
   - Crear un archivo JS en la carpeta `/agents/`
   - Implementar las funciones `setup` y `registerEndpoints`
   - Actualizar `config.json` para incluir el nuevo agente

2. **Nuevos Modelos:**
   - Agregar configuración en `agents/models/config.yml`
   - Actualizar listas de modelos permitidos en `router/config.json`

3. **Nuevos Clientes:**
   - Agregar configuración de cliente en `router/config.json`
   - Establecer permisos y agentes habilitados

## Notas de Implementación

- Se recomienda usar HTTPS en entornos de producción
- Las API keys deben mantenerse seguras y rotarse periódicamente
- Para entornos de alta disponibilidad, considere implementar balanceo de carga
- El servicio de triage puede configurarse con diferentes dominios según el entorno (desarrollo, staging, producción)
- Para despliegues en producción, considere usar contenedores Docker para asegurar la consistencia del entorno

## Requisitos del Sistema

- Node.js 14.x o superior
- NPM 6.x o superior
- Conexión a internet para acceder a las APIs de OpenAI y Azure OpenAI
- Para el triage: puerto libre (5000 por defecto) para ejecutar el servicio

---

Desarrollado por LLM_COMPLIANCE 
© 2025