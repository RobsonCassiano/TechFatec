import "dotenv/config"
import { createHash, randomBytes, randomUUID } from "node:crypto"
import { createReadStream, createWriteStream } from "node:fs"
import { mkdir, rename, rm, stat } from "node:fs/promises"
import { createServer } from "node:http"
import path from "node:path"
import { pipeline } from "node:stream/promises"
import bcrypt from "bcryptjs"
import Busboy from "busboy"
import mysql from "mysql2/promise"
import nodemailer from "nodemailer"

const port = Number.parseInt(process.env.API_PORT || "3001", 10)
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number.parseInt(process.env.MYSQL_PORT || "3306", 10),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "conecta_fatec",
  waitForConnections: true,
  connectionLimit: 10,
})

const databaseProfiles = {
  Estudante: "student",
  Professor: "teacher",
}
const sessions = new Map()
const recoveryRequestsByAddress = new Map()
const sessionDurationSeconds = 8 * 60 * 60
const uploadsDirectory = path.resolve(
  process.env.UPLOADS_DIR || path.join(process.cwd(), "server", "uploads"),
)
const maximumUploadBytes = 100 * 1024 * 1024
const uploadTypes = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
}

function sendJson(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  })
  response.end(JSON.stringify(body))
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  )
}

function sessionCookie(request, token, maxAge) {
  const secure = request.socket.encrypted ? "; Secure" : ""
  return `techfatec_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`
}

function getSession(request) {
  const token = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("techfatec_session="))
    ?.slice("techfatec_session=".length)
  const session = token ? sessions.get(token) : null

  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token)
    return null
  }

  return { ...session.user, token }
}

async function readJsonBody(request) {
  let body = ""

  for await (const chunk of request) {
    body += chunk

    if (Buffer.byteLength(body) > 16_384) {
      const error = new Error("Request body too large")
      error.statusCode = 413
      throw error
    }
  }

  try {
    return JSON.parse(body)
  } catch {
    const error = new Error("Invalid JSON")
    error.statusCode = 400
    throw error
  }
}

async function parseUpload(request) {
  const contentType = request.headers["content-type"] || ""
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    const error = new Error("Envie um arquivo usando multipart/form-data.")
    error.statusCode = 415
    throw error
  }

  await mkdir(uploadsDirectory, { recursive: true })

  return new Promise((resolve, reject) => {
    let parseError = null
    let fileResult = null
    let temporaryPath = null
    let filePromise = Promise.resolve()
    let receivedFile = false
    const fields = {}
    const fail = (message, statusCode = 400) => {
      if (!parseError) {
        parseError = new Error(message)
        parseError.statusCode = statusCode
      }
    }
    let parser

    try {
      parser = Busboy({
        headers: request.headers,
        limits: {
          fileSize: maximumUploadBytes,
          files: 1,
          fields: 8,
          fieldSize: 4096,
          parts: 9,
        },
      })
    } catch {
      const error = new Error("Requisição de upload inválida.")
      error.statusCode = 400
      reject(error)
      return
    }

    parser.on("field", (name, value, info) => {
      if (info.nameTruncated || info.valueTruncated) {
        fail("Os dados enviados excedem o tamanho permitido.", 413)
        return
      }
      fields[name] = value
    })

    parser.on("file", (fieldName, stream, info) => {
      if (receivedFile || fieldName !== "file") {
        fail("Envie somente um arquivo no campo file.")
        stream.resume()
        return
      }

      receivedFile = true
      const originalFileName = path.basename(info.filename || "").slice(0, 255)
      const extension = path.extname(originalFileName).toLowerCase()
      const expectedMimeType = uploadTypes[extension]

      if (!originalFileName || !expectedMimeType) {
        fail(
          "Formato não permitido. Use PDF, documentos Office, texto, áudio, vídeo ou imagens.",
          415,
        )
        stream.resume()
        return
      }
      if (info.mimeType !== expectedMimeType) {
        fail("O tipo do arquivo não corresponde à extensão informada.", 415)
        stream.resume()
        return
      }

      const key = `${randomUUID()}${extension}`
      temporaryPath = path.join(uploadsDirectory, `${key}.tmp`)
      filePromise = pipeline(
        stream,
        createWriteStream(temporaryPath, { flags: "wx" }),
      )
        .then(async () => {
          if (stream.truncated) {
            fail("O arquivo excede o limite de 100 MB.", 413)
            return
          }
          const fileStats = await stat(temporaryPath)
          fileResult = {
            key,
            temporaryPath,
            originalFileName,
            mimeType: expectedMimeType,
            size: fileStats.size,
          }
        })
        .catch((error) => {
          fail("Não foi possível receber o arquivo.", 400)
          console.error("Upload stream failed:", error.message)
        })

      stream.on("limit", () =>
        fail("O arquivo excede o limite de 100 MB.", 413),
      )
    })

    parser.on("filesLimit", () => fail("Envie somente um arquivo."))
    parser.on("fieldsLimit", () => fail("Há campos demais no formulário."))
    parser.on("partsLimit", () => fail("Há partes demais no formulário."))
    parser.on("error", (error) => {
      fail("Upload inválido ou incompleto.")
      console.error("Multipart parser failed:", error.message)
    })
    parser.on("close", async () => {
      try {
        await filePromise
        if (parseError || !fileResult) {
          if (temporaryPath) await rm(temporaryPath, { force: true })
          if (!parseError) fail("Selecione um arquivo para enviar.")
          reject(parseError)
          return
        }
        resolve({ fields, file: fileResult })
      } catch (error) {
        if (temporaryPath) await rm(temporaryPath, { force: true })
        reject(error)
      }
    })
    request.on("error", (error) => {
      fail("Conexão interrompida durante o upload.")
      console.error("Upload request failed:", error.message)
    })
    request.pipe(parser)
  })
}

function validStoredKey(key) {
  return /^[0-9a-f-]{36}\.[a-z0-9]{1,8}$/.test(key || "")
}

async function removeStoredFile(key) {
  if (validStoredKey(key)) {
    await rm(path.join(uploadsDirectory, key), { force: true })
  }
}

async function handleRegistration(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "POST" })
    return
  }

  if (!request.headers["content-type"]?.includes("application/json")) {
    sendJson(response, 415, {
      error: "Content-Type must be application/json",
    })
    return
  }

  let registration

  try {
    registration = await readJsonBody(request)
  } catch (error) {
    sendJson(response, error.statusCode || 400, { error: error.message })
    return
  }

  if (!registration || typeof registration !== "object") {
    sendJson(response, 400, { error: "Corpo da requisição inválido." })
    return
  }

  const fullName =
    typeof registration.name === "string" ? registration.name.trim() : ""
  const email =
    typeof registration.email === "string"
      ? registration.email.trim().toLowerCase()
      : ""
  const password =
    typeof registration.password === "string" ? registration.password : ""
  const profile = databaseProfiles[registration.profile]

  if (!fullName || fullName.length > 160) {
    sendJson(response, 400, {
      error: "Informe um nome com até 160 caracteres.",
    })
    return
  }

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    sendJson(response, 400, { error: "Informe um e-mail válido." })
    return
  }

  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    sendJson(response, 400, {
      error: "A senha deve ter pelo menos 8 caracteres e no máximo 72 bytes.",
    })
    return
  }

  if (!profile) {
    sendJson(response, 400, { error: "Selecione um perfil válido." })
    return
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12)
    await pool.execute(
      `INSERT INTO users (full_name, email, password_hash, profile, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [fullName, email, passwordHash, profile],
    )

    sendJson(response, 201, {
      message: "Cadastro concluído. Você já pode entrar na plataforma.",
    })
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      sendJson(response, 409, { error: "Este e-mail já está cadastrado." })
      return
    }

    console.error("Registration endpoint failed:", error.message)
    sendJson(response, 503, { error: "Não foi possível concluir o cadastro." })
  }
}

function recoveryTransport() {
  const host = process.env.SMTP_HOST
  const port = Number.parseInt(process.env.SMTP_PORT || "587", 10)
  const sender = process.env.SMTP_FROM
  const user = process.env.SMTP_USER
  const password = process.env.SMTP_PASSWORD
  if (
    !host ||
    !sender ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    Boolean(user) !== Boolean(password)
  ) {
    throw new Error(
      "SMTP_HOST, SMTP_FROM e credenciais SMTP válidas são necessários.",
    )
  }

  const baseUrl = new URL(process.env.APP_BASE_URL || "http://localhost:8443")
  if (
    !["http:", "https:"].includes(baseUrl.protocol) ||
    baseUrl.username ||
    baseUrl.password
  ) {
    throw new Error("APP_BASE_URL deve ser uma URL HTTP(S) válida.")
  }

  return {
    transport: nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === "true",
      ...(user ? { auth: { user, pass: password } } : {}),
    }),
    sender,
    baseUrl,
  }
}

function recoveryMessage(response, statusCode = 202) {
  sendJson(response, statusCode, {
    message:
      "Se o e-mail corresponder a uma conta ativa, você receberá um link para redefinir a senha.",
  })
}

async function handlePasswordRecovery(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "POST" })
    return
  }
  if (!request.headers["content-type"]?.includes("application/json")) {
    sendJson(response, 415, {
      error: "Content-Type must be application/json",
    })
    return
  }

  let body
  try {
    body = await readJsonBody(request)
  } catch (error) {
    sendJson(response, error.statusCode || 400, { error: error.message })
    return
  }
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    sendJson(response, 400, { error: "Informe um e-mail válido." })
    return
  }

  const now = Date.now()
  const address = request.socket.remoteAddress || "unknown"
  const windowStart = now - 15 * 60 * 1000
  const recentRequests = (recoveryRequestsByAddress.get(address) || []).filter(
    (timestamp) => timestamp > windowStart,
  )
  if (recentRequests.length >= 5) {
    sendJson(response, 429, {
      error: "Muitas solicitações. Tente novamente em alguns minutos.",
    })
    return
  }
  recentRequests.push(now)
  recoveryRequestsByAddress.set(address, recentRequests)
  if (recoveryRequestsByAddress.size > 1000) {
    for (const [key, timestamps] of recoveryRequestsByAddress) {
      if (!timestamps.some((timestamp) => timestamp > windowStart)) {
        recoveryRequestsByAddress.delete(key)
      }
    }
  }

  let mail
  try {
    mail = recoveryTransport()
    await mail.transport.verify()
  } catch (error) {
    console.error("Password recovery SMTP is unavailable:", error.message)
    sendJson(response, 503, {
      error:
        "O serviço de e-mail está indisponível. Tente novamente mais tarde.",
    })
    return
  }

  try {
    const [users] = await pool.execute(
      `SELECT id, full_name, email FROM users
       WHERE email = ? AND status = 'active' LIMIT 1`,
      [email],
    )
    const user = users[0]
    if (!user) {
      recoveryMessage(response)
      return
    }

    const token = randomBytes(32).toString("base64url")
    const tokenHash = createHash("sha256").update(token).digest("hex")
    await pool.execute(
      `DELETE FROM password_reset_tokens
       WHERE user_id = ? OR expires_at <= CURRENT_TIMESTAMP(3)
          OR used_at IS NOT NULL`,
      [user.id],
    )
    await pool.execute(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 30 MINUTE))`,
      [user.id, tokenHash],
    )
    const resetUrl = new URL(mail.baseUrl)
    resetUrl.searchParams.set("token", token)
    resetUrl.hash = "reset-password"

    try {
      await mail.transport.sendMail({
        from: mail.sender,
        to: user.email,
        subject: "Redefinição de senha — TechFatec",
        text: `Olá, ${user.full_name}.\n\nUse este link para redefinir sua senha em até 30 minutos:\n${resetUrl.href}\n\nSe você não solicitou a redefinição, ignore esta mensagem.`,
        html: `<p>Olá, ${escapeHtml(user.full_name)}.</p><p>Use o link abaixo para redefinir sua senha em até 30 minutos:</p><p><a href="${escapeHtml(resetUrl.href)}">Redefinir senha</a></p><p>Se você não solicitou a redefinição, ignore esta mensagem.</p>`,
      })
    } catch (error) {
      await pool.execute(
        "DELETE FROM password_reset_tokens WHERE token_hash = ?",
        [tokenHash],
      )
      console.error("Password recovery email delivery failed:", error.message)
      sendJson(response, 503, {
        error:
          "Não foi possível enviar o e-mail de recuperação. Tente novamente.",
      })
      return
    }
    recoveryMessage(response)
  } catch (error) {
    console.error("Password recovery endpoint failed:", error.message)
    sendJson(response, 503, {
      error: "Não foi possível processar a recuperação de senha.",
    })
  } finally {
    mail.transport.close()
  }
}

async function handlePasswordReset(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "POST" })
    return
  }
  if (!request.headers["content-type"]?.includes("application/json")) {
    sendJson(response, 415, {
      error: "Content-Type must be application/json",
    })
    return
  }
  let body
  try {
    body = await readJsonBody(request)
  } catch (error) {
    sendJson(response, error.statusCode || 400, { error: error.message })
    return
  }

  const token = typeof body?.token === "string" ? body.token : ""
  const password = typeof body?.password === "string" ? body.password : ""
  if (
    !/^[A-Za-z0-9_-]{43}$/.test(token) ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    sendJson(response, 400, {
      error:
        "O link é inválido ou expirou, ou a senha não atende aos requisitos.",
    })
    return
  }
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const [validTokens] = await pool.execute(
    `SELECT reset_token.user_id
     FROM password_reset_tokens reset_token
     INNER JOIN users ON users.id = reset_token.user_id
     WHERE reset_token.token_hash = ? AND reset_token.used_at IS NULL
       AND reset_token.expires_at > CURRENT_TIMESTAMP(3)
       AND users.status = 'active'
     LIMIT 1`,
    [tokenHash],
  )
  if (!validTokens.length) {
    sendJson(response, 400, {
      error: "O link de redefinição é inválido, já foi utilizado ou expirou.",
    })
    return
  }
  const passwordHash = await bcrypt.hash(password, 12)
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [tokens] = await connection.execute(
      `SELECT reset_token.user_id
       FROM password_reset_tokens reset_token
       INNER JOIN users ON users.id = reset_token.user_id
       WHERE reset_token.token_hash = ? AND reset_token.used_at IS NULL
         AND reset_token.expires_at > CURRENT_TIMESTAMP(3)
         AND users.status = 'active'
       FOR UPDATE`,
      [tokenHash],
    )
    if (!tokens.length) {
      await connection.rollback()
      sendJson(response, 400, {
        error: "O link de redefinição é inválido, já foi utilizado ou expirou.",
      })
      return
    }
    const userId = tokens[0].user_id
    await connection.execute(
      "UPDATE users SET password_hash = ? WHERE id = ?",
      [passwordHash, userId],
    )
    await connection.execute(
      `UPDATE password_reset_tokens
       SET used_at = CURRENT_TIMESTAMP(3)
       WHERE user_id = ? AND token_hash = ?`,
      [userId, tokenHash],
    )
    await connection.execute(
      `DELETE FROM password_reset_tokens
       WHERE user_id = ? AND token_hash <> ?`,
      [userId, tokenHash],
    )
    await connection.commit()
    for (const [sessionToken, session] of sessions) {
      if (String(session.user.id) === String(userId)) {
        sessions.delete(sessionToken)
      }
    }
    sendJson(response, 200, {
      message: "Senha redefinida. Entre com a nova senha.",
    })
  } catch (error) {
    await connection.rollback()
    console.error("Password reset endpoint failed:", error.message)
    sendJson(response, 503, {
      error: "Não foi possível redefinir a senha.",
    })
  } finally {
    connection.release()
  }
}

