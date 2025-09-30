const express = require("express");
const mysql = require("mysql2");
const path = require("path");
const session = require("express-session");
const axios = require("axios");
const PDFDocument = require("pdfkit");
const moment = require("moment");

require('dotenv').config();

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// Función para enviar correo de bienvenida
async function enviarCorreoBienvenida(correo, nombreCompleto, tipoUsuario) {
  try {
    // Determinar el rol en español
    let rolTexto = "cliente";
    if (tipoUsuario === "veterinario") {
      rolTexto = "veterinario";
    } else if (tipoUsuario === "administrador" || tipoUsuario === "admin") {
      rolTexto = "administrador";
    }

    // Crear el HTML del correo con el formato proporcionado
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .emoji {
            font-size: 1.2em;
          }
          .highlight {
            font-weight: bold;
          }
          .signature {
            color: #666;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <h2>Hola ${nombreCompleto} <span class="emoji">🐾</span></h2>
        
        <p>¡Gracias por registrarte como <span class="highlight">${rolTexto}</span> en <span class="highlight">Veterinaria UC</span>!</p>
        
        <p>Estamos felices de tenerte con nosotros.</p>
        <p>Esperamos que disfrutes de nuestros servicios y que tu experiencia sea maravillosa.</p>
        
        <p class="signature">— El equipo de Veterinaria UC 💚</p>
      </body>
      </html>
    `;

    // Enviar el correo
    await transporter.sendMail({
      from: `"Veterinaria UC" <${process.env.MAIL_USER}>`,
      to: correo,
      subject: `¡Bienvenido a Veterinaria UC, ${nombreCompleto}!`,
      html: htmlContent
    });

    console.log(`✅ Correo de bienvenida enviado a ${correo}`);
    return true;
  } catch (error) {
    console.error("❌ Error enviando correo de bienvenida:", error);
    throw error;
  }
}

function enviarFacturaCita(correoDestino, datosFactura) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", async () => {
      const pdfData = Buffer.concat(buffers);
      try {
        await transporter.sendMail({
          from: `"Veterinaria UC" <${process.env.MAIL_USER}>`,
          to: correoDestino,
          subject: `Factura de cita para ${datosFactura.mascota}`,
          text: "Adjunto encontrarás la factura de tu cita en Veterinaria UC.",
          attachments: [
            {
              filename: `Factura-${datosFactura.mascota}.pdf`,
              content: pdfData
            }
          ]
        });
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    /* ====== Encabezado ====== */
    doc.fillColor("#4A90E2");
    doc.fontSize(24).text("Veterinaria UC", { align: "center" });
    doc.moveDown(0.5);
    doc.fillColor("#555").fontSize(14)
       .text("Factura de Servicios", { align: "center" });
    doc.moveDown();
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke("#4A90E2");
    doc.moveDown(1.5);

    /* ====== Datos del cliente ====== */
    doc.fontSize(12).fillColor("black");
    doc.text(`Cliente: ${datosFactura.cliente}`);
    doc.text(`Correo: ${correoDestino}`);
    doc.text(`Mascota: ${datosFactura.mascota}`);
    doc.text(`Veterinario: ${datosFactura.veterinario}`);
    doc.text(`Fecha y hora: ${moment(datosFactura.fechaHora).format("DD/MM/YYYY HH:mm")}`);
    doc.moveDown(1.2);

    /* ====== Tabla de Servicio ====== */
    const startX = 40;
    const tableY = doc.y;
    const colWidths = [220, 100, 100, 80];
    const headers = ["Servicio", "Fecha", "Valor", "IVA"];

    doc.fillColor("#4A90E2").fontSize(12).font("Helvetica-Bold");
    let x = startX;
    headers.forEach((h, i) => {
      doc.text(h, x, tableY, { width: colWidths[i], align: "center" });
      x += colWidths[i];
    });

    doc.moveDown(0.5);
    doc.moveTo(startX, tableY + 15).lineTo(555, tableY + 15).stroke("#4A90E2");

    const subtotal = datosFactura.valor;
    const iva = subtotal * 0.19;

    doc.font("Helvetica").fillColor("black");
    x = startX;
    const filaY = tableY + 25;
    doc.text(datosFactura.servicio, x, filaY, { width: colWidths[0], align: "center" }); x += colWidths[0];
    doc.text(moment(datosFactura.fechaHora).format("DD/MM"), x, filaY, { width: colWidths[1], align: "center" }); x += colWidths[1];
    doc.text(`$${subtotal.toFixed(2)}`, x, filaY, { width: colWidths[2], align: "center" }); x += colWidths[2];
    doc.text(`$${iva.toFixed(2)}`, x, filaY, { width: colWidths[3], align: "center" });

    doc.moveDown(3);

    /* ====== Total ====== */
    const total = subtotal + iva;
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#E74C3C");
    doc.text(`Total a pagar: $${total.toFixed(2)}`, { align: "right" });

    doc.moveDown(2);
    doc.font("Helvetica-Oblique").fontSize(12).fillColor("#333")
       .text("Gracias por confiar en Veterinaria UC. ¡Le esperamos en su próxima visita!", { align: "center" });

    doc.end();
  });
}

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

// ---------------- REGISTRO DE CLIENTES ----------------
app.post("/registro", (req, res) => {
  const { cedula, nombre_completo, usuario, clave, correo, telefono, direccion } = req.body;

  // Validación rápida de campos obligatorios
  if (!cedula || !nombre_completo || !usuario || !clave || !correo) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
      </head>
      <body>
        <script>
          Swal.fire({
            icon: 'error',
            title: 'Datos incompletos',
            text: 'Todos los campos marcados son obligatorios'
          }).then(() => window.history.back());
        </script>
      </body>
      </html>
    `);
  }

  // ✅ VALIDAR SI LA CÉDULA, CORREO O USUARIO YA EXISTEN
  const sqlCheck = `
    SELECT 
      CASE 
        WHEN cedula = ? THEN 'cédula'
        WHEN correo = ? THEN 'correo'
        WHEN usuario = ? THEN 'usuario'
      END AS campo_duplicado
    FROM clientes
    WHERE cedula = ? OR correo = ? OR usuario = ?
    LIMIT 1
  `;

  db.query(sqlCheck, [cedula, correo, usuario, cedula, correo, usuario], (err, rows) => {
    if (err) {
      console.error("Error al verificar duplicados:", err);
      return res.status(500).send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
        </head>
        <body>
          <script>
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Error en el servidor. Intenta de nuevo.'
            }).then(() => window.history.back());
          </script>
        </body>
        </html>
      `);
    }

    // Si encuentra algún registro duplicado
    if (rows.length > 0) {
      const campoDuplicado = rows[0].campo_duplicado;
      return res.status(400).send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
        </head>
        <body>
          <script>
            Swal.fire({
              icon: 'error',
              title: 'Dato duplicado',
              text: 'La ${campoDuplicado} ya está registrada en el sistema'
            }).then(() => window.history.back());
          </script>
        </body>
        </html>
      `);
    }

    // ✅ Si no hay duplicados, proceder con el registro
    const sql = `
      INSERT INTO clientes
      (cedula, nombre_completo, usuario, clave, correo, telefono, direccion)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      sql,
      [cedula, nombre_completo, usuario, clave, correo, telefono || null, direccion || null],
      async (err) => {
        if (err) {
          console.error("Error al registrar cliente:", err);
          return res.status(500).send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
              <meta charset="UTF-8">
              <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
            </head>
            <body>
              <script>
                Swal.fire({
                  icon: 'error',
                  title: 'Error',
                  text: 'No se pudo registrar el cliente. Intenta de nuevo.'
                }).then(() => window.history.back());
              </script>
            </body>
            </html>
          `);
        }

        // Enviar correo de bienvenida
        try {
          await enviarCorreoBienvenida(correo, nombre_completo, "cliente");
        } catch (e) {
          console.error("Error enviando correo de bienvenida:", e);
        }

        // ✅ Mensaje emergente de éxito
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
                icon: 'success',
                title: '¡Registro exitoso!',
                text: 'El cliente ha sido registrado',
                confirmButtonText: 'Aceptar'
              }).then(() => {
                window.location.href = '/index.html';
              });
            </script>
          </body>
          </html>
        `);
      }
    );
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
                        req.session.doctor_id = empleado.id_empleado;  
                        req.session.rol = "veterinario";
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

    const sql = `INSERT INTO mascotas (nombre, especie, raza, color, tamano, anio_nacimiento, id_cliente) 
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
  if (!req.session.id_cliente) {
    return res.send(`<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
      <script>
        Swal.fire({icon:"warning",title:"Veterinaria UC",text:"Debes iniciar sesión",confirmButtonText:"Iniciar"})
          .then(()=>window.location.href="/login.html");
      </script>`);
  }

  const id_cliente = req.session.id_cliente;
  const sql = `
    INSERT INTO citas (id_cliente, id_mascota, id_servicio, id_veterinario, fecha_hora, recordatorio, intervalo)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [id_cliente, id_mascota, id_servicio, id_empleado, fecha_hora, recordatorio, intervalo], (err, result) => {
    if (err) {
      console.error("❌ Error al registrar cita:", err);
      return res.send(/* SweetAlert error aquí */);
    }

    // 📩 Buscar datos para la factura
    const datosSQL = `
      SELECT cl.nombre_completo AS cliente, cl.correo,
             m.nombre AS mascota,
             s.nombre_servicio AS servicio, s.tarifa AS valor,
             e.nombre_completo AS veterinario
      FROM clientes cl
      JOIN mascotas m ON m.id_mascota = ?
      JOIN servicios s ON s.id_servicio = ?
      JOIN empleados e ON e.id_empleado = ?
      WHERE cl.id_cliente = ?
    `;
    db.query(datosSQL, [id_mascota, id_servicio, id_empleado, id_cliente], async (err2, rows) => {
      if (!err2 && rows.length > 0) {
        const d = rows[0];
        try {
          await enviarFacturaCita(d.correo, {
            cliente: d.cliente,
            mascota: d.mascota,
            servicio: d.servicio,
            veterinario: d.veterinario,
            fechaHora: fecha_hora,
            valor: parseFloat(d.valor)
          });
          console.log("✅ Factura enviada por correo");
        } catch (e) {
          console.error("❌ Error enviando factura:", e);
        }
      }
    });

    // ✅ SweetAlert de éxito en el navegador
    res.send(`
      <!DOCTYPE html><html lang="es"><head>
      <meta charset="UTF-8"><script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
      </head><body>
      <script>
        Swal.fire({
          icon: "success",
          title: "Cita agendada",
          text: "Se ha enviado la factura a tu correo",
          confirmButtonText: "Aceptar"
        }).then(() => window.location.href = "/menus/usuario.html");
      </script>
      </body></html>
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
        SELECT id_mascota, nombre, especie, raza, color, tamano, anio_nacimiento
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
    if (!req.session.id_cliente && !req.session.rol) {
        return res.status(401).send(`
            <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
            <script>
                Swal.fire({
                    icon: "warning",
                    title: "Veterinaria UC",
                    text: "⚠️ Debes iniciar sesión para editar una mascota",
                    confirmButtonText: "Iniciar sesión"
                }).then(() => window.location.href = "/login.html");
            </script>
        `);
    }

    const { id } = req.params;
    const { nombre, especie, raza, color, tamano, anio_nacimiento } = req.body;

    let sqlCheck;
    let paramsCheck;

    // 🔹 Cliente: solo puede editar sus propias mascotas
    if (req.session.id_cliente) {
        sqlCheck = "SELECT * FROM mascotas WHERE id_mascota = ? AND id_cliente = ?";
        paramsCheck = [id, req.session.id_cliente];
    } else if (req.session.rol === "admin" || req.session.rol === "veterinario") {
        // 🔹 Admin y Veterinario: pueden editar cualquier mascota
        sqlCheck = "SELECT * FROM mascotas WHERE id_mascota = ?";
        paramsCheck = [id];
    }

    db.query(sqlCheck, paramsCheck, (err, rows) => {
        if (err) {
            console.error("❌ Error al buscar mascota:", err);
            return res.status(500).send(`
                <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
                <script>
                    Swal.fire({
                        icon: "error",
                        title: "Veterinaria UC",
                        text: "❌ Error al buscar mascota",
                        confirmButtonText: "Intentar de nuevo"
                    }).then(() => window.location.href = "/ver/vermascota.html");
                </script>
            `);
        }

        if (rows.length === 0) {
            return res.status(404).send(`
                <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
                <script>
                    Swal.fire({
                        icon: "error",
                        title: "Veterinaria UC",
                        text: "❌ Mascota no encontrada o no tienes permiso",
                        confirmButtonText: "Volver"
                    }).then(() => window.location.href = "/ver/vermascota.html");
                </script>
            `);
        }

        // ✅ Si pasa la validación, se actualiza
        const sqlUpdate = `
            UPDATE mascotas
            SET nombre = ?, especie = ?, raza = ?, color = ?, tamano = ?, anio_nacimiento = ?
            WHERE id_mascota = ?
        `;
        const paramsUpdate = [nombre, especie, raza, color, tamano, anio_nacimiento, id];

        db.query(sqlUpdate, paramsUpdate, (err) => {
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
                        }).then(() => window.location.href = "/editardatos/editarmascota.html?id=${id}");
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
});

