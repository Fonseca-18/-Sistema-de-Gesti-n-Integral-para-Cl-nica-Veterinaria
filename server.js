const express = require("express");
const mysql = require("mysql2");
const path = require("path");
const session = require("express-session");
const axios = require("axios");

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
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
</head>
<body>
    <script>
        Swal.fire({
            icon: "success",
            title: "Veterinaria UC",
            text: "✅ Cliente registrado con éxito",
            confirmButtonText: "Ir al inicio"
        }).then(() => {
            window.location.href = "/index.html";
        });
    </script>
</body>
</html>
`);
    });
});

// ------------------- LOGIN -------------------
app.post("/iniciosesion", async (req, res) => {
    const { usuario, clave, "g-recaptcha-response": captchaToken } = req.body;

    if (!req.session.intentos) {
        req.session.intentos = 0;
    }

    // Si ya falló 2 veces, validar reCAPTCHA
    if (req.session.intentos >= 2) {
        if (!captchaToken) {
            return res.send(`
                <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
                <script>
                    Swal.fire({
                        title:"Veterinaria UC",
                        text:"❌ Debes resolver el captcha",
                        icon:"error",
                        confirmButtonText:"Reintentar"
                    }).then(()=>{ window.location.href="/login.html?captcha=1"; });
                </script>
            `);
        }

        try {
            const params = new URLSearchParams();
            params.append("secret", "6LdYe8ErAAAAAODN6EjGHm7D-D6iPjoqCVpBtBrm");  
            params.append("response", captchaToken);
            params.append("remoteip", req.ip);

            const { data } = await axios.post(
                "https://www.google.com/recaptcha/api/siteverify",
                params
            );

            console.log("reCAPTCHA verify:", data);

            if (!data.success) {
                const codes = (data["error-codes"] || []).join(", ");
                return res.send(`
                    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
                    <script>
                        Swal.fire({
                            title: "Veterinaria UC",
                            html: "❌ Captcha inválido<br><small>${codes}</small>",
                            icon: "error",
                            confirmButtonText: "Reintentar"
                        }).then(() => {
                            window.location.href = "/login.html?captcha=1";
                        });
                    </script>
                `);
            }
        } catch (e) {
            console.error("❌ Error validando reCAPTCHA:", e);
            return res.status(500).send("Error validando captcha");
        }
    }

    // ---- Validación en MySQL ----
    const sqlCliente = "SELECT * FROM clientes WHERE usuario = ? AND clave = ?";
    db.query(sqlCliente, [usuario, clave], (err, clientes) => {
        if (err) return res.status(500).send("Error en el servidor");

        if (clientes.length > 0) {
            req.session.id_cliente = clientes[0].id_cliente;
            req.session.intentos = 0;

            return res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
</head>
<body>
    <script>
        Swal.fire({
            icon: "success",
            title: "Veterinaria UC",
            text: "✅ Bienvenido ${clientes[0].nombre_completo}",
            confirmButtonText: "Entrar"
        }).then(() => {
            window.location.href = "/menus/usuario.html";
        });
    </script>
</body>
</html>
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
                    req.session.intentos = 0;
                    const empleado = empleados[0];

                    if (empleado.nombre_rol === "admin") {
                        return res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
</head>
<body>
    <script>
        Swal.fire({
            icon: "success",
            title: "Veterinaria UC",
            text: "✅ Bienvenido Admin",
            confirmButtonText: "Entrar"
        }).then(() => {
            window.location.href = "/menus/admin.html";
        });
    </script>
</body>
</html>
`);
                    } else if (empleado.nombre_rol === "veterinario") {
                        return res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
</head>
<body>
    <script>
        Swal.fire({
            icon: "success",
            title: "Veterinaria UC",
            text: "✅ Bienvenido Veterinario",
            confirmButtonText: "Entrar"
        }).then(() => {
            window.location.href = "/menus/veterinario.html";
        });
    </script>
</body>
</html>
`);
                    }
                } else {
                    req.session.intentos++;

                    return res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
</head>
<body>
    <script>
        Swal.fire({
            icon: "error",
            title: "Veterinaria UC",
            text: "❌ Usuario o contraseña incorrectos",
            confirmButtonText: "Intentar de nuevo"
        }).then(() => {
            window.location.href = "/login.html?captcha=${req.session.intentos >= 2 ? 1 : 0}";
        });
    </script>
</body>
</html>
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

// --------- ENDPOINTS para llenar selects dinámicos ---------
app.get("/api/mascotas", (req, res) => {
    if (!req.session.id_cliente) return res.json([]);
    const sql = "SELECT id_mascota, nombre, especie, raza FROM mascotas WHERE id_cliente = ?";
    db.query(sql, [req.session.id_cliente], (err, rows) => {
        if (err) {
            console.error("❌ Error al obtener mascotas:", err);
            return res.status(500).json([]);
        }
        res.json(rows);
    });
});

app.get("/api/servicios", (req, res) => {
    const sql = "SELECT id_servicio, nombre_servicio, tarifa FROM servicios";
    db.query(sql, (err, rows) => {
        if (err) {
            console.error("❌ Error al obtener servicios:", err);
            return res.status(500).json([]);
        }
        res.json(rows);
    });
});

app.get("/api/veterinarios", (req, res) => {
    const sql = "SELECT id_empleado, nombre_completo, especialidad FROM empleados WHERE id_rol = 2";
    db.query(sql, (err, rows) => {
        if (err) {
            console.error("❌ Error al obtener veterinarios:", err);
            return res.status(500).json([]);
        }
        res.json(rows);
    });
});

// ------------------- AGENDAR CITA -------------------
app.post("/agendarCita", (req, res) => {
    const { id_mascota, id_servicio, id_empleado, fecha_hora, recordatorio, intervalo } = req.body;

    // Validar sesión del cliente
    if (!req.session.id_cliente) {
        return res.send(`
            <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
            <script>
                Swal.fire({
                    icon: "warning",
                    title: "Veterinaria UC",
                    text: "Debes iniciar sesión para agendar una cita",
                    confirmButtonText: "Iniciar sesión"
                }).then(() => window.location.href = "/login.html");
            </script>
        `);
    }

    const id_cliente = req.session.id_cliente;

    const sql = `
        INSERT INTO citas (id_cliente, id_mascota, id_servicio, id_veterinario, fecha_hora, recordatorio, intervalo)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [id_cliente, id_mascota, id_servicio, id_empleado, fecha_hora, recordatorio, intervalo], (err) => {
        if (err) {
            console.error("❌ Error al registrar cita:", err);
            return res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
</head>
<body>
    <script>
        Swal.fire({
            icon: "error",
            title: "Veterinaria UC",
            text: "❌ Error al registrar la cita",
            confirmButtonText: "Intentar de nuevo"
        }).then(() => {
            window.location.href = "/agendar_cita.html";
        });
    </script>
</body>
</html>
            `);
        }

        // ✅ Mensaje emergente como el de inicio de sesión
        res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
</head>
<body>
    <script>
        Swal.fire({
            icon: "success",
            title: "Veterinaria UC",
            text: "✅ Cita registrada con éxito",
            confirmButtonText: "Ir al menú"
        }).then(() => {
            window.location.href = "/menus/usuario.html";
        });
    </script>
</body>
</html>
        `);
    });
});