async function handlePendingUsers(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "GET" })
    return
  }

  const session = getSession(request)

  if (!session || session.profile !== "admin") {
    sendJson(response, 403, { error: "Acesso restrito a gestores." })
    return
  }

  try {
    const [users] = await pool.execute(
      `SELECT id, full_name, email, profile, created_at
       FROM users
       WHERE status = 'pending'
       ORDER BY created_at ASC`,
    )
    sendJson(response, 200, {
      users: users.map((user) => ({
        id: user.id,
        name: user.full_name,
        email: user.email,
        profile: user.profile,
        createdAt: user.created_at,
      })),
    })
  } catch (error) {
    console.error("Pending users endpoint failed:", error.message)
    sendJson(response, 503, {
      error: "Não foi possível carregar as solicitações.",
    })
  }
}

async function handleAdminUsers(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "GET" })
    return
  }

  const session = getSession(request)

  if (!session || session.profile !== "admin") {
    sendJson(response, 403, { error: "Acesso restrito a gestores." })
    return
  }

  const searchParams = new URL(request.url, "http://localhost").searchParams
  const query = searchParams.get("q")?.trim() || ""
  const profile = searchParams.get("profile") || ""
  const status = searchParams.get("status") || ""
  const validProfiles = new Set(["student", "teacher", "manager"])
  const validStatuses = new Set(["active", "pending", "disabled"])

  if (query.length > 160) {
    sendJson(response, 400, {
      error: "A pesquisa deve ter até 160 caracteres.",
    })
    return
  }

  if (profile && !validProfiles.has(profile)) {
    sendJson(response, 400, { error: "Filtro de perfil inválido." })
    return
  }

  if (status && !validStatuses.has(status)) {
    sendJson(response, 400, { error: "Filtro de status inválido." })
    return
  }

  const conditions = []
  const values = []

  if (query) {
    conditions.push("(full_name LIKE ? OR email LIKE ?)")
    values.push(`%${query}%`, `%${query}%`)
  }

  if (profile) {
    conditions.push("profile = ?")
    values.push(profile)
  }

  if (status) {
    conditions.push("status = ?")
    values.push(status)
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

  try {
    const [users] = await pool.execute(
      `SELECT id, full_name, email, profile, status, created_at
       FROM users
       ${where}
       ORDER BY created_at DESC
       LIMIT 200`,
      values,
    )

    sendJson(response, 200, {
      users: users.map((user) => ({
        id: user.id,
        name: user.full_name,
        email: user.email,
        profile: user.profile,
        status: user.status,
        createdAt: user.created_at,
      })),
    })
  } catch (error) {
    console.error("Admin users endpoint failed:", error.message)
    sendJson(response, 503, { error: "Não foi possível carregar os usuários." })
  }
}

async function handleUserStatus(request, response, userId) {
  if (request.method !== "PATCH") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "PATCH" })
    return
  }

  if (!request.headers["content-type"]?.includes("application/json")) {
    sendJson(response, 415, {
      error: "Content-Type must be application/json",
    })
    return
  }

  const session = getSession(request)

  if (!session || session.profile !== "admin") {
    sendJson(response, 403, { error: "Acesso restrito a gestores." })
    return
  }

  if (!/^[1-9]\d*$/.test(userId)) {
    sendJson(response, 400, { error: "Identificador de usuário inválido." })
    return
  }

  let body

  try {
    body = await readJsonBody(request)
  } catch (error) {
    sendJson(response, error.statusCode || 400, { error: error.message })
    return
  }

  if (!body || !["active", "disabled"].includes(body.status)) {
    sendJson(response, 400, { error: "O status informado é inválido." })
    return
  }

  try {
    const [users] = await pool.execute(
      "SELECT id, profile, status FROM users WHERE id = ? LIMIT 1",
      [userId],
    )
    const user = users[0]

    if (!user) {
      sendJson(response, 404, { error: "Usuário não encontrado." })
      return
    }

    if (String(user.id) === String(session.id) && body.status !== "active") {
      sendJson(response, 409, {
        error: "Você não pode desativar sua própria conta.",
      })
      return
    }

    if (
      user.profile === "manager" &&
      user.status === "active" &&
      body.status !== "active"
    ) {
      const [admins] = await pool.execute(
        "SELECT COUNT(*) AS total FROM users WHERE profile = 'manager' AND status = 'active'",
      )

      if (Number(admins[0].total) <= 1) {
        sendJson(response, 409, {
          error: "Não é possível desativar o último gestor ativo.",
        })
        return
      }
    }

    await pool.execute("UPDATE users SET status = ? WHERE id = ?", [
      body.status,
      userId,
    ])

    if (body.status !== "active") {
      for (const [token, activeSession] of sessions) {
        if (String(activeSession.user.id) === String(userId)) {
          sessions.delete(token)
        }
      }
    }

    sendJson(response, 200, { message: "Status do usuário atualizado." })
  } catch (error) {
    console.error("User status endpoint failed:", error.message)
    sendJson(response, 503, { error: "Não foi possível atualizar o usuário." })
  }
}

function groupQuery(
  searchParams,
  includeInactive,
  memberUserId = null,
  membershipOnly = false,
  teacherManagedOnly = false,
) {
  const query = searchParams.get("q")?.trim() || ""
  const theme = searchParams.get("theme")?.trim() || ""
  const level = searchParams.get("level") || ""
  const modality = searchParams.get("modality") || ""
  const status = searchParams.get("status") || ""
  const sort = searchParams.get("sort") || "relevance"

  if (query.length > 160 || theme.length > 80) {
    return { error: "A pesquisa ou o tema excede o tamanho permitido." }
  }

  if (level && !["beginner", "intermediate", "advanced"].includes(level)) {
    return { error: "Filtro de nível inválido." }
  }

  if (modality && !["online", "in_person", "hybrid"].includes(modality)) {
    return { error: "Filtro de modalidade inválido." }
  }

  if (status && !["active", "inactive", "archived"].includes(status)) {
    return { error: "Filtro de status inválido." }
  }

  if (!["relevance", "name", "members"].includes(sort)) {
    return { error: "Ordenação inválida." }
  }

  const conditions = []
  const values = memberUserId ? [memberUserId] : []
  if (memberUserId) values.push(memberUserId)

  if (!includeInactive) {
    conditions.push("g.status = 'active'")
  } else if (status) {
    conditions.push("g.status = ?")
    values.push(status)
  }

  if (query) {
    conditions.push(
      "(g.name LIKE ? OR g.description LIKE ? OR EXISTS (SELECT 1 FROM group_themes search_theme WHERE search_theme.group_id = g.id AND search_theme.theme LIKE ?))",
    )
    values.push(`%${query}%`, `%${query}%`, `%${query}%`)
  }

  if (theme) {
    conditions.push(
      "EXISTS (SELECT 1 FROM group_themes filter_theme WHERE filter_theme.group_id = g.id AND filter_theme.theme = ?)",
    )
    values.push(theme)
  }

  if (level) {
    conditions.push("g.level = ?")
    values.push(level)
  }

  if (modality) {
    conditions.push("g.modality = ?")
    values.push(modality)
  }

  if (membershipOnly) {
    conditions.push(
      `EXISTS (SELECT 1 FROM group_memberships mine
       WHERE mine.group_id = g.id AND mine.user_id = ? AND mine.status = 'active')`,
    )
    values.push(memberUserId)
  }

  if (teacherManagedOnly) {
    conditions.push(
      `EXISTS (
        SELECT 1 FROM group_mentors manager_mentor
        INNER JOIN users manager_teacher
          ON manager_teacher.id = manager_mentor.teacher_user_id
        WHERE manager_mentor.group_id = g.id
          AND manager_teacher.profile = 'teacher'
      )`,
    )
  }

  const orderBy = {
    relevance: "g.name ASC",
    name: "g.name ASC",
    members: "member_count DESC, g.name ASC",
  }[sort]
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

  return {
    sql: `SELECT
            ${
              memberUserId
                ? `EXISTS (SELECT 1 FROM group_memberships own
                   WHERE own.group_id = g.id AND own.user_id = ? AND own.status = 'active')`
                : "FALSE"
            } AS is_member,
            ${
              memberUserId
                ? `(SELECT own.status FROM group_memberships own
                    WHERE own.group_id = g.id AND own.user_id = ?
                    LIMIT 1)`
                : "NULL"
            } AS membership_status,
            g.id,
            g.name,
            g.description,
            g.level,
            g.modality,
            g.status,
            (SELECT GROUP_CONCAT(gt.theme ORDER BY gt.theme SEPARATOR ',')
             FROM group_themes gt WHERE gt.group_id = g.id) AS themes,
            (SELECT COUNT(*) FROM group_memberships gm
             WHERE gm.group_id = g.id AND gm.status = 'active') AS member_count,
            (SELECT m.title FROM meetings m
             WHERE m.group_id = g.id AND m.status = 'scheduled' AND m.starts_at >= CURRENT_TIMESTAMP
             ORDER BY m.starts_at ASC LIMIT 1) AS next_meeting_title,
            (SELECT m.starts_at FROM meetings m
             WHERE m.group_id = g.id AND m.status = 'scheduled' AND m.starts_at >= CURRENT_TIMESTAMP
             ORDER BY m.starts_at ASC LIMIT 1) AS next_meeting_at
          FROM study_groups g
          ${where}
          ORDER BY ${orderBy}
          LIMIT 200`,
    values,
  }
}

function formatGroups(rows) {
  return rows.map((group) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    level: group.level,
    modality: group.modality,
    status: group.status,
    themes: group.themes ? group.themes.split(",") : [],
    members: Number(group.member_count),
    nextMeetingTitle: group.next_meeting_title,
    nextMeetingAt: group.next_meeting_at,
    isMember: Boolean(group.is_member),
    membershipStatus: group.membership_status || null,
  }))
}

async function handleDisciplines(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "GET" })
    return
  }

  const session = getSession(request)

  if (!session || session.profile !== "professor") {
    request.resume()
    sendJson(response, 403, {
      error: "Apenas professores aprovados podem consultar as disciplinas.",
    })
    return
  }

  try {
    const [disciplines] = await pool.execute(
      `SELECT id, name
       FROM disciplines
       WHERE active = TRUE
       ORDER BY name`,
    )

    sendJson(response, 200, {
      disciplines,
    })
  } catch (error) {
    console.error("Disciplines listing failed:", error.message)

    sendJson(response, 503, {
      error: "Não foi possível carregar as disciplinas.",
    })
  }
}

async function handleMyGroups(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "GET" })
    return
  }

  const session = getSession(request)
  if (!session || session.profile !== "student") {
    sendJson(response, 403, {
      error: "Apenas estudantes podem consultar seus grupos.",
    })
    return
  }

  try {
    const query = groupQuery(
      new URL(request.url, "http://localhost").searchParams,
      false,
      session.id,
      true,
    )
    const [groups] = await pool.execute(query.sql, query.values)
    sendJson(response, 200, { groups: formatGroups(groups) })
  } catch (error) {
    console.error("My groups endpoint failed:", error.message)
    sendJson(response, 503, {
      error: "Não foi possível carregar seus grupos.",
    })
  }
}

async function handleMyMeetings(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "GET" })
    return
  }

  const session = getSession(request)
  if (!session || session.profile !== "student") {
    sendJson(response, 403, {
      error: "Apenas estudantes podem consultar seus encontros.",
    })
    return
  }

  try {
    const [meetings] = await pool.execute(
      `SELECT
         m.id,
         m.group_id,
         g.name AS group_name,
         m.title,
         DATE_FORMAT(m.starts_at, '%Y-%m-%dT%H:%i:%s') AS starts_at,
         DATE_FORMAT(m.ends_at, '%Y-%m-%dT%H:%i:%s') AS ends_at,
         m.modality,
         m.location_or_url
       FROM meetings m
       INNER JOIN study_groups g ON g.id = m.group_id
       INNER JOIN group_memberships gm
         ON gm.group_id = g.id
        AND gm.user_id = ?
        AND gm.status = 'active'
       WHERE g.status = 'active'
         AND m.status = 'scheduled'
         AND m.starts_at >= CURRENT_TIMESTAMP
       ORDER BY m.starts_at ASC
       LIMIT 200`,
      [session.id],
    )

    sendJson(response, 200, {
      meetings: meetings.map((meeting) => ({
        id: meeting.id,
        groupId: meeting.group_id,
        groupName: meeting.group_name,
        title: meeting.title,
        startsAt: meeting.starts_at,
        endsAt: meeting.ends_at,
        modality: meeting.modality,
        locationOrUrl: meeting.location_or_url,
      })),
    })
  } catch (error) {
    console.error("My meetings endpoint failed:", error.message)
    sendJson(response, 503, {
      error: "Não foi possível carregar seus próximos encontros.",
    })
  }
}