// ------------------- LISTAR TODAS LAS MASCOTAS DEL CLIENTE -------------------
app.get("/api/mis-mascotas", (req, res) => {
    if (!req.session.id_cliente) {
        return res.status(401).json({ error: "No has iniciado sesión" });
    }

    const sql = `
        SELECT id_mascota, nombre, especie, raza, color, tamano, anio_nacimiento
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

// ---------------- REGISTRO DE EMPLEADOS ----------------

app.post("/registro_empleado", (req, res) => {
  const { nombre_completo, usuario, clave, correo, telefono, id_rol, especialidad } = req.body;

  // ✅ Verificar duplicados en empleados
  const sqlCheck = `
    SELECT 
      CASE 
        WHEN correo = ? THEN 'correo'
        WHEN usuario = ? THEN 'usuario'
      END AS campo_duplicado
    FROM empleados
    WHERE correo = ? OR usuario = ?
    LIMIT 1
  `;

  db.query(sqlCheck, [correo, usuario, correo, usuario], (err, rows) => {
    if (err) {
      console.error("Error al verificar duplicados:", err);
      return res.status(500).json({
        success: false,
        message: "Error en el servidor."
      });
    }

    if (rows.length > 0) {
      const campoDuplicado = rows[0].campo_duplicado;
      return res.status(400).json({
        success: false,
        message: `El ${campoDuplicado} ya está registrado en el sistema`
      });
    }

    // Continuar con el INSERT original...
    const sql = `
      INSERT INTO empleados 
      (nombre_completo, usuario, clave, correo, telefono, id_rol, especialidad)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [nombre_completo, usuario, clave, correo, telefono, id_rol, especialidad || null], async (err) => {
      if (err) {
        console.error("Error al registrar empleado:", err);
        return res.status(500).json({
          success: false,
          message: "No se pudo registrar el empleado."
        });
      }

      try {
        let rolTexto = "empleado";
        if (id_rol == 2) rolTexto = "veterinario";
        if (id_rol == 1) rolTexto = "administrador";
        await enviarCorreoBienvenida(correo, nombre_completo, rolTexto);
      } catch (e) {
        console.error("Error enviando correo:", e);
      }

      res.status(200).json({
        success: true,
        message: "Empleado registrado con éxito"
      });
    });
  });
});