// ------------------- VER CITAS DEL CLIENTE -------------------
app.get("/api/citas", (req, res) => {
    if (!req.session.id_cliente) {
        return res.status(401).json({ error: "No has iniciado sesión" });
    }

    const sql = `
        SELECT 
            c.id_cita,
            m.nombre AS mascota,
            s.nombre_servicio AS servicio,
            e.nombre_completo AS veterinario,
            DATE_FORMAT(c.fecha_hora, '%Y-%m-%d') AS fecha,
            DATE_FORMAT(c.fecha_hora, '%H:%i') AS hora,
            c.recordatorio,
            c.intervalo
        FROM citas c
        JOIN mascotas m ON c.id_mascota = m.id_mascota
        JOIN servicios s ON c.id_servicio = s.id_servicio
        JOIN empleados e ON c.id_veterinario = e.id_empleado
        WHERE c.id_cliente = ?
        ORDER BY c.fecha_hora DESC
    `;

    db.query(sql, [req.session.id_cliente], (err, rows) => {
        if (err) {
            console.error("❌ Error al obtener citas:", err);
            return res.status(500).json({ error: "Error al obtener citas" });
        }
        res.json(rows);
    });
});

// ------------------- OBTENER DATOS DEL CLIENTE -------------------
app.get("/api/cliente", (req, res) => {
    if (!req.session.id_cliente) {
        return res.status(401).json({ error: "No has iniciado sesión" });
    }

    const sql = `SELECT id_cliente, cedula, nombre_completo, usuario, correo, telefono, direccion 
                 FROM clientes WHERE id_cliente = ?`;

    db.query(sql, [req.session.id_cliente], (err, rows) => {
        if (err) {
            console.error("❌ Error al obtener cliente:", err);
            return res.status(500).json({ error: "Error al obtener cliente" });
        }
        res.json(rows[0]);
    });
});

