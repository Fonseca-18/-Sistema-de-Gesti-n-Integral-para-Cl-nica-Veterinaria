CREATE DATABASE Veterinaria_UC;
USE Veterinaria_UC;

-- Tabla de roles (solo para empleados)
CREATE TABLE roles (
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nombre_rol ENUM('admin', 'veterinario') NOT NULL UNIQUE
);

-- Tabla de empleados (creados únicamente por admin)
CREATE TABLE empleados (
    id_empleado INT AUTO_INCREMENT PRIMARY KEY,
    nombre_completo VARCHAR(100) NOT NULL,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    clave VARCHAR(255) NOT NULL,
    correo VARCHAR(100),
    telefono VARCHAR(20),
    id_rol INT NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
);

-- Tabla de clientes (registro independiente desde la web)
CREATE TABLE clientes (
    id_cliente INT AUTO_INCREMENT PRIMARY KEY,
    nombre_completo VARCHAR(100) NOT NULL,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    clave VARCHAR(255) NOT NULL,
    correo VARCHAR(100),
    telefono VARCHAR(20),
    direccion VARCHAR(150),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de mascotas (asociadas a clientes)
CREATE TABLE mascotas (
    id_mascota INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    especie VARCHAR(50) NOT NULL,
    raza VARCHAR(50),
    color VARCHAR(30),
    tamaño ENUM('Pequeño', 'Mediano', 'Grande') NOT NULL,
    anio_nacimiento YEAR NOT NULL,
    id_cliente INT NOT NULL,
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE CASCADE
);

-- Tabla de servicios ofrecidos
CREATE TABLE servicios (
    id_servicio INT AUTO_INCREMENT PRIMARY KEY,
    nombre_servicio VARCHAR(100) NOT NULL,
    descripcion TEXT,
    tarifa DECIMAL(10,2) NOT NULL
);

-- Historial clínico de mascotas (lo registra un veterinario)
CREATE TABLE historial_clinico (
    id_historial INT AUTO_INCREMENT PRIMARY KEY,
    id_mascota INT NOT NULL,
    id_servicio INT NOT NULL,
    id_veterinario INT NOT NULL,
    fecha DATE NOT NULL,
    medicamentos TEXT,
    vacunas_realizadas TEXT,
    vacunas_pendientes TEXT,
    pruebas_diagnosticas TEXT,
    observaciones TEXT,
    FOREIGN KEY (id_mascota) REFERENCES mascotas(id_mascota) ON DELETE CASCADE,
    FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio),
    FOREIGN KEY (id_veterinario) REFERENCES empleados(id_empleado)
);

-- Facturas (cliente paga por servicios)
CREATE TABLE facturas (
    id_factura INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE CASCADE
);

-- Detalle de facturas
CREATE TABLE detalle_factura (
    id_detalle INT AUTO_INCREMENT PRIMARY KEY,
    id_factura INT NOT NULL,
    id_servicio INT NOT NULL,
    cantidad INT DEFAULT 1,
    subtotal DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (id_factura) REFERENCES facturas(id_factura) ON DELETE CASCADE,
    FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio)
);

-- Notificaciones (recordatorios para clientes sobre sus mascotas)
CREATE TABLE notificaciones (
    id_notificacion INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_mascota INT NOT NULL,
    mensaje TEXT NOT NULL,
    fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    enviado BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    FOREIGN KEY (id_mascota) REFERENCES mascotas(id_mascota) ON DELETE CASCADE
);

select * from clientes;

INSERT INTO roles (nombre_rol) VALUES ('admin');
INSERT INTO roles (nombre_rol) VALUES ('veterinario');

SELECT * FROM roles;

INSERT INTO empleados (nombre_completo, usuario, clave, correo, telefono, id_rol)
VALUES ('Juan Perez', 'admin1', '1234', 'juan@example.com', '3001234567', 1);

ALTER TABLE clientes
ADD cedula VARCHAR(20) NULL AFTER id_cliente;

UPDATE clientes SET cedula = '1000123456' WHERE id_cliente = 1;
UPDATE clientes SET cedula = '1000234567' WHERE id_cliente = 2;
UPDATE clientes SET cedula = '1000345678' WHERE id_cliente = 3;
UPDATE clientes SET cedula = '1000456789' WHERE id_cliente = 4;

ALTER TABLE clientes
MODIFY cedula VARCHAR(20) NOT NULL UNIQUE;

select * from mascotas;

CREATE TABLE citas (
    id_cita INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_mascota INT NOT NULL,
    id_servicio INT NOT NULL,
    fecha_hora DATETIME NOT NULL,
    recordatorio ENUM('si','no') DEFAULT 'no',
    intervalo VARCHAR(20),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    FOREIGN KEY (id_mascota) REFERENCES mascotas(id_mascota) ON DELETE CASCADE,
    FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio)
);

select * from citas;