// ------------------- CONSULTAR CLIENTE Y MASCOTAS POR CÉDULA -------------------
app.get("/consulta_cliente/:cedula", (req, res) => {
    const cedula = req.params.cedula;

    // 1. Buscar cliente por cédula
    const sqlCliente = `
        SELECT id_cliente, nombre_completo, cedula, usuario, correo, telefono, direccion, creado_en
        FROM clientes
        WHERE cedula = ?
    `;

    db.query(sqlCliente, [cedula], (err, clienteRows) => {
        if (err) {
            console.error("Error al consultar cliente:", err);
            return res.json({ success: false, message: "Error en la consulta de cliente." });
        }

        if (clienteRows.length === 0) {
            return res.json({ success: false, message: "Cliente no encontrado." });
        }

        const cliente = clienteRows[0];

        // 2. Buscar mascotas asociadas a ese cliente
        const sqlMascotas = `
            SELECT nombre, especie, raza, color, tamano, anio_nacimiento
            FROM mascotas
            WHERE id_cliente = ?
        `;

        db.query(sqlMascotas, [cliente.id_cliente], (err2, mascotasRows) => {
            if (err2) {
                console.error("Error al consultar mascotas:", err2);
                return res.json({ success: false, message: "Error en la consulta de mascotas." });
            }

            res.json({
                success: true,
                cliente: cliente,
                mascotas: mascotasRows
            });
        });
    });
});

