"use strict";
let state,
  session,
  page = "office";
let disposeOffice = () => {};
const root = document.getElementById("root");
const dialog = document.getElementById("editor");
const pesos = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    n / 100,
  );
const names = {
  office: "Oficina virtual",
  dashboard: "Visión general",
  crm: "Prospectos y clientes",
  tasks: "Seguimiento",
  quotes: "Cotizaciones",
  orders: "Pedidos y finanzas",
  agents: "Centro de agentes",
  settings: "Configuración",
};
const stages = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  negociacion: "Negociación",
  ganado: "Cliente",
  perdido: "Perdido",
};
const quoteStates = {
  borrador: "Borrador",
  enviada: "Enviada manualmente",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
};
const el = (tag, cls = "", text = "") => {
  const n = document.createElement(tag);
  n.className = cls;
  n.textContent = text;
  return n;
};
const button = (label, action, cls = "button button-muted") => {
  const b = el("button", cls, label);
  b.type = "button";
  b.onclick = () => Promise.resolve(action()).catch((e) => toast(e.message));
  return b;
};
function toast(message) {
  const t = document.getElementById("toast");
  t.textContent = message;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 5000);
}
async function api(path, method = "GET", data) {
  const r = await fetch("/api/" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": session?.csrf || "",
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  const body = await r.json();
  if (!r.ok) {
    if (r.status === 401 && path !== "login") {
      session = null;
      state = null;
      dialog.close();
      NFCOffice.reset();
      login();
    }
    throw Error(body.error || "No se pudo completar");
  }
  return body;
}
async function executeAgent(agent, prospect_id) {
  const owner = session;
  const result = await NFCOffice.execute(agent, prospect_id, () =>
    api("agents/run", "POST", { agent, prospect_id }),
  );
  // Logout/session expiration invalidates pending UI updates; never reopen a previous user's view.
  if (session !== owner) return result;
  try {
    await refresh();
  } catch {
    if (session === owner)
      toast(
        "Resultado recibido. No se pudo actualizar el historial; usa Actualizar.",
      );
  }
  return result;
}
async function refresh() {
  const owner = session;
  const updated = await api("state");
  if (!owner || session !== owner) return;
  state = updated;
  render();
}
const businesses = () => state.prospects.map((p) => [p.id, p.business]);
const users = () => state.users.map((u) => [u.id, u.username]);
const business = (id) =>
  state.prospects.find((p) => p.id === id)?.business ||
  "Registro no disponible";
function form(title, fields, submit) {
  const f = el("form");
  f.append(el("h2", "", title));
  for (const [name, label, type = "text", value = "", options] of fields) {
    const l = el("label", "", label);
    let i;
    if (type === "select") {
      i = el("select", "field");
      for (const [v, t] of options) {
        const o = el("option", "", t);
        o.value = v;
        i.append(o);
      }
      i.value = String(value !== "" ? value : (options[0]?.[0] ?? ""));
    } else {
      i = el(type === "textarea" ? "textarea" : "input", "field");
      if (type !== "textarea") i.type = type;
      i.value = value;
      i.maxLength = type === "textarea" ? 800 : 200;
      if (type === "number") {
        i.min = "0";
        i.max = "100000000";
        i.step = ".01";
      }
    }
    i.name = name;
    i.setAttribute("aria-label", label);
    i.required = !["sector", "contact", "phone", "note"].includes(name);
    l.append(i);
    f.append(l);
  }
  const error = el("p", "form-error");
  error.setAttribute("role", "alert");
  const save = el("button", "button button-primary", "Guardar");
  save.type = "submit";
  f.append(error, save);
  f.onsubmit = async (e) => {
    e.preventDefault();
    save.disabled = true;
    try {
      await submit(Object.fromEntries(new FormData(f)));
    } catch (err) {
      error.textContent = err.message;
    } finally {
      save.disabled = false;
    }
  };
  return f;
}
function edit(title, fields, path, method = "POST", extra = {}) {
  dialog.replaceChildren(button("Cerrar", () => dialog.close(), "close-modal"));
  const requestId = globalThis.crypto.randomUUID();
  dialog.append(
    form(title, fields, async (data) => {
      await api(path, method, { ...data, ...extra, request_id: requestId });
      dialog.close();
      await refresh();
      toast("Guardado");
    }),
  );
  dialog.showModal();
}
function login() {
  disposeOffice();
  root.replaceChildren();
  const card = el("main", "login panel");
  card.append(el("p", "eyebrow", "NFC AI OFFICE · 1.0"));
  const f = form(
    "Acceso de socios",
    [
      ["username", "Usuario"],
      ["password", "Contraseña", "password"],
    ],
    async (data) => {
      session = await api("login", "POST", data);
      page = "office";
      await refresh();
    },
  );
  f.querySelector("[name=username]").autocomplete = "username";
  f.querySelector("[name=password]").autocomplete = "current-password";
  f.querySelector("button").textContent = "Iniciar sesión";
  card.append(
    f,
    el(
      "p",
      "table-hint",
      "Dos socios, un espacio compartido. Solicita tu cuenta a quien administra esta instalación.",
    ),
  );
  root.append(card);
}
function table(headers, rows) {
  const wrap = el("div", "table-wrap"),
    t = el("table"),
    head = el("thead"),
    tr = el("tr");
  headers.forEach((h) => tr.append(el("th", "", h)));
  head.append(tr);
  t.append(head);
  const body = el("tbody");
  for (const cells of rows) {
    const r = el("tr");
    for (const [index, cell] of cells.entries()) {
      const td = el("td");
      td.dataset.label = headers[index];
      if (cell instanceof Node) td.append(cell);
      else td.textContent = cell;
      r.append(td);
    }
    body.append(r);
  }
  t.append(body);
  wrap.append(t);
  if (!rows.length)
    wrap.append(
      el(
        "p",
        "empty-box",
        "Todavía no hay registros. Agrega el primero para comenzar.",
      ),
    );
  return wrap;
}
function stack(...children) {
  const n = el("div", "actions");
  n.append(...children);
  return n;
}
function statusSelect(value, options, path, key) {
  const s = el("select", "field");
  s.setAttribute("aria-label", "Estado");
  Object.entries(options).forEach(([v, t]) => {
    const o = el("option", "", t);
    o.value = v;
    s.append(o);
  });
  s.value = value;
  s.onchange = async () => {
    s.disabled = true;
    try {
      await api(path, "PATCH", { [key]: s.value });
      await refresh();
    } catch (e) {
      s.value = value;
      toast(e.message);
    } finally {
      s.disabled = false;
    }
  };
  return s;
}
function prospectEdit(p) {
  edit(
    p ? "Editar negocio" : "Agregar negocio",
    [
      ["business", "Negocio", "text", p?.business],
      ["sector", "Sector", "text", p?.sector],
      ["contact", "Contacto", "text", p?.contact],
      ["phone", "Teléfono", "tel", p?.phone],
    ],
    p ? "prospects/" + p.id : "prospects",
    p ? "PATCH" : "POST",
  );
}
function render() {
  disposeOffice();
  disposeOffice = () => {};
  root.replaceChildren();
  const shell = el("div", "shell"),
    side = el("aside", "sidebar");
  side.append(
    el("div", "brand", "◈ NFC OFFICE"),
    el("p", "eyebrow", "ESPACIO DE LOS SOCIOS"),
  );
  const nav = el("nav", "navigation");
  for (const [id, label] of Object.entries(names))
    nav.append(
      button(
        label,
        () => {
          page = id;
          render();
        },
        "nav-btn" + (page === id ? " active" : ""),
      ),
    );
  side.append(nav);
  const main = el("main", "main-content"),
    bar = el("header", "topbar");
  bar.append(
    el("strong", "", names[page]),
    stack(
      el("span", "", session.username),
      button("Actualizar", refresh),
      button("Salir", async () => {
        await api("logout", "POST", {});
        session = null;
        state = null;
        NFCOffice.reset();
        login();
      }),
    ),
  );
  const content = el("div", "content");
  if (page === "office") {
    main.append(bar, content);
    shell.append(side, main);
    root.append(shell);
    disposeOffice = NFCOffice.mount(content, {
      state,
      executeAgent,
      navigate: (target) => {
        page = target;
        render();
      },
    });
    return;
  }

  content.append(
    el("p", "eyebrow", "NFC AI OFFICE / 1.0"),
    el("h1", "", names[page]),
    el("p", "subheading", "Información compartida · Acciones bajo tu control"),
  );
  const panel = el("section", "panel workspace-panel");
  content.append(panel);
  main.append(bar, content);
  shell.append(side, main);
  root.append(shell);
  if (page === "dashboard") {
    const m = state.metrics,
      metrics = el("div", "metrics");
    for (const [label, value] of [
      ["Negocios", m.prospects],
      ["Clientes", m.clients],
      ["Cobrado", pesos(m.collected)],
      ["Saldo por cobrar", pesos(m.balance)],
    ]) {
      const c = el("article", "metric");
      c.append(
        el("span", "metric-caption", label),
        el("div", "metric-number", value),
      );
      metrics.append(c);
    }
    panel.append(metrics);
    panel.append(
      el("h2", "", "Resultado por pedidos"),
      el(
        "p",
        "settings-copy",
        `Ventas confirmadas: ${pesos(m.sales)} · Margen estimado: ${pesos(m.profit)}`,
      ),
      el(
        "p",
        "settings-copy",
        `Socio A: ${pesos(m.share_a)} · Socio B: ${pesos(m.share_b)}`,
      ),
      el(
        "p",
        "table-hint",
        "Margen = total de pedidos − costo directo − gastos registrados. Incluye ventas pendientes de cobro. El reparto es una estimación, no un retiro ni utilidad fiscal.",
      ),
    );
    panel.append(
      table(
        ["Etapa", "Negocios"],
        Object.entries(stages).map(([k, v]) => [
          v,
          state.prospects.filter((p) => p.stage === k).length,
        ]),
      ),
      button("Registrar oportunidad", () => prospectEdit()),
    );
  } else if (page === "crm") {
    panel.append(
      button(
        "+ Agregar negocio",
        () => prospectEdit(),
        "button button-primary",
      ),
    );
    const search = el("input", "field");
    search.placeholder = "Buscar negocio, contacto o teléfono";
    search.setAttribute("aria-label", "Buscar");
    const list = el("div");
    const draw = () => {
      const q = search.value.toLocaleLowerCase("es-MX");
      list.replaceChildren(
        table(
          ["Negocio", "Contacto", "Etapa", "Acciones"],
          state.prospects
            .filter((p) =>
              [p.business, p.contact, p.phone]
                .join(" ")
                .toLocaleLowerCase("es-MX")
                .includes(q),
            )
            .map((p) => [
              p.business,
              `${p.contact} · ${p.phone}`,
              statusSelect(p.stage, stages, "prospects/" + p.id, "stage"),
              stack(
                button("Editar", () => prospectEdit(p)),
                button("Historial", () => history(p)),
              ),
            ]),
        ),
      );
    };
    search.oninput = draw;
    panel.append(search, list);
    draw();
  } else if (page === "tasks") {
    panel.append(
      button("+ Nueva tarea", () =>
        edit(
          "Nueva tarea",
          [
            ["prospect_id", "Negocio", "select", "", businesses()],
            ["title", "Tarea"],
            ["due", "Fecha límite", "date"],
            ["assignee", "Responsable", "select", "", users()],
          ],
          "tasks",
        ),
      ),
    );
    panel.append(
      table(
        ["Negocio", "Tarea", "Fecha límite", "Responsable", "Estado"],
        state.tasks.map((t) => [
          business(t.prospect_id),
          t.title,
          t.due,
          state.users.find((u) => u.id === t.assignee)?.username || "",
          button(
            t.done ? "Completada · reabrir" : "Marcar completada",
            async () => {
              await api("tasks/" + t.id, "PATCH", { done: t.done ? 0 : 1 });
              await refresh();
            },
          ),
        ]),
      ),
    );
  } else if (page === "quotes") {
    panel.append(
      button("+ Nueva cotización", () =>
        edit(
          "Cotización (MXN)",
          [
            ["prospect_id", "Negocio", "select", "", businesses()],
            ["quantity", "Cantidad", "number", 1],
            [
              "total",
              "Total acordado (ajusta por cantidad)",
              "number",
              state.settings.price / 100,
            ],
            [
              "unit_cost",
              "Costo por tarjeta",
              "number",
              state.settings.cost / 100,
            ],
          ],
          "quotes",
        ),
      ),
    );
    panel.append(
      table(
        [
          "Folio / negocio",
          "Cantidad",
          "Total",
          "Costo unitario",
          "Estado",
          "Pedido",
        ],
        state.quotes.map((q) => {
          const converted = state.orders.some((o) => o.quote_id === q.id);
          const b = button("Crear pedido", () =>
            edit("Confirmar pedido", [], "orders", "POST", { quote_id: q.id }),
          );
          b.disabled = converted || q.status !== "aceptada";
          return [
            `#${q.id} · ${business(q.prospect_id)}`,
            q.quantity,
            pesos(Math.round(q.total * 100)),
            pesos(Math.round(q.unit_cost * 100)),
            converted
              ? "Aceptada · bloqueada"
              : statusSelect(q.status, quoteStates, "quotes/" + q.id, "status"),
            b,
          ];
        }),
      ),
    );
    panel.append(
      el(
        "p",
        "table-hint",
        "Crear pedido fija el total, costo y porcentaje de reparto actuales. Una cotización aceptada por sí sola no cuenta como venta. No se envían documentos automáticamente.",
      ),
    );
  } else if (page === "orders") {
    panel.append(
      table(
        [
          "Pedido",
          "Operación",
          "Total / cobrado / saldo",
          "Margen / reparto",
          "Registro manual",
        ],
        state.orders.map((o) => [
          o.id,
          statusSelect(
            o.status,
            {
              pendiente: "Pendiente",
              produccion: "En producción",
              entregado: "Entregado",
            },
            "orders/" + o.id,
            "status",
          ),
          `${pesos(o.total)} / ${pesos(o.paid)} / ${pesos(o.balance)} (${o.payment_status})`,
          `${pesos(o.profit)} · A ${o.share}%: ${pesos(o.share_a)} / B: ${pesos(o.share_b)}`,
          stack(
            button("Registrar pago", () =>
              edit(
                "Registrar pago ya recibido (no realiza cobros)",
                [
                  ["amount", "Monto recibido MXN", "number", o.balance / 100],
                  ["reference", "Referencia o comprobante"],
                ],
                "payments",
                "POST",
                { order_id: o.id },
              ),
            ),
            button("Agregar gasto", () =>
              edit(
                "Gasto adicional al costo directo",
                [
                  ["amount", "Monto MXN", "number"],
                  ["description", "Concepto"],
                ],
                "expenses",
                "POST",
                { order_id: o.id },
              ),
            ),
          ),
        ]),
      ),
    );
    panel.append(
      el("h2", "", "Pagos registrados"),
      table(
        ["Pedido", "Importe", "Referencia", "Fecha UTC"],
        state.payments.map((p) => [
          p.order_id,
          pesos(p.amount),
          p.reference,
          p.created_at,
        ]),
      ),
      el("h2", "", "Gastos adicionales"),
      table(
        ["Pedido", "Importe", "Concepto"],
        state.expenses.map((e) => [e.order_id, pesos(e.amount), e.description]),
      ),
    );
  } else if (page === "agents") {
    panel.append(
      el(
        "p",
        "settings-copy",
        "Coordinador y finanzas consultan registros internos. Prospección revisa datos existentes; no investiga en Internet. Ventas usa Ollama si responde; de lo contrario genera una plantilla. Revisa todo resultado antes de utilizarlo.",
      ),
    );
    const f = form(
      "Ejecutar herramienta",
      [
        [
          "agent",
          "Agente",
          "select",
          "coordinador",
          [
            ["coordinador", "Coordinador"],
            ["prospeccion", "Prospección asistida"],
            ["ventas", "Ventas"],
            ["finanzas", "Finanzas"],
          ],
        ],
        [
          "prospect_id",
          "Negocio (ventas y prospección)",
          "select",
          "",
          [[0, "Sin selección"], ...businesses()],
        ],
      ],
      async (data) => {
        await executeAgent(data.agent, data.prospect_id);
      },
    );
    f.querySelector("button").textContent = "Generar análisis o borrador";
    panel.append(f);
    for (const run of state.runs) {
      const card = el("article", "panel");
      card.append(
        el("h3", "", `${run.agent} · ${run.mode} · #${run.id}`),
        el(
          "small",
          "",
          run.created_at +
            " UTC · " +
            (run.prospect_id ? business(run.prospect_id) : "Datos internos"),
        ),
        el("pre", "agent-output", run.result),
        el(
          "p",
          "table-hint",
          "Resultado histórico. Puede quedar desactualizado; no ejecuta acciones externas.",
        ),
      );
      panel.append(card);
    }
  } else if (page === "settings") {
    panel.append(
      form(
        "Precios y reparto para nuevos pedidos",
        [
          [
            "price",
            "Precio sugerido por tarjeta (MXN)",
            "number",
            state.settings.price / 100,
          ],
          [
            "cost",
            "Costo directo por tarjeta (MXN)",
            "number",
            state.settings.cost / 100,
          ],
          [
            "share",
            "Porcentaje socio A (B recibe el resto)",
            "number",
            state.settings.share,
          ],
        ],
        async (data) => {
          await api("settings", "POST", data);
          await refresh();
          toast("Configuración guardada");
        },
      ),
    );
    panel.append(
      el(
        "p",
        "table-hint",
        "A y B son los socios según su acuerdo comercial. Los pedidos existentes conservan su reparto; asignen esos nombres por escrito. No incluye impuestos no registrados ni mueve fondos.",
      ),
      el(
        "p",
        "settings-copy",
        `Modelo opcional: ${state.model}. Las cuentas y contraseñas se administran desde la consola del servidor.`,
      ),
      el("h2", "", "Bitácora reciente"),
      table(
        ["Socio", "Acción", "Fecha UTC"],
        state.audit.map((a) => [
          state.users.find((u) => u.id === a.user_id)?.username || a.user_id,
          a.action,
          a.created_at,
        ]),
      ),
    );
  }
}
function history(p) {
  dialog.replaceChildren(
    button("Cerrar", () => dialog.close(), "close-modal"),
    el("h2", "", p.business),
  );
  if (p.note) dialog.append(el("p", "", p.note));
  for (const n of state.notes.filter((n) => n.prospect_id === p.id))
    dialog.append(
      el(
        "p",
        "",
        `${n.created_at} UTC · ${state.users.find((u) => u.id === n.author)?.username}: ${n.body}`,
      ),
    );
  dialog.append(
    form("Agregar nota", [["body", "Nota", "textarea"]], async (data) => {
      await api("notes", "POST", { ...data, prospect_id: p.id });
      await refresh();
      history(p);
    }),
  );
  if (!dialog.open) dialog.showModal();
}
(async () => {
  try {
    session = await api("session");
    await refresh();
  } catch (e) {
    login();
  }
})();
