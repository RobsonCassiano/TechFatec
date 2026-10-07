const app = document.querySelector("#app")

const profiles = {
  student: { label: "Estudante", home: "home" },
  professor: { label: "Professor / Orientador", home: "professor-dashboard" },
  admin: { label: "Gestor / Administrador", home: "admin-dashboard" },
}

async function loadAdminUsers() {
  state.adminUsersLoading = true
  state.adminUsersError = ""
  updateAdminUsersTable()

  const profileValues = {
    Estudante: "student",
    Professor: "teacher",
    Gestor: "manager",
  }
  const statusValues = {
    Ativo: "active",
    Pendente: "pending",
    Desativado: "disabled",
  }
  const params = new URLSearchParams()
  if (state.userSearch.trim()) params.set("q", state.userSearch.trim())
  if (profileValues[state.userProfile]) {
    params.set("profile", profileValues[state.userProfile])
  }
  if (statusValues[state.userStatus]) {
    params.set("status", statusValues[state.userStatus])
  }

  try {
    const response = await fetch(`/api/admin/users?${params}`)
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || "Não foi possível carregar os usuários.")
    }

    state.adminUsers = result.users
  } catch (error) {
    state.adminUsersError = error.message || "Não foi possível conectar à API."
  } finally {
    state.adminUsersLoading = false
    updateAdminUsersTable()
  }
}

function updateAdminUsersTable() {
  const results = app.querySelector("#users-results")
  if (results) results.innerHTML = userRows()
}

const authScreens = new Set([
  "login",
  "recovery",
  "reset-password",
  "register",
  "profile-selection",
])

const screenRenderers = {
  login: loginScreen,
  recovery: recoveryScreen,
  "reset-password": resetPasswordScreen,
  register: registerScreen,
  "profile-selection": profileSelectionScreen,
  home: homeScreen,
  "group-list": groupListScreen,
  "group-details": groupDetailsScreen,
  "participation-feedback": participationScreen,
  "group-area": groupAreaScreen,
  agenda: agendaScreen,
  materials: materialsScreen,
  activities: activitiesScreen,
  projects: projectsScreen,
  "professor-dashboard": professorDashboardScreen,
  "professor-groups": professorGroupsScreen,
  "professor-activities": professorActivitiesScreen,
  "professor-messages": professorMessagesScreen,
  "professor-projects": professorProjectsScreen,
  "professor-reports": professorReportsScreen,
  "admin-dashboard": adminDashboardScreen,
  "admin-participation": adminParticipationScreen,
  "admin-groups": adminGroupsScreen,
}

const groups = [
  {
    name: "Redes de Computadores",

    goal: "Estudar conceitos de redes, protocolos TCP/IP e configuração de ambientes de rede.",

    themes: ["Redes", "Infraestrutura"],

    level: "Intermediário",

    mode: "Híbrido",

    members: 14,

    nextMeeting: "Segunda, 09/09 · 19h",

    leader: "Pedro Alves",
  },

  {
    name: "Desenvolvimento Web",

    goal: "Criar aplicações web e praticar fundamentos de HTML, CSS, JavaScript e interfaces.",

    themes: ["Front-end", "JavaScript"],

    level: "Iniciante",

    mode: "Presencial",

    members: 22,

    nextMeeting: "Quarta, 11/09 · 20h",

    leader: "João Pereira",
  },

  {
    name: "Banco de Dados Relacional",

    goal: "Aprofundar SQL, modelagem relacional e otimização de consultas.",

    themes: ["Banco de Dados", "SQL"],

    level: "Intermediário",

    mode: "Online",

    members: 9,

    nextMeeting: "Sexta, 13/09 · 18h30",

    leader: "Maria Costa",
  },

  {
    name: "Inteligência Artificial Aplicada",

    goal: "Explorar aprendizado de máquina e aplicações práticas com Python.",

    themes: ["Inteligência Artificial", "Python"],

    level: "Avançado",

    mode: "Online",

    members: 18,

    nextMeeting: "Terça, 10/09 · 19h30",

    leader: "Ana Ribeiro",
  },

  {
    name: "Algoritmos e Estruturas de Dados",

    goal: "Praticar resolução de problemas, algoritmos clássicos e lógica de programação.",

    themes: ["Algoritmos", "Lógica"],

    level: "Iniciante",

    mode: "Presencial",

    members: 11,

    nextMeeting: "Quinta, 12/09 · 19h",

    leader: "Lucas Martins",
  },

  {
    name: "Segurança da Informação",

    goal: "Estudar criptografia, proteção de sistemas e fundamentos de segurança digital.",

    themes: ["Segurança", "Redes"],

    level: "Avançado",

    mode: "Híbrido",

    members: 7,

    nextMeeting: "Segunda, 09/09 · 20h",

    leader: "Camila Souza",
  },
]

const navItems = {
  student: [
    ["Início", "home"],

    ["Grupos", "group-list"],

    ["Agenda", "agenda"],

    ["Materiais", "materials"],

    ["Atividades", "activities"],

    ["Projetos", "projects"],
  ],

  professor: [
    ["Dashboard", "professor-dashboard"],

    ["Grupos", "professor-groups"],

    ["Materiais", "materials"],

    ["Atividades", "professor-activities"],

    ["Mensagens", "professor-messages"],

    ["Projetos", "professor-projects"],

    ["Relatórios", "professor-reports"],
  ],

  admin: [
    ["Dashboard", "admin-dashboard"],
    ["Participação", "admin-participation"],
    ["Grupos", "admin-groups"],
  ],
}

const state = {
  screen: "login",

  profile: null,
  user: null,

  groupSearch: "",

  theme: "Todos",

  level: "Todos",

  mode: "Todos",

  materialSearch: "",

  materialType: "Todos",

  groupSort: "Relevância",
  exploreGroups: [],
  selectedGroupId: null,
  groupMembershipStatus: "idle",
  groupMembershipError: "",
  materials: [],
  materialsLoading: false,
  materialsError: "",
  materialsRequestId: 0,
  teacherGroups: [],
  teacherGroupsLoading: false,
  teacherGroupsError: "",
  teacherGroupsRequestId: 0,
  teacherDisciplines: [],
  teacherDisciplinesLoading: false,
  teacherDisciplinesError: "",
  teacherDisciplinesRequestId: 0,
  teacherMessages: [],
  teacherMessagesLoading: false,
  teacherMessagesError: "",
  teacherMessagesRequestId: 0,
  groupTeachers: {},
  groupTeachersLoading: {},
  groupTeachersError: {},
  groupMessages: {},
  groupMessagesLoading: {},
  groupMessagesError: {},
  activities: [],
  activitiesLoading: false,
  activitiesError: "",
  activitiesRequestId: 0,
  teacherActivities: [],
  teacherActivitiesLoading: false,
  teacherActivitiesError: "",
  teacherActivitiesRequestId: 0,
  teacherSubmissions: {},
  teacherSubmissionsLoading: {},
  teacherSubmissionsError: {},
  activityGroupId: "all",
  myGroups: [],
  myGroupsLoaded: false,
  myGroupsLoading: false,
  myGroupsError: "",
  myGroupsRequestId: 0,
  materialsSearchTimer: null,
  meetings: [],
  meetingsLoading: false,
  meetingsError: "",
  meetingsRequestId: 0,
  agendaGroupId: "all",
  groupRequestId: 0,
  groupSearchTimer: null,
  adminGroups: [],
  adminTeachers: [],
  adminGroupsLoading: false,
  adminGroupsError: "",
  adminGroupRequestId: 0,
  adminGroupSearchTimer: null,
  activityStatus: "Todos",
  projectStatus: "Todos",
  projectGroupId: "all",
  projects: [],
  projectsLoading: false,
  projectsError: "",
  projectsRequestId: 0,
  userSearch: "",
  userProfile: "Todos os perfis",
  userStatus: "Todos",
  adminUsers: [],
  adminUsersLoading: false,
  adminUsersError: "",
  userSearchTimer: null,
  pendingUsers: [],
  pendingUsersLoading: false,
  pendingUsersError: "",
  adminGroupSearch: "",
  adminGroupTheme: "Todos",
  adminGroupStatus: "Todos",
  managerDashboard: null,
  managerDashboardLoading: false,
  managerDashboardError: "",
  groupStatuses: groups.map(() => "Ativo"),
  groupLoading: false,
  groupError: false,
  accessibilityFontScale: 1,
  accessibilityHighContrast: false,
  colorVisionFilter: "default",
}

const baseFontSizes = new WeakMap()

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

function button(label, destination, style = "secondary", extra = "") {
  const navigation = extra.includes("data-action=")
    ? ""
    : `data-nav="${destination}"`

  return `<button class="button ${style}" type="button" ${navigation} ${extra}>${label}</button>`
}

function link(label, destination, className = "text-button") {
  return `<button class="${className}" type="button" data-nav="${destination}">${label}</button>`
}

function card(content, className = "") {
  return `<article class="card ${className}">${content}</article>`
}

function stat(label, value) {
  return card(
    `<p class="stat-value">${value}</p><p class="stat-label">${label}</p>`,
    "stat-card",
  )
}

function section(title, content, action = "") {
  return `<section class="section"><div class="section-heading"><h2>${title}</h2>${action}</div>${content}</section>`
}

function page(title, subtitle, content, options = {}) {
  const className = options.compact ? "page compact" : "page"

  return `<main class="${className}">
    <p class="eyebrow">${options.eyebrow || (state.profile ? profiles[state.profile].label : "TechFatec")}</p>
    <h1>${title}</h1>
    ${subtitle ? `<p class="page-intro">${subtitle}</p>` : ""}
    ${content}
  </main>`
}

function details(rows) {
  return `<div class="detail-list">${rows.map(([label, value]) => `<div class="detail-row"><span>${label}</span><strong>${value}</strong></div>`).join("")}</div>`
}

function status(value) {
  return `<span class="status">${value}</span>`
}

function groupCard(group, compact = false) {
  const detailButton = group.id
    ? button(
        compact ? "Ver detalhes" : "Conhecer grupo",
        "group-details",
        "small",
        `data-group-id="${escapeHtml(group.id)}"`,
      )
    : button(
        compact ? "Ver detalhes" : "Conhecer grupo",
        "group-details",
        "small",
      )

  return card(
    `
    <p class="eyebrow">${escapeHtml(group.themes.join(" · "))}</p>
    <h3>${escapeHtml(group.name)}</h3>
    <p class="muted">${escapeHtml(group.goal)}</p>
    <div class="chips"><span class="chip">${escapeHtml(group.level)}</span><span class="chip">${escapeHtml(group.mode)}</span><span class="chip">${escapeHtml(group.members)} participantes</span></div>
    <p class="meta">Próximo encontro: ${escapeHtml(group.nextMeeting)}</p>
    ${detailButton}
  `,
    "group-card",
  )
}