// Actualizar datos del cliente
app.put("/actualizar_cliente", (req, res) => {
    const { id_cliente, nombre_completo, telefono, correo, direccion } = req.body;

    const sql = `
      UPDATE clientes
      SET nombre_completo = ?, telefono = ?, correo = ?, direccion = ?
      WHERE id_cliente = ?
    `;
    db.query(sql, [nombre_completo, telefono, correo, direccion, id_cliente], (err, result) => {
        if (err) {
            console.error("Error al actualizar cliente:", err);
            return res.json({ success: false, message: "Error al actualizar cliente." });
        }
        res.json({ success: true });
    });
});

// Actualizar datos de una mascota
app.put("/actualizar_mascota", (req, res) => {
    const { id_mascota, nombre, especie, raza, color, tamano, anio_nacimiento } = req.body;

    const sql = `
      UPDATE mascotas
      SET nombre = ?, especie = ?, raza = ?, color = ?, tamano = ?, anio_nacimiento = ?
      WHERE id_mascota = ?
    `;
    db.query(sql, [nombre, especie, raza, color, tamano, anio_nacimiento, id_mascota], (err, result) => {
        if (err) {
            console.error("Error al actualizar mascota:", err);
            return res.json({ success: false, message: "Error al actualizar mascota." });
        }
        res.json({ success: true });
    });
});

