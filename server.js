const express = require("express");
const mysql = require("mysql2");
const path = require("path");
const session = require("express-session");

const app = express();
const PORT = 3000;

// Middleware para leer formularios y JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Middleware de sesiones
app.use(session({
    secret: "mi_secreto_seguro", // cámbialo en producción
    resave: false,
    saveUninitialized: true
}));

// Servir archivos estáticos (ej: login.html, registro.html, etc.)
app.use(express.static(path.join(__dirname, "public")));

// Conexión a la base de datos
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Juan49555309",
    database: "veterinaria_UC"
});

db.connect((err) => {
    if (err) {
        console.error("❌ Error de conexión a la base de datos:", err);
        return;
    }
    console.log("✅ Conectado a MySQL");
});

// ------------------- REGISTRO CLIENTES -------------------
app.post("/registro", (req, res) => {
    const { cedula, nombre_completo, usuario, clave, correo, telefono, direccion } = req.body;

    const sql = "INSERT INTO clientes (cedula, nombre_completo, usuario, clave, correo, telefono, direccion) VALUES (?, ?, ?, ?, ?, ?, ?)";
    db.query(sql, [cedula, nombre_completo, usuario, clave, correo, telefono, direccion], (err, result) => {
        if (err) {
            console.error("❌ Error al insertar:", err);
            return res.status(500).send(`
                <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
                <script>
                    Swal.fire({
                        title: "Veterinaria UC",
                        text: "❌ Error al registrar el cliente",
                        icon: "error",
                        confirmButtonText: "Volver"
                    }).then(() => {
                        window.location.href = "/registro.html";
                    });
                </script>
            `);
        }

        res.send(`
            <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
            <script>
                Swal.fire({
                    title: "Veterinaria UC",
                    text: "✅ Cliente registrado con éxito",
                    icon: "success",
                    confirmButtonText: "Ir al inicio"
                }).then(() => {
                    window.location.href = "/index.html";
                });
            </script>
        `);
    });
});

// ------------------- LOGIN -------------------
app.post("/iniciosesion", (req, res) => {
    const { usuario, clave } = req.body;

    const sqlCliente = "SELECT * FROM clientes WHERE usuario = ? AND clave = ?";
    db.query(sqlCliente, [usuario, clave], (err, clientes) => {
        if (err) return res.status(500).send("Error en el servidor");

        if (clientes.length > 0) {
            req.session.id_cliente = clientes[0].id_cliente;

            return res.send(`
                <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
                <script>
                    Swal.fire({
                        title: "Veterinaria UC",
                        text: "✅ Bienvenido ${clientes[0].nombre_completo}",
                        icon: "success",
                        confirmButtonText: "Continuar"
                    }).then(() => {
                        window.location.href = "/menus/usuario.html";
                    });
                </script>
            `);
        } else {
            const sqlEmpleado = `
                SELECT e.*, r.nombre_rol 
                FROM empleados e 
                JOIN roles r ON e.id_rol = r.id_rol 
                WHERE e.usuario = ? AND e.clave = ?
            `;
            db.query(sqlEmpleado, [usuario, clave], (err, empleados) => {
                if (err) return res.status(500).send("Error en el servidor");

                if (empleados.length > 0) {
                    const empleado = empleados[0];

                    if (empleado.nombre_rol === "admin") {
                        return res.send(`
                            <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
                            <script>
                                Swal.fire({
                                    title: "Veterinaria UC",
                                    text: "✅ Bienvenido administrador",
                                    icon: "success",
                                    confirmButtonText: "Continuar"
                                }).then(() => {
                                    window.location.href = "/menus/admin.html";
                                });
                            </script>
                        `);
                    } else if (empleado.nombre_rol === "veterinario") {
                        return res.send(`
                            <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
                            <script>
                                Swal.fire({
                                    title: "Veterinaria UC",
                                    text: "✅ Bienvenido veterinario",
                                    icon: "success",
                                    confirmButtonText: "Continuar"
                                }).then(() => {
                                    window.location.href = "/menus/veterinario.html";
                                });
                            </script>
                        `);
                    }
                } else {
                    return res.send(`
                        <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
                        <script>
                            Swal.fire({
                                title: "Veterinaria UC",
                                text: "❌ Usuario o contraseña incorrectos",
                                icon: "error",
                                confirmButtonText: "Volver"
                            }).then(() => {
                                window.location.href = "/login.html";
                            });
                        </script>
                    `);
                }
            });
        }
    });
});

// ------------------- AGREGAR MASCOTA -------------------
app.post("/agregar_mascota", (req, res) => {
    const { nombre, especie, raza, color, tamano, anio_nacimiento } = req.body;
    const id_cliente = req.session.id_cliente;

    if (!id_cliente) {
        return res.status(401).json({ error: "Debes iniciar sesión para registrar una mascota" });
    }

    const sql = `INSERT INTO mascotas (nombre, especie, raza, color, tamaño, anio_nacimiento, id_cliente) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.query(sql, [nombre, especie, raza, color, tamano, anio_nacimiento, id_cliente], (err, result) => {
        if (err) {
            console.error("❌ Error al registrar la mascota:", err.sqlMessage);
            return res.status(500).json({ error: "Error SQL: " + err.sqlMessage });
        }

        res.status(200).json({ message: "Mascota registrada con éxito" });
    });
});

// ------------------- AGENDAR CITA -------------------
app.post("/agendarCita", (req, res) => {
    const { id_servicio, fecha_hora, recordatorio, intervalo } = req.body;

    if (!req.session.user) {
        return res.send("<script>alert('Debes iniciar sesión'); window.location.href='/login.html';</script>");
    }

    const id_cliente = req.session.user.id_cliente;

    const sql = "INSERT INTO citas (id_cliente, id_servicio, fecha_hora, recordatorio, intervalo) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [id_cliente, id_servicio, fecha_hora, recordatorio, intervalo], (err, result) => {
        if (err) {
            console.error("❌ Error al registrar cita:", err);
            return res.send(`
                <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
                <script>
                    Swal.fire({
                        icon: "error",
                        title: "Veterinaria UC",
                        text: "Error al registrar la cita",
                        confirmButtonText: "Intentar de nuevo"
                    }).then(() => {
                        window.location.href = "/agendar_cita.html";
                    });
                </script>
            `);
        }

        // Mensaje de éxito con opción a nueva cita
        res.send(`
            <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
            <script>
                Swal.fire({
                    icon: "success",
                    title: "Veterinaria UC",
                    text: "Cita registrada con éxito. ¿Desea agendar otra cita?",
                    showCancelButton: true,
                    confirmButtonText: "Sí",
                    cancelButtonText: "No"
                }).then((result) => {
                    if (result.isConfirmed) {
                        window.location.href = "/agendar_cita.html";
                    } else {
                        window.location.href = "/menus/usuario.html";
                    }
                });
            </script>
        `);
    });
});

// ------------------- INICIO SERVIDOR -------------------
app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