function adaptApiGroup(group) {
  const levels = {
    beginner: "Iniciante",
    intermediate: "Intermediário",
    advanced: "Avançado",
  }
  const modalities = {
    online: "Online",
    in_person: "Presencial",
    hybrid: "Híbrido",
  }
  const meetingDate = group.nextMeetingAt
    ? new Date(group.nextMeetingAt).toLocaleString("pt-BR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Não agendado"
  const isMember =
    group.isMember || group.membershipStatus === "pending"

  return {
    ...group,
    isMember,
    membershipStatus: isMember ? "active" : group.membershipStatus,
    goal: group.description,
    level: levels[group.level] || group.level,
    mode: modalities[group.modality] || group.modality,
    nextMeeting: group.nextMeetingTitle
      ? `${group.nextMeetingTitle} · ${meetingDate}`
      : "Não agendado",
  }
}

function authLayout(content) {
  return `<main class="auth-wrap"><section class="auth-card">
    <div class="auth-brand"><p class="wordmark">TechFatec</p><p class="muted">Plataforma acadêmica colaborativa · FATEC</p></div>
    ${content}
  </section></main>`
}

function inputField(label, name, type = "text", extra = "") {
  return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" ${extra} /></div>`
}

function selectField(label, name, options, selected = options[0]) {
  return `<div class="field"><label for="${name}">${label}</label><select id="${name}" name="${name}">${options.map((value) => `<option ${value === selected ? "selected" : ""}>${value}</option>`).join("")}</select></div>`
}

function loginScreen() {
  return authLayout(`
    <form class="form" data-form="login">
      ${inputField("E-mail", "login-email", "email", 'autocomplete="email" required placeholder="voce@fatec.edu.br"')}
      ${inputField("Senha", "login-password", "password", 'autocomplete="current-password" required placeholder="Digite sua senha"')}
      <p class="form-message" data-login-message role="alert" hidden></p>
      <button class="button primary" type="submit">Entrar</button>
    </form>
    <div class="link-stack">${link("Esqueci minha senha", "recovery")}${link("Criar conta", "register")}</div>
  `)
}

function recoveryScreen() {
  return authLayout(`
    <h1>Recuperar senha</h1>
    <p class="page-intro">Informe seu e-mail para receber as instruções de recuperação.</p>
    <form class="form" data-form="recovery">
      ${inputField("E-mail cadastrado", "recovery-email", "email", 'required autocomplete="email" placeholder="voce@fatec.edu.br"')}
      <p class="form-message" data-recovery-message role="status" hidden></p>
      <button class="button primary" type="submit">Enviar link de recuperação</button>
    </form>
    <div class="link-stack">${link("Voltar ao login", "login")}</div>
  `)
}

function resetPasswordScreen() {
  const token = new URLSearchParams(window.location.search).get("token")
  if (!token) {
    return authLayout(
      `<h1>Redefinir senha</h1><p class="form-message" role="alert">O link de redefinição é inválido ou expirou.</p><div class="link-stack">${link("Solicitar outro link", "recovery")}</div>`,
    )
  }
  return authLayout(`
    <h1>Redefinir senha</h1>
    <p class="page-intro">Escolha uma nova senha. Ela deve ter pelo menos 8 caracteres.</p>
    <form class="form" data-form="reset-password">
      ${inputField("Nova senha", "reset-password-value", "password", 'required minlength="8" maxlength="72" autocomplete="new-password"')}
      ${inputField("Confirmar nova senha", "reset-password-confirm", "password", 'required minlength="8" maxlength="72" autocomplete="new-password"')}
      <p class="form-message" data-reset-message role="alert" hidden></p>
      <button class="button primary" type="submit">Salvar nova senha</button>
    </form>
  `)
}

function registerScreen() {
  return authLayout(`
    <h1>Criar conta</h1>
    <p class="page-intro">Cadastre-se para acessar a plataforma e entrar diretamente nos grupos de seu interesse.</p>
    <form class="form" data-form="register">
      ${inputField("Nome completo", "register-name", "text", 'required autocomplete="name"')}
      ${inputField("E-mail", "register-email", "email", 'required autocomplete="email" placeholder="voce@fatec.edu.br"')}
      ${inputField("Senha", "register-password", "password", 'required minlength="8" autocomplete="new-password"')}
      ${inputField("Confirmar senha", "register-confirm", "password", 'required minlength="8" autocomplete="new-password"')}
      ${selectField("Perfil", "register-profile", ["Estudante", "Professor"])}
      <button class="button primary" type="submit">Criar conta</button>
    </form>
    <div class="link-stack">${link("Já tenho uma conta — entrar", "login")}</div>
  `)
}

function profileSelectionScreen() {
  const cards = Object.entries(profiles)
    .map(([, profile]) =>
      card(`
    <p class="eyebrow">Acesso à área</p><h3>${profile.label}</h3>
    <p class="muted">Acesse as ferramentas e informações do perfil ${profile.label.toLowerCase()}.</p>
    ${button("Continuar", profile.home, "secondary")}
  `),
    )
    .join("")

  return page(
    "Selecione seu perfil",
    "Escolha a área correspondente para continuar.",
    `<div class="card-grid two">${cards}</div>`,
    { compact: true },
  )
}

function homeScreen() {
  const featured = state.exploreGroups
    .slice(0, 3)
    .map((group) => groupCard(group, true))
    .join("")

  return `<section class="hero"><div class="hero-inner">
    <div><p class="eyebrow">Plataforma Acadêmica · FATEC</p><h1>Conecte.<br />Estude. Evolua.</h1>
      <p class="hero-lead">Encontre grupos de estudo, compartilhe materiais, acompanhe atividades e colabore em projetos com colegas da FATEC.</p>
      <div class="button-row">${button("Explorar grupos", "group-list", "primary")}${button("Conhecer a plataforma", "group-list")}</div>
      <form class="home-search" data-form="home-search">
        <label for="home-search">Pesquisar grupos</label>
        <div class="button-row"><input id="home-search" name="query" type="search" placeholder="Pesquise por grupo, tema ou tecnologia" /><button class="button small" type="submit">Buscar</button></div>
      </form>
    </div><div class="wire-box" aria-label="Área reservada para ilustração">[ área de destaque ]</div>
  </div></section>
  <div class="shortcut-bar"><div class="button-row"><span class="eyebrow">Acesso rápido</span>${[
    ["Agenda", "agenda"],
    ["Materiais", "materials"],
    ["Atividades", "activities"],
    ["Projetos", "projects"],
  ]
    .map(([label, destination]) => button(label, destination, "small"))
    .join("")}</div></div>
  <main class="page">${myGroupsSection()}<p class="eyebrow">Sua próxima jornada começa aqui</p><div class="section-heading"><h2>Grupos em destaque</h2>${button("Ver todos os grupos", "group-list", "small")}</div><div class="card-grid">${featured}</div></main>`
}

function myGroupsSection() {
  let content

  if (state.myGroupsLoading || !state.myGroupsLoaded) {
    content = '<p class="muted" role="status">Carregando seus grupos...</p>'
  } else if (state.myGroupsError) {
    content = `<div class="empty-state" role="alert"><p>${escapeHtml(state.myGroupsError)}</p><button class="button small" type="button" data-action="retry-my-groups">Tentar novamente</button></div>`
  } else if (!state.myGroups.length) {
    content = `<div class="empty-state"><p>Você ainda não participa de nenhum grupo.</p>${button("Explorar grupos", "group-list", "small")}</div>`
  } else {
    content = `<div class="card-grid">${state.myGroups
      .map(
        (group) =>
          `<article class="card group-card"><p class="eyebrow">${escapeHtml(group.themes.join(" · "))}</p><h3>${escapeHtml(group.name)}</h3><p class="muted">${escapeHtml(group.goal)}</p><div class="chips"><span class="chip">${escapeHtml(group.level)}</span><span class="chip">${escapeHtml(group.mode)}</span><span class="chip">${escapeHtml(group.members)} participantes</span></div><div class="button-row"><button class="button small" type="button" data-nav="group-details" data-group-id="${escapeHtml(group.id)}">Ver detalhes</button><button class="button small primary" type="button" data-nav="group-area" data-group-id="${escapeHtml(group.id)}">Acessar grupo</button></div></article>`,
      )
      .join("")}</div>`
  }

  return `<section class="section"><div class="section-heading"><h2>Meus grupos</h2><button class="button small" type="button" data-action="retry-my-groups">Atualizar</button></div>${content}</section>`
}

function filteredGroups() {
  return state.exploreGroups
}

function groupResults() {
  if (state.groupLoading) {
    return `<div class="empty-state" role="status"><h3>Carregando grupos...</h3><div class="skeleton" aria-hidden="true"></div><div class="skeleton" aria-hidden="true"></div></div>`
  }
  if (state.groupError) {
    return `<div class="empty-state" role="alert"><h3>Não foi possível carregar os grupos</h3><p>Verifique sua conexão e tente novamente.</p><button class="button small" data-action="retry-group-load">Tentar novamente</button></div>`
  }

  const results = filteredGroups()

  const active = [
    state.theme !== "Todos" ? state.theme : "",

    state.level !== "Todos" ? state.level : "",

    state.mode !== "Todos" ? state.mode : "",

    state.groupSearch.trim(),
  ].filter(Boolean)

  return `<div class="active-filters">${active.map((filter) => `<span class="chip">${escapeHtml(filter)}</span>`).join(" ")}</div>
    <p class="meta">${results.length} grupo(s) encontrado(s)</p>
    ${
      results.length
        ? results.map((group) => groupCard(group, true)).join("")
        : `<div class="empty-state"><h3>Nenhum grupo encontrado</h3><p>Tente ajustar sua busca ou limpar os filtros.</p><button class="button small" data-action="clear-group-filters">Limpar filtros</button></div>`
    }`
}

function groupListScreen() {
  return page(
    "Explorar Grupos",
    "Encontre uma comunidade de estudo por tema, nível ou modalidade.",
    `
    <div class="filters">
      <div class="field"><label for="group-search">Pesquisar grupos</label><input id="group-search" type="search" value="${escapeHtml(state.groupSearch)}" placeholder="Nome, tema ou tecnologia" /></div>
      ${selectField("Tema", "group-theme", ["Todos", "Redes", "Infraestrutura", "Front-end", "JavaScript", "Banco de Dados", "SQL", "Inteligência Artificial", "Python", "Algoritmos", "Lógica", "Segurança"])}
      ${selectField("Nível", "group-level", ["Todos", "Iniciante", "Intermediário", "Avançado"])}
      ${selectField("Modalidade", "group-mode", ["Todos", "Online", "Presencial", "Híbrido"])}
      ${selectField("Ordenar por", "group-sort", ["Relevância", "Nome", "Participantes"])}
    </div>
    <details class="state-demo"><summary>Pré-visualizar estados de carregamento e erro</summary><div class="button-row">${button("Carregando", "group-list", "small", 'data-action="simulate-group-loading"')}${button("Erro", "group-list", "small", 'data-action="simulate-group-error"')}</div></details>
    <div class="results-layout"><aside class="filter-panel"><p class="eyebrow">Filtros ativos</p><div class="active-filters">${
      [state.theme, state.level, state.mode]
        .filter((item) => item !== "Todos")
        .map((item) => `<span class="chip">${item}</span>`)
        .join(" ") || "<span class='muted'>Nenhum filtro aplicado</span>"
    }</div><button class="button small" data-action="clear-group-filters">Limpar filtros</button></aside>
      <div id="group-results">${groupResults()}</div>
    </div>`,
  )
}

function groupDetailsScreen() {
  const group =
    state.exploreGroups.find(
      (item) => String(item.id) === String(state.selectedGroupId),
    ) || state.exploreGroups[0]

  if (!group) {
    return page(
      "Grupo não encontrado",
      "Volte para a lista e escolha um grupo disponível.",
      button("Voltar para grupos", "group-list"),
    )
  }

  return page(
    escapeHtml(group.name),
    "Um espaço para aprender, colaborar e compartilhar conhecimento.",
    `
    <div class="button-row">${
      group.isMember
        ? button(
            "Acessar área do grupo",
            "group-area",
            "primary",
            `data-group-id="${escapeHtml(group.id)}"`,
          )
        : button(
              "Participar do grupo",
              "participation-feedback",
              "primary",
              'data-action="join-group"',
            )
    }${button("Voltar para grupos", "group-list")}</div>
    <nav class="tabs" aria-label="Seções do grupo">${[
      ["Visão geral", "group-details"],
      ["Agenda", "agenda"],
      ["Materiais", "materials"],
      ["Atividades", "activities"],
      ["Projetos", "projects"],
    ]
      .map(
        ([label, target], index) =>
          `<button class="tab ${
            index === 0 ? "active" : ""
          }" data-nav="${target}" ${
            target === "agenda" && group
              ? `data-group-id="${escapeHtml(group.id)}"`
              : ""
          }>${label}</button>`,
      )
      .join("")}</nav>
    <div class="card-grid two">
      ${card(`<h2>Objetivo do grupo</h2><p>${escapeHtml(group.goal)}</p><div class="chips">${group.themes.map((theme) => `<span class="chip">${escapeHtml(theme)}</span>`).join("")}</div>`)}
      ${card(
        `<h2>Informações</h2>${details([
          ["Nível", group.level],
          ["Modalidade", group.mode],
          ["Responsável pelo grupo", "Consulte a equipe responsável"],
          ["Participantes", `${group.members} pessoas`],
        ])}`,
      )}
    </div>
    ${section(
      "Próximos encontros",
      `<div class="card">${details([
        [
          escapeHtml(group.nextMeeting),
          group.nextMeeting === "Não agendado"
            ? "Nenhum encontro agendado."
            : "Consulte os detalhes do encontro.",
        ],
      ])}</div>`,
      button("Abrir agenda", "agenda", "small"),
    )}
    ${state.profile === "student" ? groupMessageForm(group) : ""}
  `,
  )
}

function groupMessageForm(group) {
  const key = String(group.id)
  const teachers = state.groupTeachers[key] || []
  const status = state.groupTeachersLoading[key]
    ? '<p role="status">Carregando professores...</p>'
    : state.groupTeachersError[key]
      ? `<div class="form-message" role="alert"><p>${escapeHtml(state.groupTeachersError[key])}</p><button class="button small" type="button" data-action="retry-group-teachers" data-group-id="${escapeHtml(group.id)}">Tentar novamente</button></div>`
      : teachers.length
        ? `<form class="form" data-form="student-teacher-message" data-group-id="${escapeHtml(group.id)}"><div class="field"><label for="group-message-teacher">Professor</label><select id="group-message-teacher" name="teacherId" required><option value="">Selecione um professor</option>${teachers.map((teacher) => `<option value="${escapeHtml(teacher.id)}">${escapeHtml(teacher.name)}</option>`).join("")}</select></div><div class="field"><label for="group-message-subject">Assunto</label><input id="group-message-subject" name="subject" maxlength="200" required /></div><div class="field"><label for="group-message-body">Mensagem</label><textarea id="group-message-body" name="message" maxlength="5000" rows="4" required></textarea></div><button class="button primary" type="submit">Enviar mensagem</button><p class="form-message" data-message-status role="status" hidden></p></form>`
        : '<p class="empty-state">Este grupo ainda não tem professor orientador associado.</p>'

  const canReadConversation = group.isMember
  return `<section class="section"><h2>Enviar mensagem ao professor</h2><p class="muted">A conversa fica disponível dentro da plataforma.</p>${
    canReadConversation ? studentGroupMessages(key) : ""
  }${status}</section>`
}

function studentGroupMessages(groupId) {
  if (state.groupMessagesLoading[groupId]) {
    return '<p role="status">Carregando conversa...</p>'
  }
  if (state.groupMessagesError[groupId]) {
    return `<div class="empty-state" role="alert">${escapeHtml(state.groupMessagesError[groupId])}<button class="button small" type="button" data-action="refresh-group-messages" data-group-id="${escapeHtml(groupId)}">Tentar novamente</button></div>`
  }
  const messages = state.groupMessages[groupId] || []
  return `<div class="group-conversation">${
    messages.length
      ? messages
          .map(
            (message) =>
              `<article class="card list-card"><p class="eyebrow">${
                message.senderRole === "teacher"
                  ? `Resposta de ${escapeHtml(message.teacherName)}`
                  : "Sua mensagem"
              } · ${escapeHtml(new Date(message.createdAt).toLocaleString("pt-BR"))}</p><h3>${escapeHtml(message.subject)}</h3><p>${escapeHtml(message.message)}</p></article>`,
          )
          .join("")
      : '<p class="empty-state">Ainda não há mensagens nesta conversa.</p>'
  }</div>`
}

function participationScreen() {
  const group = state.exploreGroups.find(
    (item) => String(item.id) === String(state.selectedGroupId),
  )

  if (state.groupMembershipStatus === "loading") {
    return page(
      "Entrando no grupo",
      `Estamos registrando sua participação em ${escapeHtml(group?.name || "este grupo")}.`,
      '<p role="status">Aguarde...</p>',
      { compact: true, eyebrow: "Participação no grupo" },
    )
  }

  if (state.groupMembershipStatus === "error") {
    return page(
      "Não foi possível participar",
      escapeHtml(state.groupMembershipError),
      `<div class="button-row"><button class="button primary" type="button" data-action="retry-group-membership">Tentar novamente</button>${button("Voltar ao grupo", "group-details")}</div>`,
      { compact: true, eyebrow: "Participação no grupo" },
    )
  }

  return page(
    "Você entrou no grupo!",
    `Sua participação em ${escapeHtml(group?.name || "este grupo")} já está ativa. O grupo está disponível na sua área do estudante.`,
    `
    <div class="success-state"><h2>Participação confirmada</h2><p>Você já pode acessar os encontros, materiais e atividades do grupo.</p></div>
    ${button("Ir para Área do Grupo", "group-area", "primary", `data-group-id="${escapeHtml(group?.id || state.selectedGroupId || "")}"`)}
  `,
    { compact: true, eyebrow: "Participação no grupo" },
  )
}

function groupAreaScreen() {
  const group =
    state.myGroups.find(
      (item) => String(item.id) === String(state.selectedGroupId),
    ) ||
    state.exploreGroups.find(
      (item) => String(item.id) === String(state.selectedGroupId),
    ) ||
    state.myGroups[0]

  if (state.myGroupsLoading || !state.myGroupsLoaded) {
    return page(
      "Área do Grupo",
      "Carregando seus grupos...",
      '<p role="status">Aguarde...</p>',
    )
  }

  if (!state.myGroupsError && !group) {
    return page(
      "Área do Grupo",
      "Você ainda não participa de nenhum grupo.",
      button("Explorar grupos", "group-list", "primary"),
    )
  }

  return page(
    escapeHtml(group?.name || "Área do Grupo"),
    state.myGroupsLoading
      ? "Carregando os dados do grupo..."
      : escapeHtml(
          group?.goal || "Encontre aqui as atualizações e atividades do grupo.",
        ),
    `
    ${
      state.myGroupsError
        ? `<p class="form-message" role="alert">${escapeHtml(state.myGroupsError)}</p><button class="button small" type="button" data-action="retry-my-groups">Tentar novamente</button>`
        : ""
    }
    <div class="card-grid four">${stat("Próximo encontro", escapeHtml(group?.nextMeeting || "Não agendado"))}${stat("Materiais", "—")}${stat("Atividades abertas", "—")}${stat("Projetos", "—")}</div>
    <nav class="tabs" aria-label="Navegação da área do grupo">${[
      ["Visão geral", "group-area"],
      ["Agenda", "agenda"],
      ["Materiais", "materials"],
      ["Atividades", "activities"],
      ["Projetos", "projects"],
    ]
      .map(
        ([label, target], index) =>
          `<button class="tab ${
            index === 0 ? "active" : ""
          }" data-nav="${target}" ${
            target === "agenda" && group
              ? `data-group-id="${escapeHtml(group.id)}"`
              : ""
          }>${label}</button>`,
      )
      .join("")}</nav>
    <div class="card-grid two">
      ${card(`<p class="eyebrow">Próximo encontro</p><h3>${escapeHtml(group?.nextMeeting || "Não agendado")}</h3>${button("Ver agenda", "agenda", "small", group ? `data-group-id="${escapeHtml(group.id)}"` : "")}`)}
      ${card(`<p class="eyebrow">Participantes</p><h3>${escapeHtml(group?.members ?? 0)} membros</h3><p>Você participa deste grupo.</p>`)}
    </div>
  `,
  )
}