// ---- RUTA: citas pendientes del doctor logueado ----
app.get("/citas_pendientes", (req, res) => {
    if (!req.session || !req.session.doctor_id) {
        return res.json({ success: false, message: "No has iniciado sesión como doctor." });
    }

    const idDoctor = req.session.doctor_id;

    const sql = `
        SELECT c.id_cita,
               cl.nombre_completo AS cliente,
               m.nombre AS mascota,
               s.nombre_servicio AS servicio,
               c.fecha_hora
        FROM citas c
        INNER JOIN clientes cl ON c.id_cliente = cl.id_cliente
        INNER JOIN mascotas m ON c.id_mascota = m.id_mascota
        INNER JOIN servicios s ON c.id_servicio = s.id_servicio
        WHERE c.id_veterinario = ? AND c.recordatorio = 'no'
        ORDER BY c.fecha_hora ASC
    `;

    db.query(sql, [idDoctor], (err, rows) => {
        if (err) {
            console.error("Error al obtener citas pendientes:", err);
            return res.json({ success: false, message: "Error al consultar las citas." });
        }
        res.json({ success: true, citas: rows });
    });
});

// ------------------- CERRAR SESIÓN -------------------
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("❌ Error al cerrar sesión:", err);
      return res.status(500).send("Error al cerrar sesión");
    }
    // Elimina la cookie de sesión en el navegador
    res.clearCookie("connect.sid");
    // Redirige al login o a la página principal
    res.redirect("/login.html");
  });
});

