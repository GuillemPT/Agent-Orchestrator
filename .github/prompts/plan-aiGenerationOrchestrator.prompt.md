# Plan: AI generation + arquitectura de despliegue

## TL;DR
Se añade un endpoint de generación por IA al servidor Hono (`POST /api/generate/agent|skill`), conectado con **Groq** (free tier, OpenAI-compatible) como proveedor primario. La IA rellena el scaffold del agente/skill a partir de una descripción en lenguaje natural. En el frontend se añade un botón "✨ Generate" en `AgentEditor` y `SkillWizard` que abre un modal de prompt. La arquitectura Kubernetes + Ollama se diseña como un **tier enterprise opcional** — no se implementa ahora, pero el código se deja preparado para ello con una sola variable de entorno.

**Por qué Groq y no Ollama en VPS:** a 1000 req/día con ~800 tokens de salida, auto-alojar Ollama en una VPS sin GPU ($20/mes) cuesta igual o más que las APIs cloud, con una latencia de ~2–4 minutos por req en CPU. Groq da `llama-3.3-70B` gratis hasta 14.400 req/día con latencia <2 s.

---

## Bloque 1 — Proveedor de IA y ruta de generación (backend)

1. Instalar `openai` (sirve como cliente para Groq — su API es OpenAI-compatible) y añadir a `package.json`.

2. Añadir variables de entorno nuevas a `.env.example`:
   - `AI_PROVIDER` — `groq` | `openai` | `ollama`
   - `AI_BASE_URL` — por defecto `https://api.groq.com/openai/v1`
   - `AI_API_KEY` — la Groq API key
   - `AI_MODEL` — por defecto `llama-3.3-70b-versatile`

3. Crear `src/server/services/AIService.ts` — wrapper delgado sobre `openai` SDK que lee esas 4 vars. Si `AI_PROVIDER=ollama`, `AI_BASE_URL` apunta al Ollama local (p.ej. `http://localhost:11434/v1`, que también expone endpoint OpenAI-compatible desde Ollama v0.1.24+). **Un solo servicio sirve los tres casos** sin cambiar nada más.

4. Crear `src/server/routes/generate.ts` con dos endpoints:
   - `POST /api/generate/agent` — recibe `{ prompt, projectId? }`, devuelve un objeto `Agent` completo. Prompt del sistema: instruye al modelo a rellenar `metadata.name`, `metadata.description`, `metadata.tags`, `instructions` y los campos de `mcpConfig` relevantes en JSON estrictamente validado.
   - `POST /api/generate/skill` — recibe `{ prompt, projectId? }`, devuelve un objeto `Skill` completo con `metadata`, `markdown` (instrucciones), y `yaml` generados.

5. Añadir **rate limiting** en esa ruta con un middleware ligero en Hono: máximo 20 req/usuario/hora almacenado en un `Map<userId, {count, resetAt}>` en memoria (suficiente para empezar sin Redis).

6. Registrar la ruta en `src/server/index.ts` junto a las demás.

---

## Bloque 2 — UI de generación (frontend)

7. Crear `src/renderer/components/GenerateModal.tsx` + `GenerateModal.css`: modal pequeño con un `<textarea>` de prompt libre (placeholder: *"A Python backend developer that specialises in FastAPI…"*), selector del número de herramientas MCP a sugerir, y botón "Generate". Muestra un spinner en envío y permite editar el resultado antes de guardarlo.

8. En `src/renderer/api/index.ts` añadir `generate.agent(prompt, projectId?)` → `POST /api/generate/agent` y `generate.skill(prompt, projectId?)` → `POST /api/generate/skill`. En Electron (sin servidor) estas llamadas lanzan `new Error('AI generation requires web mode')` con un mensaje amigable.

9. En `AgentEditor.tsx` añadir botón "✨ Generate" junto a "+ New Agent" que abre `GenerateModal`. Al confirmar: llama al API, recibe el `Agent` generado, lo guarda vía `api.agent.create(generated)`, lo añade a la lista y lo abre en el editor para revisión.