function agendaScreen() {
  const meetings =
    state.agendaGroupId === "all"
      ? state.meetings
      : state.meetings.filter(
          (meeting) => String(meeting.groupId) === state.agendaGroupId,
        )
  let results

  if (state.meetingsLoading || !state.myGroupsLoaded) {
    results =
      '<p class="empty-state" role="status">Carregando seus encontros...</p>'
  } else if (state.meetingsError || state.myGroupsError) {
    results = `<div class="empty-state" role="alert"><p>${escapeHtml(state.meetingsError || state.myGroupsError)}</p><button class="button small" type="button" data-action="retry-meetings">Tentar novamente</button></div>`
  } else if (!meetings.length) {
    results = `<div class="empty-state"><h3>Nenhum encontro futuro</h3><p>${
      state.myGroups.length
        ? "Seus grupos ainda não têm encontros futuros agendados."
        : "Participe de um grupo para acompanhar os encontros."
    }</p>${
      state.myGroups.length
        ? ""
        : button("Explorar grupos", "group-list", "small")
    }</div>`
  } else {
    const modalities = {
      online: "Online",
      in_person: "Presencial",
      hybrid: "Híbrido",
    }
    results = `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Horário</th><th>Encontro</th><th>Grupo</th><th>Modalidade</th><th>Local / link</th><th>Ação</th></tr></thead><tbody>${meetings
      .map((meeting) => {
        const startsAt = new Date(meeting.startsAt)
        const endsAt = new Date(meeting.endsAt)
        const date = startsAt.toLocaleDateString("pt-BR", {
          dateStyle: "medium",
        })
        const time = `${startsAt.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })}–${endsAt.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })}`
        const location = meeting.locationOrUrl
          ? escapeHtml(meeting.locationOrUrl)
          : "A definir"

        return `<tr><td>${escapeHtml(date)}</td><td>${escapeHtml(time)}</td><td>${escapeHtml(meeting.title)}</td><td>${escapeHtml(meeting.groupName)}</td><td>${modalities[meeting.modality] || escapeHtml(meeting.modality)}</td><td>${location}</td><td><button class="button small" type="button" data-nav="group-details" data-group-id="${escapeHtml(meeting.groupId)}">Ver grupo</button></td></tr>`
      })
      .join("")}</tbody></table></div>`
  }

  return page(
    "Agenda",
    "Acompanhe os próximos encontros agendados para os grupos dos quais você participa.",
    `
    <div class="filters"><div class="field"><label for="agenda-group">Grupo</label><select id="agenda-group"><option value="all" ${
      state.agendaGroupId === "all" ? "selected" : ""
    }>Todos os meus grupos</option>${state.myGroups
      .map(
        (group) =>
          `<option value="${escapeHtml(group.id)}" ${
            String(group.id) === state.agendaGroupId ? "selected" : ""
          }>${escapeHtml(group.name)}</option>`,
      )
      .join(
        "",
      )}</select></div><button class="button small" type="button" data-action="retry-meetings">Atualizar agenda</button></div>
    ${section("Próximos encontros", results)}
  `,
  )
}

const uploadAccept =
  ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.mp4,.webm,.mov,.mp3,.wav,.png,.jpg,.jpeg,.gif"

function formatBytes(value) {
  if (!Number.isFinite(Number(value))) return "Tamanho indisponível"
  const bytes = Number(value)
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function materialResults() {
  if (state.materialsLoading) {
    return '<p class="empty-state" role="status">Carregando materiais...</p>'
  }
  if (state.materialsError) {
    return `<div class="empty-state" role="alert"><p>${escapeHtml(state.materialsError)}</p><button class="button small" type="button" data-action="retry-materials">Tentar novamente</button></div>`
  }
  if (!state.materials.length) {
    return '<div class="empty-state"><h3>Nenhum material encontrado</h3><p>Materiais publicados para seus grupos aparecerão aqui.</p></div>'
  }

  return state.materials
    .map(
      (material) =>
        `<article class="card list-card"><div class="section-heading"><div><p class="eyebrow">${escapeHtml(material.type.toUpperCase())} · ${escapeHtml(material.groupName)}</p><h3>${escapeHtml(material.title)}</h3></div><a class="button small" href="/api/materials/${encodeURIComponent(material.id)}/file" target="_blank" rel="noopener">Abrir material</a></div><p>${escapeHtml(material.description || "")}</p><p class="meta">${escapeHtml(material.fileName || "Arquivo")} · ${formatBytes(material.fileSize)} · Publicado por ${escapeHtml(material.uploadedBy)}</p></article>`,
    )
    .join("")
}

function materialUploadForm() {
  if (state.profile !== "professor") return ""
  if (state.teacherGroupsLoading) {
    return '<p role="status">Carregando grupos orientados...</p>'
  }
  if (state.teacherGroupsError) {
    return `<p class="form-message" role="alert">${escapeHtml(state.teacherGroupsError)}</p>`
  }
  if (!state.teacherGroups.length) {
    return '<div class="empty-state">Você ainda não está associado a um grupo como professor orientador.</div>'
  }

  return `<section class="section"><h2>Publicar material</h2><p class="muted">PDF, documentos, imagens, áudio ou vídeo. Limite: 100 MB por arquivo.</p><form class="form" data-form="material-upload" enctype="multipart/form-data"><div class="field"><label for="material-group">Grupo</label><select id="material-group" name="groupId" required>${state.teacherGroups.map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)}</option>`).join("")}</select></div><div class="field"><label for="material-title">Título</label><input id="material-title" name="title" maxlength="200" required /></div><div class="field"><label for="material-description">Descrição</label><textarea id="material-description" name="description" maxlength="5000" rows="3"></textarea></div><div class="field"><label for="material-file">Arquivo</label><input id="material-file" name="file" type="file" accept="${uploadAccept}" required /></div><button class="button primary" type="submit">Enviar material</button><p class="form-message" data-upload-message role="status" hidden></p></form></section>`
}

function materialsScreen() {
  const types = [
    ["Todos", "Todos os formatos"],
    ["pdf", "PDF"],
    ["doc", "Word (.doc)"],
    ["docx", "Word (.docx)"],
    ["ppt", "PowerPoint (.ppt)"],
    ["pptx", "PowerPoint (.pptx)"],
    ["xls", "Excel (.xls)"],
    ["xlsx", "Excel (.xlsx)"],
    ["txt", "Texto"],
    ["csv", "CSV"],
    ["mp4", "Vídeo MP4"],
    ["webm", "Vídeo WebM"],
    ["mov", "Vídeo MOV"],
    ["mp3", "Áudio MP3"],
    ["wav", "Áudio WAV"],
    ["png", "Imagem PNG"],
    ["jpg", "Imagem JPG"],
    ["jpeg", "Imagem JPEG"],
    ["gif", "Imagem GIF"],
  ]

  return page(
    "Materiais",
    state.profile === "professor"
      ? "Publique arquivos de estudo para os grupos sob sua orientação."
      : "Materiais publicados pelos professores dos seus grupos.",
    `
    ${materialUploadForm()}
    <div class="filters"><div class="field"><label for="material-search">Buscar material</label><input id="material-search" type="search" value="${escapeHtml(state.materialSearch)}" placeholder="Título, descrição ou grupo" /></div><div class="field"><label for="material-type">Formato</label><select id="material-type">${types.map(([value, label]) => `<option value="${value}" ${state.materialType === value ? "selected" : ""}>${label}</option>`).join("")}</select></div><button class="button small" type="button" data-action="clear-material-filters">Limpar filtros</button><button class="button small" type="button" data-action="retry-materials">Atualizar lista</button></div>
    <div id="material-results">${materialResults()}</div>
  `,
  )
}

function activityStatusLabel(activity) {
  if (activity.submissionStatus === "submitted") return "Entregue"
  if (activity.submissionStatus === "completed") return "Concluída"
  if (activity.submissionStatus === "late") return "Prazo encerrado"
  return "Pendente"
}

function activityDeadline(activity) {
  return activity.dueAt
    ? new Date(activity.dueAt).toLocaleString("pt-BR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Sem prazo"
}

function studentActivityCards() {
  if (state.activitiesLoading) {
    return '<p class="empty-state" role="status">Carregando tarefas...</p>'
  }
  if (state.activitiesError) {
    return `<div class="empty-state" role="alert"><p>${escapeHtml(state.activitiesError)}</p><button class="button small" type="button" data-action="retry-activities">Tentar novamente</button></div>`
  }

  const activities = state.activities.filter((activity) => {
    const matchesGroup =
      state.activityGroupId === "all" ||
      String(activity.groupId) === state.activityGroupId
    const matchesStatus =
      state.activityStatus === "Todos" ||
      (state.activityStatus === "Pendentes" &&
        activity.submissionStatus === "pending") ||
      (state.activityStatus === "Entregues" &&
        ["submitted", "completed"].includes(activity.submissionStatus)) ||
      (state.activityStatus === "Prazo encerrado" &&
        activity.submissionStatus === "late")
    return matchesGroup && matchesStatus
  })

  if (!activities.length) {
    return '<div class="empty-state"><h3>Nenhuma tarefa encontrada</h3><p>As tarefas abertas para seus grupos aparecerão aqui.</p></div>'
  }

  return activities
    .map((activity) => {
      const canSubmit =
        activity.submissionStatus !== "late" &&
        (!activity.dueAt || new Date(activity.dueAt).getTime() >= Date.now())
      const submittedFile = activity.submissionFileName
        ? `<p class="meta">Último arquivo enviado: <a href="/api/submissions/${encodeURIComponent(activity.submissionId)}/file">${escapeHtml(activity.submissionFileName)}</a></p>`
        : ""
      const submissionForm = canSubmit
        ? `<form class="form" data-form="activity-submission" data-activity-id="${escapeHtml(activity.id)}" enctype="multipart/form-data"><div class="field"><label for="submission-file-${escapeHtml(activity.id)}">${
            activity.submissionId
              ? "Substituir arquivo da entrega"
              : "Enviar arquivo da entrega"
          }</label><input id="submission-file-${escapeHtml(activity.id)}" name="file" type="file" accept="${uploadAccept}" required /></div><button class="button small primary" type="submit">${
            activity.submissionId ? "Atualizar entrega" : "Enviar entrega"
          }</button><p class="form-message" data-upload-message role="status" hidden></p></form>`
        : '<p class="form-message" role="status">O prazo desta tarefa expirou; não é mais possível enviar arquivos.</p>'

      return `<article class="card list-card"><div class="section-heading"><div><p class="eyebrow">${escapeHtml(activity.groupName)} · Prazo: ${escapeHtml(activityDeadline(activity))}</p><h3>${escapeHtml(activity.title)}</h3></div>${status(escapeHtml(activityStatusLabel(activity)))}</div><p>${escapeHtml(activity.description)}</p>${submittedFile}<p class="meta">Professor: ${escapeHtml(activity.createdBy)}</p>${submissionForm}</article>`
    })
    .join("")
}

function activitiesScreen() {
  if (state.profile !== "student") {
    return page(
      "Atividades",
      "As tarefas de estudantes ficam disponíveis no perfil de estudante.",
      button("Voltar ao início", profiles[state.profile]?.home || "login"),
    )
  }

  return page(
    "Atividades",
    "Consulte os prazos e envie suas tarefas aos professores.",
    `
    <div class="filters"><div class="field"><label for="activity-status">Status</label><select id="activity-status">${["Todos", "Pendentes", "Entregues", "Prazo encerrado"].map((value) => `<option ${state.activityStatus === value ? "selected" : ""}>${value}</option>`).join("")}</select></div><div class="field"><label for="activity-group">Grupo</label><select id="activity-group"><option value="all">Todos os meus grupos</option>${state.myGroups.map((group) => `<option value="${escapeHtml(group.id)}" ${String(group.id) === state.activityGroupId ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("")}</select></div><button class="button small" type="button" data-action="retry-activities">Atualizar tarefas</button></div>
    ${studentActivityCards()}
  `,
  )
}

function projectDate(value) {
  return value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR")
    : "A definir"
}

function projectStatusLabel(value) {
  return (
    {
      planning: "Planejamento",
      in_progress: "Em andamento",
      completed: "Concluído",
      cancelled: "Cancelado",
    }[value] || value
  )
}

function projectCards(projects = state.projects) {
  if (state.projectsLoading) {
    return '<p class="empty-state" role="status">Carregando projetos...</p>'
  }
  if (state.projectsError) {
    return `<div class="empty-state" role="alert"><p>${escapeHtml(state.projectsError)}</p><button class="button small" type="button" data-action="refresh-projects">Tentar novamente</button></div>`
  }
  if (!projects.length) {
    return '<div class="empty-state">Nenhum projeto disponível para os grupos que você acompanha.</div>'
  }

  return projects
    .map((project) => {
      const members = project.memberNames.length
        ? project.memberNames.map(escapeHtml).join(", ")
        : "Nenhum participante"
      const membershipAction =
        state.profile === "student" && !project.isMember
          ? `<button class="button small primary" type="button" data-action="join-project" data-project-id="${escapeHtml(project.id)}">Participar do projeto</button>`
          : ""
      const editForm =
        state.profile === "professor"
          ? `<details><summary>Editar projeto</summary><form class="form compact-form" data-form="project-update" data-project-id="${escapeHtml(project.id)}"><label>Nome<input name="name" maxlength="200" value="${escapeHtml(project.name)}" required></label><label>Descrição<textarea name="description" maxlength="5000" rows="3" required>${escapeHtml(project.description)}</textarea></label><label>Status<select name="status"><option value="planning" ${
              project.status === "planning" ? "selected" : ""
            }>Planejamento</option><option value="in_progress" ${
              project.status === "in_progress" ? "selected" : ""
            }>Em andamento</option><option value="completed" ${
              project.status === "completed" ? "selected" : ""
            }>Concluído</option><option value="cancelled" ${
              project.status === "cancelled" ? "selected" : ""
            }>Cancelado</option></select></label><div class="form-grid two"><label>Início<input name="startsOn" type="date" value="${escapeHtml(project.startsOn || "")}"></label><label>Término<input name="endsOn" type="date" value="${escapeHtml(project.endsOn || "")}"></label></div><button class="button small primary" type="submit">Salvar alterações</button><p class="form-message" role="status" hidden></p></form></details>`
          : ""

      return card(
        `<div class="section-heading"><div><p class="eyebrow">${escapeHtml(project.groupName)}</p><h3>${escapeHtml(project.name)}</h3></div>${status(projectStatusLabel(project.status))}</div><p>${escapeHtml(project.description)}</p>${details(
          [
            ["Participantes", `${project.members} participante(s)`],
            [
              "Período",
              `${projectDate(project.startsOn)} – ${projectDate(project.endsOn)}`,
            ],
            ["Integrantes", members],
          ],
        )}<div class="button-row">${membershipAction}</div>${editForm}`,
        "list-card",
      )
    })
    .join("")
}

function filteredProjects() {
  return state.projects.filter(
    (project) =>
      (state.projectStatus === "Todos" ||
        projectStatusLabel(project.status) === state.projectStatus) &&
      (state.projectGroupId === "all" ||
        String(project.groupId) === state.projectGroupId),
  )
}

function projectsScreen() {
  return page(
    "Projetos",
    "Projetos dos grupos dos quais você participa.",
    `
    <div class="section-heading"><p class="muted">Acompanhe o andamento e participe dos projetos do seu grupo.</p><button class="button small" type="button" data-action="refresh-projects">Atualizar</button></div>
    <div class="filters">${selectField("Status", "project-status", ["Todos", "Planejamento", "Em andamento", "Concluído"], state.projectStatus)}<div class="field"><label for="project-group">Grupo</label><select id="project-group"><option value="all">Todos os grupos</option>${[
      ...new Map(
        state.projects.map((project) => [String(project.groupId), project]),
      ).values(),
    ]
      .map(
        (project) =>
          `<option value="${escapeHtml(project.groupId)}" ${
            String(project.groupId) === state.projectGroupId ? "selected" : ""
          }>${escapeHtml(project.groupName)}</option>`,
      )
      .join("")}</select></div></div>
    ${projectCards(filteredProjects())}
  `,
  )
}

