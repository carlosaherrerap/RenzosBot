# Plan de Trabajo: Bot de WhatsApp (Pastelería) y Plataforma Web

## Resumen del Alcance
- Bot de WhatsApp con contexto completo del negocio y objetivos claros.
- Recomienda productos por precio, presupuesto y preferencias; sugiere similares.
- Voz: escucha audios (STT) y responde por voz (TTS); menú interactivo.
- Gestión de reservas, recordatorios, estados y notificaciones en tiempo real.
- Integración con Yape, generación de comprobantes/QR y ticket impreso.
- Plataforma web con dashboards, roles, drag-and-drop de estados y QR de conexión.

## Preferencias de Respuesta (Audio/Texto)
- El bot solo responde por audio cuando el cliente escribe el comando: **"audio x"**.
- Si el cliente desea cambiar las respuestas a texto, escribe el comando: **"texto x"**.
- La preferencia se mantiene por sesión del cliente y puede alternarse con cada comando.

## Arquitectura
- Backend en Node.js + TypeScript para el bot y APIs REST/WebSocket.
- Orquestación de conversación con DeepSeek (RAG + memoria del negocio).
- PostgreSQL para datos (clientes, productos, pedidos, estados, pagos).
- Servicios especializados:
  - STT: ffmpeg + whisper.cpp.
  - TTS: motor enchufable (Edge TTS/Polly/Coqui).
  - Visión: microservicio TensorFlow (FastAPI) para embeddings y similitud.
- Contenedores: Docker Compose (bot, API, web, DB, STT, visión).
- Tiempo real: WebSocket y Postgres LISTEN/NOTIFY para cambios de estado.
- Impresión: driver ESC/POS o Windows Spooler según impresora conectada.

## Tecnologías Propuestas
- WhatsApp: Baileys (whisky baileys).
- Base de datos: PostgreSQL + ORM (Prisma).
- IA: DeepSeek vía API, con claves en variables de entorno.
- Visión: TensorFlow + modelo ligero (MobileNet/EfficientNet) + ANN.
- STT: whisper.cpp + ffmpeg para normalización de audio WhatsApp (OGG → WAV).
- TTS: seleccionable; salida en OGG/opus para WhatsApp, control por "audio x"/"texto x".
- Web: React + Next.js; UI moderna con Tailwind/Chakra + GSAP; Three.js para 3D opcional.
- Tablero: drag-and-drop estilo Trello/Jira (react-beautiful-dnd).
- Contenedores: Docker + Docker Compose.
- Jobs y colas: BullMQ/Redis (recordatorios y campañas), opcional según escala.
- Seguridad: JWT + RBAC (admin/empleado), Helmet, CORS, rate limit.

## Componentes Principales
- Servicio Bot WhatsApp:
  - Conexión Baileys; QR de emparejamiento, menús, plantillas de mensajes.
  - Ingesta de audio; STT; respuesta con texto y/o voz según "audio x"/"texto x".
  - Rutas conversacionales con objetivos (precios, cercanía, presupuesto).
- Motor de Recomendación:
  - Filtros por presupuesto, preferencias, disponibilidad.
  - Similitud por texto e imagen (TensorFlow embeddings + top‑k).
- Gestión de Pedidos:
  - Estados: RESERVADO, EN PROCESO, TERMINADO; transiciones auditadas.
  - Notificaciones automáticas al cliente cuando cambie el estado.
- Pagos e Integración Yape:
  - Verificación de pago: API oficial/webhook; fallback por lectura de comprobante + validaciones.
- Impresión:
  - Ticket automático post‑reserva con datos de cliente y detalles.

## Flujos Clave del Cliente
- Precios: consulta por categoría (tortas, decoraciones, repostería) con variaciones/ingredientes.
- Tienda más cercana: detección por ubicación (link de ubicación/ciudad); cálculo de distancia; rutas y horarios.
- Compra por presupuesto: el cliente indica monto; se sugieren combos/alternativas y 3 coincidencias similares.
- Búsqueda por imagen/texto: encuentra el producto más parecido y muestra 3 similares.
- Reserva: captura datos, fecha/hora, opciones de entrega; confirma; genera comprobante; imprime ticket.
- Voz: el cliente envía audio; el bot entiende y responde con audio cuando se indique "audio x".
- Quejas y soporte: categorización, registro y seguimiento.

## Plataforma Web
- Dashboards: ventas, clientes, fechas, reservas vs delivery vs pago en tienda.
- Gráficos y estadísticas: cantidades, rango de fecha, horarios pico, satisfacción (NPS/sentimiento).
- Gestión de productos, precios y stock; base de conocimiento (FAQs del negocio).
- Usuarios y roles: admin/empleado con permisos.
- Kanban de pedidos: drag‑and‑drop con animaciones; 3D opcional.
- Conexión WhatsApp: pantalla QR dinámica (Baileys) para emparejar.
- Campañas: ofertas/promociones; segmentación; envío por WhatsApp.