async function handleTeacherGroups(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "GET" })
    return
  }

  const session = getSession(request)
  if (!session || session.profile !== "professor") {
    sendJson(response, 403, {
      error: "Apenas professores podem consultar seus grupos orientados.",
    })
    return
  }

  try {
    const [groups] = await pool.execute(
      `SELECT g.id, g.name, g.description, g.level, g.modality, g.status,
         (SELECT GROUP_CONCAT(gt.theme ORDER BY gt.theme SEPARATOR ',')
          FROM group_themes gt WHERE gt.group_id = g.id) AS themes,
         (SELECT COUNT(*) FROM group_memberships gm
          WHERE gm.group_id = g.id AND gm.status = 'active') AS member_count,
         (SELECT COUNT(*) FROM meeting_attendance attendance
          INNER JOIN meetings meeting ON meeting.id = attendance.meeting_id
          WHERE meeting.group_id = g.id AND meeting.status = 'completed')
            AS attendance_count,
         (SELECT COUNT(*) FROM meeting_attendance attendance
          INNER JOIN meetings meeting ON meeting.id = attendance.meeting_id
          WHERE meeting.group_id = g.id AND meeting.status = 'completed'
            AND attendance.attendance_status = 'present') AS present_count,
         (SELECT COUNT(*) FROM activity_submissions submission
          INNER JOIN activities activity ON activity.id = submission.activity_id
          WHERE activity.group_id = g.id) AS submission_count,
         (SELECT COUNT(*) FROM activity_submissions submission
          INNER JOIN activities activity ON activity.id = submission.activity_id
          WHERE activity.group_id = g.id AND submission.status = 'completed')
            AS completed_count
       FROM group_mentors mentor
       INNER JOIN study_groups g ON g.id = mentor.group_id
       WHERE mentor.teacher_user_id = ? AND g.status = 'active'
       ORDER BY g.name`,
      [session.id],
    )
    const studentsByGroup = new Map()
    const pendingByGroup = new Map()
    if (groups.length) {
      const [students] = await pool.execute(
        `SELECT gm.group_id, gm.id AS membership_id, gm.status,
           DATE_FORMAT(gm.joined_at, '%Y-%m-%dT%H:%i:%s') AS requested_at,
           u.id, u.full_name, u.email
         FROM group_memberships gm
         INNER JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id IN (${groups.map(() => "?").join(", ")})
           AND gm.status IN ('active', 'pending')
           AND u.profile = 'student' AND u.status = 'active'
         ORDER BY u.full_name`,
        groups.map((group) => group.id),
      )
      for (const student of students) {
        if (student.status === "active") {
          const members = studentsByGroup.get(String(student.group_id)) || []
          members.push({
            id: student.id,
            membershipId: student.membership_id,
            name: student.full_name,
          })
          studentsByGroup.set(String(student.group_id), members)
        } else {
          const requests = pendingByGroup.get(String(student.group_id)) || []
          requests.push({
            id: student.membership_id,
            studentId: student.id,
            studentName: student.full_name,
            studentEmail: student.email,
            requestedAt: student.requested_at,
          })
          pendingByGroup.set(String(student.group_id), requests)
        }
      }
    }
    sendJson(response, 200, {
      groups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        level: group.level,
        modality: group.modality,
        themes: group.themes ? group.themes.split(",") : [],
        members: Number(group.member_count),
        attendanceCount: Number(group.attendance_count),
        presentCount: Number(group.present_count),
        attendanceRate: Number(group.attendance_count)
          ? Math.round(
              (Number(group.present_count) / Number(group.attendance_count)) *
                100,
            )
          : null,
        submissions: Number(group.submission_count),
        completedActivities: Number(group.completed_count),
        performanceRate: Number(group.submission_count)
          ? Math.round(
              (Number(group.completed_count) / Number(group.submission_count)) *
                100,
            )
          : null,
        students: studentsByGroup.get(String(group.id)) || [],
        pendingStudents: pendingByGroup.get(String(group.id)) || [],
      })),
    })
  } catch (error) {
    console.error("Teacher groups endpoint failed:", error.message)
    sendJson(response, 503, {
      error: "Não foi possível carregar seus grupos orientados.",
    })
  }
}

async function handleTeacherGroup(request, response, groupId) {
  const session = getSession(request)
  if (!session || session.profile !== "professor") {
    if (request.method !== "GET") request.resume()
    sendJson(response, 403, {
      error: "Apenas professores podem gerenciar grupos.",
    })
    return
  }
  if (!/^[1-9]\d*$/.test(groupId)) {
    request.resume()
    sendJson(response, 400, { error: "Identificador de grupo inválido." })
    return
  }
  if (!["PUT", "DELETE"].includes(request.method)) {
    sendJson(response, 405, { error: "Method not allowed" }, {
      Allow: "PUT, DELETE",
    })
    return
  }

  let body
  if (request.method === "PUT") {
    if (!request.headers["content-type"]?.includes("application/json")) {
      sendJson(response, 415, {
        error: "Content-Type must be application/json",
      })
      return
    }
    try {
      body = await readJsonBody(request)
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message })
      return
    }
  }

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [ownedGroups] = await connection.execute(
      `SELECT g.id, g.status FROM study_groups g
       INNER JOIN group_mentors mentor ON mentor.group_id = g.id
       WHERE g.id = ? AND mentor.teacher_user_id = ? FOR UPDATE`,
      [groupId, session.id],
    )
    if (!ownedGroups.length || ownedGroups[0].status === "archived") {
      await connection.rollback()
      sendJson(response, 404, { error: "Grupo não encontrado." })
      return
    }

    if (request.method === "DELETE") {
      await connection.execute(
        "UPDATE study_groups SET status = 'archived' WHERE id = ?",
        [groupId],
      )
      await connection.commit()
      sendJson(response, 200, { message: "Grupo arquivado." })
      return
    }

    const name = typeof body?.name === "string" ? body.name.trim() : ""
    const description =
      typeof body?.description === "string" ? body.description.trim() : ""
    const themes = Array.isArray(body?.themes)
      ? [
          ...new Set(
            body.themes.map((theme) => String(theme).trim()).filter(Boolean),
          ),
        ]
      : []
    if (
      !name ||
      name.length > 160 ||
      description.length > 5000 ||
      !["beginner", "intermediate", "advanced"].includes(body.level) ||
      !["online", "in_person", "hybrid"].includes(body.modality) ||
      themes.length > 10 ||
      themes.some((theme) => theme.length > 80)
    ) {
      await connection.rollback()
      sendJson(response, 400, {
        error: "Dados inválidos para atualizar o grupo.",
      })
      return
    }
    await connection.execute(
      `UPDATE study_groups SET name = ?, description = ?, level = ?, modality = ?
       WHERE id = ?`,
      [name, description, body.level, body.modality, groupId],
    )
    await connection.execute("DELETE FROM group_themes WHERE group_id = ?", [
      groupId,
    ])
    for (const theme of themes) {
      await connection.execute(
        "INSERT INTO group_themes (group_id, theme) VALUES (?, ?)",
        [groupId, theme],
      )
    }
    await connection.commit()
    sendJson(response, 200, { message: "Grupo atualizado." })
  } catch (error) {
    await connection.rollback()
    console.error("Teacher group management failed:", error.message)
    sendJson(response, 503, { error: "Não foi possível atualizar o grupo." })
  } finally {
    connection.release()
  }
}

async function handleTeacherGroupMembership(request, response, membershipId) {
  if (request.method !== "PATCH") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "PATCH" })
    return
  }
  const session = getSession(request)
  if (!session || session.profile !== "professor") {
    sendJson(response, 403, {
      error: "Apenas professores podem gerenciar alunos.",
    })
    return
  }
  if (!/^[1-9]\d*$/.test(membershipId)) {
    sendJson(response, 400, { error: "Identificador de matrícula inválido." })
    return
  }
  if (!request.headers["content-type"]?.includes("application/json")) {
    sendJson(response, 415, { error: "Content-Type must be application/json" })
    return
  }
  let body
  try {
    body = await readJsonBody(request)
  } catch (error) {
    sendJson(response, error.statusCode || 400, { error: error.message })
    return
  }
  if (body?.status !== "left") {
    sendJson(response, 400, { error: "A única ação disponível é remover o aluno." })
    return
  }
  try {
    const [result] = await pool.execute(
      `UPDATE group_memberships gm
       INNER JOIN study_groups g ON g.id = gm.group_id
       INNER JOIN group_mentors mentor ON mentor.group_id = g.id
       INNER JOIN users u ON u.id = gm.user_id
       SET gm.status = 'left', gm.is_leader = FALSE
       WHERE gm.id = ?
         AND g.status = 'active' AND mentor.teacher_user_id = ?
         AND u.profile = 'student' AND u.status = 'active'
         AND gm.status IN ('pending', 'active')`,
      [membershipId, session.id],
    )
    if (!result.affectedRows) {
      sendJson(response, 404, {
        error: "Participante não encontrado neste grupo.",
      })
      return
    }
    sendJson(response, 200, {
      message: "Aluno removido do grupo.",
    })
  } catch (error) {
    console.error("Teacher student removal failed:", error.message)
    sendJson(response, 503, {
      error: "Não foi possível atualizar a matrícula.",
    })
  }
}

async function handleTeacherAttendance(request, response, groupId) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "POST" })
    return
  }
  const session = getSession(request)
  if (!session || session.profile !== "professor") {
    request.resume()
    sendJson(response, 403, {
      error: "Apenas professores podem registrar frequência.",
    })
    return
  }
  if (!/^[1-9]\d*$/.test(groupId)) {
    request.resume()
    sendJson(response, 400, { error: "Identificador de grupo inválido." })
    return
  }
  if (!request.headers["content-type"]?.includes("application/json")) {
    sendJson(response, 415, { error: "Content-Type must be application/json" })
    return
  }
  let body
  try {
    body = await readJsonBody(request)
  } catch (error) {
    sendJson(response, error.statusCode || 400, { error: error.message })
    return
  }
  const title = typeof body?.title === "string" ? body.title.trim() : ""
  const startsAt = typeof body?.startsAt === "string" ? body.startsAt : ""
  const attendance = body?.attendance
  if (
    !title ||
    title.length > 160 ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startsAt) ||
    !Array.isArray(attendance) ||
    attendance.some(
      (item) =>
        !/^[1-9]\d*$/.test(String(item?.studentId || "")) ||
        !["present", "absent", "justified"].includes(item?.status),
    )
  ) {
    sendJson(response, 400, {
      error: "Informe encontro, data e frequência válida dos alunos.",
    })
    return
  }
  const [datePart, timePart] = startsAt.split("T")
  const [year, month, day] = datePart.split("-").map(Number)
  const [hour, minute] = timePart.split(":").map(Number)
  const startDate = new Date(year, month - 1, day, hour, minute)
  if (
    Number.isNaN(startDate.getTime()) ||
    startDate.getFullYear() !== year ||
    startDate.getMonth() !== month - 1 ||
    startDate.getDate() !== day ||
    startDate.getHours() !== hour ||
    startDate.getMinutes() !== minute ||
    startDate.getTime() > Date.now()
  ) {
    sendJson(response, 400, {
      error: "A data do encontro deve ser válida e não futura.",
    })
    return
  }
  const uniqueAttendance = new Map(
    attendance.map((item) => [String(item.studentId), item.status]),
  )
  if (uniqueAttendance.size !== attendance.length) {
    sendJson(response, 400, {
      error: "Há alunos repetidos na lista de frequência.",
    })
    return
  }
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [groups] = await connection.execute(
      `SELECT g.id, g.modality FROM study_groups g
       INNER JOIN group_mentors mentor ON mentor.group_id = g.id
       WHERE g.id = ? AND g.status = 'active'
         AND mentor.teacher_user_id = ? FOR UPDATE`,
      [groupId, session.id],
    )
    if (!groups.length) {
      await connection.rollback()
      sendJson(response, 404, { error: "Grupo não encontrado." })
      return
    }
    const [students] = await connection.execute(
      `SELECT u.id FROM group_memberships gm
       INNER JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = ? AND gm.status = 'active'
         AND u.status = 'active' AND u.profile = 'student'
       FOR UPDATE`,
      [groupId],
    )
    const activeIds = new Set(students.map((student) => String(student.id)))
    if (
      uniqueAttendance.size !== activeIds.size ||
      [...uniqueAttendance.keys()].some((id) => !activeIds.has(id))
    ) {
      await connection.rollback()
      sendJson(response, 400, {
        error:
          "A frequência deve incluir exatamente os alunos ativos do grupo.",
      })
      return
    }
    const startSql = `${startsAt.replace("T", " ")}:00.000`
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
    const localDatePart = [
      endDate.getFullYear(),
      String(endDate.getMonth() + 1).padStart(2, "0"),
      String(endDate.getDate()).padStart(2, "0"),
    ].join("-")
    const localTimePart = [
      String(endDate.getHours()).padStart(2, "0"),
      String(endDate.getMinutes()).padStart(2, "0"),
      "00",
    ].join(":")
    const endSql = `${localDatePart} ${localTimePart}.000`
    const [meeting] = await connection.execute(
      `INSERT INTO meetings (group_id, title, starts_at, ends_at, modality, status)
       VALUES (?, ?, ?, ?, ?, 'completed')`,
      [groupId, title, startSql, endSql, groups[0].modality],
    )
    for (const [studentId, status] of uniqueAttendance) {
      await connection.execute(
        `INSERT INTO meeting_attendance (meeting_id, user_id, attendance_status)
         VALUES (?, ?, ?)`,
        [meeting.insertId, studentId, status],
      )
    }
    await connection.commit()
    sendJson(response, 201, { message: "Encontro e frequência registrados." })
  } catch (error) {
    await connection.rollback()
    console.error("Teacher attendance endpoint failed:", error.message)
    sendJson(response, 503, {
      error: "Não foi possível registrar a frequência.",
    })
  } finally {
    connection.release()
  }
}