function professorDashboardScreen() {
  const attendanceCount = state.teacherGroups.reduce(
    (total, group) => total + (group.attendanceCount || 0),
    0,
  )
  const presentCount = state.teacherGroups.reduce(
    (total, group) => total + (group.presentCount || 0),
    0,
  )
  const submissionCount = state.teacherGroups.reduce(
    (total, group) => total + (group.submissions || 0),
    0,
  )
  const completedCount = state.teacherGroups.reduce(
    (total, group) => total + (group.completedActivities || 0),
    0,
  )
  const studentCount = state.teacherGroups.reduce(
    (total, group) => total + group.members,
    0,
  )
  const groupsList = state.teacherGroupsLoading
    ? '<p role="status">Carregando grupos e indicadores...</p>'
    : state.teacherGroupsError
      ? `<div class="empty-state" role="alert">${escapeHtml(state.teacherGroupsError)}</div>`
      : state.teacherGroups.length
        ? `<div class="card-grid">${state.teacherGroups
            .map((group) =>
              card(
                `<h3>${escapeHtml(group.name)}</h3>${details([
                  ["Alunos participantes", `${group.members} alunos`],
                  [
                    "Frequência",
                    group.attendanceRate === null
                      ? "Sem registros"
                      : `${group.attendanceRate}%`,
                  ],
                  [
                    "Tarefas concluídas",
                    group.performanceRate === null
                      ? "Sem entregas"
                      : `${group.performanceRate}%`,
                  ],
                ])}${button("Gerenciar grupo", "professor-groups", "small")}`,
              ),
            )
            .join("")}</div>`
        : '<div class="empty-state">Você ainda não criou grupos de estudo.</div>'

  return page(
    "Dashboard do professor",
    "Gerencie seus grupos e acompanhe frequência e entregas dos alunos.",
    `
    <div class="card-grid four">${stat("Meus grupos", state.teacherGroups.length)}${stat("Alunos participantes", studentCount)}${stat("Frequência registrada", attendanceCount ? `${Math.round((presentCount / attendanceCount) * 100)}%` : "Sem registros")}${stat("Tarefas concluídas", submissionCount ? `${Math.round((completedCount / submissionCount) * 100)}%` : "Sem entregas")}</div>
    ${section("Grupos sob minha responsabilidade", groupsList)}
    ${section("Acesso rápido", `<div class="button-row">${button("Acompanhar atividades", "professor-activities")}${button("Acompanhar projetos", "professor-projects")}${button("Relatórios", "professor-reports")}</div>`)}
  `,
  )
}

function professorGroupsScreen() {
  return page(
    "Meus grupos",
    "Crie grupos de estudo e gerencie diretamente os alunos e as atividades.",
    `
    <section class="section">
  <h2>Criar grupo</h2>
  <p class="muted">
    Ao criar o grupo, você será associado automaticamente como professor orientador.
  </p>

  <form class="form" data-form="teacher-group-create">
    <div class="field">
      <label for="teacher-group-discipline">Disciplina</label>
      <select id="teacher-group-discipline" name="disciplineId" required>
        <option value="">Selecione uma disciplina</option>
        ${state.teacherDisciplines
          .map(
            (discipline) =>
              `<option value="${discipline.id}">${discipline.name}</option>`,
          )
          .join("")}
      </select>
    </div>

    <div class="field">
      <label for="teacher-group-name">Nome do grupo</label>
      <input
        id="teacher-group-name"
        name="name"
        maxlength="160"
        placeholder="Ex.: Grupo de Estudos de Inglês"
        required
      />
  <label for="teacher-group-discipline">Disciplina</label>
 <select id="teacher-group-discipline" name="disciplineId" required>
  <option value="">Selecione uma disciplina</option>
  ${state.teacherDisciplines
    .map(
      (discipline) =>
        `<option value="${discipline.id}">${discipline.name}</option>`,
    )
    .join("")}
</select>
</div>

<div class="field">
  <label for="teacher-group-name">Nome do grupo</label>
  <input
    id="teacher-group-name"
    name="name"
    maxlength="160"
    placeholder="Ex.: Grupo de Estudos de Inglês"
    required
  />
</div></div><div class="field"><label for="teacher-group-description">Descrição / objetivo</label><textarea id="teacher-group-description" name="description" maxlength="5000" rows="3" required></textarea></div><div class="form-grid two"><div class="field"><label for="teacher-group-level">Nível</label><select id="teacher-group-level" name="level" required><option value="beginner">Iniciante</option><option value="intermediate">Intermediário</option><option value="advanced">Avançado</option></select></div><div class="field"><label for="teacher-group-modality">Modalidade</label><select id="teacher-group-modality" name="modality" required><option value="online">Online</option><option value="in_person">Presencial</option><option value="hybrid">Híbrido</option></select></div></div><div class="field"><label for="teacher-group-themes">Temas (separados por vírgula)</label><input id="teacher-group-themes" name="themes" maxlength="800" placeholder="Ex.: Redes, Segurança" /></div><button class="button primary" type="submit">Criar grupo</button><p class="form-message" data-group-create-message role="status" hidden></p></form></section>
    <section class="section"><div class="section-heading"><h2>Grupos sob minha orientação</h2><button class="button small" type="button" data-action="refresh-teacher-groups">Atualizar</button></div>${teacherGroupsContent()}</section>
  `,
  )
}

function teacherGroupsContent() {
  if (state.teacherGroupsLoading) {
    return     '<p role="status">Carregando grupos e participantes...</p>'
  }
  if (state.teacherGroupsError) {
    return `<div class="empty-state" role="alert"><p>${escapeHtml(state.teacherGroupsError)}</p><button class="button small" type="button" data-action="refresh-teacher-groups">Tentar novamente</button></div>`
  }
  if (!state.teacherGroups.length) {
    return '<div class="empty-state">Você ainda não criou ou recebeu associação a um grupo.</div>'
  }
  return `<div class="card-grid">${state.teacherGroups
    .map((group) => {
      const students = (group.students || [])
        .map(
          (student) =>
            `<li>${escapeHtml(student.name)} <button class="button small" type="button" data-action="remove-teacher-student" data-student-id="${escapeHtml(student.id)}" data-group-id="${escapeHtml(group.id)}">Remover</button></li>`,
        )
        .join("")
      const attendanceOptions = (group.students || [])
        .map(
          (student) =>
            `<label class="attendance-entry">${escapeHtml(student.name)}<select name="attendance-${escapeHtml(student.id)}" required><option value="" selected disabled>Selecione</option><option value="present">Presente</option><option value="absent">Ausente</option><option value="justified">Justificada</option></select></label>`,
        )
        .join("")
      return `<article class="card list-card"><p class="eyebrow">${escapeHtml((group.themes || []).join(" · ") || "Grupo de estudo")}</p><h3>${escapeHtml(group.name)}</h3><p>${escapeHtml(group.description || "")}</p><p class="meta">${escapeHtml(group.members)} aluno(s) participante(s)</p><details><summary>Participantes (${escapeHtml(group.members)})</summary>${
        students
          ? `<ul class="teacher-student-list">${students}</ul>`
          : "<p>Nenhum aluno participa deste grupo ainda.</p>"
      }</details><details><summary>Editar grupo</summary><form class="form compact-form" data-form="teacher-group-update" data-group-id="${escapeHtml(group.id)}"><label>Nome<input name="name" list="teacher-subjects" value="${escapeHtml(group.name)}" maxlength="160" required></label><label>Descrição<textarea name="description" maxlength="5000" rows="2" required>${escapeHtml(group.description || "")}</textarea></label><div class="form-grid two"><label>Nível<select name="level"><option value="beginner" ${
        group.level === "beginner" ? "selected" : ""
      }>Iniciante</option><option value="intermediate" ${
        group.level === "intermediate" ? "selected" : ""
      }>Intermediário</option><option value="advanced" ${
        group.level === "advanced" ? "selected" : ""
      }>Avançado</option></select></label><label>Modalidade<select name="modality"><option value="online" ${
        group.modality === "online" ? "selected" : ""
      }>Online</option><option value="in_person" ${
        group.modality === "in_person" ? "selected" : ""
      }>Presencial</option><option value="hybrid" ${
        group.modality === "hybrid" ? "selected" : ""
      }>Híbrido</option></select></label></div><label>Temas<input name="themes" value="${escapeHtml((group.themes || []).join(", "))}" maxlength="800"></label><button class="button small primary" type="submit">Salvar alterações</button><p class="form-message" role="status" hidden></p></form></details>${
        group.students?.length
          ? `<details><summary>Registrar frequência</summary><form class="form compact-form" data-form="teacher-attendance" data-group-id="${escapeHtml(group.id)}"><label>Encontro<input name="title" maxlength="160" required placeholder="Ex.: Aula de redes"></label><label>Data e horário<input name="startsAt" type="datetime-local" required></label><div class="attendance-list">${attendanceOptions}</div><button class="button small primary" type="submit">Registrar frequência</button><p class="form-message" role="status" hidden></p></form></details>`
          : ""
      }<div class="button-row"><button class="button small" type="button" data-nav="materials">Publicar material</button><button class="button small" type="button" data-nav="professor-activities">Abrir tarefa</button><button class="button small" type="button" data-action="archive-teacher-group" data-group-id="${escapeHtml(group.id)}">Arquivar grupo</button></div></article>`
    })
    .join("")}</div>`
}

function professorMessagesScreen() {
  if (state.teacherMessagesLoading) {
    return page(
      "Mensagens",
      "Solicitações e mensagens enviadas pelos estudantes.",
      '<p role="status">Carregando mensagens...</p>',
    )
  }
  if (state.teacherMessagesError) {
    return page(
      "Mensagens",
      "Solicitações e mensagens enviadas pelos estudantes.",
      `<div class="empty-state" role="alert"><p>${escapeHtml(state.teacherMessagesError)}</p><button class="button small" type="button" data-action="refresh-teacher-messages">Tentar novamente</button></div>`,
    )
  }
  const messages = state.teacherMessages.length
    ? state.teacherMessages
        .map(
          (message) =>
            `<article class="card list-card"><div class="section-heading"><div><p class="eyebrow">${escapeHtml(message.groupName)} · ${escapeHtml(new Date(message.createdAt).toLocaleString("pt-BR"))}</p><h2>${escapeHtml(message.subject)}</h2></div><span class="status">${
              message.status === "unread" ? "Não lida" : "Lida"
            }</span></div><p>${escapeHtml(message.message)}</p><p class="meta">${
              message.senderRole === "teacher" ? "Resposta enviada para" : "De"
            } ${escapeHtml(message.studentName)} · ${escapeHtml(message.studentEmail)}</p>${
              message.status === "unread"
                ? `<button class="button small" type="button" data-action="mark-teacher-message-read" data-message-id="${escapeHtml(message.id)}">Marcar como lida</button>`
                : ""
            }${
              message.senderRole === "student"
                ? `<form class="form compact-form" data-form="teacher-message-reply" data-message-id="${escapeHtml(message.id)}"><label>Responder ao aluno<textarea name="message" maxlength="5000" rows="3" required></textarea></label><button class="button small primary" type="submit">Enviar resposta</button><p class="form-message" role="status" hidden></p></form>`
                : ""
            }</article>`,
        )
        .join("")
    : '<div class="empty-state">Você ainda não recebeu mensagens de estudantes.</div>'
  return page(
    "Mensagens",
    "Solicitações e mensagens enviadas pelos estudantes.",
    `<div class="section-heading"><p>As mensagens são recebidas nesta caixa da plataforma.</p><button class="button small" type="button" data-action="refresh-teacher-messages">Atualizar</button></div><div class="card-grid">${messages}</div>`,
  )
}