// ------------------- CANCELAR CITA -------------------
app.delete("/api/citas/:id", (req, res) => {
  if (!req.session.id_cliente) {
    return res.status(401).json({ error: "No has iniciado sesión" });
  }

  const idCita = req.params.id;

  // 🔎 Buscar los datos de la cita antes de eliminarla
  const sqlDatos = `
    SELECT c.id_cita,
           cl.nombre_completo AS cliente, cl.correo,
           m.nombre AS mascota,
           s.nombre_servicio AS servicio,
           e.nombre_completo AS veterinario,
           DATE_FORMAT(c.fecha_hora, '%Y-%m-%d') AS fecha,
           DATE_FORMAT(c.fecha_hora, '%H:%i') AS hora
    FROM citas c
    INNER JOIN clientes cl ON c.id_cliente = cl.id_cliente
    INNER JOIN mascotas m ON c.id_mascota = m.id_mascota
    INNER JOIN servicios s ON c.id_servicio = s.id_servicio
    INNER JOIN empleados e ON c.id_veterinario = e.id_empleado
    WHERE c.id_cita = ? AND c.id_cliente = ?
  `;

  db.query(sqlDatos, [idCita, req.session.id_cliente], (err, rows) => {
    if (err) {
      console.error("❌ Error buscando cita:", err);
      return res.status(500).json({ error: "Error en el servidor" });
    }

    if (rows.length === 0) {
      return res.status(404).json({ error: "Cita no encontrada o no autorizada" });
    }

    const cita = rows[0];

    // ❌ Eliminar la cita
    const sqlDelete = "DELETE FROM citas WHERE id_cita = ? AND id_cliente = ?";
    db.query(sqlDelete, [idCita, req.session.id_cliente], async (err2) => {
      if (err2) {
        console.error("❌ Error cancelando cita:", err2);
        return res.status(500).json({ error: "No se pudo cancelar la cita" });
      }

      // 📧 Enviar correo de cancelación
      try {
        await transporter.sendMail({
          from: `"Veterinaria UC" <${process.env.MAIL_USER}>`,
          to: cita.correo,
          subject: `Cita cancelada - ${cita.mascota}`,
          html: `
            <h2>Hola ${cita.cliente},</h2>
            <p>Te confirmamos que tu cita ha sido <b style="color:red;">cancelada</b>.</p>
            <ul>
              <li><b>Mascota:</b> ${cita.mascota}</li>
              <li><b>Servicio:</b> ${cita.servicio}</li>
              <li><b>Veterinario:</b> ${cita.veterinario}</li>
              <li><b>Fecha:</b> ${cita.fecha}</li>
              <li><b>Hora:</b> ${cita.hora}</li>
            </ul>
            <p>Si deseas reprogramar, por favor agenda una nueva cita desde nuestra plataforma.</p>
            <p>Saludos,<br><b>Veterinaria UC</b></p>
          `
        });

        console.log(`📧 Correo de cancelación enviado a ${cita.correo}`);
      } catch (e) {
        console.error("❌ Error enviando correo de cancelación:", e);
      }

      res.json({ message: "Cita cancelada correctamente" });
    });
  });
});