async function handleManagerDashboard(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "GET" })
    return
  }
  const session = getSession(request)
  if (!session || session.profile !== "admin") {
    sendJson(response, 403, { error: "Acesso restrito a gestores." })
    return
  }
  try {
    const [groups] = await pool.execute(
      `SELECT g.id, g.name,
         GROUP_CONCAT(DISTINCT CASE WHEN teacher.profile = 'teacher' THEN teacher.full_name END ORDER BY teacher.full_name SEPARATOR ', ') AS teacher_name,
         COUNT(DISTINCT CASE WHEN gm.status = 'active' THEN gm.user_id END) AS student_count,
         COUNT(DISTINCT CASE WHEN meeting.status = 'completed' THEN meeting.id END) AS meeting_count,
         COUNT(DISTINCT CASE WHEN attendance.id IS NOT NULL THEN attendance.id END) AS attendance_count,
         COUNT(DISTINCT CASE WHEN attendance.attendance_status = 'present' THEN attendance.id END) AS present_count,
         COUNT(DISTINCT CASE WHEN submission.id IS NOT NULL THEN submission.id END) AS submission_count,
         COUNT(DISTINCT CASE WHEN submission.status = 'completed' THEN submission.id END) AS completed_count
       FROM study_groups g
       LEFT JOIN group_mentors mentor ON mentor.group_id = g.id
       LEFT JOIN users teacher ON teacher.id = mentor.teacher_user_id
       LEFT JOIN group_memberships gm ON gm.group_id = g.id
       LEFT JOIN meetings meeting ON meeting.group_id = g.id AND meeting.status = 'completed'
       LEFT JOIN meeting_attendance attendance ON attendance.meeting_id = meeting.id
       LEFT JOIN activities activity ON activity.group_id = g.id
       LEFT JOIN activity_submissions submission ON submission.activity_id = activity.id
       WHERE g.status = 'active'
         AND EXISTS (
           SELECT 1 FROM group_mentors monitoring_mentor
           INNER JOIN users monitoring_teacher
             ON monitoring_teacher.id = monitoring_mentor.teacher_user_id
           WHERE monitoring_mentor.group_id = g.id
             AND monitoring_teacher.profile = 'teacher'
         )
       GROUP BY g.id, g.name
       ORDER BY g.name`,
    )
    const [students] = await pool.execute(
      `SELECT g.id AS group_id, g.name AS group_name, u.id AS student_id,
         u.full_name AS student_name,
         COUNT(DISTINCT attendance.id) AS attendance_count,
         COUNT(DISTINCT CASE WHEN attendance.attendance_status = 'present' THEN attendance.id END) AS present_count,
         COUNT(DISTINCT submission.id) AS submission_count,
         COUNT(DISTINCT CASE WHEN submission.status = 'completed' THEN submission.id END) AS completed_count
       FROM group_memberships gm
       INNER JOIN study_groups g ON g.id = gm.group_id AND g.status = 'active'
       INNER JOIN users u ON u.id = gm.user_id AND u.status = 'active'
       LEFT JOIN meetings meeting ON meeting.group_id = g.id AND meeting.status = 'completed'
       LEFT JOIN meeting_attendance attendance
         ON attendance.meeting_id = meeting.id AND attendance.user_id = u.id
       LEFT JOIN activities activity ON activity.group_id = g.id
       LEFT JOIN activity_submissions submission
         ON submission.activity_id = activity.id AND submission.user_id = u.id
       WHERE gm.status = 'active' AND u.profile = 'student'
         AND EXISTS (
           SELECT 1 FROM group_mentors monitoring_mentor
           INNER JOIN users monitoring_teacher
             ON monitoring_teacher.id = monitoring_mentor.teacher_user_id
           WHERE monitoring_mentor.group_id = g.id
             AND monitoring_teacher.profile = 'teacher'
         )
       GROUP BY g.id, g.name, u.id, u.full_name
       ORDER BY g.name, u.full_name`,
    )
    const resultGroups = groups.map((group) => {
      const attendanceCount = Number(group.attendance_count)
      const submissionCount = Number(group.submission_count)
      return {
        id: group.id,
        name: group.name,
        teacherName: group.teacher_name || "Sem professor associado",
        students: Number(group.student_count),
        meetings: Number(group.meeting_count),
        attendanceRate: attendanceCount
          ? Math.round((Number(group.present_count) / attendanceCount) * 100)
          : null,
        completedActivities: Number(group.completed_count),
        submissions: submissionCount,
        performanceRate: submissionCount
          ? Math.round((Number(group.completed_count) / submissionCount) * 100)
          : null,
      }
    })
    sendJson(response, 200, {
      summary: {
        groups: resultGroups.length,
        students: new Set(students.map((student) => String(student.student_id)))
          .size,
        attendanceRate: (() => {
          const totalAttendance = groups.reduce(
            (sum, group) => sum + Number(group.attendance_count),
            0,
          )
          return totalAttendance
            ? Math.round(
                (groups.reduce(
                  (sum, group) => sum + Number(group.present_count),
                  0,
                ) /
                  totalAttendance) *
                  100,
              )
            : null
        })(),
        performanceRate: (() => {
          const total = resultGroups.reduce(
            (sum, group) => sum + group.submissions,
            0,
          )
          return total
            ? Math.round(
                (resultGroups.reduce(
                  (sum, group) => sum + group.completedActivities,
                  0,
                ) /
                  total) *
                  100,
              )
            : null
        })(),
      },
      groups: resultGroups,
      students: students.map((student) => {
        const attendanceCount = Number(student.attendance_count)
        const submissionCount = Number(student.submission_count)
        return {
          groupId: student.group_id,
          groupName: student.group_name,
          studentId: student.student_id,
          name: student.student_name,
          attendanceRate: attendanceCount
            ? Math.round(
                (Number(student.present_count) / attendanceCount) * 100,
              )
            : null,
          completedActivities: Number(student.completed_count),
          submissions: submissionCount,
          performanceRate: submissionCount
            ? Math.round(
                (Number(student.completed_count) / submissionCount) * 100,
              )
            : null,
        }
      }),
    })
  } catch (error) {
    console.error("Manager dashboard endpoint failed:", error.message)
    sendJson(response, 503, {
      error: "Não foi possível carregar o dashboard de acompanhamento.",
    })
  }
}

function validateProjectInput(body) {
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const description =
    typeof body?.description === "string" ? body.description.trim() : ""
  const status = body?.status
  const startsOn = body?.startsOn || null
  const endsOn = body?.endsOn || null
  const validDate = (value) =>
    value === null ||
    (typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value)

  if (
    !name ||
    name.length > 200 ||
    !description ||
    description.length > 5000 ||
    !["planning", "in_progress", "completed", "cancelled"].includes(status) ||
    !validDate(startsOn) ||
    !validDate(endsOn) ||
    (startsOn && endsOn && endsOn < startsOn)
  ) {
    return {
      error:
        "Informe nome, descrição, status e datas válidas; o término não pode anteceder o início.",
    }
  }

  return { name, description, status, startsOn, endsOn }
}

async function handleProjects(request, response) {
  const session = getSession(request)
  if (!session || !["student", "professor"].includes(session.profile)) {
    request.resume()
    sendJson(response, 403, {
      error: "Apenas estudantes e professores podem consultar projetos.",
    })
    return
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "GET" })
    return
  }

  try {
    const student = session.profile === "student"
    const [rows] = await pool.execute(
      `SELECT project.id, project.group_id, group_record.name AS group_name,
         project.name, project.description, project.status,
         DATE_FORMAT(project.starts_on, '%Y-%m-%d') AS starts_on,
         DATE_FORMAT(project.ends_on, '%Y-%m-%d') AS ends_on,
         project.created_by_user_id,
         EXISTS (
           SELECT 1 FROM project_members own_member
           WHERE own_member.project_id = project.id
             AND own_member.user_id = ?
         ) AS is_member,
         (SELECT COUNT(*) FROM project_members project_member
          WHERE project_member.project_id = project.id) AS member_count
       FROM projects project
       INNER JOIN study_groups group_record ON group_record.id = project.group_id
       WHERE ${
         student
           ? `group_record.status = 'active'
              AND project.status <> 'cancelled'
              AND EXISTS (
                SELECT 1 FROM group_memberships membership
                WHERE membership.group_id = project.group_id
                  AND membership.user_id = ? AND membership.status = 'active'
              )`
           : `EXISTS (
                SELECT 1 FROM group_mentors mentor
                WHERE mentor.group_id = project.group_id
                  AND mentor.teacher_user_id = ?
              )`
       }
       ORDER BY project.created_at DESC, project.id DESC`,
      [session.id, session.id],
    )
    const membersByProject = new Map()
    if (rows.length) {
      const [members] = await pool.execute(
        `SELECT project_member.project_id, member.full_name
          FROM project_members project_member
          INNER JOIN users member ON member.id = project_member.user_id
          WHERE project_member.project_id IN (${rows.map(() => "?").join(", ")})
          ORDER BY member.full_name`,
        rows.map((project) => project.id),
      )
      for (const member of members) {
        const names = membersByProject.get(String(member.project_id)) || []
        names.push(member.full_name)
        membersByProject.set(String(member.project_id), names)
      }
    }
    sendJson(response, 200, {
      projects: rows.map((project) => ({
        id: project.id,
        groupId: project.group_id,
        groupName: project.group_name,
        name: project.name,
        description: project.description,
        status: project.status,
        startsOn: project.starts_on,
        endsOn: project.ends_on,
        createdByUserId: project.created_by_user_id,
        isMember: Boolean(project.is_member),
        members: Number(project.member_count),
        memberNames: membersByProject.get(String(project.id)) || [],
      })),
    })
  } catch (error) {
    console.error("Projects endpoint failed:", error.message)
    sendJson(response, 503, { error: "Não foi possível carregar os projetos." })
  }
}

async function handleTeacherGroupProjects(request, response, groupId) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "POST" })
    return
  }
  const session = getSession(request)
  if (!session || session.profile !== "professor") {
    request.resume()
    sendJson(response, 403, {
      error: "Apenas professores podem criar projetos.",
    })
    return
  }
  if (!/^[1-9]\d*$/.test(groupId)) {
    request.resume()
    sendJson(response, 400, { error: "Identificador de grupo inválido." })
    return
  }

  let body
  try {
    body = await readJsonBody(request)
  } catch (error) {
    sendJson(response, error.statusCode || 400, { error: error.message })
    return
  }
  const project = validateProjectInput(body)
  if (project.error) {
    sendJson(response, 400, { error: project.error })
    return
  }

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [groups] = await connection.execute(
      `SELECT group_record.id FROM study_groups group_record
       INNER JOIN group_mentors mentor ON mentor.group_id = group_record.id
       WHERE group_record.id = ? AND group_record.status = 'active'
         AND mentor.teacher_user_id = ? FOR UPDATE`,
      [groupId, session.id],
    )
    if (!groups.length) {
      await connection.rollback()
      sendJson(response, 404, { error: "Grupo não encontrado." })
      return
    }
    const [result] = await connection.execute(
      `INSERT INTO projects
         (group_id, created_by_user_id, name, description, status, starts_on, ends_on)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        groupId,
        session.id,
        project.name,
        project.description,
        project.status,
        project.startsOn,
        project.endsOn,
      ],
    )
    await connection.commit()
    sendJson(response, 201, {
      project: { id: result.insertId, groupId: Number(groupId), ...project },
      message: "Projeto criado.",
    })
  } catch (error) {
    await connection.rollback()
    console.error("Teacher project creation failed:", error.message)
    sendJson(response, 503, { error: "Não foi possível criar o projeto." })
  } finally {
    connection.release()
  }
}

async function handleTeacherProject(request, response, projectId) {
  if (request.method !== "PUT") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "PUT" })
    return
  }
  const session = getSession(request)
  if (!session || session.profile !== "professor") {
    request.resume()
    sendJson(response, 403, {
      error: "Apenas professores podem editar projetos.",
    })
    return
  }
  if (!/^[1-9]\d*$/.test(projectId)) {
    request.resume()
    sendJson(response, 400, { error: "Identificador de projeto inválido." })
    return
  }
  let body
  try {
    body = await readJsonBody(request)
  } catch (error) {
    sendJson(response, error.statusCode || 400, { error: error.message })
    return
  }
  const project = validateProjectInput(body)
  if (project.error) {
    sendJson(response, 400, { error: project.error })
    return
  }

  try {
    const [result] = await pool.execute(
      `UPDATE projects project
       INNER JOIN group_mentors mentor ON mentor.group_id = project.group_id
       SET project.name = ?, project.description = ?, project.status = ?,
           project.starts_on = ?, project.ends_on = ?
       WHERE project.id = ? AND mentor.teacher_user_id = ?`,
      [
        project.name,
        project.description,
        project.status,
        project.startsOn,
        project.endsOn,
        projectId,
        session.id,
      ],
    )
    if (!result.affectedRows) {
      const [ownedProjects] = await pool.execute(
        `SELECT project.id FROM projects project
         INNER JOIN group_mentors mentor ON mentor.group_id = project.group_id
         WHERE project.id = ? AND mentor.teacher_user_id = ?`,
        [projectId, session.id],
      )
      if (ownedProjects.length) {
        sendJson(response, 200, {
          project: { id: Number(projectId), ...project },
        })
        return
      }
      sendJson(response, 404, { error: "Projeto não encontrado." })
      return
    }
    sendJson(response, 200, { project: { id: Number(projectId), ...project } })
  } catch (error) {
    console.error("Teacher project update failed:", error.message)
    sendJson(response, 503, { error: "Não foi possível atualizar o projeto." })
  }
}

async function handleProjectMembership(request, response, projectId) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "POST" })
    return
  }
  const session = getSession(request)
  if (!session || session.profile !== "student") {
    request.resume()
    sendJson(response, 403, {
      error: "Apenas estudantes podem participar de projetos.",
    })
    return
  }
  if (!/^[1-9]\d*$/.test(projectId)) {
    request.resume()
    sendJson(response, 400, { error: "Identificador de projeto inválido." })
    return
  }

  try {
    const [projects] = await pool.execute(
      `SELECT project.id, project.group_id
       FROM projects project
       INNER JOIN study_groups group_record
         ON group_record.id = project.group_id AND group_record.status = 'active'
       INNER JOIN group_memberships membership
         ON membership.group_id = project.group_id
        AND membership.user_id = ? AND membership.status = 'active'
       WHERE project.id = ? AND project.status <> 'cancelled'`,
      [session.id, projectId],
    )
    if (!projects.length) {
      sendJson(response, 404, {
        error: "Projeto não encontrado ou você ainda não participa do grupo.",
      })
      return
    }
    await pool.execute(
      `INSERT INTO project_members (project_id, user_id)
       VALUES (?, ?) ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
      [projectId, session.id],
    )
    sendJson(response, 200, { message: "Você participa deste projeto." })
  } catch (error) {
    console.error("Project membership endpoint failed:", error.message)
    sendJson(response, 503, {
      error: "Não foi possível participar do projeto.",
    })
  }
}