function professorActivitiesScreen() {
  return page(
    "Tarefas dos grupos",
    "Abra tarefas com prazo e acompanhe as entregas dos estudantes.",
    `
    ${
      state.teacherGroupsLoading
        ? '<p role="status">Carregando grupos orientados...</p>'
        : state.teacherGroupsError
          ? `<p class="form-message" role="alert">${escapeHtml(state.teacherGroupsError)}</p>`
          : state.teacherGroups.length
            ? `<section class="section"><h2>Abrir nova tarefa</h2><p class="muted">Defina um prazo futuro. Os alunos dos grupos selecionados poderão enviar arquivos de até 100 MB.</p><form class="form" data-form="activity-create"><div class="field"><label for="activity-create-group">Grupo</label><select id="activity-create-group" name="groupId" required>${state.teacherGroups.map((group) => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)}</option>`).join("")}</select></div><div class="field"><label for="activity-title">Título</label><input id="activity-title" name="title" maxlength="200" required /></div><div class="field"><label for="activity-description">Instruções</label><textarea id="activity-description" name="description" maxlength="5000" rows="4" required></textarea></div><div class="field"><label for="activity-due-at">Prazo de entrega</label><input id="activity-due-at" name="dueAt" type="datetime-local" required /></div><button class="button primary" type="submit">Abrir tarefa</button><p class="form-message" data-upload-message role="status" hidden></p></form></section>`
            : '<div class="empty-state">Você ainda não criou grupos de estudo.</div>'
    }
    <section class="section"><div class="section-heading"><h2>Tarefas abertas</h2><button class="button small" type="button" data-action="retry-teacher-activities">Atualizar</button></div>${teacherActivityCards()}</section>
  `,
  )
}

function teacherActivityCards() {
  if (state.teacherActivitiesLoading) {
    return '<p class="empty-state" role="status">Carregando tarefas...</p>'
  }
  if (state.teacherActivitiesError) {
    return `<div class="empty-state" role="alert"><p>${escapeHtml(state.teacherActivitiesError)}</p><button class="button small" type="button" data-action="retry-teacher-activities">Tentar novamente</button></div>`
  }
  if (!state.teacherActivities.length) {
    return '<div class="empty-state">Você ainda não abriu tarefas para seus grupos.</div>'
  }

  return state.teacherActivities
    .map((activity) => {
      const submissions = state.teacherSubmissions[activity.id] || []
      const submissionContent = state.teacherSubmissionsLoading[activity.id]
        ? '<p role="status">Carregando entregas...</p>'
        : state.teacherSubmissionsError[activity.id]
          ? `<p class="form-message" role="alert">${escapeHtml(state.teacherSubmissionsError[activity.id])}</p>`
          : submissions.length
            ? `<ul>${submissions
                .map(
                  (submission) =>
                    `<li>${escapeHtml(submission.studentName)} · ${escapeHtml(submission.status)} · ${escapeHtml(submission.fileName || "Sem arquivo")} · ${
                      submission.submittedAt
                        ? escapeHtml(
                            new Date(submission.submittedAt).toLocaleString(
                              "pt-BR",
                            ),
                          )
                        : "Sem envio registrado"
                    } ${
                      submission.fileName
                        ? `<a href="/api/submissions/${encodeURIComponent(submission.id)}/file">Baixar</a>`
                        : ""
                    } ${
                      submission.status === "submitted" ||
                      submission.status === "late"
                        ? `<button class="button small" type="button" data-action="complete-submission" data-submission-id="${escapeHtml(submission.id)}" data-activity-id="${escapeHtml(activity.id)}">Marcar como concluída</button>`
                        : ""
                    }</li>`,
                )
                .join("")}</ul>`
            : "<p>Nenhuma entrega foi enviada.</p>"

      return `<article class="card list-card"><p class="eyebrow">${escapeHtml(activity.groupName)} · Prazo: ${escapeHtml(activityDeadline(activity))}</p><h3>${escapeHtml(activity.title)}</h3><p>${escapeHtml(activity.description)}</p><p class="meta">${escapeHtml(activity.submissionCount)} entrega(s) recebida(s)</p><details><summary>Consultar entregas</summary><button class="button small" type="button" data-action="load-activity-submissions" data-activity-id="${escapeHtml(activity.id)}">Atualizar entregas</button>${submissionContent}</details></article>`
    })
    .join("")
}

function professorProjectsScreen() {
  return page(
    "Projetos dos grupos",
    "Crie projetos para seus grupos e atualize seu andamento.",
    `
    <section class="section"><h2>Criar projeto</h2>${
      state.teacherGroupsLoading
        ? '<p role="status">Carregando seus grupos...</p>'
        : state.teacherGroupsError
          ? `<p class="form-message" role="alert">${escapeHtml(state.teacherGroupsError)}</p>`
          : state.teacherGroups.length
            ? `<form class="form" data-form="project-create"><div class="field"><label for="project-create-group">Grupo</label><select id="project-create-group" name="groupId" required>${state.teacherGroups
                .map(
                  (group) =>
                    `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)}</option>`,
                )
                .join(
                  "",
                )}</select></div><label>Nome<input name="name" maxlength="200" required></label><label>Descrição<textarea name="description" maxlength="5000" rows="3" required></textarea></label><label>Status<select name="status"><option value="planning">Planejamento</option><option value="in_progress">Em andamento</option><option value="completed">Concluído</option></select></label><div class="form-grid two"><label>Início<input name="startsOn" type="date"></label><label>Término<input name="endsOn" type="date"></label></div><button class="button primary" type="submit">Criar projeto</button><p class="form-message" role="status" hidden></p></form>`
            : '<p class="empty-state">Crie um grupo antes de cadastrar projetos.</p>'
    }</section>
    <section class="section"><div class="section-heading"><h2>Projetos dos meus grupos</h2><button class="button small" type="button" data-action="refresh-projects">Atualizar</button></div><div class="filters">${selectField("Status", "project-status", ["Todos", "Planejamento", "Em andamento", "Concluído", "Cancelado"], state.projectStatus)}<div class="field"><label for="project-group">Grupo</label><select id="project-group"><option value="all">Todos os grupos</option>${state.teacherGroups
      .map(
        (group) =>
          `<option value="${escapeHtml(group.id)}" ${
            String(group.id) === state.projectGroupId ? "selected" : ""
          }>${escapeHtml(group.name)}</option>`,
      )
      .join(
        "",
      )}</select></div></div>${projectCards(filteredProjects())}</section>
  `,
  )
}

function professorReportsScreen() {
  const rows = state.teacherGroups
    .map(
      (group) =>
        `<tr><td>${escapeHtml(group.name)}</td><td>${
          group.attendanceRate === null
            ? "Sem registros"
            : `${group.attendanceRate}%`
        }</td><td>${
          group.performanceRate === null
            ? "Sem entregas"
            : `${group.completedActivities} / ${group.submissions} (${group.performanceRate}%)`
        }</td><td>${group.members}</td></tr>`,
    )
    .join("")

  return page(
    "Relatórios de Participação",
    "Consulte os dados registrados nos seus próprios grupos.",
    `
    ${
      state.teacherGroupsLoading
        ? '<p role="status">Carregando indicadores...</p>'
        : state.teacherGroupsError
          ? `<p class="form-message" role="alert">${escapeHtml(state.teacherGroupsError)}</p>`
          : `<div class="table-wrap"><table><thead><tr><th>Grupo</th><th>Frequência</th><th>Tarefas avaliadas</th><th>Alunos</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Você ainda não criou grupos.</td></tr>'}</tbody></table></div>`
    }
  `,
  )
}

function chartValue(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.min(100, Math.round(number)))
}

function chart(title, items, emptyMessage = "Sem dados suficientes para gerar o gráfico.") {
  const content = items.length
    ? `<div class="bar-chart">${items
        .map((item) => {
          const width = chartValue(item.value)
          const label = escapeHtml(item.label)
          const display = escapeHtml(item.display ?? `${width}%`)
          return `<div class="bar-row"><span title="${label}">${label}</span><div class="bar-track" role="img" aria-label="${label}: ${display}"><div class="bar-fill" style="width:${width}%"></div></div><strong>${display}</strong></div>`
        })
        .join("")}</div>`
    : `<p class="empty-chart">${emptyMessage}</p>`

  return card(`<h3>${escapeHtml(title)}</h3>${content}`, "chart-card")
}

function percentageChartItems(items, valueKey) {
  return items
    .filter((item) => item[valueKey] !== null && item[valueKey] !== undefined)
    .map((item) => ({
      label: item.name || item.groupName,
      value: item[valueKey],
      display: `${item[valueKey]}%`,
    }))
}

function countChartItems(items, valueKey) {
  const values = items.map((item) => Number(item[valueKey] || 0))
  const max = Math.max(...values, 0)
  if (!max) return []

  return items
    .filter((item) => Number(item[valueKey] || 0) > 0)
    .map((item) => {
      const value = Number(item[valueKey] || 0)
      return {
        label: item.name || item.groupName,
        value: (value / max) * 100,
        display: String(value),
      }
    })
}

function adminDashboardScreen() {
  const dashboard = state.managerDashboard
  if (state.managerDashboardLoading) {
    return page(
      "Dashboard do gestor",
      "Acompanhamento dos grupos, frequência dos alunos e desempenho nas atividades.",
      '<p role="status">Carregando indicadores...</p>',
    )
  }
  if (state.managerDashboardError) {
    return page(
      "Dashboard do gestor",
      "Acompanhamento dos grupos, frequência dos alunos e desempenho nas atividades.",
      `<div class="empty-state" role="alert"><p>${escapeHtml(state.managerDashboardError)}</p><button class="button small" type="button" data-action="refresh-manager-dashboard">Tentar novamente</button></div>`,
    )
  }
  const summary = dashboard?.summary || {}
  const groupsList = dashboard?.groups?.length
    ? `<div class="table-wrap"><table><thead><tr><th>Grupo</th><th>Professor responsável</th><th>Alunos</th><th>Encontros</th><th>Frequência</th><th>Tarefas concluídas</th></tr></thead><tbody>${dashboard.groups
        .map(
          (group) =>
            `<tr><td>${escapeHtml(group.name)}</td><td>${escapeHtml(group.teacherName)}</td><td>${escapeHtml(group.students)}</td><td>${escapeHtml(group.meetings)}</td><td>${
              group.attendanceRate === null
                ? "Sem registros"
                : `${escapeHtml(group.attendanceRate)}%`
            }</td><td>${
              group.performanceRate === null
                ? "Sem entregas avaliadas"
                : `${escapeHtml(group.performanceRate)}%`
            }</td></tr>`,
        )
        .join("")}</tbody></table></div>`
    : '<div class="empty-state">Ainda não há grupos de professores para acompanhar.</div>'
  const studentRows = dashboard?.students?.length
    ? `<div class="table-wrap"><table><thead><tr><th>Aluno</th><th>Grupo</th><th>Frequência</th><th>Desempenho nas tarefas</th></tr></thead><tbody>${dashboard.students
        .map(
          (student) =>
            `<tr><td>${escapeHtml(student.name)}</td><td>${escapeHtml(student.groupName)}</td><td>${
              student.attendanceRate === null
                ? "Sem registros"
                : `${escapeHtml(student.attendanceRate)}%`
            }</td><td>${
              student.performanceRate === null
                ? "Sem entregas avaliadas"
                : `${escapeHtml(student.performanceRate)}% (${escapeHtml(student.completedActivities)}/${escapeHtml(student.submissions)})`
            }</td></tr>`,
        )
        .join("")}</tbody></table></div>`
    : '<div class="empty-state">Os alunos participantes dos grupos aparecerão aqui.</div>'
  return page(
    "Dashboard do gestor",
    "Acompanhe os grupos dos professores, a frequência dos alunos e o desempenho nas atividades. Esta área é somente para consulta.",
    `
    <div class="section-heading"><p>Indicadores calculados com os registros feitos pelos professores.</p><button class="button small" type="button" data-action="refresh-manager-dashboard">Atualizar</button></div>
    <div class="card-grid four">${stat("Grupos ativos", escapeHtml(summary.groups ?? 0))}${stat("Alunos", escapeHtml(summary.students ?? 0))}${stat("Frequência registrada", summary.attendanceRate == null ? "Sem registros" : `${escapeHtml(summary.attendanceRate)}%`)}${stat("Tarefas concluídas", summary.performanceRate == null ? "Sem entregas" : `${escapeHtml(summary.performanceRate)}%`)}</div>
    ${section("Acompanhamento por grupo", groupsList)}
    ${section("Frequência e desempenho por aluno", studentRows)}
  `,
  )
}

function adminParticipationScreen() {
  const students = state.managerDashboard?.students || []
  const rows = students.length
    ? students
        .map(
          (student) =>
            `<tr><td>${escapeHtml(student.name)}</td><td>${escapeHtml(student.groupName)}</td><td>${
              student.attendanceRate === null
                ? "Sem registros"
                : `${escapeHtml(student.attendanceRate)}%`
            }</td><td>${
              student.performanceRate === null
                ? "Sem entregas avaliadas"
                : `${escapeHtml(student.performanceRate)}%`
            }</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="4">Não há dados de participação disponíveis.</td></tr>'
  return page(
    "Frequência e desempenho",
    "Indicadores registrados pelos professores. O gestor acompanha, sem aprovar alunos nem alterar grupos.",
    `
    <div class="section-heading"><p>Percentuais calculados a partir dos encontros e das entregas avaliadas.</p><button class="button small" type="button" data-action="refresh-manager-dashboard">Atualizar</button></div>
    <div class="table-wrap"><table><thead><tr><th>Aluno</th><th>Grupo</th><th>Frequência</th><th>Desempenho</th></tr></thead><tbody>${rows}</tbody></table></div>
  `,
  )
}

function adminUsersScreen() {
  return page(
    "Gerenciar Usuários",
    "Consulte e administre os usuários da plataforma.",
    `
    <section class="section">
      <div class="section-heading"><h2>Solicitações pendentes</h2><button class="button small" type="button" data-action="refresh-pending-users">Atualizar</button></div>
      <p class="form-message" data-pending-users-message role="status" hidden></p>
      <div class="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil solicitado</th><th>Recebido em</th><th>Ações</th></tr></thead><tbody id="pending-users-results">${pendingUserRows()}</tbody></table></div>
    </section>
    <div class="filters"><div class="field"><label for="users-search">Pesquisar</label><input id="users-search" type="search" value="${escapeHtml(state.userSearch)}" placeholder="Nome ou e-mail" /></div>${selectField("Perfil", "users-profile", ["Todos os perfis", "Estudante", "Professor", "Gestor"], state.userProfile)}${selectField("Status", "users-status", ["Todos", "Ativo", "Pendente", "Desativado"], state.userStatus)}<button class="button small" type="button" data-action="refresh-admin-users">Atualizar lista</button></div>
    <div class="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Ações</th></tr></thead><tbody id="users-results">${userRows()}</tbody></table></div>
  `,
  )
}

function pendingUserRows() {
  if (state.pendingUsersLoading) {
    return '<tr><td colspan="5">Carregando solicitações…</td></tr>'
  }

  if (state.pendingUsersError) {
    return `<tr><td colspan="5">${escapeHtml(state.pendingUsersError)}</td></tr>`
  }

  if (!state.pendingUsers.length) {
    return '<tr><td colspan="5">Não há solicitações pendentes.</td></tr>'
  }

  const profileLabels = {
    student: "Estudante",
    teacher: "Professor",
    manager: "Gestor",
  }

  return state.pendingUsers
    .map(
      (user) =>
        `<tr><td>${escapeHtml(user.name)}</td><td>${escapeHtml(user.email)}</td><td>${profileLabels[user.profile] || "Desconhecido"}</td><td>${escapeHtml(new Date(user.createdAt).toLocaleString("pt-BR"))}</td><td><button class="button small" type="button" data-action="approve-pending-user" data-user-id="${escapeHtml(user.id)}">Aprovar</button></td></tr>`,
    )
    .join("")
}

async function loadPendingUsers() {
  state.pendingUsersLoading = true
  state.pendingUsersError = ""
  updatePendingUsersTable()

  try {
    const response = await fetch("/api/admin/users/pending")
    const result = await response.json()

    if (!response.ok) {
      throw new Error(
        result.error || "Não foi possível carregar as solicitações.",
      )
    }

    state.pendingUsers = result.users
  } catch (error) {
    state.pendingUsersError =
      error.message || "Não foi possível conectar à API."
  } finally {
    state.pendingUsersLoading = false
    updatePendingUsersTable()
  }
}

function updatePendingUsersTable() {
  const results = app.querySelector("#pending-users-results")
  if (results) results.innerHTML = pendingUserRows()
}

async function loadExploreGroups() {
  const requestId = ++state.groupRequestId
  const params = new URLSearchParams()
  const levels = {
    Iniciante: "beginner",
    Intermediário: "intermediate",
    Avançado: "advanced",
  }
  const modalities = {
    Online: "online",
    Presencial: "in_person",
    Híbrido: "hybrid",
  }
  const sorts = {
    Relevância: "relevance",
    Nome: "name",
    Participantes: "members",
  }

  if (state.groupSearch.trim()) params.set("q", state.groupSearch.trim())
  if (state.theme !== "Todos") params.set("theme", state.theme)
  if (levels[state.level]) params.set("level", levels[state.level])
  if (modalities[state.mode]) params.set("modality", modalities[state.mode])
  params.set("sort", sorts[state.groupSort] || "relevance")

  state.groupLoading = true
  state.groupError = false
  updateGroupResults()

  try {
    const response = await fetch(`/api/groups?${params}`)
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || "Não foi possível carregar os grupos.")
    }

    if (requestId !== state.groupRequestId) return
    state.exploreGroups = result.groups.map(adaptApiGroup)
  } catch {
    if (requestId !== state.groupRequestId) return
    state.groupError = true
  } finally {
    if (requestId === state.groupRequestId) {
      state.groupLoading = false
      updateGroupResults()
      if (state.screen === "home") render()
      if (state.screen === "group-details") render()
    }
  }
}

async function loadMyGroups() {
  const requestId = ++state.myGroupsRequestId
  state.myGroupsLoading = true
  state.myGroupsError = ""
  if (["home", "group-area", "agenda"].includes(state.screen)) render()

  try {
    const response = await fetch("/api/groups/mine")
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || "Não foi possível carregar seus grupos.")
    }

    if (requestId !== state.myGroupsRequestId) return
    state.myGroups = result.groups.map(adaptApiGroup)
    for (const group of state.myGroups) {
      const exploredGroup = state.exploreGroups.find(
        (item) => String(item.id) === String(group.id),
      )
      if (exploredGroup) exploredGroup.isMember = true
    }
  } catch (error) {
    if (requestId !== state.myGroupsRequestId) return
    state.myGroupsError = error.message || "Não foi possível conectar à API."
  } finally {
    if (requestId === state.myGroupsRequestId) {
      state.myGroupsLoading = false
      state.myGroupsLoaded = true
      if (["home", "group-area", "agenda"].includes(state.screen)) render()
    }
  }
}
async function loadTeacherDisciplines() {
  const requestId = ++state.teacherDisciplinesRequestId

  state.teacherDisciplinesLoading = true
  state.teacherDisciplinesError = ""

  try {
    const response = await fetch("/api/disciplines")
    const result = await response.json()

    if (!response.ok) {
      throw new Error(
        result.error || "Não foi possível carregar as disciplinas.",
      )
    }

    if (requestId !== state.teacherDisciplinesRequestId) return

    state.teacherDisciplines = Array.isArray(result.disciplines)
      ? result.disciplines
      : []
  } catch (error) {
    if (requestId !== state.teacherDisciplinesRequestId) return

    state.teacherDisciplinesError =
      error.message || "Não foi possível conectar à API."
  } finally {
    if (requestId === state.teacherDisciplinesRequestId) {
      state.teacherDisciplinesLoading = false

      if (state.screen === "professor-groups") {
        render()
      }
    }
  }
}
async function loadTeacherGroups() {
  const requestId = ++state.teacherGroupsRequestId
  state.teacherGroupsLoading = true
  state.teacherGroupsError = ""
  if (
    state.screen === "materials" ||
    state.screen === "professor-activities" ||
    state.screen === "professor-groups" ||
    state.screen === "professor-dashboard" ||
    state.screen === "professor-reports" ||
    state.screen === "professor-projects"
  ) {
    render()
  }

  try {
    const response = await fetch("/api/teacher/groups")
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || "Não foi possível carregar seus grupos.")
    }
    if (requestId !== state.teacherGroupsRequestId) return
    state.teacherGroups = result.groups
  } catch (error) {
    if (requestId !== state.teacherGroupsRequestId) return
    state.teacherGroupsError =
      error.message || "Não foi possível conectar à API."
  } finally {
    if (requestId === state.teacherGroupsRequestId) {
      state.teacherGroupsLoading = false
      if (
        state.screen === "materials" ||
        state.screen === "professor-activities" ||
        state.screen === "professor-groups" ||
        state.screen === "professor-dashboard" ||
        state.screen === "professor-reports" ||
        state.screen === "professor-projects"
      ) {
        render()
      }
    }
  }
}