// ------------------- EDITAR DATOS DEL CLIENTE -------------------
app.post("/api/cliente/editar", (req, res) => {
    if (!req.session.id_cliente) {
        return res.status(401).send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
</head>
<body>
    <script>
        Swal.fire({
            icon: "warning",
            title: "Veterinaria UC",
            text: "⚠️ Debes iniciar sesión para editar tus datos",
            confirmButtonText: "Iniciar sesión"
        }).then(() => window.location.href = "/login.html");
    </script>
</body>
</html>
        `);
    }

    const { cedula, nombre_completo, usuario, correo, telefono, direccion } = req.body;

    const sql = `
        UPDATE clientes 
        SET cedula = ?, nombre_completo = ?, usuario = ?, correo = ?, telefono = ?, direccion = ?
        WHERE id_cliente = ?
    `;

    db.query(sql, [cedula, nombre_completo, usuario, correo, telefono, direccion, req.session.id_cliente], (err) => {
        if (err) {
            console.error("❌ Error al editar cliente:", err);
            return res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
</head>
<body>
    <script>
        Swal.fire({
            icon: "error",
            title: "Veterinaria UC",
            text: "❌ Error al editar los datos",
            confirmButtonText: "Intentar de nuevo"
        }).then(() => window.location.href = "/editar_cliente.html");
    </script>
</body>
</html>
            `);
        }

        // ✅ Ahora con SweetAlert2 emergente igual al login
        res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
</head>
<body>
    <script>
        Swal.fire({
            icon: "success",
            title: "Veterinaria UC",
            text: "✅ Datos actualizados con éxito",
            confirmButtonText: "Aceptar"
        }).then(() => window.location.href = "/menus/usuario.html");
    </script>
</body>
</html>
        `);
    });
});

// ------------------- OBTENER UNA MASCOTA -------------------
app.get("/api/mascota/:id", (req, res) => {
    if (!req.session.id_cliente) {
        return res.status(401).json({ error: "No has iniciado sesión" });
    }

    const sql = `
        SELECT id_mascota, nombre, especie, raza, color, \`tamaño\` AS tamano, anio_nacimiento
        FROM mascotas 
        WHERE id_mascota = ? AND id_cliente = ?
    `;

    db.query(sql, [req.params.id, req.session.id_cliente], (err, rows) => {
        if (err) return res.status(500).json({ error: "Error al obtener mascota" });
        if (rows.length === 0) return res.status(404).json({ error: "Mascota no encontrada" });
        res.json(rows[0]);
    });
});

// ------------------- EDITAR UNA MASCOTA -------------------
app.post("/api/mascota/editar/:id", (req, res) => {
    if (!req.session.id_cliente) {
        return res.status(401).send(`
            <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
            <script>
                Swal.fire({
                    icon: "warning",
                    title: "Veterinaria UC",
                    text: "⚠️ Debes iniciar sesión para editar tu mascota",
                    confirmButtonText: "Iniciar sesión"
                }).then(() => window.location.href = "/login.html");
            </script>
        `);
    }

    const { nombre, especie, raza, color, tamano, anio_nacimiento } = req.body;

    const sql = `
        UPDATE mascotas 
        SET nombre = ?, especie = ?, raza = ?, color = ?, \`tamaño\` = ?, anio_nacimiento = ?
        WHERE id_mascota = ? AND id_cliente = ?
    `;

    db.query(sql, [nombre, especie, raza, color, tamano, anio_nacimiento, req.params.id, req.session.id_cliente], (err) => {
        if (err) {
            console.error("❌ Error al editar mascota:", err);
            return res.send(`
                <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
                <script>
                    Swal.fire({
                        icon: "error",
                        title: "Veterinaria UC",
                        text: "❌ Error al editar la mascota",
                        confirmButtonText: "Intentar de nuevo"
                    }).then(() => window.location.href = "/editardatos/editarmascota.html?id=${req.params.id}");
                </script>
            `);
        }

        res.send(`
            <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
            <script>
                Swal.fire({
                    icon: "success",
                    title: "Veterinaria UC",
                    text: "✅ Mascota editada con éxito",
                    confirmButtonText: "Aceptar"
                }).then(() => window.location.href = "/ver/vermascota.html");
            </script>
        `);
    });
});

// ------------------- LISTAR TODAS LAS MASCOTAS DEL CLIENTE -------------------
app.get("/api/mis-mascotas", (req, res) => {
    if (!req.session.id_cliente) {
        return res.status(401).json({ error: "No has iniciado sesión" });
    }

    const sql = `
        SELECT id_mascota, nombre, especie, raza, color, \`tamaño\` AS tamano, anio_nacimiento
        FROM mascotas
        WHERE id_cliente = ?
        ORDER BY nombre ASC
    `;

    db.query(sql, [req.session.id_cliente], (err, rows) => {
        if (err) {
            console.error("❌ Error al obtener mascotas:", err);
            return res.status(500).json({ error: "Error al obtener mascotas" });
        }
        res.json(rows);
    });
});

// ------------------- INICIO SERVIDOR -------------------
app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