async function handleCreateTeacherGroup(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "POST" })
    return
  }

  const session = getSession(request)
  if (!session || session.profile !== "professor") {
    request.resume()
    sendJson(response, 403, {
      error: "Apenas professores aprovados podem criar grupos.",
    })
    return
  }

  if (!request.headers["content-type"]?.includes("application/json")) {
    sendJson(response, 415, {
      error: "Content-Type must be application/json",
    })
    return
  }

  let body
  try {
    body = await readJsonBody(request)
  } catch (error) {
    sendJson(response, error.statusCode || 400, { error: error.message })
    return
  }

  const disciplineId = /^[1-9]\d*$/.test(String(body?.disciplineId || ""))
    ? Number(body.disciplineId)
    : null

  const name = typeof body?.name === "string" ? body.name.trim() : ""

  const description =
    typeof body?.description === "string" ? body.description.trim() : ""

  const level = body?.level
  const modality = body?.modality

  const themes = Array.isArray(body?.themes)
    ? [
        ...new Set(
          body.themes.map((theme) => String(theme).trim()).filter(Boolean),
        ),
      ]
    : []

  if (
    !disciplineId ||
    !name ||
    name.length > 160 ||
    description.length > 5000 ||
    !["beginner", "intermediate", "advanced"].includes(level) ||
    !["online", "in_person", "hybrid"].includes(modality) ||
    themes.length > 10 ||
    themes.some((theme) => theme.length > 80)
  ) {
    sendJson(response, 400, {
      error:
        "Selecione uma disciplina e informe nome (até 160 caracteres), descrição (até 5000), nível, modalidade e até 10 temas válidos.",
    })
    return
  }

  let connection

  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()

    const [disciplines] = await connection.execute(
      `SELECT id, name
       FROM disciplines
       WHERE id = ? AND active = TRUE
       FOR SHARE`,
      [disciplineId],
    )

    if (!disciplines.length) {
      await connection.rollback()
      sendJson(response, 400, {
        error: "A disciplina selecionada não existe ou está inativa.",
      })
      return
    }

    const discipline = disciplines[0]

    const [result] = await connection.execute(
      `INSERT INTO study_groups
         (discipline_id, name, description, level, modality, status, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, 'active', ?)`,
      [disciplineId, name, description, level, modality, session.id],
    )

    for (const theme of themes) {
      await connection.execute(
        "INSERT INTO group_themes (group_id, theme) VALUES (?, ?)",
        [result.insertId, theme],
      )
    }

    await connection.execute(
      "INSERT INTO group_mentors (group_id, teacher_user_id) VALUES (?, ?)",
      [result.insertId, session.id],
    )

    await connection.commit()

    sendJson(response, 201, {
      group: {
        id: result.insertId,
        disciplineId: discipline.id,
        disciplineName: discipline.name,
        name,
        description,
        level,
        modality,
        themes,
        members: 0,
        students: [],
      },
      message:
        "Grupo criado. Você já está associado e pode publicar materiais e tarefas.",
    })
  } catch (error) {
    if (connection) await connection.rollback()

    console.error("Teacher group creation failed:", error.message)

    sendJson(response, 503, {
      error: "Não foi possível criar o grupo.",
    })
  } finally {
    connection?.release()
  }
}

async function handleStudentGroupMessage(request, response, groupId) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "POST" })
    return
  }
  const session = getSession(request)
  if (!session || session.profile !== "student") {
    request.resume()
    sendJson(response, 403, {
      error: "Somente estudantes autenticados podem enviar mensagens.",
    })
    return
  }
  if (!/^[1-9]\d*$/.test(groupId)) {
    request.resume()
    sendJson(response, 400, { error: "Identificador de grupo inválido." })
    return
  }
  if (!request.headers["content-type"]?.includes("application/json")) {
    sendJson(response, 415, {
      error: "Content-Type must be application/json",
    })
    return
  }

  let body
  try {
    body = await readJsonBody(request)
  } catch (error) {
    sendJson(response, error.statusCode || 400, { error: error.message })
    return
  }
  const subject = typeof body?.subject === "string" ? body.subject.trim() : ""
  const message = typeof body?.message === "string" ? body.message.trim() : ""
  if (
    !/^[1-9]\d*$/.test(String(body?.teacherId || "")) ||
    !subject ||
    subject.length > 200 ||
    !message ||
    message.length > 5000
  ) {
    sendJson(response, 400, {
      error:
        "Informe professor, assunto (até 200 caracteres) e mensagem (até 5000).",
    })
    return
  }

  try {
    const [teachers] = await pool.execute(
      `SELECT teacher.id, teacher.full_name, teacher.email, g.name AS group_name
       FROM study_groups g
       INNER JOIN group_mentors mentor ON mentor.group_id = g.id
       INNER JOIN users teacher ON teacher.id = mentor.teacher_user_id
       WHERE g.id = ? AND g.status = 'active'
         AND teacher.id = ? AND teacher.profile = 'teacher'
         AND teacher.status = 'active'
         AND EXISTS (
           SELECT 1 FROM group_memberships membership
           WHERE membership.group_id = g.id
             AND membership.user_id = ? AND membership.status IN ('active', 'pending')
         )`,
      [groupId, body.teacherId, session.id],
    )
    if (!teachers.length) {
      sendJson(response, 404, {
        error: "Professor não associado a um grupo ativo.",
      })
      return
    }
    const [result] = await pool.execute(
      `INSERT INTO teacher_messages
         (group_id, student_user_id, teacher_user_id, sender_role, subject, message)
       VALUES (?, ?, ?, 'student', ?, ?)`,
      [groupId, session.id, body.teacherId, subject, message],
    )
    let notificationSent = false
    let mail
    try {
      mail = recoveryTransport()
      const teacherUrl = new URL(mail.baseUrl)
      teacherUrl.search = ""
      teacherUrl.hash = "professor-messages"
      await mail.transport.sendMail({
        from: mail.sender,
        to: teachers[0].email,
        subject: `TechFatec: nova mensagem — ${subject}`,
        text: `Olá, ${teachers[0].full_name}.\n\n${session.name} enviou uma mensagem no grupo ${teachers[0].group_name}.\n\nAssunto: ${subject}\n\n${message}\n\nAcesse a plataforma para responder: ${teacherUrl.href}`,
        html: `<p>Olá, ${escapeHtml(teachers[0].full_name)}.</p><p><strong>${escapeHtml(session.name)}</strong> enviou uma mensagem no grupo <strong>${escapeHtml(teachers[0].group_name)}</strong>.</p><p><strong>Assunto:</strong> ${escapeHtml(subject)}</p><p>${escapeHtml(message).replace(/\r?\n/g, "<br>")}</p><p><a href="${escapeHtml(teacherUrl.href)}">Acessar a plataforma para responder</a></p>`,
      })
      notificationSent = true
    } catch (error) {
      console.error("Student message email notification failed:", error.message)
    } finally {
      mail?.transport.close()
    }
    sendJson(response, 201, {
      id: result.insertId,
      notificationSent,
      message: notificationSent
        ? "Mensagem enviada e professor notificado por e-mail."
        : "Mensagem salva na plataforma, mas a notificação por e-mail não foi enviada.",
    })
  } catch (error) {
    console.error("Student message endpoint failed:", error.message)
    sendJson(response, 503, { error: "Não foi possível enviar a mensagem." })
  }
}

async function handleStudentGroupMessages(request, response, groupId) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "GET" })
    return
  }
  const session = getSession(request)
  if (!session || session.profile !== "student") {
    sendJson(response, 403, {
      error: "Apenas estudantes podem consultar estas mensagens.",
    })
    return
  }
  if (!/^[1-9]\d*$/.test(groupId)) {
    sendJson(response, 400, { error: "Identificador de grupo inválido." })
    return
  }
  try {
    const [messages] = await pool.execute(
      `SELECT message.id, message.sender_role, message.subject, message.message,
         DATE_FORMAT(message.created_at, '%Y-%m-%dT%H:%i:%s') AS created_at,
         teacher.full_name AS teacher_name
       FROM teacher_messages message
       INNER JOIN users teacher ON teacher.id = message.teacher_user_id
       WHERE message.group_id = ? AND message.student_user_id = ?
         AND EXISTS (
           SELECT 1 FROM group_memberships membership
           WHERE membership.group_id = message.group_id
             AND membership.user_id = message.student_user_id
             AND membership.status IN ('active', 'pending')
         )
       ORDER BY message.created_at, message.id
       LIMIT 200`,
      [groupId, session.id],
    )
    sendJson(response, 200, {
      messages: messages.map((message) => ({
        id: message.id,
        senderRole: message.sender_role,
        subject: message.subject,
        message: message.message,
        teacherName: message.teacher_name,
        createdAt: message.created_at,
      })),
    })
  } catch (error) {
    console.error("Student group messages endpoint failed:", error.message)
    sendJson(response, 503, {
      error: "Não foi possível carregar as mensagens do grupo.",
    })
  }
}

async function handleTeacherMessageReply(request, response, messageId) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "POST" })
    return
  }
  const session = getSession(request)
  if (!session || session.profile !== "professor") {
    request.resume()
    sendJson(response, 403, {
      error: "Apenas professores podem responder mensagens.",
    })
    return
  }
  if (!/^[1-9]\d*$/.test(messageId)) {
    request.resume()
    sendJson(response, 400, { error: "Identificador de mensagem inválido." })
    return
  }
  if (!request.headers["content-type"]?.includes("application/json")) {
    sendJson(response, 415, { error: "Content-Type must be application/json" })
    return
  }
  let body
  try {
    body = await readJsonBody(request)
  } catch (error) {
    sendJson(response, error.statusCode || 400, { error: error.message })
    return
  }
  const message = typeof body?.message === "string" ? body.message.trim() : ""
  if (!message || message.length > 5000) {
    sendJson(response, 400, {
      error: "Informe uma resposta de até 5000 caracteres.",
    })
    return
  }
  try {
    const [original] = await pool.execute(
      `SELECT incoming.group_id, incoming.student_user_id, incoming.subject
       FROM teacher_messages incoming
       INNER JOIN group_mentors mentor ON mentor.group_id = incoming.group_id
       WHERE incoming.id = ? AND incoming.teacher_user_id = ?
         AND incoming.sender_role = 'student'
         AND mentor.teacher_user_id = ?`,
      [messageId, session.id, session.id],
    )
    if (!original.length) {
      sendJson(response, 404, {
        error: "Mensagem não encontrada nos seus grupos.",
      })
      return
    }
    await pool.execute(
      `INSERT INTO teacher_messages
         (group_id, student_user_id, teacher_user_id, sender_role, subject, message, status)
       VALUES (?, ?, ?, 'teacher', ?, ?, 'read')`,
      [
        original[0].group_id,
        original[0].student_user_id,
        session.id,
        original[0].subject.startsWith("Re: ")
          ? original[0].subject
          : `Re: ${original[0].subject}`.slice(0, 200),
        message,
      ],
    )
    sendJson(response, 201, { message: "Resposta enviada ao estudante." })
  } catch (error) {
    console.error("Teacher message reply failed:", error.message)
    sendJson(response, 503, { error: "Não foi possível enviar a resposta." })
  }
}

async function handleTeacherMessages(request, response, messageId = null) {
  const session = getSession(request)
  if (!session || session.profile !== "professor") {
    if (request.method !== "GET") request.resume()
    sendJson(response, 403, {
      error: "Apenas professores podem acessar suas mensagens.",
    })
    return
  }
  if (!messageId && request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "GET" })
    return
  }
  if (messageId && request.method !== "PATCH") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "PATCH" })
    return
  }
  if (messageId && !/^[1-9]\d*$/.test(messageId)) {
    sendJson(response, 400, { error: "Identificador de mensagem inválido." })
    return
  }

  try {
    if (messageId) {
      const [result] = await pool.execute(
        `UPDATE teacher_messages SET status = 'read'
         WHERE id = ? AND teacher_user_id = ?`,
        [messageId, session.id],
      )
      if (!result.affectedRows) {
        sendJson(response, 404, { error: "Mensagem não encontrada." })
        return
      }
      sendJson(response, 200, { message: "Mensagem marcada como lida." })
      return
    }
    const [messages] = await pool.execute(
      `SELECT m.id, m.group_id, g.name AS group_name, m.sender_role, m.subject,
         m.message, m.status,
         DATE_FORMAT(m.created_at, '%Y-%m-%dT%H:%i:%s') AS created_at,
         student.full_name AS student_name, student.email AS student_email
       FROM teacher_messages m
       INNER JOIN study_groups g ON g.id = m.group_id
       INNER JOIN users student ON student.id = m.student_user_id
       WHERE m.teacher_user_id = ?
       ORDER BY m.created_at DESC
       LIMIT 200`,
      [session.id],
    )
    sendJson(response, 200, {
      messages: messages.map((item) => ({
        id: item.id,
        groupId: item.group_id,
        groupName: item.group_name,
        subject: item.subject,
        senderRole: item.sender_role,
        message: item.message,
        status: item.status,
        createdAt: item.created_at,
        studentName: item.student_name,
        studentEmail: item.student_email,
      })),
    })
  } catch (error) {
    console.error("Teacher messages endpoint failed:", error.message)
    sendJson(response, 503, { error: "Não foi possível carregar mensagens." })
  }
}

async function handleGroupTeachers(request, response, groupId) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "GET" })
    return
  }
  const session = getSession(request)
  if (!session || session.profile !== "student") {
    sendJson(response, 403, {
      error: "Entre como estudante para consultar os professores.",
    })
    return
  }
  if (!/^[1-9]\d*$/.test(groupId)) {
    sendJson(response, 400, { error: "Identificador de grupo inválido." })
    return
  }
  try {
    const [teachers] = await pool.execute(
      `SELECT teacher.id, teacher.full_name AS name, teacher.email
       FROM group_mentors mentor
       INNER JOIN users teacher ON teacher.id = mentor.teacher_user_id
       INNER JOIN study_groups g ON g.id = mentor.group_id
       WHERE mentor.group_id = ? AND g.status = 'active'
         AND teacher.status = 'active'
       ORDER BY teacher.full_name`,
      [groupId],
    )
    sendJson(response, 200, { teachers })
  } catch (error) {
    console.error("Group teachers endpoint failed:", error.message)
    sendJson(response, 503, {
      error: "Não foi possível carregar os professores do grupo.",
    })
  }
}