async function loadTeacherMessages() {
  const requestId = ++state.teacherMessagesRequestId
  state.teacherMessagesLoading = true
  state.teacherMessagesError = ""
  if (state.screen === "professor-messages") render()
  try {
    const response = await fetch("/api/teacher/messages")
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || "Não foi possível carregar mensagens.")
    }
    if (requestId !== state.teacherMessagesRequestId) return
    state.teacherMessages = result.messages
  } catch (error) {
    if (requestId !== state.teacherMessagesRequestId) return
    state.teacherMessagesError =
      error.message || "Não foi possível conectar à API."
  } finally {
    if (requestId === state.teacherMessagesRequestId) {
      state.teacherMessagesLoading = false
      if (state.screen === "professor-messages") render()
    }
  }
}

async function markTeacherMessageRead(messageId) {
  try {
    const response = await fetch(
      `/api/teacher/messages/${encodeURIComponent(messageId)}`,
      { method: "PATCH" },
    )
    const result = await response.json()
    if (!response.ok) {
      showToast(result.error || "Não foi possível atualizar a mensagem.")
      return
    }
    await loadTeacherMessages()
  } catch {
    showToast("Não foi possível conectar à API para atualizar a mensagem.")
  }
}

async function loadGroupTeachers(groupId) {
  const key = String(groupId)
  state.groupTeachersLoading[key] = true
  delete state.groupTeachersError[key]
  try {
    const response = await fetch(
      `/api/groups/${encodeURIComponent(key)}/teachers`,
    )
    const result = await response.json()
    if (!response.ok) {
      throw new Error(
        result.error || "Não foi possível carregar os professores.",
      )
    }
    state.groupTeachers[key] = result.teachers
  } catch (error) {
    state.groupTeachersError[key] =
      error.message || "Não foi possível conectar à API."
  } finally {
    state.groupTeachersLoading[key] = false
    if (
      state.screen === "group-details" &&
      String(state.selectedGroupId) === key
    ) {
      render()
    }
  }
}

async function loadGroupMessages(groupId) {
  const key = String(groupId)
  state.groupMessagesLoading[key] = true
  delete state.groupMessagesError[key]
  if (state.screen === "group-details") render()
  try {
    const response = await fetch(
      `/api/groups/${encodeURIComponent(key)}/messages`,
    )
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || "Não foi possível carregar a conversa.")
    }
    state.groupMessages[key] = result.messages
  } catch (error) {
    state.groupMessagesError[key] =
      error.message || "Não foi possível conectar à API."
  } finally {
    state.groupMessagesLoading[key] = false
    if (
      state.screen === "group-details" &&
      String(state.selectedGroupId) === key
    ) {
      render()
    }
  }
}

async function createTeacherGroup(form) {
  const submitButton = form.querySelector('button[type="submit"]')
  const message = form.querySelector("[data-group-create-message]")
  const themes = form.elements
    .namedItem("themes")
    .value.split(",")
    .map((theme) => theme.trim())
    .filter(Boolean)
  submitButton.disabled = true
  message.hidden = true
  try {
    const response = await fetch("/api/teacher/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.elements.namedItem("name").value,
        description: form.elements.namedItem("description").value,
        level: form.elements.namedItem("level").value,
        modality: form.elements.namedItem("modality").value,
        themes,
      }),
    })
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || "Não foi possível criar o grupo.")
    }
    form.reset()
    await loadTeacherGroups()
    showToast(result.message)
  } catch (error) {
    message.textContent = error.message || "Não foi possível conectar à API."
    message.hidden = false
  } finally {
    if (submitButton.isConnected) submitButton.disabled = false
  }
}

async function updateTeacherGroup(form) {
  const submitButton = form.querySelector('button[type="submit"]')
  const message = form.querySelector(".form-message")
  submitButton.disabled = true
  message.hidden = true
  try {
    const response = await fetch(
      `/api/teacher/groups/${encodeURIComponent(form.dataset.groupId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.elements.namedItem("name").value,
          description: form.elements.namedItem("description").value,
          level: form.elements.namedItem("level").value,
          modality: form.elements.namedItem("modality").value,
          themes: form.elements
            .namedItem("themes")
            .value.split(",")
            .map((theme) => theme.trim())
            .filter(Boolean),
        }),
      },
    )
    const result = await response.json()
    if (!response.ok)
      throw new Error(result.error || "Não foi possível atualizar o grupo.")
    await loadTeacherGroups()
    showToast(result.message)
  } catch (error) {
    message.textContent = error.message || "Não foi possível conectar à API."
    message.hidden = false
  } finally {
    if (submitButton.isConnected) submitButton.disabled = false
  }
}

async function archiveTeacherGroup(groupId) {
  if (
    !window.confirm(
      "Arquivar este grupo? Ele deixará de aparecer para novos alunos, mas seus dados serão preservados.",
    )
  ) {
    return
  }
  try {
    const response = await fetch(
      `/api/teacher/groups/${encodeURIComponent(groupId)}`,
      { method: "DELETE" },
    )
    const result = await response.json()
    if (!response.ok) {
      showToast(result.error || "Não foi possível arquivar o grupo.")
      return
    }
    await loadTeacherGroups()
    showToast(result.message)
  } catch {
    showToast("Não foi possível conectar à API para arquivar o grupo.")
  }
}

async function removeTeacherMembership(membershipId) {
  try {
    const response = await fetch(
      `/api/teacher/memberships/${encodeURIComponent(membershipId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "left" }),
      },
    )
    const result = await response.json()
    if (!response.ok) {
      showToast(result.error || "Não foi possível atualizar o aluno.")
      return
    }
    await loadTeacherGroups()
    showToast(result.message)
  } catch {
    showToast("Não foi possível conectar à API para atualizar o aluno.")
  }
}

async function recordTeacherAttendance(form) {
  const submitButton = form.querySelector('button[type="submit"]')
  const message = form.querySelector(".form-message")
  const group = state.teacherGroups.find(
    (item) => String(item.id) === String(form.dataset.groupId),
  )
  const attendance = (group?.students || []).map((student) => ({
    studentId: student.id,
    status: form.elements.namedItem(`attendance-${student.id}`).value,
  }))
  submitButton.disabled = true
  message.hidden = true
  try {
    const response = await fetch(
      `/api/teacher/groups/${encodeURIComponent(form.dataset.groupId)}/attendance`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.elements.namedItem("title").value,
          startsAt: form.elements.namedItem("startsAt").value,
          attendance,
        }),
      },
    )
    const result = await response.json()
    if (!response.ok)
      throw new Error(
        result.error || "Não foi possível registrar a frequência.",
      )
    form.reset()
    message.textContent = result.message
    message.hidden = false
  } catch (error) {
    message.textContent = error.message || "Não foi possível conectar à API."
    message.hidden = false
  } finally {
    if (submitButton.isConnected) submitButton.disabled = false
  }
}

async function sendTeacherMessage(form) {
  const submitButton = form.querySelector('button[type="submit"]')
  const messageStatus = form.querySelector("[data-message-status]")
  submitButton.disabled = true
  messageStatus.hidden = true
  try {
    const response = await fetch(
      `/api/groups/${encodeURIComponent(form.dataset.groupId)}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: form.elements.namedItem("teacherId").value,
          subject: form.elements.namedItem("subject").value,
          message: form.elements.namedItem("message").value,
        }),
      },
    )
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || "Não foi possível enviar a mensagem.")
    }
    form.reset()
    messageStatus.textContent = result.message
    messageStatus.hidden = false
    if (state.user?.id) {
      loadGroupMessages(form.dataset.groupId)
    }
  } catch (error) {
    messageStatus.textContent =
      error.message || "Não foi possível conectar à API."
    messageStatus.hidden = false
  } finally {
    if (submitButton.isConnected) submitButton.disabled = false
  }
}

async function replyToStudentMessage(form) {
  const submitButton = form.querySelector('button[type="submit"]')
  const messageStatus = form.querySelector(".form-message")
  submitButton.disabled = true
  messageStatus.hidden = true
  try {
    const response = await fetch(
      `/api/teacher/messages/${encodeURIComponent(form.dataset.messageId)}/reply`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: form.elements.namedItem("message").value,
        }),
      },
    )
    const result = await response.json()
    if (!response.ok)
      throw new Error(result.error || "Não foi possível enviar a resposta.")
    showToast(result.message)
    await loadTeacherMessages()
  } catch (error) {
    messageStatus.textContent =
      error.message || "Não foi possível conectar à API."
    messageStatus.hidden = false
  } finally {
    if (submitButton.isConnected) submitButton.disabled = false
  }
}

async function loadMaterials() {
  const requestId = ++state.materialsRequestId
  const params = new URLSearchParams()
  if (state.materialSearch.trim()) params.set("q", state.materialSearch.trim())
  if (state.materialType !== "Todos") {
    params.set("type", state.materialType)
  }
  state.materialsLoading = true
  state.materialsError = ""
  const results = app.querySelector("#material-results")
  if (results) results.innerHTML = materialResults()

  try {
    const response = await fetch(`/api/materials?${params}`)
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || "Não foi possível carregar materiais.")
    }
    if (requestId !== state.materialsRequestId) return
    state.materials = result.materials
  } catch (error) {
    if (requestId !== state.materialsRequestId) return
    state.materialsError = error.message || "Não foi possível conectar à API."
  } finally {
    if (requestId === state.materialsRequestId) {
      state.materialsLoading = false
      const currentResults = app.querySelector("#material-results")
      if (currentResults) currentResults.innerHTML = materialResults()
    }
  }
}

async function loadStudentActivities() {
  const requestId = ++state.activitiesRequestId
  state.activitiesLoading = true
  state.activitiesError = ""
  if (state.screen === "activities") render()

  try {
    const response = await fetch("/api/activities/mine")
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || "Não foi possível carregar as tarefas.")
    }
    if (requestId !== state.activitiesRequestId) return
    state.activities = result.activities
  } catch (error) {
    if (requestId !== state.activitiesRequestId) return
    state.activitiesError = error.message || "Não foi possível conectar à API."
  } finally {
    if (requestId === state.activitiesRequestId) {
      state.activitiesLoading = false
      if (state.screen === "activities") render()
    }
  }
}

async function loadTeacherActivities() {
  const requestId = ++state.teacherActivitiesRequestId
  state.teacherActivitiesLoading = true
  state.teacherActivitiesError = ""
  if (state.screen === "professor-activities") render()

  try {
    const response = await fetch("/api/teacher/activities")
    const result = await response.json()
    if (!response.ok) {
      throw new Error(
        result.error || "Não foi possível carregar as tarefas orientadas.",
      )
    }
    if (requestId !== state.teacherActivitiesRequestId) return
    state.teacherActivities = result.activities
  } catch (error) {
    if (requestId !== state.teacherActivitiesRequestId) return
    state.teacherActivitiesError =
      error.message || "Não foi possível conectar à API."
  } finally {
    if (requestId === state.teacherActivitiesRequestId) {
      state.teacherActivitiesLoading = false
      if (state.screen === "professor-activities") render()
    }
  }
}

async function loadTeacherSubmissions(activityId) {
  const key = String(activityId)
  state.teacherSubmissionsLoading[key] = true
  delete state.teacherSubmissionsError[key]
  if (state.screen === "professor-activities") render()

  try {
    const response = await fetch(
      `/api/teacher/activities/${encodeURIComponent(key)}/submissions`,
    )
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || "Não foi possível carregar as entregas.")
    }
    state.teacherSubmissions[key] = result.submissions
  } catch (error) {
    state.teacherSubmissionsError[key] =
      error.message || "Não foi possível conectar à API."
  } finally {
    state.teacherSubmissionsLoading[key] = false
    if (state.screen === "professor-activities") render()
  }
}

async function completeTeacherSubmission(submissionId, activityId) {
  try {
    const response = await fetch(
      `/api/teacher/submissions/${encodeURIComponent(submissionId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      },
    )
    const result = await response.json()
    if (!response.ok) {
      showToast(result.error || "Não foi possível avaliar a entrega.")
      return
    }
    showToast(result.message)
    await Promise.all([
      loadTeacherSubmissions(activityId),
      loadTeacherActivities(),
    ])
  } catch {
    showToast("Não foi possível conectar à API para avaliar a entrega.")
  }
}

async function loadMeetings() {
  const requestId = ++state.meetingsRequestId
  state.meetingsLoading = true
  state.meetingsError = ""
  if (state.screen === "agenda") render()

  try {
    const response = await fetch("/api/meetings/mine")
    const result = await response.json()

    if (!response.ok) {
      throw new Error(
        result.error || "Não foi possível carregar seus próximos encontros.",
      )
    }

    if (requestId !== state.meetingsRequestId) return
    state.meetings = result.meetings
  } catch (error) {
    if (requestId !== state.meetingsRequestId) return
    state.meetingsError = error.message || "Não foi possível conectar à API."
  } finally {
    if (requestId === state.meetingsRequestId) {
      state.meetingsLoading = false
      if (state.screen === "agenda") render()
    }
  }
}

async function joinSelectedGroup() {
  const group = state.exploreGroups.find(
    (item) => String(item.id) === String(state.selectedGroupId),
  )

  if (!group) {
    state.groupMembershipStatus = "error"
    state.groupMembershipError =
      "O grupo selecionado não está disponível. Volte à lista e escolha um grupo ativo."
    render()
    return
  }

  state.groupMembershipStatus = "loading"
  state.groupMembershipError = ""
  render()

  try {
    const response = await fetch(
      `/api/groups/${encodeURIComponent(group.id)}/membership`,
      { method: "POST" },
    )
    const result = await response.json()

    if (!response.ok) {
      throw new Error(
        result.error || "Não foi possível registrar a participação.",
      )
    }

    group.membershipStatus = "active"
    group.isMember = true
    state.myGroupsRequestId += 1
    state.groupMembershipStatus = "success"
    await Promise.all([loadMyGroups(), loadExploreGroups()])
  } catch (error) {
    state.groupMembershipStatus = "error"
    state.groupMembershipError =
      error.message || "Não foi possível conectar à API."
  }

  render()
}

function updateGroupResults() {
  const results = app.querySelector("#group-results")
  if (results) results.innerHTML = groupResults()
}

async function loadAdminGroups() {
  const requestId = ++state.adminGroupRequestId
  const params = new URLSearchParams()

  if (state.adminGroupSearch.trim()) {
    params.set("q", state.adminGroupSearch.trim())
  }

  state.adminGroupsLoading = true
  state.adminGroupsError = ""
  updateAdminGroupsTable()

  try {
    const groupsResponse = await fetch(`/api/admin/groups?${params}`)
    const groupsResult = await groupsResponse.json()

    if (!groupsResponse.ok) {
      throw new Error(
        groupsResult.error || "Não foi possível carregar os grupos.",
      )
    }

    if (requestId !== state.adminGroupRequestId) return
    state.adminGroups = groupsResult.groups.map(adaptApiGroup)
  } catch (error) {
    if (requestId !== state.adminGroupRequestId) return
    state.adminGroupsError = error.message || "Não foi possível conectar à API."
  } finally {
    if (requestId === state.adminGroupRequestId) {
      state.adminGroupsLoading = false
      updateAdminGroupsTable()
    }
  }
}

async function loadManagerDashboard() {
  state.managerDashboardLoading = true
  state.managerDashboardError = ""
  if (["admin-dashboard", "admin-participation"].includes(state.screen))
    render()
  try {
    const response = await fetch("/api/manager/dashboard", {
      cache: "no-store",
    })
    const result = await response.json()
    if (!response.ok) {
      throw new Error(
        result.error || "Não foi possível carregar os indicadores.",
      )
    }
    state.managerDashboard = result
  } catch (error) {
    state.managerDashboardError =
      error.message || "Não foi possível conectar à API."
  } finally {
    state.managerDashboardLoading = false
    if (["admin-dashboard", "admin-participation"].includes(state.screen)) {
      render()
    }
  }
}

async function loadProjects() {
  const requestId = ++state.projectsRequestId
  state.projectsLoading = true
  state.projectsError = ""
  if (["projects", "professor-projects"].includes(state.screen)) render()
  try {
    const response = await fetch("/api/projects", { cache: "no-store" })
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || "Não foi possível carregar os projetos.")
    }
    if (requestId !== state.projectsRequestId) return
    state.projects = result.projects
  } catch (error) {
    if (requestId !== state.projectsRequestId) return
    state.projectsError = error.message || "Não foi possível conectar à API."
  } finally {
    if (requestId === state.projectsRequestId) {
      state.projectsLoading = false
      if (["projects", "professor-projects"].includes(state.screen)) render()
    }
  }
}

