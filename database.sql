-- Migración: 001_initial_schema.sql
-- Esquema inicial para la base de datos del bot de WhatsApp (PostgreSQL)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de usuarios/clientes
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT now(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla de administradores
CREATE TABLE administradores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    telefono VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT now(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabla de empleados
CREATE TABLE empleados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    telefono VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT now(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Categorías de productos
CREATE TABLE categorias (
    id VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT
);

-- Productos
CREATE TABLE productos (
    id VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    categoria_id VARCHAR(50) REFERENCES categorias(id),
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Presentaciones (formas de venta de un producto)
CREATE TABLE presentaciones (
    id VARCHAR(50) PRIMARY KEY,
    producto_id VARCHAR(50) REFERENCES productos(id),
    tipo VARCHAR(50) NOT NULL,
    cantidad NUMERIC NOT NULL,
    unidad VARCHAR(20) NOT NULL,
    precio NUMERIC(10,2) NOT NULL,
    stock INTEGER,
    activo BOOLEAN DEFAULT TRUE
);

-- Propiedades de productos
CREATE TABLE propiedades_producto (
    id VARCHAR(50) PRIMARY KEY,
    producto_id VARCHAR(50) REFERENCES productos(id),
    propiedad VARCHAR(50) NOT NULL,
    valor VARCHAR(100) NOT NULL
);

-- Reservas / Pedidos
CREATE TABLE reservas (
    id VARCHAR(50) PRIMARY KEY,
    usuario_id UUID REFERENCES usuarios(id),
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    total NUMERIC(10,2) NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT now(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT now(),
    fecha_retiro DATE,
    hora_retiro TIME
);

-- Items dentro de una reserva
CREATE TABLE items_reserva (
    id VARCHAR(50) PRIMARY KEY,
    reserva_id VARCHAR(50) REFERENCES reservas(id) ON DELETE CASCADE,
    presentacion_id VARCHAR(50) REFERENCES presentaciones(id),
    cantidad NUMERIC NOT NULL,
    precio NUMERIC(10,2) NOT NULL
);

-- Plantillas JSON usadas por el bot
CREATE TABLE plantillas (
    id VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    contenido_json JSON NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Medios (imágenes, PDFs, etc.)
CREATE TABLE medios (
    id VARCHAR(50) PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL,
    ruta VARCHAR(255) NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Notificaciones para usuarios/empleados
CREATE TABLE notificaciones (
    id VARCHAR(50) PRIMARY KEY,
    usuario_id UUID REFERENCES usuarios(id),
    mensaje TEXT NOT NULL,
    leido BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- -------------------------------------------------------
-- Preguntas frecuentes (usadas por el bot para reclamos)
-- El bot busca palabras clave del reclamo y devuelve la respuesta automática.
-- Si no hay coincidencia, deriva a un empleado humano.
-- -------------------------------------------------------
CREATE TABLE preguntas_frecuentes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    categoria VARCHAR(50) NOT NULL DEFAULT 'general',
    pregunta TEXT NOT NULL,
    palabras_clave TEXT,
    respuesta TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT now(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- -------------------------------------------------------
-- Reclamos registrados por clientes vía bot o portal
-- -------------------------------------------------------
CREATE TABLE reclamos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id),
    reserva_id VARCHAR(50) REFERENCES reservas(id),
    descripcion TEXT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    respuesta_automatica TEXT,
    empleado_id UUID REFERENCES empleados(id),
    respuesta_empleado TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT now(),
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- -------------------------------------------------------
-- Sugerencias mixtas por evento u ocasión
-- El bot consulta esta tabla cuando el cliente no sabe qué pedir
-- -------------------------------------------------------
CREATE TABLE sugerencias_mixtas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ocasion VARCHAR(100) NOT NULL,
    palabras_clave TEXT,
    descripcion TEXT NOT NULL,
    presentaciones_ids JSON,
    precio_estimado NUMERIC(10,2),
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_productos_categoria ON productos(categoria_id);
CREATE INDEX idx_presentaciones_producto ON presentaciones(producto_id);
CREATE INDEX idx_reservas_usuario ON reservas(usuario_id);
CREATE INDEX idx_items_reserva_reserva ON items_reserva(reserva_id);
CREATE INDEX idx_faq_categoria ON preguntas_frecuentes(categoria);
CREATE INDEX idx_reclamos_usuario ON reclamos(usuario_id);
CREATE INDEX idx_reclamos_estado ON reclamos(estado);
CREATE INDEX idx_sugerencias_ocasion ON sugerencias_mixtas(ocasion);