async function handleMaterials(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "GET" })
    return
  }

  const session = getSession(request)
  if (
    !session ||
    !["student", "professor", "admin"].includes(session.profile)
  ) {
    sendJson(response, 403, {
      error: "Entre na plataforma para ver materiais.",
    })
    return
  }

  const params = new URL(request.url, "http://localhost").searchParams
  const search = params.get("q")?.trim() || ""
  const type = params.get("type")?.trim() || ""
  if (search.length > 160 || type.length > 40) {
    sendJson(response, 400, { error: "Filtro de materiais inválido." })
    return
  }

  const conditions = ["g.status = 'active'"]
  const values = []
  if (session.profile === "student") {
    conditions.push(
      `EXISTS (SELECT 1 FROM group_memberships gm
       WHERE gm.group_id = m.group_id AND gm.user_id = ? AND gm.status = 'active')`,
    )
    values.push(session.id)
  } else if (session.profile === "professor") {
    conditions.push(
      `EXISTS (SELECT 1 FROM group_mentors mentor
       WHERE mentor.group_id = m.group_id AND mentor.teacher_user_id = ?)`,
    )
    values.push(session.id)
  }
  if (search) {
    conditions.push(
      "(m.title LIKE ? OR COALESCE(m.description, '') LIKE ? OR g.name LIKE ?)",
    )
    values.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }
  if (type) {
    conditions.push("m.type = ?")
    values.push(type)
  }

  try {
    const [materials] = await pool.execute(
      `SELECT m.id, m.group_id, g.name AS group_name, m.title, m.type,
         m.description, m.original_file_name, m.mime_type, m.file_size,
         m.created_at, uploader.full_name AS uploaded_by
       FROM materials m
       INNER JOIN study_groups g ON g.id = m.group_id
       INNER JOIN users uploader ON uploader.id = m.uploaded_by_user_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY m.created_at DESC
       LIMIT 200`,
      values,
    )
    sendJson(response, 200, {
      materials: materials.map((material) => ({
        id: material.id,
        groupId: material.group_id,
        groupName: material.group_name,
        title: material.title,
        type: material.type,
        description: material.description,
        fileName: material.original_file_name,
        mimeType: material.mime_type,
        fileSize: material.file_size ? Number(material.file_size) : null,
        createdAt: material.created_at,
        uploadedBy: material.uploaded_by,
      })),
    })
  } catch (error) {
    console.error("Materials endpoint failed:", error.message)
    sendJson(response, 503, { error: "Não foi possível carregar materiais." })
  }
}

async function handleTeacherMaterialUpload(request, response, groupId) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "POST" })
    return
  }

  const session = getSession(request)
  if (!session || session.profile !== "professor") {
    request.resume()
    sendJson(response, 403, {
      error: "Apenas professores podem publicar materiais.",
    })
    return
  }
  if (!/^[1-9]\d*$/.test(groupId)) {
    request.resume()
    sendJson(response, 400, { error: "Identificador de grupo inválido." })
    return
  }

  try {
    const [groups] = await pool.execute(
      `SELECT g.id FROM study_groups g
       INNER JOIN group_mentors mentor ON mentor.group_id = g.id
       WHERE g.id = ? AND g.status = 'active'
         AND mentor.teacher_user_id = ?`,
      [groupId, session.id],
    )
    if (!groups.length) {
      request.resume()
      sendJson(response, 403, {
        error: "Você não é responsável por este grupo.",
      })
      return
    }

    const upload = await parseUpload(request)
    const title = upload.fields.title?.trim() || ""
    const description = upload.fields.description?.trim() || ""
    if (!title || title.length > 200 || description.length > 5000) {
      await rm(upload.file.temporaryPath, { force: true })
      sendJson(response, 400, {
        error:
          "Informe um título de até 200 caracteres e uma descrição de até 5000 caracteres.",
      })
      return
    }

    const storedPath = path.join(uploadsDirectory, upload.file.key)
    await rename(upload.file.temporaryPath, storedPath)
    try {
      const [result] = await pool.execute(
        `INSERT INTO materials
           (group_id, uploaded_by_user_id, title, type, description, storage_key,
            original_file_name, mime_type, file_size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          groupId,
          session.id,
          title,
          path.extname(upload.file.originalFileName).slice(1).toLowerCase(),
          description || null,
          upload.file.key,
          upload.file.originalFileName,
          upload.file.mimeType,
          upload.file.size,
        ],
      )
      sendJson(response, 201, {
        id: result.insertId,
        message: "Material publicado para o grupo.",
      })
    } catch (error) {
      await removeStoredFile(upload.file.key)
      throw error
    }
  } catch (error) {
    if (error.statusCode) {
      sendJson(response, error.statusCode, { error: error.message })
      return
    }
    console.error("Material upload endpoint failed:", error.message)
    sendJson(response, 503, { error: "Não foi possível publicar o material." })
  }
}

async function handleMaterialFile(request, response, materialId) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "GET" })
    return
  }

  const session = getSession(request)
  if (!session) {
    sendJson(response, 403, {
      error: "Entre na plataforma para abrir o arquivo.",
    })
    return
  }
  if (!/^[1-9]\d*$/.test(materialId)) {
    sendJson(response, 400, { error: "Identificador de material inválido." })
    return
  }

  try {
    const [materials] = await pool.execute(
      `SELECT m.storage_key, m.original_file_name, m.mime_type
       FROM materials m
       INNER JOIN study_groups g ON g.id = m.group_id
       WHERE m.id = ? AND g.status = 'active'
         AND (
           ? = 'admin'
           OR (? = 'student' AND EXISTS (
             SELECT 1 FROM group_memberships gm
             WHERE gm.group_id = m.group_id AND gm.user_id = ? AND gm.status = 'active'
           ))
           OR (? = 'professor' AND EXISTS (
             SELECT 1 FROM group_mentors mentor
             WHERE mentor.group_id = m.group_id AND mentor.teacher_user_id = ?
           ))
         )
       LIMIT 1`,
      [
        materialId,
        session.profile,
        session.profile,
        session.id,
        session.profile,
        session.id,
      ],
    )
    const material = materials[0]
    if (!material || !validStoredKey(material.storage_key)) {
      sendJson(response, 404, { error: "Material não encontrado." })
      return
    }

    const filePath = path.join(uploadsDirectory, material.storage_key)
    const fileStats = await stat(filePath)
    const safeName = encodeURIComponent(
      material.original_file_name || "material",
    ).replace(
      /['()*]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    )
    response.writeHead(200, {
      "Content-Type": material.mime_type || "application/octet-stream",
      "Content-Length": fileStats.size,
      "Content-Disposition": `inline; filename*=UTF-8''${safeName}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    })
    createReadStream(filePath).pipe(response)
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(response, 404, { error: "Arquivo de material não encontrado." })
      return
    }
    console.error("Material download endpoint failed:", error.message)
    sendJson(response, 503, { error: "Não foi possível abrir o material." })
  }
}

async function handleMyActivities(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "GET" })
    return
  }

  const session = getSession(request)
  if (!session || session.profile !== "student") {
    sendJson(response, 403, {
      error: "Apenas estudantes podem consultar as tarefas dos seus grupos.",
    })
    return
  }

  try {
    const [activities] = await pool.execute(
      `SELECT a.id, a.group_id, g.name AS group_name, a.title, a.description,
         DATE_FORMAT(a.due_at, '%Y-%m-%dT%H:%i:%s') AS due_at,
         a.created_at, teacher.full_name AS created_by,
         s.status AS submission_status,
         DATE_FORMAT(s.submitted_at, '%Y-%m-%dT%H:%i:%s') AS submitted_at,
         s.id AS submission_id, s.original_file_name AS submission_file_name
       FROM activities a
       INNER JOIN study_groups g ON g.id = a.group_id
       INNER JOIN group_memberships gm
         ON gm.group_id = g.id AND gm.user_id = ? AND gm.status = 'active'
       INNER JOIN users teacher ON teacher.id = a.created_by_user_id
       LEFT JOIN activity_submissions s
         ON s.activity_id = a.id AND s.user_id = ?
       WHERE g.status = 'active'
       ORDER BY a.due_at IS NULL, a.due_at ASC, a.created_at DESC
       LIMIT 200`,
      [session.id, session.id],
    )

    sendJson(response, 200, {
      activities: activities.map((activity) => ({
        id: activity.id,
        groupId: activity.group_id,
        groupName: activity.group_name,
        title: activity.title,
        description: activity.description,
        dueAt: activity.due_at,
        createdAt: activity.created_at,
        createdBy: activity.created_by,
        submissionStatus:
          activity.submission_status ||
          (activity.due_at && new Date(activity.due_at) < new Date()
            ? "late"
            : "pending"),
        submittedAt: activity.submitted_at,
        submissionId: activity.submission_id,
        submissionFileName: activity.submission_file_name,
      })),
    })
  } catch (error) {
    console.error("My activities endpoint failed:", error.message)
    sendJson(response, 503, {
      error: "Não foi possível carregar suas tarefas.",
    })
  }
}

async function handleTeacherActivities(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "GET" })
    return
  }

  const session = getSession(request)
  if (!session || session.profile !== "professor") {
    sendJson(response, 403, {
      error:
        "Apenas professores podem consultar tarefas dos grupos orientados.",
    })
    return
  }

  try {
    const [activities] = await pool.execute(
      `SELECT a.id, a.group_id, g.name AS group_name, a.title, a.description,
         DATE_FORMAT(a.due_at, '%Y-%m-%dT%H:%i:%s') AS due_at,
         a.created_at,
         (SELECT COUNT(*) FROM activity_submissions s
          WHERE s.activity_id = a.id) AS submission_count
       FROM activities a
       INNER JOIN study_groups g ON g.id = a.group_id
       INNER JOIN group_mentors mentor
         ON mentor.group_id = g.id AND mentor.teacher_user_id = ?
       WHERE g.status = 'active'
       ORDER BY a.due_at IS NULL, a.due_at ASC, a.created_at DESC
       LIMIT 200`,
      [session.id],
    )
    sendJson(response, 200, {
      activities: activities.map((activity) => ({
        id: activity.id,
        groupId: activity.group_id,
        groupName: activity.group_name,
        title: activity.title,
        description: activity.description,
        dueAt: activity.due_at,
        createdAt: activity.created_at,
        submissionCount: Number(activity.submission_count),
      })),
    })
  } catch (error) {
    console.error("Teacher activities endpoint failed:", error.message)
    sendJson(response, 503, {
      error: "Não foi possível carregar as tarefas orientadas.",
    })
  }
}

async function handleCreateActivity(request, response, groupId) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "POST" })
    return
  }

  const session = getSession(request)
  if (!session || session.profile !== "professor") {
    sendJson(response, 403, {
      error: "Apenas professores podem abrir tarefas.",
    })
    return
  }
  if (!/^[1-9]\d*$/.test(groupId)) {
    sendJson(response, 400, { error: "Identificador de grupo inválido." })
    return
  }
  if (!request.headers["content-type"]?.includes("application/json")) {
    sendJson(response, 415, {
      error: "Content-Type must be application/json",
    })
    return
  }

  let body
  try {
    body = await readJsonBody(request)
  } catch (error) {
    sendJson(response, error.statusCode || 400, { error: error.message })
    return
  }

  const title = typeof body?.title === "string" ? body.title.trim() : ""
  const description =
    typeof body?.description === "string" ? body.description.trim() : ""
  const dueAt = typeof body?.dueAt === "string" ? body.dueAt.trim() : ""
  if (
    !title ||
    title.length > 200 ||
    !description ||
    description.length > 5000
  ) {
    sendJson(response, 400, {
      error: "Informe título e descrição dentro dos limites permitidos.",
    })
    return
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dueAt)) {
    sendJson(response, 400, {
      error: "Defina um prazo válido para a entrega da tarefa.",
    })
    return
  }
  const [datePart, timePart] = dueAt.split("T")
  const [year, month, day] = datePart.split("-").map(Number)
  const [hour, minute] = timePart.split(":").map(Number)
  const dueDate = new Date(year, month - 1, day, hour, minute)
  if (
    Number.isNaN(dueDate.getTime()) ||
    dueDate.getFullYear() !== year ||
    dueDate.getMonth() !== month - 1 ||
    dueDate.getDate() !== day ||
    dueDate.getHours() !== hour ||
    dueDate.getMinutes() !== minute ||
    dueDate.getTime() <= Date.now()
  ) {
    sendJson(response, 400, {
      error: "O prazo deve ser uma data futura válida.",
    })
    return
  }

  try {
    const [groups] = await pool.execute(
      `SELECT g.id FROM study_groups g
       INNER JOIN group_mentors mentor ON mentor.group_id = g.id
       WHERE g.id = ? AND g.status = 'active'
         AND mentor.teacher_user_id = ?`,
      [groupId, session.id],
    )
    if (!groups.length) {
      sendJson(response, 403, {
        error: "Você não é responsável por este grupo.",
      })
      return
    }

    const dueAtForMySql = `${dueAt.replace("T", " ")}:00.000`
    const [result] = await pool.execute(
      `INSERT INTO activities
         (group_id, created_by_user_id, title, description, due_at)
       VALUES (?, ?, ?, ?, ?)`,
      [groupId, session.id, title, description, dueAtForMySql],
    )
    sendJson(response, 201, {
      id: result.insertId,
      message: "Tarefa criada com prazo de entrega.",
    })
  } catch (error) {
    console.error("Activity creation endpoint failed:", error.message)
    sendJson(response, 503, { error: "Não foi possível criar a tarefa." })
  }
}

