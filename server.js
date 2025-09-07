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
            // Enviar como application/x-www-form-urlencoded
            const params = new URLSearchParams();
            params.append("secret", "6LdYe8ErAAAAAODN6EjGHm7D-D6iPjoqCVpBtBrm");  
            params.append("response", captchaToken);
            params.append("remoteip", req.ip); // opcional

            const { data } = await axios.post(
                "https://www.google.com/recaptcha/api/siteverify",
                params
            );

            // Log en consola para depuración
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
            req.session.intentos = 0; // resetear intentos

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