function projectFormData(form) {
  return {
    name: form.elements.namedItem("name").value,
    description: form.elements.namedItem("description").value,
    status: form.elements.namedItem("status").value,
    startsOn: form.elements.namedItem("startsOn").value || null,
    endsOn: form.elements.namedItem("endsOn").value || null,
  }
}

async function submitProjectForm(form, url, method) {
  const button = form.querySelector('button[type="submit"]')
  const message = form.querySelector(".form-message")
  button.disabled = true
  message.hidden = true
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(projectFormData(form)),
    })
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || "Não foi possível salvar o projeto.")
    }
    await loadProjects()
    if (method === "POST") form.reset()
    showToast(result.message || "Projeto atualizado.")
  } catch (error) {
    message.textContent = error.message || "Não foi possível conectar à API."
    message.hidden = false
  } finally {
    if (button.isConnected) button.disabled = false
  }
}

async function joinProject(projectId, button) {
  button.disabled = true
  try {
    const response = await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/membership`,
      { method: "POST" },
    )
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || "Não foi possível participar do projeto.")
    }
    await loadProjects()
    showToast(result.message)
  } catch (error) {
    button.disabled = false
    showToast(error.message || "Não foi possível conectar à API.")
  }
}

function updateAdminGroupsTable() {
  const results = app.querySelector("#admin-groups-results")
  if (results) results.innerHTML = adminGroupRows()
}

async function updateGroupStatus(groupId, currentStatus) {
  const status = currentStatus === "active" ? "inactive" : "active"

  try {
    const response = await fetch(
      `/api/admin/groups/${encodeURIComponent(groupId)}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    )
    const result = await response.json()

    if (!response.ok) {
      showToast(result.error || "Não foi possível atualizar o grupo.")
      return
    }

    await loadAdminGroups()
    showToast(result.message)
  } catch {
    showToast("Não foi possível conectar à API para atualizar o grupo.")
  }
}

async function updateGroupTeacher(groupId, teacherId, action = "assign") {
  const url = `/api/admin/groups/${encodeURIComponent(groupId)}/teachers${
    action === "remove" ? `/${encodeURIComponent(teacherId)}` : ""
  }`

  try {
    const response = await fetch(url, {
      method: action === "remove" ? "DELETE" : "POST",
      ...(action === "assign"
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teacherId }),
          }
        : {}),
    })
    const result = await response.json()

    if (!response.ok) {
      showToast(result.error || "Não foi possível atualizar a associação.")
      return
    }

    await loadAdminGroups()
    showToast(result.message)
  } catch {
    showToast("Não foi possível conectar à API para associar o professor.")
  }
}

function userRows() {
  if (state.adminUsersLoading) {
    return '<tr><td colspan="5">Carregando usuários…</td></tr>'
  }

  if (state.adminUsersError) {
    return `<tr><td colspan="5">${escapeHtml(state.adminUsersError)}</td></tr>`
  }

  const profileLabels = {
    student: "Estudante",
    teacher: "Professor",
    manager: "Gestor",
  }
  const statusLabels = {
    active: "Ativo",
    pending: "Pendente",
    disabled: "Desativado",
  }

  return (
    state.adminUsers
      .map(
        (user) =>
          `<tr><td>${escapeHtml(user.name)}</td><td>${escapeHtml(user.email)}</td><td>${profileLabels[user.profile] || "Desconhecido"}</td><td><span class="status">${statusLabels[user.status] || "Desconhecido"}</span></td><td>${
            ["active", "disabled"].includes(user.status)
              ? `<button class="button small" type="button" data-action="toggle-user" data-user-id="${escapeHtml(user.id)}" data-user-status="${user.status}">${
                  user.status === "active" ? "Desativar" : "Ativar"
                }</button>`
              : "—"
          }</td></tr>`,
      )
      .join("") ||
    `<tr><td colspan="5"><div class="empty-state">Nenhum usuário encontrado.</div></td></tr>`
  )
}

function adminGroupsScreen() {
  return page(
    "Grupos dos professores",
    "Acompanhamento somente para consulta. A criação e a gestão dos grupos pertencem aos professores responsáveis.",
    `
    <div class="section-heading"><p class="muted">Professores administram participantes, materiais e tarefas dos próprios grupos.</p><button class="button small" type="button" data-action="refresh-admin-groups">Atualizar lista</button></div>
    <div class="filters"><div class="field"><label for="admin-groups-search">Pesquisar</label><input id="admin-groups-search" type="search" value="${escapeHtml(state.adminGroupSearch)}" placeholder="Nome do grupo" /></div><button class="button small" type="button" data-action="refresh-admin-groups">Pesquisar</button></div>
    <div class="table-wrap"><table><thead><tr><th>Matéria / grupo</th><th>Tema</th><th>Participantes</th><th>Professor responsável</th><th>Status</th></tr></thead><tbody id="admin-groups-results">${adminGroupRows()}</tbody></table></div>
  `,
  )
}

function adminGroupRows() {
  if (state.adminGroupsLoading) {
    return '<tr><td colspan="5">Carregando grupos e professores…</td></tr>'
  }

  if (state.adminGroupsError) {
    return `<tr><td colspan="5">${escapeHtml(state.adminGroupsError)}</td></tr>`
  }

  const statuses = {
    active: "Ativo",
    inactive: "Desativado",
    archived: "Arquivado",
  }

  return (
    state.adminGroups
      .map((group) => {
        const assignedTeachers = (group.assignedTeachers || [])
          .map((teacher) => `<li>${escapeHtml(teacher.name)}</li>`)
          .join("")
        return `<tr><td>${escapeHtml(group.name)}</td><td>${escapeHtml(group.themes.join(", ") || "—")}</td><td>${escapeHtml(group.members)}</td><td><ul class="teacher-assignment-list">${assignedTeachers || "<li>Não informado</li>"}</ul></td><td><span class="status">${statuses[group.status] || "Desconhecido"}</span></td></tr>`
      })
      .join("") ||
    `<tr><td colspan="5"><div class="empty-state">Nenhum grupo encontrado.</div></td></tr>`
  )
}

function screenContent() {
  return (screenRenderers[state.screen] || loginScreen)()
}

function accessibilityTools() {
  return `<div class="accessibility-tools" role="group" aria-label="Ferramentas de acessibilidade">
    <button class="accessibility-button" type="button" data-accessibility="increase-font" aria-label="Aumentar tamanho do texto" title="Aumentar tamanho do texto">A+</button>
    <button class="accessibility-button" type="button" data-accessibility="decrease-font" aria-label="Diminuir tamanho do texto" title="Diminuir tamanho do texto">A−</button>
    <button class="accessibility-button contrast-button" type="button" data-accessibility="toggle-contrast" aria-label="Alternar alto contraste" aria-pressed="${state.accessibilityHighContrast}" title="Alternar alto contraste"><span aria-hidden="true">◐</span></button>
    <label class="visually-hidden" for="color-vision-filter">Filtro para daltonismo</label>
    <select class="accessibility-filter" id="color-vision-filter" aria-label="Filtro para daltonismo">
      <option value="default" ${
        state.colorVisionFilter === "default" ? "selected" : ""
      }>Cores Padrão</option>
      <option value="achromatomaly" ${
        state.colorVisionFilter === "achromatomaly" ? "selected" : ""
      }>Acromatomia</option>
      <option value="achromatopsia" ${
        state.colorVisionFilter === "achromatopsia" ? "selected" : ""
      }>Acromatopsia</option>
      <option value="deuteranomaly" ${
        state.colorVisionFilter === "deuteranomaly" ? "selected" : ""
      }>Deuteranomalia</option>
      <option value="deuteranopia" ${
        state.colorVisionFilter === "deuteranopia" ? "selected" : ""
      }>Deuteranopia</option>
      <option value="protanomaly" ${
        state.colorVisionFilter === "protanomaly" ? "selected" : ""
      }>Protanomalia</option>
      <option value="protanopia" ${
        state.colorVisionFilter === "protanopia" ? "selected" : ""
      }>Protanopia</option>
      <option value="tritanomaly" ${
        state.colorVisionFilter === "tritanomaly" ? "selected" : ""
      }>Tritanomalia</option>
      <option value="tritanopia" ${
        state.colorVisionFilter === "tritanopia" ? "selected" : ""
      }>Tritanopia</option>
    </select>
    <span class="visually-hidden" role="status" aria-live="polite" data-accessibility-status></span>
  </div>`
}

function shell(content) {
  if (authScreens.has(state.screen)) {
    return `<div class="auth-shell"><div class="auth-accessibility">${accessibilityTools()}</div>${content}</div>`
  }

  const profile = state.profile || "student"

  const home = profiles[profile].home
  const displayName = state.user?.name?.trim() || profiles[profile].label

  return `<header class="site-header">
    <button class="brand" data-nav="${home}" aria-label="TechFatec, página inicial">TechFatec</button>
    <nav class="header-nav" aria-label="Navegação principal">${navItems[profile].map(([label, destination]) => `<button class="nav-button" data-nav="${destination}" ${state.screen === destination ? 'aria-current="page"' : ""}>${label}</button>`).join("")}</nav>
    ${accessibilityTools()}
    <div class="header-user"><span class="persona-tag" title="${escapeHtml(profiles[profile].label)}">${escapeHtml(displayName)}</span><button class="nav-button" data-action="logout">Sair</button></div>
  </header>${content}<footer class="site-footer"><div><p class="wordmark">TechFatec</p><p>Plataforma acadêmica colaborativa para a FATEC.</p></div><div><h3>Explorar</h3><p>Grupos · Agenda · Materiais · Atividades · Projetos</p></div><div><h3>Suporte</h3><p>FAQ · Contato · Privacidade</p></div></footer>`
}

function applyAccessibilitySettings() {
  const elements = [...app.querySelectorAll("*")]

  for (const element of elements) {
    if (!baseFontSizes.has(element)) {
      baseFontSizes.set(
        element,
        Number.parseFloat(window.getComputedStyle(element).fontSize),
      )
    }
  }

  for (const element of elements) {
    element.style.fontSize = `${baseFontSizes.get(element) * state.accessibilityFontScale}px`
  }

  const filters = {
    achromatomaly: "url(#filter-achromatomaly)",
    achromatopsia: "url(#filter-achromatopsia)",
    deuteranomaly: "url(#filter-deuteranomaly)",
    deuteranopia: "url(#filter-deuteranopia)",
    protanomaly: "url(#filter-protanomaly)",
    protanopia: "url(#filter-protanopia)",
    tritanomaly: "url(#filter-tritanomaly)",
    tritanopia: "url(#filter-tritanopia)",
  }
  const colorFilter = filters[state.colorVisionFilter]
  const contrastFilter = state.accessibilityHighContrast ? "contrast(1.5)" : ""

  app.style.filter = [colorFilter, contrastFilter].filter(Boolean).join(" ")

  const status = app.querySelector("[data-accessibility-status]")
  if (status) {
    status.textContent = `Tamanho do texto: ${Math.round(state.accessibilityFontScale * 100)}%.`
  }
}

function render() {
  app.innerHTML = shell(screenContent())
  applyAccessibilitySettings()
}

function navigate(screen, push = true) {
  if (!Object.hasOwn(screenRenderers, screen)) return

  const requiredProfile = profileForScreen(screen)

  if (screen === "login") {
    state.profile = null
    state.user = null
  } else if (requiredProfile && !state.profile) {
    screen = "login"
  } else if (requiredProfile && state.profile !== requiredProfile) {
    screen = profiles[state.profile].home
    showToast("Essa área não está disponível para o seu perfil.")
  }

  state.screen = screen

  if (push) history.pushState({ screen }, "", `#${screen}`)
  else if (window.location.hash.slice(1) !== screen) {
    history.replaceState({ screen }, "", `#${screen}`)
  }

  render()

  if (screen === "admin-groups" && state.profile === "admin") {
    loadAdminGroups()
  }
  if (
    ["admin-dashboard", "admin-participation"].includes(screen) &&
    state.profile === "admin"
  ) {
    loadManagerDashboard()
  }
  if (["home", "group-list", "group-details"].includes(screen)) {
    loadExploreGroups()
  }
  if (
    ["home", "group-list", "group-details", "group-area", "agenda"].includes(
      screen,
    )
  ) {
    loadMyGroups()
  }
  if (screen === "agenda") loadMeetings()
  if (screen === "projects") loadProjects()
  if (screen === "professor-projects") {
    loadTeacherGroups()
    loadProjects()
  }
  if (screen === "materials") {
    loadMaterials()
    if (state.profile === "professor") loadTeacherGroups()
  }
  if (screen === "group-details" && state.profile === "student") {
    const groupId = state.selectedGroupId
    if (groupId) {
      loadGroupTeachers(groupId)
      const group = state.exploreGroups.find(
        (item) => String(item.id) === String(groupId),
      )
      if (group?.isMember) {
        loadGroupMessages(groupId)
      }
    }
  }
  if (screen === "activities" && state.profile === "student") {
    loadStudentActivities()
  }
  if (screen === "professor-activities" && state.profile === "professor") {
    loadTeacherGroups()
    loadTeacherActivities()
  }
  if (screen === "professor-groups" && state.profile === "professor") {
    loadTeacherGroups()
    loadTeacherDisciplines()
  }
  if (
    ["professor-dashboard", "professor-reports"].includes(screen) &&
    state.profile === "professor"
  ) {
    loadTeacherGroups()
  }
  if (screen === "professor-messages" && state.profile === "professor") {
    loadTeacherMessages()
  }

  window.scrollTo({ top: 0, behavior: "smooth" })
}

function profileForScreen(screen) {
  if (screen.startsWith("admin-")) return "admin"
  if (screen.startsWith("professor-")) return "professor"
  if (["login", "recovery", "reset-password", "register"].includes(screen))
    return null
  if (screen === "materials") return state.profile || "student"
  if (screen === "profile-selection") return state.profile || "student"
  return "student"
}

async function restoreSession() {
  const requestedScreen = window.location.hash.slice(1)

  if (!Object.hasOwn(screenRenderers, requestedScreen)) return
  if (!profileForScreen(requestedScreen)) {
    state.screen = requestedScreen
    render()
    return
  }

  try {
    const response = await fetch("/api/auth/me")
    const result = await response.json()

    if (!response.ok || !profiles[result.user?.profile]) {
      navigate("login", false)
      return
    }

    state.user = result.user
    state.profile = result.user.profile
    state.screen = requestedScreen
    navigate(requestedScreen, false)
  } catch {
    navigate("login", false)
    showToast("Não foi possível validar sua sessão. Entre novamente.")
  }
}

async function logout() {
  try {
    const response = await fetch("/api/auth/logout", { method: "POST" })

    if (!response.ok) {
      showToast("Não foi possível encerrar a sessão. Tente novamente.")
      return
    }
  } catch {
    showToast("Não foi possível conectar à API para encerrar a sessão.")
    return
  }

  navigate("login")
}