async function handleActivitySubmission(request, response, activityId) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "POST" })
    return
  }

  const session = getSession(request)
  if (!session || session.profile !== "student") {
    request.resume()
    sendJson(response, 403, {
      error: "Apenas estudantes podem enviar entregas.",
    })
    return
  }
  if (!/^[1-9]\d*$/.test(activityId)) {
    request.resume()
    sendJson(response, 400, { error: "Identificador de tarefa inválido." })
    return
  }

  try {
    const [activities] = await pool.execute(
      `SELECT a.id, a.due_at
       FROM activities a
       INNER JOIN study_groups g ON g.id = a.group_id
       INNER JOIN group_memberships gm
         ON gm.group_id = g.id AND gm.user_id = ? AND gm.status = 'active'
       WHERE a.id = ? AND g.status = 'active'
       LIMIT 1`,
      [session.id, activityId],
    )
    const activity = activities[0]
    if (!activity) {
      request.resume()
      sendJson(response, 404, {
        error: "Tarefa não encontrada em um grupo do qual você participa.",
      })
      return
    }
    if (!activity.due_at || new Date(activity.due_at).getTime() < Date.now()) {
      request.resume()
      sendJson(response, 409, {
        error: "O prazo desta tarefa expirou; o envio está encerrado.",
      })
      return
    }

    const upload = await parseUpload(request)
    const storedPath = path.join(uploadsDirectory, upload.file.key)
    await rename(upload.file.temporaryPath, storedPath)
    try {
      const status =
        new Date(activity.due_at).getTime() < Date.now() ? "late" : "submitted"
      const [previous] = await pool.execute(
        `SELECT storage_key FROM activity_submissions
         WHERE activity_id = ? AND user_id = ?`,
        [activityId, session.id],
      )
      await pool.execute(
        `INSERT INTO activity_submissions
           (activity_id, user_id, status, submitted_at, storage_key,
            original_file_name, mime_type, file_size)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP(3), ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           status = VALUES(status),
           submitted_at = VALUES(submitted_at),
           storage_key = VALUES(storage_key),
           original_file_name = VALUES(original_file_name),
           mime_type = VALUES(mime_type),
           file_size = VALUES(file_size)`,
        [
          activityId,
          session.id,
          status,
          upload.file.key,
          upload.file.originalFileName,
          upload.file.mimeType,
          upload.file.size,
        ],
      )
      if (previous[0]?.storage_key) {
        await removeStoredFile(previous[0].storage_key)
      }
      sendJson(response, 201, {
        message:
          status === "late"
            ? "Entrega recebida após o prazo e marcada como atrasada."
            : "Entrega enviada com sucesso.",
        status,
      })
    } catch (error) {
      await removeStoredFile(upload.file.key)
      throw error
    }
  } catch (error) {
    if (error.statusCode) {
      sendJson(response, error.statusCode, { error: error.message })
      return
    }
    console.error("Activity submission endpoint failed:", error.message)
    sendJson(response, 503, { error: "Não foi possível enviar a tarefa." })
  }
}

async function handleTeacherSubmissions(request, response, activityId) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "GET" })
    return
  }

  const session = getSession(request)
  if (!session || session.profile !== "professor") {
    sendJson(response, 403, {
      error: "Apenas professores podem consultar as entregas.",
    })
    return
  }
  if (!/^[1-9]\d*$/.test(activityId)) {
    sendJson(response, 400, { error: "Identificador de tarefa inválido." })
    return
  }

  try {
    const [activities] = await pool.execute(
      `SELECT a.id FROM activities a
       INNER JOIN group_mentors mentor
         ON mentor.group_id = a.group_id AND mentor.teacher_user_id = ?
       WHERE a.id = ?`,
      [session.id, activityId],
    )
    if (!activities.length) {
      sendJson(response, 404, {
        error: "Tarefa não encontrada em um grupo sob sua orientação.",
      })
      return
    }

    const [submissions] = await pool.execute(
      `SELECT s.id, s.status, s.original_file_name,
         DATE_FORMAT(s.submitted_at, '%Y-%m-%dT%H:%i:%s') AS submitted_at,
         u.full_name AS student_name
       FROM activity_submissions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.activity_id = ?
       ORDER BY s.submitted_at DESC, u.full_name`,
      [activityId],
    )
    sendJson(response, 200, {
      submissions: submissions.map((submission) => ({
        id: submission.id,
        status: submission.status,
        fileName: submission.original_file_name,
        submittedAt: submission.submitted_at,
        studentName: submission.student_name,
      })),
    })
  } catch (error) {
    console.error("Teacher submissions endpoint failed:", error.message)
    sendJson(response, 503, {
      error: "Não foi possível carregar as entregas dos estudantes.",
    })
  }
}

async function handleTeacherSubmissionReview(request, response, submissionId) {
  if (request.method !== "PATCH") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "PATCH" })
    return
  }
  const session = getSession(request)
  if (!session || session.profile !== "professor") {
    sendJson(response, 403, {
      error: "Apenas professores podem avaliar entregas.",
    })
    return
  }
  if (!/^[1-9]\d*$/.test(submissionId)) {
    sendJson(response, 400, { error: "Identificador de entrega inválido." })
    return
  }
  if (!request.headers["content-type"]?.includes("application/json")) {
    sendJson(response, 415, { error: "Content-Type must be application/json" })
    return
  }
  let body
  try {
    body = await readJsonBody(request)
  } catch (error) {
    sendJson(response, error.statusCode || 400, { error: error.message })
    return
  }
  if (
    body?.status !== "completed" ||
    (typeof body.feedback !== "string" && body.feedback !== undefined) ||
    (body.feedback || "").trim().length > 5000
  ) {
    sendJson(response, 400, {
      error: "Informe um status de conclusão e um comentário válido.",
    })
    return
  }
  try {
    const [result] = await pool.execute(
      `UPDATE activity_submissions submission
       INNER JOIN activities activity ON activity.id = submission.activity_id
       INNER JOIN group_mentors mentor ON mentor.group_id = activity.group_id
       SET submission.status = 'completed', submission.feedback = ?
       WHERE submission.id = ? AND mentor.teacher_user_id = ?
         AND submission.status IN ('submitted', 'late', 'completed')`,
      [(body.feedback || "").trim() || null, submissionId, session.id],
    )
    if (!result.affectedRows) {
      sendJson(response, 404, {
        error: "Entrega não encontrada nos seus grupos.",
      })
      return
    }
    sendJson(response, 200, { message: "Entrega avaliada como concluída." })
  } catch (error) {
    console.error("Teacher submission review failed:", error.message)
    sendJson(response, 503, { error: "Não foi possível avaliar a entrega." })
  }
}