10. En `SkillWizard.tsx` añadir el mismo botón "✨ Generate" junto a "+ New Skill". Al confirmar: guarda la skill generada y carga el wizard directamente en el paso 2 (Markdown) para que el usuario pueda revisar/editar.

---

## Bloque 3 — Arquitectura Kubernetes + Ollama (documentación + preparación de código)

11. El `AIService.ts` ya soporta Ollama con sólo cambiar `AI_PROVIDER=ollama` + `AI_BASE_URL`; no hay código adicional. Documentar en `SESSION_NOTES.md` la arquitectura de despliegue enterprise:
    - Ingress → Hono API gateway (N réplicas, HPA por CPU)
    - Namespace por tenant: pod app + sidecar Ollama
    - Modelo recomendado para sidecar: `qwen2.5:7b` (requiere node con ≥8 GB RAM, sin GPU necesaria si se acepta latencia de ~30–60 s para generación en background)
    - Para generación síncrona con GPU: nodos A10G (24 GB VRAM) en un node pool separado con taints + tolerations; `llama3.1:8b` a ~80 tokens/s
    - Helm chart sketch: `values.yaml` con flags `ollama.enabled`, `ollama.model`, `ollama.gpuNodePool`

12. Añadir `docker-compose.yml` (o actualizar si existe) con un servicio `ollama` para desarrollo local:
    ```yaml
    services:
      ollama:
        image: ollama/ollama
        ports:
          - "11434:11434"
        volumes:
          - ollama_data:/root/.ollama
    volumes:
      ollama_data:
    ```
    Con instrucción de poststart: `docker exec ollama ollama pull qwen2.5:7b`

---

## Bloque 4 — Settings UI para el proveedor de IA

13. En `Settings.tsx` añadir una sección "AI Provider" con:
    - Selector: Groq / OpenAI / Ollama (local) / Desactivado
    - Campo de API key (enmascarado, guardado vía `api.gitProvider`-style secure storage)
    - Campo de modelo (con sugerencias por proveedor)
    - Botón "Test connection" que llama a `POST /api/generate/agent` con un prompt de prueba
    - En Electron: sección oculta con nota *"La generación por IA sólo está disponible en modo web"*

---

## Verification

- `npm test` — debe seguir en 86 passing (los nuevos end-to-end del endpoint se mockean con `vi.fn()`)
- `curl -X POST http://localhost:3001/api/generate/agent -H "Content-Type: application/json" -d '{"prompt":"A senior DevOps engineer specialising in Kubernetes"}'` → debe devolver un JSON con `metadata.name`, `instructions` y `mcpConfig` rellenos
- Test de rate limit: 21ª llamada en menos de 1 hora debe devolver `429 Too Many Requests`
- Test Ollama: `AI_PROVIDER=ollama AI_BASE_URL=http://localhost:11434/v1 AI_API_KEY=none npm run dev:server` + Ollama corriendo localmente → mismo endpoint funciona

---

## Decisions

| Decision | Elección | Razón |
|---|---|---|
| Groq sobre Ollama-en-VPS | Groq free tier | Cubre 14× más req/día que la carga estimada a $0; VPS sin GPU = misma latencia 100× peor |
| `openai` SDK | Un solo cliente | Groq, OpenAI y Ollama ≥0.1.24 son todos OpenAI-compatible con `baseURL` |
| Rate limit en memoria | `Map<userId, ...>` | Suficiente para MVP; migrar a Redis/Upstash al escalar horizontalmente |
| Ollama = tier enterprise | Documentado, no desplegado por defecto | Solo tiene sentido para clientes on-premise que no pueden enviar datos fuera de su red |
| Generación como sugerencia | Mostrar en editor antes de guardar | El usuario siempre revisa y controla lo que persiste |