// === Chatbot ===
app.post("/chatbot", (req, res) => {
  const { message } = req.body;

  // Normalizar: minúsculas y quitar acentos
  const msg = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  let reply =
    "No entendí tu pregunta 😅. Puedes preguntar sobre: registrar mascotas, agendar o consultar citas, editar datos, horarios, soporte o cerrar sesión.";

  // === SALUDO ===
  if (msg.includes("hola") || msg.includes("buenas") || msg.includes("saludos")) {
    reply =
      "¡Hola! 👋 Soy tu asistente virtual de Veterinaria UC 🐾. Puedo ayudarte con registro de mascotas, citas, datos personales y más. ¿Qué necesitas?";
  }

  // === REGISTRAR MASCOTA ===
  else if (
    msg.includes("registrar mascota") ||
    msg.includes("como registro una mascota") ||
    msg.includes("como registro a mi mascota") ||
    msg.includes("donde registro mi mascota") ||
    msg.includes("quiero registrar una mascota") ||
    msg.includes("agregar mascota") ||
    msg.includes("añadir mascota") ||
    msg.includes("meter mascota") ||
    msg.includes("nueva mascota")
  ) {
    reply =
      "🐶 Para registrar una mascota:\n1. Entra al menú 'Registrar Mascota'.\n2. Completa nombre, especie, raza, edad y características.\n3. Haz clic en 'Guardar'.\n⚠️ Si dejas campos vacíos, el sistema no permitirá avanzar.";
  }

  // === AGENDAR CITA ===
  else if (
    msg.includes("agendar cita") ||
    msg.includes("quiero una cita") ||
    msg.includes("reservar cita") ||
    msg.includes("como saco cita") ||
    msg.includes("pedir cita") ||
    msg.includes("hacer cita") ||
    msg.includes("programar cita")
  ) {
    reply =
      "📅 Para agendar una cita:\n1. Ingresa al menú 'Agendar Cita'.\n2. Selecciona tu mascota.\n3. Elige fecha y hora disponibles.\n4. Confirma la cita.\n⚠️ No se permiten fechas pasadas ni horarios ya ocupados.";
  }

  // === CONSULTAR CITA ===
  else if (
    msg.includes("consultar cita") ||
    msg.includes("ver mis citas") ||
    msg.includes("donde veo mis citas") ||
    msg.includes("quiero revisar mis citas") ||
    msg.includes("estado de mi cita") ||
    msg.includes("historial de citas")
  ) {
    reply =
      "🔍 Para consultar tus citas:\n1. Ingresa a 'Consultar Cita'.\n2. Verás fecha, hora, mascota y estado (pendiente, confirmada o atendida).\n3. Puedes filtrar por mascota o estado.";
  }

  // === EDITAR DATOS PERSONALES ===
  else if (
    msg.includes("editar datos personales") ||
    msg.includes("cambiar mis datos") ||
    msg.includes("modificar mi informacion") ||
    msg.includes("actualizar mis datos") ||
    msg.includes("cambiar correo") ||
    msg.includes("cambiar telefono")
  ) {
    reply =
      "✏️ Para editar tus datos personales:\n1. Ve al menú 'Editar Datos Personales'.\n2. Cambia lo que necesites (nombre, correo, teléfono).\n3. Guarda los cambios.\n⚠️ Si eliminas correo o teléfono, puede afectar la comunicación de citas.";
  }

  // === EDITAR DATOS DE LA MASCOTA ===
  else if (
    msg.includes("editar mascota") ||
    msg.includes("editar datos de mi mascota") ||
    msg.includes("cambiar datos mascota") ||
    msg.includes("modificar mascota") ||
    msg.includes("actualizar mascota")
  ) {
    reply =
      "🐾 Para editar los datos de tu mascota:\n1. Ingresa a 'Editar Datos de la Mascota'.\n2. Cambia la información que quieras.\n3. Guarda los cambios.\n⚠️ El sistema debería impedir valores inválidos, como edad negativa.";
  }

  // === CERRAR SESIÓN ===
  else if (
    msg.includes("cerrar sesion") ||
    msg.includes("logout") ||
    msg.includes("salir de la cuenta") ||
    msg.includes("terminar sesion")
  ) {
    reply =
      "🚪 Para cerrar sesión, haz clic en el botón 'Cerrar Sesión' en la parte inferior del menú. ⚠️ Si cierras sin guardar, los cambios se perderán.";
  }

  // === HORARIO DE ATENCIÓN ===
  else if (
    msg.includes("horario") ||
    msg.includes("atencion") ||
    msg.includes("a que hora abren") ||
    msg.includes("cuando atienden") ||
    msg.includes("dias de servicio")
  ) {
    reply =
      "⏰ Nuestro horario es:\n- Lunes a viernes: 9:00 a 18:00\n- Sábados: 9:00 a 13:00\n⚠️ El sistema no permite agendar citas fuera de este horario.";
  }

  // === CONTACTO / SOPORTE ===
  else if (
    msg.includes("contacto") ||
    msg.includes("ayuda") ||
    msg.includes("soporte") ||
    msg.includes("hablar con alguien") ||
    msg.includes("problema con el sistema")
  ) {
    reply =
      "📧 Para ayuda, escribe a veterinariauc@gmail.com o llama al 📞 555-123-456.\nSi es un problema técnico, describe qué estabas haciendo cuando ocurrió.";
  }

  // === ERRORES COMUNES ===
  else if (
    msg.includes("que pasa si registro dos veces la misma mascota") ||
    msg.includes("duplicado mascota") ||
    msg.includes("registrar mascota repetida")
  ) {
    reply =
      "⚠️ Actualmente el sistema no valida duplicados estrictamente. Es posible registrar dos veces la misma mascota si usas datos diferentes. Lo recomendable es revisar bien antes de guardar.";
  } else if (
    msg.includes("que pasa si agendo dos citas a la misma hora") ||
    msg.includes("cita duplicada") ||
    msg.includes("doble cita")
  ) {
    reply =
      "⚠️ El sistema debería evitar que la misma mascota tenga dos citas en la misma fecha y hora. Si lo permite, sería un error de validación en la lógica.";
  } else if (
    msg.includes("que pasa si pongo la edad negativa") ||
    msg.includes("edad incorrecta") ||
    msg.includes("dato invalido")
  ) {
    reply =
      "⚠️ El sistema debería validar que la edad de la mascota sea un número positivo. Si te deja guardar un valor inválido, es un error de programación.";
  }

  // === DESPEDIDA ===
  else if (
    msg.includes("gracias") ||
    msg.includes("muchas gracias") ||
    msg.includes("hasta luego")
  ) {
    reply =
      "¡Con gusto! 😄 Estoy aquí para ayudarte siempre. ¡Hasta luego!";
  }

  res.json({ reply });
});

// ------------------- INICIO SERVIDOR -------------------
app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