async function handleSubmissionFile(request, response, submissionId) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "GET" })
    return
  }

  const session = getSession(request)
  if (!session || !/^[1-9]\d*$/.test(submissionId)) {
    sendJson(response, session ? 400 : 403, {
      error: session
        ? "Identificador de entrega inválido."
        : "Entre na plataforma para abrir a entrega.",
    })
    return
  }

  try {
    const [submissions] = await pool.execute(
      `SELECT s.storage_key, s.original_file_name, s.mime_type
       FROM activity_submissions s
       INNER JOIN activities a ON a.id = s.activity_id
       INNER JOIN study_groups g ON g.id = a.group_id
       WHERE s.id = ? AND g.status = 'active'
         AND (
           (? = 'student' AND s.user_id = ?)
           OR (? = 'professor' AND EXISTS (
             SELECT 1 FROM group_mentors mentor
             WHERE mentor.group_id = g.id AND mentor.teacher_user_id = ?
           ))
           OR ? = 'admin'
         )
       LIMIT 1`,
      [
        submissionId,
        session.profile,
        session.id,
        session.profile,
        session.id,
        session.profile,
      ],
    )
    const submission = submissions[0]
    if (!submission || !validStoredKey(submission.storage_key)) {
      sendJson(response, 404, { error: "Arquivo da entrega não encontrado." })
      return
    }

    const filePath = path.join(uploadsDirectory, submission.storage_key)
    const fileStats = await stat(filePath)
    const safeName = encodeURIComponent(
      submission.original_file_name || "entrega",
    )
    response.writeHead(200, {
      "Content-Type": submission.mime_type || "application/octet-stream",
      "Content-Length": fileStats.size,
      "Content-Disposition": `attachment; filename*=UTF-8''${safeName}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    })
    createReadStream(filePath).pipe(response)
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(response, 404, { error: "Arquivo da entrega não encontrado." })
      return
    }
    console.error("Submission download endpoint failed:", error.message)
    sendJson(response, 503, {
      error: "Não foi possível abrir o arquivo da entrega.",
    })
  }
}

async function handleGroupMembership(request, response, groupId) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "POST" })
    return
  }

  const session = getSession(request)
  if (!session || session.profile !== "student") {
    sendJson(response, 403, {
      error: "Somente estudantes autenticados podem participar de grupos.",
    })
    return
  }

  if (!/^[1-9]\d*$/.test(groupId)) {
    sendJson(response, 400, { error: "Identificador de grupo inválido." })
    return
  }

  let connection

  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()

    const [groups] = await connection.execute(
      "SELECT id FROM study_groups WHERE id = ? AND status = 'active' FOR UPDATE",
      [groupId],
    )

    if (!groups.length) {
      await connection.rollback()
      sendJson(response, 404, {
        error: "Grupo não encontrado ou indisponível para participação.",
      })
      return
    }

    const [memberships] = await connection.execute(
      `SELECT id, status FROM group_memberships
       WHERE group_id = ? AND user_id = ? FOR UPDATE`,
      [groupId, session.id],
    )
    const membership = memberships[0]

    if (membership?.status === "active") {
      await connection.commit()
      sendJson(response, 200, {
        alreadyMember: true,
        message: "Você já participa deste grupo.",
      })
      return
    }

    if (membership?.status === "pending") {
      await connection.execute(
        `UPDATE group_memberships
         SET status = 'active', is_leader = FALSE,
             joined_at = CURRENT_TIMESTAMP(3)
         WHERE id = ?`,
        [membership.id],
      )
      await connection.commit()
      sendJson(response, 200, {
        alreadyMember: false,
        isMember: true,
        message: "Você entrou no grupo e já pode acessá-lo.",
      })
      return
    }

    if (membership) {
      await connection.execute(
        `UPDATE group_memberships
         SET status = 'active', is_leader = FALSE,
             joined_at = CURRENT_TIMESTAMP(3)
         WHERE id = ?`,
        [membership.id],
      )
    } else {
      await connection.execute(
        `INSERT INTO group_memberships (group_id, user_id, status)
         VALUES (?, ?, 'active')`,
        [groupId, session.id],
      )
    }

    await connection.commit()
    sendJson(response, 201, {
      isMember: true,
      message: "Você entrou no grupo e já pode acessá-lo.",
    })
  } catch (error) {
    if (connection) await connection.rollback()
    console.error("Group membership endpoint failed:", error.message)
    sendJson(response, 503, {
      error: "Não foi possível registrar sua participação.",
    })
  } finally {
    connection?.release()
  }
}

async function handleAdminGroups(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "GET" })
    return
  }

  const session = getSession(request)
  if (!session || session.profile !== "admin") {
    sendJson(response, 403, { error: "Acesso restrito a gestores." })
    return
  }

  const { searchParams } = new URL(request.url, "http://localhost")
  const query = groupQuery(searchParams, true, null, false, true)

  if (query.error) {
    sendJson(response, 400, { error: query.error })
    return
  }

  try {
    const [groups] = await pool.execute(query.sql, query.values)
    const formattedGroups = formatGroups(groups)
    if (formattedGroups.length) {
      const groupIds = formattedGroups.map((group) => group.id)
      const [mentors] = await pool.execute(
        `SELECT mentor.group_id, teacher.id, teacher.full_name
         FROM group_mentors mentor
         INNER JOIN users teacher ON teacher.id = mentor.teacher_user_id
         WHERE mentor.group_id IN (${groupIds.map(() => "?").join(", ")})
         ORDER BY teacher.full_name`,
        groupIds,
      )
      const mentorsByGroup = new Map()
      for (const mentor of mentors) {
        const assigned = mentorsByGroup.get(String(mentor.group_id)) || []
        assigned.push({ id: mentor.id, name: mentor.full_name })
        mentorsByGroup.set(String(mentor.group_id), assigned)
      }
      for (const group of formattedGroups) {
        group.assignedTeachers = mentorsByGroup.get(String(group.id)) || []
      }
    }
    sendJson(response, 200, { groups: formattedGroups })
  } catch (error) {
    console.error("Admin groups endpoint failed:", error.message)
    sendJson(response, 503, { error: "Não foi possível carregar os grupos." })
  }
}

async function handleAdminGroupTeachers(
  request,
  response,
  groupId,
  teacherId = null,
) {
  const allowedMethods = teacherId ? ["DELETE"] : ["POST"]
  if (!allowedMethods.includes(request.method)) {
    sendJson(response, 405, { error: "Method not allowed" }, {
      Allow: allowedMethods.join(", "),
    })
    return
  }

  const session = getSession(request)
  if (!session || session.profile !== "admin") {
    request.resume()
    sendJson(response, 403, { error: "Acesso restrito a gestores." })
    return
  }

  if (
    !/^[1-9]\d*$/.test(groupId) ||
    (teacherId && !/^[1-9]\d*$/.test(teacherId))
  ) {
    request.resume()
    sendJson(response, 400, { error: "Identificador inválido." })
    return
  }

  let assignedTeacherId = teacherId
  if (!teacherId) {
    if (!request.headers["content-type"]?.includes("application/json")) {
      sendJson(response, 415, {
        error: "Content-Type must be application/json",
      })
      return
    }
    try {
      const body = await readJsonBody(request)
      if (!body || !/^[1-9]\d*$/.test(String(body.teacherId || ""))) {
        sendJson(response, 400, {
          error: "Selecione um professor válido para associar.",
        })
        return
      }
      assignedTeacherId = String(body.teacherId)
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message })
      return
    }
  }

  let connection
  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()
    const [groups] = await connection.execute(
      "SELECT id, status FROM study_groups WHERE id = ? FOR UPDATE",
      [groupId],
    )
    if (!groups.length) {
      await connection.rollback()
      sendJson(response, 404, { error: "Grupo/matéria não encontrado." })
      return
    }
    if (request.method === "POST" && groups[0].status === "archived") {
      await connection.rollback()
      sendJson(response, 409, {
        error: "Não é possível associar professores a um grupo arquivado.",
      })
      return
    }

    if (request.method === "POST") {
      const [teachers] = await connection.execute(
        `SELECT id FROM users
         WHERE id = ? AND profile = 'teacher' AND status = 'active'
         FOR UPDATE`,
        [assignedTeacherId],
      )
      if (!teachers.length) {
        await connection.rollback()
        sendJson(response, 404, {
          error: "Professor ativo não encontrado.",
        })
        return
      }
      const [existing] = await connection.execute(
        `SELECT teacher_user_id FROM group_mentors
         WHERE group_id = ? AND teacher_user_id = ?`,
        [groupId, assignedTeacherId],
      )
      if (existing.length) {
        await connection.commit()
        sendJson(response, 200, {
          message: "Esse professor já está associado ao grupo.",
        })
        return
      }
      await connection.execute(
        `INSERT INTO group_mentors (group_id, teacher_user_id)
         VALUES (?, ?)`,
        [groupId, assignedTeacherId],
      )
    } else {
      const [result] = await connection.execute(
        `DELETE FROM group_mentors
         WHERE group_id = ? AND teacher_user_id = ?`,
        [groupId, assignedTeacherId],
      )
      if (!result.affectedRows) {
        await connection.rollback()
        sendJson(response, 404, {
          error: "A associação entre grupo e professor não foi encontrada.",
        })
        return
      }
    }

    await connection.commit()
    sendJson(response, 200, {
      message:
        request.method === "POST"
          ? "Professor associado à matéria/grupo."
          : "Professor removido da matéria/grupo.",
    })
  } catch (error) {
    if (connection) await connection.rollback()
    console.error("Group teacher assignment failed:", error.message)
    sendJson(response, 503, {
      error: "Não foi possível atualizar os professores do grupo.",
    })
  } finally {
    connection?.release()
  }
}

async function handleGroupStatus(request, response, groupId) {
  if (request.method !== "PATCH") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "PATCH" })
    return
  }

  if (!request.headers["content-type"]?.includes("application/json")) {
    sendJson(response, 415, {
      error: "Content-Type must be application/json",
    })
    return
  }

  const session = getSession(request)
  if (!session || session.profile !== "admin") {
    sendJson(response, 403, { error: "Acesso restrito a gestores." })
    return
  }

  if (!/^[1-9]\d*$/.test(groupId)) {
    sendJson(response, 400, { error: "Identificador de grupo inválido." })
    return
  }

  let body
  try {
    body = await readJsonBody(request)
  } catch (error) {
    sendJson(response, error.statusCode || 400, { error: error.message })
    return
  }

  if (!body || !["active", "inactive"].includes(body.status)) {
    sendJson(response, 400, { error: "O status informado é inválido." })
    return
  }

  try {
    const [result] = await pool.execute(
      "UPDATE study_groups SET status = ? WHERE id = ? AND status != 'archived'",
      [body.status, groupId],
    )

    if (!result.affectedRows) {
      sendJson(response, 404, {
        error: "Grupo não encontrado ou arquivado.",
      })
      return
    }

    sendJson(response, 200, { message: "Status do grupo atualizado." })
  } catch (error) {
    console.error("Group status endpoint failed:", error.message)
    sendJson(response, 503, { error: "Não foi possível atualizar o grupo." })
  }
}

async function handleUserApproval(request, response, userId) {
  if (request.method !== "PATCH") {
    sendJson(response, 405, { error: "Method not allowed" }, { Allow: "PATCH" })
    return
  }

  const session = getSession(request)

  if (!session || session.profile !== "admin") {
    sendJson(response, 403, { error: "Acesso restrito a gestores." })
    return
  }

  if (!/^[1-9]\d*$/.test(userId)) {
    sendJson(response, 400, { error: "Identificador de usuário inválido." })
    return
  }

  try {
    const [result] = await pool.execute(
      "UPDATE users SET status = 'active' WHERE id = ? AND status = 'pending'",
      [userId],
    )

    if (!result.affectedRows) {
      sendJson(response, 404, {
        error: "Solicitação não encontrada ou já revisada.",
      })
      return
    }

    sendJson(response, 200, { message: "Conta aprovada." })
  } catch (error) {
    console.error("User approval endpoint failed:", error.message)
    sendJson(response, 503, { error: "Não foi possível aprovar a conta." })
  }
}

const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url, "http://localhost")

  if (pathname === "/api/health") {
    if (request.method !== "GET") {
      response.writeHead(405, {
        Allow: "GET",

        "Content-Type": "application/json; charset=utf-8",
      })

      response.end(JSON.stringify({ error: "Method not allowed" }))

      return
    }

    try {
      await pool.query("SELECT 1")
    } catch (error) {
      console.error("MySQL health check failed:", error.message)
      response.writeHead(503, {
        "Content-Type": "application/json; charset=utf-8",
      })
      response.end(
        JSON.stringify({
          status: "error",
          service: "techfatec-api",
          database: "disconnected",
          timestamp: new Date().toISOString(),
        }),
      )
      return
    }

    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
    })

    response.end(
      JSON.stringify({
        status: "ok",

        service: "techfatec-api",

        database: "connected",

        timestamp: new Date().toISOString(),
      }),
    )

    return
  }

  if (pathname === "/api/auth/register") {
    await handleRegistration(request, response)
    return
  }

  if (pathname === "/api/auth/password-recovery") {
    await handlePasswordRecovery(request, response)
    return
  }

  if (pathname === "/api/auth/password-reset") {
    await handlePasswordReset(request, response)
    return
  }
  if (pathname === "/api/disciplines") {
    await handleDisciplines(request, response)
    return
  }

  if (pathname === "/api/groups") {
    await handleExploreGroups(request, response)
    return
  }

  if (pathname === "/api/groups/mine") {
    await handleMyGroups(request, response)
    return
  }

  if (pathname === "/api/meetings/mine") {
    await handleMyMeetings(request, response)
    return
  }

  if (pathname === "/api/teacher/groups" && request.method === "POST") {
    await handleCreateTeacherGroup(request, response)
    return
  }

  if (pathname === "/api/teacher/groups") {
    await handleTeacherGroups(request, response)
    return
  }

  if (pathname === "/api/manager/dashboard") {
    await handleManagerDashboard(request, response)
    return
  }

  if (pathname === "/api/projects") {
    await handleProjects(request, response)
    return
  }

  const teacherGroupProjectsMatch = pathname.match(
    /^\/api\/teacher\/groups\/(\d+)\/projects$/,
  )
  if (teacherGroupProjectsMatch) {
    await handleTeacherGroupProjects(
      request,
      response,
      teacherGroupProjectsMatch[1],
    )
    return
  }

  const teacherProjectMatch = pathname.match(
    /^\/api\/teacher\/projects\/(\d+)$/,
  )
  if (teacherProjectMatch) {
    await handleTeacherProject(request, response, teacherProjectMatch[1])
    return
  }

  const projectMembershipMatch = pathname.match(
    /^\/api\/projects\/(\d+)\/membership$/,
  )
  if (projectMembershipMatch) {
    await handleProjectMembership(request, response, projectMembershipMatch[1])
    return
  }

  const teacherAttendanceMatch = pathname.match(
    /^\/api\/teacher\/groups\/(\d+)\/attendance$/,
  )
  if (teacherAttendanceMatch) {
    await handleTeacherAttendance(request, response, teacherAttendanceMatch[1])
    return
  }

  const teacherMembershipMatch = pathname.match(
    /^\/api\/teacher\/memberships\/(\d+)$/,
  )
  if (teacherMembershipMatch) {
    await handleTeacherGroupMembership(
      request,
      response,
      teacherMembershipMatch[1],
    )
    return
  }

  const teacherGroupMatch = pathname.match(/^\/api\/teacher\/groups\/(\d+)$/)
  if (teacherGroupMatch) {
    await handleTeacherGroup(request, response, teacherGroupMatch[1])
    return
  }

  if (pathname === "/api/teacher/messages") {
    await handleTeacherMessages(request, response)
    return
  }

  const teacherMessageMatch = pathname.match(
    /^\/api\/teacher\/messages\/(\d+)$/,
  )
  if (teacherMessageMatch) {
    await handleTeacherMessages(request, response, teacherMessageMatch[1])
    return
  }

  const groupTeachersMatch = pathname.match(/^\/api\/groups\/(\d+)\/teachers$/)
  if (groupTeachersMatch) {
    await handleGroupTeachers(request, response, groupTeachersMatch[1])
    return
  }

  const studentGroupMessageMatch = pathname.match(
    /^\/api\/groups\/(\d+)\/messages$/,
  )
  if (studentGroupMessageMatch) {
    if (request.method === "GET") {
      await handleStudentGroupMessages(
        request,
        response,
        studentGroupMessageMatch[1],
      )
    } else {
      await handleStudentGroupMessage(
        request,
        response,
        studentGroupMessageMatch[1],
      )
    }
    return
  }

  const teacherReplyMatch = pathname.match(
    /^\/api\/teacher\/messages\/(\d+)\/reply$/,
  )
  if (teacherReplyMatch) {
    await handleTeacherMessageReply(request, response, teacherReplyMatch[1])
    return
  }

  if (pathname === "/api/materials") {
    await handleMaterials(request, response)
    return
  }

  if (pathname === "/api/activities/mine") {
    await handleMyActivities(request, response)
    return
  }

  if (pathname === "/api/teacher/activities") {
    await handleTeacherActivities(request, response)
    return
  }

  const teacherMaterialMatch = pathname.match(
    /^\/api\/teacher\/groups\/(\d+)\/materials$/,
  )
  if (teacherMaterialMatch) {
    await handleTeacherMaterialUpload(
      request,
      response,
      teacherMaterialMatch[1],
    )
    return
  }

  const teacherActivityMatch = pathname.match(
    /^\/api\/teacher\/groups\/(\d+)\/activities$/,
  )
  if (teacherActivityMatch) {
    await handleCreateActivity(request, response, teacherActivityMatch[1])
    return
  }

  const materialFileMatch = pathname.match(/^\/api\/materials\/(\d+)\/file$/)
  if (materialFileMatch) {
    await handleMaterialFile(request, response, materialFileMatch[1])
    return
  }

  const activitySubmissionMatch = pathname.match(
    /^\/api\/activities\/(\d+)\/submission$/,
  )
  if (activitySubmissionMatch) {
    await handleActivitySubmission(
      request,
      response,
      activitySubmissionMatch[1],
    )
    return
  }

  const submissionFileMatch = pathname.match(
    /^\/api\/submissions\/(\d+)\/file$/,
  )
  if (submissionFileMatch) {
    await handleSubmissionFile(request, response, submissionFileMatch[1])
    return
  }

  const teacherSubmissionsMatch = pathname.match(
    /^\/api\/teacher\/activities\/(\d+)\/submissions$/,
  )
  if (teacherSubmissionsMatch) {
    await handleTeacherSubmissions(
      request,
      response,
      teacherSubmissionsMatch[1],
    )
    return
  }

  const teacherSubmissionReviewMatch = pathname.match(
    /^\/api\/teacher\/submissions\/(\d+)$/,
  )
  if (teacherSubmissionReviewMatch) {
    await handleTeacherSubmissionReview(
      request,
      response,
      teacherSubmissionReviewMatch[1],
    )
    return
  }

  const groupMembershipMatch = pathname.match(
    /^\/api\/groups\/(\d+)\/membership$/,
  )
  if (groupMembershipMatch) {
    await handleGroupMembership(request, response, groupMembershipMatch[1])
    return
  }

  if (pathname === "/api/auth/login") {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed" }, {
        Allow: "POST",
      })
      return
    }

    if (!request.headers["content-type"]?.includes("application/json")) {
      sendJson(response, 415, {
        error: "Content-Type must be application/json",
      })
      return
    }

    let credentials

    try {
      credentials = await readJsonBody(request)
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message })
      return
    }

    if (!credentials || typeof credentials !== "object") {
      sendJson(response, 400, { error: "Corpo da requisição inválido." })
      return
    }

    const email =
      typeof credentials.email === "string"
        ? credentials.email.trim().toLowerCase()
        : ""
    const password =
      typeof credentials.password === "string" ? credentials.password : ""

    if (
      !email ||
      email.length > 254 ||
      !password ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      sendJson(response, 400, {
        error: "Informe um e-mail e uma senha válidos.",
      })
      return
    }

    try {
      const [users] = await pool.execute(
        `SELECT id, full_name, email, password_hash, profile, status
         FROM users
         WHERE email = ?
         LIMIT 1`,
        [email],
      )
      const user = users[0]

      if (
        !user ||
        !(await bcrypt.compare(password, user?.password_hash || ""))
      ) {
        sendJson(response, 401, { error: "E-mail ou senha incorretos." })
        return
      }

      if (user.status !== "active") {
        sendJson(response, 403, {
          error:
            "Esta conta ainda não está ativa. Entre em contato com a instituição.",
        })
        return
      }

      const profiles = {
        student: "student",
        teacher: "professor",
        manager: "admin",
      }

      const token = randomBytes(32).toString("base64url")
      sessions.set(token, {
        user: {
          id: user.id,
          name: user.full_name,
          email: user.email,
          profile: profiles[user.profile],
        },
        expiresAt: Date.now() + sessionDurationSeconds * 1000,
      })

      sendJson(
        response,
        200,
        {
          user: {
            id: user.id,
            name: user.full_name,
            email: user.email,
            profile: profiles[user.profile],
          },
        },
        { "Set-Cookie": sessionCookie(request, token, sessionDurationSeconds) },
      )
    } catch (error) {
      console.error("Login endpoint failed:", error.message)
      sendJson(response, 503, { error: "Não foi possível acessar o serviço." })
    }

    return
  }

  if (pathname === "/api/auth/me") {
    const session = getSession(request)

    if (!session) {
      sendJson(response, 401, { error: "Sessão não encontrada." })
      return
    }

    const { token, ...user } = session
    sendJson(response, 200, { user })
    return
  }

  if (pathname === "/api/auth/logout") {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed" }, {
        Allow: "POST",
      })
      return
    }

    const session = getSession(request)
    if (session) sessions.delete(session.token)
    sendJson(response, 200, { message: "Sessão encerrada." }, {
      "Set-Cookie": sessionCookie(request, "", 0),
    })
    return
  }

  if (pathname === "/api/admin/groups") {
    await handleAdminGroups(request, response)
    return
  }

  sendJson(response, 404, { error: "Not found" })
})

server.listen(port, "127.0.0.1", () => {
  console.log(`TechFatec API listening at http://127.0.0.1:${port}`)
})
