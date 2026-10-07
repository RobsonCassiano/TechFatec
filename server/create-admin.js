import "dotenv/config"

import { randomBytes } from "node:crypto"

import bcrypt from "bcryptjs"

import mysql from "mysql2/promise"

const [emailArgument, ...nameParts] = process.argv
  .slice(2)
  .filter((argument) => argument !== "--")

const email = emailArgument?.trim().toLowerCase()

const fullName = nameParts.join(" ").trim()

if (
  !email ||
  email.length > 254 ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
  !fullName ||
  fullName.length > 160
) {
  console.error(
    'Uso: node server/create-admin.js "admin@fatec.edu.br" "Nome do gestor"',
  )

  process.exitCode = 1
} else {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || "127.0.0.1",

    port: Number.parseInt(process.env.MYSQL_PORT || "3306", 10),

    user: process.env.MYSQL_USER || "root",

    password: process.env.MYSQL_PASSWORD || "",

    database: process.env.MYSQL_DATABASE || "conecta_fatec",

    connectionLimit: 1,
  })

  try {
    const [admins] = await pool.execute(
      "SELECT id FROM users WHERE profile = 'manager' AND status = 'active' LIMIT 1",
    )

    if (admins.length) {
      throw new Error(
        "Já existe um gestor ativo. A criação de novos gestores deve ser feita pela instituição.",
      )
    }

    const password = randomBytes(24).toString("base64url")

    const passwordHash = await bcrypt.hash(password, 12)

    await pool.execute(
      `INSERT INTO users (full_name, email, password_hash, profile, status)
       VALUES (?, ?, ?, 'manager', 'active')`,

      [fullName, email, passwordHash],
    )

    console.log("Gestor inicial criado.")

    console.log(`E-mail: ${email}`)

    console.log(`Senha temporária: ${password}`)

    console.log(
      "Guarde a senha em local seguro; ela não será exibida novamente.",
    )
  } catch (error) {
    console.error(`Não foi possível criar o gestor inicial: ${error.message}`)

    process.exitCode = 1
  } finally {
    await pool.end()
  }
}
