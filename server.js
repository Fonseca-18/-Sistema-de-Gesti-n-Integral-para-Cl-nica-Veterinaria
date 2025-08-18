const express = require("express");
const mysql = require("mysql2");
const path = require("path");

const app = express();
const PORT = 3000;

// Middleware para poder leer datos de formularios y JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Servir archivos estáticos (ej: tu login.html, registro.html, etc.)
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

// ------------------- REGISTRO -------------------
app.post("/registro", (req, res) => {
    const { nombre_completo, usuario, clave, correo, telefono, direccion } = req.body;

    const sql = "INSERT INTO clientes (nombre_completo, usuario, clave, correo, telefono, direccion) VALUES (?, ?, ?, ?, ?, ?)";
    db.query(sql, [nombre_completo, usuario, clave, correo, telefono, direccion], (err, result) => {
        if (err) {
            console.error("❌ Error al insertar:", err);
            res.status(500).send("Error al registrar el cliente");
            return;
        }
        res.redirect("/index.html"); // después de registrarse
    });
});

// ------------------- LOGIN -------------------
app.post("/iniciosesion", (req, res) => {
    const { usuario, clave } = req.body;

    const sql = "SELECT * FROM clientes WHERE usuario = ? AND clave = ?";
    db.query(sql, [usuario, clave], (err, results) => {
        if (err) {
            console.error("❌ Error al verificar login:", err);
            res.status(500).send("Error en el servidor");
            return;
        }

        if (results.length > 0) {
            console.log("✅ Login exitoso:", results[0].usuario);
            res.redirect("/menus/usuario.html"); // ✅ Ahora redirige a usuario.html dentro de /menus
        } else {
            console.log("❌ Intento de login fallido");
            res.send("Usuario o contraseña incorrectos. <a href='/login.html'>Volver</a>");
        }
    });
});

// ------------------- INICIO SERVIDOR -------------------
app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