## IA y Contexto del Negocio
- RAG con pgvector: documentos del negocio (precios, políticas, horarios, ubicaciones).
- Memoria: perfiles, preferencias y últimos pedidos por cliente.
- Prompts con objetivos: guiar a compra, respetar presupuesto, tono de marca.
- Salvaguardas: límites de contexto y revisiones de seguridad de respuesta.

## Integración con Yape
- API/Webhook para confirmación de pagos (merchant).
- Validación de comprobante: lectura de QR/imagen y metadatos (monto, hora, referencia).
- Reconciliación: enlace pedido‑pago; estados “pagado/verificado”; alertas de discrepancia.

## Base de Datos (Esquema Alto Nivel)
- clientes, sucursales, productos, categorías, inventario.
- pedidos, items_pedido, estados_pedido (histórico).
- pagos, métodos, referencias (Yape).
- campañas, mensajes, plantillas.
- usuarios, roles, permisos.
- kb_documentos, embeddings (pgvector).
- eventos (auditoría y disparadores).

## Generación de Imágenes y Tickets
- Plantillas base en HTML/CSS/Canvas; render a PNG/JPEG.
- Estados: RESERVADO, EN PROCESO, TERMINADO con diseño consistente.
- Ticket: formato ESC/POS (si compatible) o PDF/imagen; impresión automática en Windows.

## Audio: STT/TTS
- STT: ffmpeg normaliza + whisper.cpp transcribe; multilenguaje; caching.
- TTS: voz natural; enviado como audio WhatsApp; control mediante "audio x"/"texto x".

## Recomendaciones y Coincidencias
- Texto: BM25/embeddings; filtros por precio y disponibilidad.
- Imagen: embeddings TensorFlow; índice ANN; top‑1 más parecido + top‑3 alternativas.
- Reglas del negocio: upsell/cross‑sell, packs, fechas especiales.

## Notificaciones en Tiempo Real
- Escucha de cambios con Postgres LISTEN/NOTIFY.
- Bot envía mensajes “tu pedido está listo” al momento.
- Web: WebSocket para actualizar tableros y métricas sin refrescar.

## Seguridad y Cumplimiento
- Claves (DeepSeek, Yape) en variables de entorno; nunca en repositorio.
- RBAC, cifrado en tránsito (HTTPS), backups y rotación de logs.
- Rate limiting anti‑spam; protección de comandos sensibles del bot.

## DevOps y Contenedores
- Docker Compose con servicios (bot, API, web, Postgres, STT, visión).
- Entornos dev y prod separados; .env gestionado.
- Observabilidad: logs estructurados, métricas, alertas (salud de colas, pagos, impresora).

## Pruebas y Calidad
- Unitarias: recomendación, estados, pagos, impresión mock.
- Integración: Baileys, Yape, STT/visión; extremo a extremo.
- Validación de diseño: generación de imágenes; accesibilidad web.
- Datos de prueba: catálogos y clientes ficticios; sandbox de pagos si existe.

## Cronograma y Entregables
- Semana 1: diseño detallado, esquema DB, contratos API, setup Docker.
- Semana 2: Bot básico (menús, precios, reservas), STT/TTS, QR de conexión.
- Semana 3: Recomendaciones (texto/imagen), estados + notificaciones, generación de imágenes.
- Semana 4: Dashboard web (roles, kanban, métricas), campañas, ofertas.
- Semana 5: Integración Yape, impresión de ticket, endurecimiento de seguridad.
- Semana 6: Pruebas E2E, optimización rendimiento, documentación operativa y entrega.

## Criterios de Aceptación
- Bot responde correctamente a precios, presupuestos y cercanía.
- Encuentra producto más parecido y 3 coincidencias adicionales.
- Reserva completa: comprobante, impresión de ticket, cambio de estado y notificación.
- Voz funcional: entiende audios y responde con audio bajo "audio x".
- Web con dashboards, roles, QR de conexión, kanban animado.
- Detección de pago Yape y actualización automática del pedido.
- Imágenes generadas por estado con diseño consistente.

## Riesgos y Mitigaciones
- API Yape limitada: sandbox/alternativas de verificación y logs claros.
- Impresora incompatible: validar ESC/POS/Windows; fallback a PDF y app de impresión.
- Calidad STT/TTS: ajustar modelos/codec y modo texto alternativo.
- Carga en recomendación: cache de embeddings y lotes; ANN optimizado.
- Conexión WhatsApp: reconexión automática y persistencia de sesión.

## Próximos Pasos
- Preparar inventario y reglas de precios para poblar el contexto.
- Definir diseño base de imágenes (comprobante y estados).
- Proveer requisitos de impresora y acceso/credenciales de Yape.
- Inicializar proyecto con Docker Compose, módulos del bot y base de datos.