async function approvePendingUser(userId) {
  try {
    const response = await fetch(
      `/api/admin/users/${encodeURIComponent(userId)}/approve`,
      {
        method: "PATCH",
      },
    )
    const result = await response.json()

    if (!response.ok) {
      showToast(result.error || "Não foi possível aprovar a conta.")
      return
    }

    state.pendingUsers = state.pendingUsers.filter(
      (user) => String(user.id) !== String(userId),
    )
    updatePendingUsersTable()
    await loadAdminUsers()
    showToast(result.message)
  } catch {
    showToast("Não foi possível conectar à API para aprovar a conta.")
  }
}

async function updateUserStatus(userId, currentStatus) {
  const status = currentStatus === "active" ? "disabled" : "active"

  try {
    const response = await fetch(
      `/api/admin/users/${encodeURIComponent(userId)}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    )
    const result = await response.json()

    if (!response.ok) {
      showToast(result.error || "Não foi possível atualizar o usuário.")
      return
    }

    await loadAdminUsers()
    showToast(result.message)
  } catch {
    showToast("Não foi possível conectar à API para atualizar o usuário.")
  }
}

function setFormMessage(form, message, isError = false) {
  const output = form.querySelector("[data-upload-message]")
  if (!output) return
  output.textContent = message
  output.hidden = !message
  output.setAttribute("role", isError ? "alert" : "status")
}

async function uploadFormFile(form, endpoint) {
  const fileInput = form.querySelector('input[type="file"]')
  const file = fileInput?.files?.[0]
  const submitButton = form.querySelector('button[type="submit"]')
  if (!file) {
    setFormMessage(form, "Selecione um arquivo para enviar.", true)
    return
  }
  if (file.size > 100 * 1024 * 1024) {
    setFormMessage(form, "O arquivo excede o limite de 100 MB.", true)
    return
  }

  submitButton.disabled = true
  setFormMessage(form, "Enviando arquivo...")
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: new FormData(form),
    })
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || "Não foi possível enviar o arquivo.")
    }
    setFormMessage(form, result.message)
    fileInput.value = ""
    if (form.dataset.form === "material-upload") loadMaterials()
    if (form.dataset.form === "activity-submission") loadStudentActivities()
  } catch (error) {
    setFormMessage(
      form,
      error.message || "Não foi possível conectar à API.",
      true,
    )
  } finally {
    if (submitButton.isConnected) submitButton.disabled = false
  }
}

async function createActivity(form) {
  const groupId = form.elements.namedItem("groupId").value
  const submitButton = form.querySelector('button[type="submit"]')
  submitButton.disabled = true
  setFormMessage(form, "Abrindo tarefa...")

  try {
    const response = await fetch(
      `/api/teacher/groups/${encodeURIComponent(groupId)}/activities`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.elements.namedItem("title").value,
          description: form.elements.namedItem("description").value,
          dueAt: form.elements.namedItem("dueAt").value,
        }),
      },
    )
    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || "Não foi possível abrir a tarefa.")
    }
    form.reset()
    setFormMessage(form, result.message)
    loadTeacherActivities()
  } catch (error) {
    setFormMessage(
      form,
      error.message || "Não foi possível conectar à API.",
      true,
    )
  } finally {
    if (submitButton.isConnected) submitButton.disabled = false
  }
}

function showToast(message) {
  document.querySelector(".toast")?.remove()

  const toast = document.createElement("div")

  toast.className = "toast"

  toast.setAttribute("role", "status")

  toast.textContent = message

  document.body.append(toast)

  window.setTimeout(() => toast.remove(), 3200)
}

app.addEventListener("click", (event) => {
  const target = event.target.closest(
    "[data-nav], [data-action], [data-accessibility]",
  )

  if (!target) return

  if (target.dataset.accessibility) {
    if (target.dataset.accessibility === "increase-font") {
      state.accessibilityFontScale = Math.min(
        1.5,
        Number((state.accessibilityFontScale + 0.1).toFixed(1)),
      )
    } else if (target.dataset.accessibility === "decrease-font") {
      state.accessibilityFontScale = Math.max(
        0.8,
        Number((state.accessibilityFontScale - 0.1).toFixed(1)),
      )
    } else if (target.dataset.accessibility === "toggle-contrast") {
      state.accessibilityHighContrast = !state.accessibilityHighContrast
      target.setAttribute(
        "aria-pressed",
        String(state.accessibilityHighContrast),
      )
    }

    applyAccessibilitySettings()

    return
  }

  if (target.dataset.nav) {
    if (target.dataset.groupId) {
      state.selectedGroupId = target.dataset.groupId
    }
    if (target.dataset.nav === "agenda" && target.dataset.groupId) {
      state.agendaGroupId = target.dataset.groupId
    }

    navigate(target.dataset.nav)

    return
  }

  switch (target.dataset.action) {
    case "logout":
      logout()
      break

    case "join-group":
      state.groupMembershipStatus = "loading"
      navigate("participation-feedback")
      joinSelectedGroup()
      break
    case "retry-group-membership":
      joinSelectedGroup()
      break

    case "clear-group-filters":
      state.groupSearch = ""

      state.theme = "Todos"

      state.level = "Todos"

      state.mode = "Todos"
      state.groupLoading = false
      state.groupError = false

      render()
      loadExploreGroups()

      break

    case "simulate-group-loading":
      state.groupError = false
      state.groupLoading = true
      render()
      window.setTimeout(() => {
        state.groupLoading = false
        if (state.screen === "group-list") render()
      }, 1200)
      break

    case "simulate-group-error":
      state.groupLoading = false
      state.groupError = true
      render()
      break

    case "retry-group-load":
      loadExploreGroups()
      break
    case "retry-meetings":
      loadMeetings()
      break
    case "retry-materials":
      loadMaterials()
      break
    case "retry-activities":
      loadStudentActivities()
      break
    case "retry-teacher-activities":
      loadTeacherActivities()
      break
    case "refresh-teacher-groups":
      loadTeacherGroups()
      break
    case "refresh-teacher-messages":
      loadTeacherMessages()
      break
    case "mark-teacher-message-read":
      markTeacherMessageRead(target.dataset.messageId)
      break
    case "retry-group-teachers":
      loadGroupTeachers(target.dataset.groupId)
      break
    case "refresh-group-messages":
      loadGroupMessages(target.dataset.groupId)
      break
    case "load-activity-submissions":
      loadTeacherSubmissions(target.dataset.activityId)
      break
    case "complete-submission":
      completeTeacherSubmission(
        target.dataset.submissionId,
        target.dataset.activityId,
      )
      break

    case "refresh-admin-groups":
      loadAdminGroups()
      break
    case "refresh-manager-dashboard":
      loadManagerDashboard()
      break
    case "refresh-projects":
      loadProjects()
      break
    case "join-project":
      joinProject(target.dataset.projectId, target)
      break
    case "remove-teacher-student":
      removeTeacherMembership(
        target.dataset.membershipId ||
          state.teacherGroups
            .find((group) => String(group.id) === target.dataset.groupId)
            ?.students.find(
              (student) => String(student.id) === target.dataset.studentId,
            )?.membershipId,
        "left",
      )
      break
    case "archive-teacher-group":
      archiveTeacherGroup(target.dataset.groupId)
      break

    case "clear-material-filters":
      state.materialSearch = ""
      state.materialType = "Todos"
      render()
      loadMaterials()
      break

    case "show-message":
      showToast("Esta ação demonstrativa será conectada à API posteriormente.")

      break

    default:
      break
  }
})

app.addEventListener("submit", (event) => {
  const form = event.target.closest("form[data-form]")

  if (!form) return

  event.preventDefault()

  if (form.dataset.form === "teacher-group-create") {
    createTeacherGroup(form)
    return
  }

  if (form.dataset.form === "project-create") {
    submitProjectForm(
      form,
      `/api/teacher/groups/${encodeURIComponent(form.elements.namedItem("groupId").value)}/projects`,
      "POST",
    )
    return
  }

  if (form.dataset.form === "project-update") {
    submitProjectForm(
      form,
      `/api/teacher/projects/${encodeURIComponent(form.dataset.projectId)}`,
      "PUT",
    )
    return
  }

  if (form.dataset.form === "teacher-group-update") {
    updateTeacherGroup(form)
    return
  }

  if (form.dataset.form === "teacher-attendance") {
    recordTeacherAttendance(form)
    return
  }

  if (form.dataset.form === "student-teacher-message") {
    sendTeacherMessage(form)
    return
  }

  if (form.dataset.form === "teacher-message-reply") {
    replyToStudentMessage(form)
    return
  }

  if (form.dataset.form === "material-upload") {
    const groupId = form.elements.namedItem("groupId").value
    uploadFormFile(
      form,
      `/api/teacher/groups/${encodeURIComponent(groupId)}/materials`,
    )
    return
  }

  if (form.dataset.form === "activity-submission") {
    uploadFormFile(
      form,
      `/api/activities/${encodeURIComponent(form.dataset.activityId)}/submission`,
    )
    return
  }

  if (form.dataset.form === "activity-create") {
    createActivity(form)
    return
  }

  if (form.dataset.form === "login") {
    const email = form.elements
      .namedItem("login-email")
      .value.trim()
      .toLowerCase()
    const password = form.elements.namedItem("login-password").value
    const message = form.querySelector("[data-login-message]")
    const submitButton = form.querySelector('button[type="submit"]')

    message.hidden = true
    submitButton.disabled = true

    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
      .then(async (response) => {
        const result = await response.json()

        if (!response.ok) {
          message.textContent =
            result.error || "Não foi possível entrar. Tente novamente."
          message.hidden = false
          return
        }

        if (!profiles[result.user?.profile]) {
          message.textContent = "A API retornou um perfil de usuário inválido."
          message.hidden = false
          return
        }

        state.user = result.user
        state.profile = result.user.profile
        navigate(profiles[result.user.profile].home)
      })
      .catch(() => {
        message.textContent =
          "Não foi possível conectar à API. Verifique se ela está em execução."
        message.hidden = false
      })
      .finally(() => {
        submitButton.disabled = false
      })
  } else if (form.dataset.form === "home-search") {
    state.groupSearch = form.querySelector("#home-search").value
    navigate("group-list")
  } else if (form.dataset.form === "recovery") {
    const submitButton = form.querySelector('button[type="submit"]')
    const message = form.querySelector("[data-recovery-message]")
    submitButton.disabled = true
    message.hidden = true
    fetch("/api/auth/password-recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.elements.namedItem("recovery-email").value,
      }),
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) {
          throw new Error(
            result.error || "Não foi possível solicitar a recuperação.",
          )
        }
        form.innerHTML = `<div class="success-state" role="status"><h2>Solicitação recebida</h2><p>${escapeHtml(result.message)}</p></div>${button("Voltar ao login", "login", "primary")}`
      })
      .catch((error) => {
        message.textContent =
          error.message || "Não foi possível conectar à API."
        message.hidden = false
      })
      .finally(() => {
        if (submitButton.isConnected) submitButton.disabled = false
      })
  } else if (form.dataset.form === "reset-password") {
    const password = form.elements.namedItem("reset-password-value").value
    const confirmation = form.elements.namedItem("reset-password-confirm").value
    const message = form.querySelector("[data-reset-message]")
    const submitButton = form.querySelector('button[type="submit"]')
    if (password !== confirmation) {
      message.textContent = "As senhas não coincidem."
      message.hidden = false
      return
    }
    submitButton.disabled = true
    message.hidden = true
    fetch("/api/auth/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: new URLSearchParams(window.location.search).get("token"),
        password,
      }),
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.error || "Não foi possível redefinir a senha.")
        }
        history.replaceState(
          {},
          "",
          `${window.location.pathname}#reset-password`,
        )
        form.innerHTML = `<div class="success-state" role="status"><h2>Senha redefinida</h2><p>${escapeHtml(result.message)}</p></div>${button("Ir para o login", "login", "primary")}`
      })
      .catch((error) => {
        message.textContent =
          error.message || "Não foi possível conectar à API."
        message.hidden = false
      })
      .finally(() => {
        if (submitButton.isConnected) submitButton.disabled = false
      })
  } else if (form.dataset.form === "register") {
    const password = form.querySelector("#register-password").value

    const confirm = form.querySelector("#register-confirm").value

    if (password !== confirm) {
      form
        .querySelector("#register-confirm")
        .setCustomValidity("As senhas não coincidem.")

      form.reportValidity()

      form.querySelector("#register-confirm").setCustomValidity("")

      return
    }

    const submitButton = form.querySelector('button[type="submit"]')
    const profile = form.querySelector("#register-profile").value
    submitButton.disabled = true

    fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.querySelector("#register-name").value,
        email: form.querySelector("#register-email").value,
        password,
        profile,
      }),
    })
      .then(async (response) => {
        const result = await response.json()

        if (!response.ok) {
          showToast(result.error || "Não foi possível criar a conta.")
          return
        }

        form.innerHTML = `<div class="success-state" role="status"><h2>Solicitação recebida</h2><p data-registration-message></p></div>${button("Voltar ao login", "login", "primary")}`
        form.querySelector("[data-registration-message]").textContent =
          result.message
      })
      .catch(() => {
        showToast(
          "Não foi possível conectar à API. Verifique se ela está em execução.",
        )
      })
      .finally(() => {
        if (submitButton.isConnected) submitButton.disabled = false
      })
  }
})

app.addEventListener("input", (event) => {
  if (event.target.id === "group-search") {
    state.groupSearch = event.target.value
    window.clearTimeout(state.groupSearchTimer)
    state.groupSearchTimer = window.setTimeout(loadExploreGroups, 250)
  }

  if (event.target.id === "material-search") {
    state.materialSearch = event.target.value
    window.clearTimeout(state.materialsSearchTimer)
    state.materialsSearchTimer = window.setTimeout(loadMaterials, 250)
  }
  if (event.target.id === "users-search") {
    state.userSearch = event.target.value
    window.clearTimeout(state.userSearchTimer)
    state.userSearchTimer = window.setTimeout(loadAdminUsers, 250)
  }
  if (event.target.id === "admin-groups-search") {
    state.adminGroupSearch = event.target.value
    window.clearTimeout(state.adminGroupSearchTimer)
    state.adminGroupSearchTimer = window.setTimeout(loadAdminGroups, 250)
  }
})

app.addEventListener("change", (event) => {
  const { id, value } = event.target

  if (id === "color-vision-filter") {
    state.colorVisionFilter = value
    applyAccessibilitySettings()
  }

  if (id === "group-theme") state.theme = value

  if (id === "group-level") state.level = value

  if (id === "group-mode") state.mode = value

  if (id === "group-sort") state.groupSort = value

  if (id === "material-type") state.materialType = value
  if (id === "users-profile") state.userProfile = value
  if (id === "users-status") state.userStatus = value
  if (id === "admin-group-theme") state.adminGroupTheme = value
  if (id === "admin-group-status") state.adminGroupStatus = value
  if (id === "agenda-group") {
    state.agendaGroupId = value
    render()
  }

  if (id === "activity-status") {
    state.activityStatus = value
    render()
  }
  if (id === "activity-group") {
    state.activityGroupId = value
    render()
  }

  if (id === "project-status") {
    state.projectStatus = value
    render()
  }
  if (id === "project-group") {
    state.projectGroupId = value
    render()
  }
  if (["users-profile", "users-status"].includes(id)) {
    loadAdminUsers()
  }
  if (["admin-group-theme", "admin-group-status"].includes(id)) {
    loadAdminGroups()
  }

  if (["group-theme", "group-level", "group-mode", "group-sort"].includes(id)) {
    loadExploreGroups()

    const activeFilters = document.querySelector(
      ".filter-panel .active-filters",
    )

    if (activeFilters) {
      const active = [state.theme, state.level, state.mode].filter(
        (item) => item !== "Todos",
      )

      activeFilters.innerHTML =
        active.map((item) => `<span class="chip">${item}</span>`).join(" ") ||
        "<span class='muted'>Nenhum filtro aplicado</span>"
    }
  }

  if (id === "material-type") {
    state.materialType = value
    loadMaterials()
  }
})

window.addEventListener("popstate", () => {
  const screen = window.location.hash.slice(1)

  if (!Object.hasOwn(screenRenderers, screen)) return

  navigate(screen, false)
})

render()
restoreSession()
