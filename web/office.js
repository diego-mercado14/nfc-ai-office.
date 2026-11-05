/* Original pixel artwork and office interaction. No external assets or game engine. */
"use strict";
window.NFCOffice = (() => {
  const agents = [
    {
      id: "coordinador",
      name: "Coordinador",
      role: "El siguiente paso, claro.",
      color: "#a8b8ff",
      shirt: "#737ac7",
      hair: "#483a43",
      skin: "#e9b995",
      x: 2.4,
      y: 2.0,
      tool: "Consultar prioridades",
      description:
        "Revisa las métricas del negocio y las tareas pendientes registradas.",
      page: "tasks",
      link: "Abrir seguimiento",
    },
    {
      id: "prospeccion",
      name: "Prospección",
      role: "Conoce tus oportunidades.",
      color: "#a9d8b4",
      shirt: "#5f9c86",
      hair: "#372d32",
      skin: "#b87959",
      x: 6.5,
      y: 2.0,
      tool: "Analizar prospecto",
      description:
        "Identifica datos faltantes de un negocio registrado. No busca información en Internet.",
      page: "crm",
      link: "Abrir CRM",
    },
    {
      id: "ventas",
      name: "Ventas",
      role: "Una conversación a la vez.",
      color: "#edbe8f",
      shirt: "#ce8b58",
      hair: "#744632",
      skin: "#edbd99",
      x: 2.4,
      y: 5.0,
      tool: "Preparar borrador",
      description:
        "Prepara un texto con Ollama, si responde, o con una plantilla. Siempre requiere tu revisión; nunca lo envía.",
      page: "quotes",
      link: "Abrir cotizaciones",
    },
    {
      id: "finanzas",
      name: "Finanzas",
      role: "Cada número, con respaldo.",
      color: "#9ccedc",
      shirt: "#5798ad",
      hair: "#30383d",
      skin: "#ca926c",
      x: 6.5,
      y: 5.0,
      tool: "Consultar finanzas",
      description:
        "Consulta pedidos, pagos, gastos, saldos y reparto con los registros actuales. No hace cobros ni movimientos de dinero.",
      page: "orders",
      link: "Abrir pedidos y finanzas",
    },
  ];
  const jobs = new Map();
  const selectedProspects = new Map();
  const listeners = new Set();
  let selected = "coordinador",
    epoch = 0;
  const notify = () => listeners.forEach((fn) => fn());
  const current = (id) => jobs.get(id) || { status: "idle" };
  const labels = {
    idle: "Disponible",
    working: "Ejecutando",
    done: "Resultado listo",
    error: "Sin confirmar",
  };
  async function execute(id, pid, request) {
    if (current(id).status === "working")
      throw Error("Este agente ya tiene una solicitud en curso.");
    const generation = epoch;
    jobs.set(id, { status: "working", pid });
    notify();
    try {
      const result = await request();
      if (generation === epoch) {
        jobs.set(id, {
          status: "done",
          pid,
          result,
          completed: performance.now(),
        });
        notify();
      }
      return result;
    } catch (error) {
      if (generation === epoch) {
        jobs.set(id, { status: "error", pid, error: error.message });
        notify();
      }
      throw error;
    }
  }
  function reset() {
    epoch++;
    jobs.clear();
    selectedProspects.clear();
    selected = "coordinador";
    notify();
  }
  const make = (tag, className, text = "") => {
    const n = document.createElement(tag);
    n.className = className;
    n.textContent = text;
    return n;
  };
  const click = (text, fn, className = "office-button") => {
    const b = make("button", className, text);
    b.type = "button";
    b.onclick = fn;
    return b;
  };
  const iso = (x, y, z = 0) => [
    Math.round(218 + (x - y) * 22),
    Math.round(94 + (x + y) * 11 - z),
  ];
  // Integer coordinates are rasterized on a 480 × 340 surface and scaled without smoothing.
  function painter(canvas) {
    const c = canvas.getContext("2d");
    c.imageSmoothingEnabled = false;
    const rect = (x, y, w, h, color) => {
      c.fillStyle = color;
      c.fillRect(Math.round(x), Math.round(y), w, h);
    };
    const poly = (points, color) => {
      c.fillStyle = color;
      c.beginPath();
      points.forEach(([x, y], i) =>
        i
          ? c.lineTo(Math.round(x), Math.round(y))
          : c.moveTo(Math.round(x), Math.round(y)),
      );
      c.closePath();
      c.fill();
    };
    const line = (a, b, color) => {
      c.strokeStyle = color;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(...a);
      c.lineTo(...b);
      c.stroke();
    };
    const box = (u, v, w, h, height, top, left, right, bottom = 0) => {
      const a = iso(u, v, height),
        b = iso(u + w, v, height),
        d = iso(u, v + h, height),
        e = iso(u + w, v + h, height);
      poly([d, e, iso(u + w, v + h, bottom), iso(u, v + h, bottom)], left);
      poly([b, e, iso(u + w, v + h, bottom), iso(u + w, v, bottom)], right);
      poly([a, b, e, d], top);
    };
    const plant = (u, v) => {
      const [x, y] = iso(u, v);
      poly(
        [
          [x - 10, y - 2],
          [x + 1, y - 7],
          [x + 11, y - 2],
          [x, y + 4],
        ],
        "#364b47",
      );
      rect(x - 6, y - 10, 12, 13, "#b77450");
      rect(x - 4, y - 8, 8, 12, "#d09965");
      rect(x - 8, y - 12, 16, 4, "#e2b789");
      rect(x - 1, y - 34, 2, 22, "#426846");
      [
        [-12, -29, 10, 7],
        [-8, -38, 7, 12],
        [2, -35, 9, 8],
        [3, -25, 12, 6],
        [-12, -21, 10, 6],
      ].forEach(([a, b, w, h], i) => {
        rect(x + a, y + b, w, h, i % 2 ? "#789e61" : "#4c7b53");
        rect(x + a + 2, y + b, 3, 3, "#a4b976");
      });
    };
    const desk = (a) => {
      const u = a.x - 0.9,
        v = a.y - 0.25;
      box(u + 0.05, v + 0.05, 0.16, 0.18, 19, "#565650", "#484a46", "#343d3b");
      box(u + 1.8, v + 0.05, 0.16, 0.18, 19, "#565650", "#484a46", "#343d3b");
      box(u + 0.05, v + 0.85, 0.16, 0.18, 19, "#565650", "#484a46", "#343d3b");
      box(u + 1.8, v + 0.85, 0.16, 0.18, 19, "#565650", "#484a46", "#343d3b");
      box(u, v, 2.05, 1.1, 23, "#ddbd8b", "#aa805e", "#9a7354", 20);
      box(u + 1.4, v + 0.1, 0.5, 0.7, 18, "#bc986f", "#ae885e", "#8d6e50");
      const [dx, dy] = iso(u + 1.7, v + 0.8, 12);
      rect(dx - 2, dy, 4, 1, "#4b5150");
      const [x, y] = iso(a.x, a.y, 24);
      rect(x - 3, y - 13, 3, 14, "#434e52");
      rect(x - 7, y - 3, 13, 3, "#64716e");
      rect(x - 13, y - 25, 25, 18, "#2c3943");
      rect(x - 11, y - 23, 21, 13, "#547580");
      rect(x - 10, y - 23, 19, 1, "#9bbabd");
      rect(x - 9, y - 21, 7, 2, a.color);
      rect(x - 9, y - 17, 15, 1, "#a6c7bd");
      rect(x - 9, y - 14, 10, 1, "#9ab8b6");
      poly(
        [
          [x - 7, y + 3],
          [x + 6, y + 7],
          [x + 15, y + 3],
          [x + 2, y - 1],
        ],
        "#535c5a",
      );
      rect(x + 20, y, 4, 5, "#eae1bf");
      rect(x + 24, y + 1, 2, 3, "#a97d55");
      rect(x - 25, y - 4, 7, 5, "#ece1be");
      rect(x - 24, y - 3, 4, 1, a.shirt);
      // Chair behind the character.
      const [cx, cy] = iso(a.x + 0.25, a.y + 1.05);
      rect(cx - 9, cy - 15, 17, 17, "#3a4e57");
      rect(cx - 7, cy - 13, 13, 12, a.shirt);
      rect(cx - 3, cy, 5, 8, "#414b4a");
      rect(cx - 9, cy + 7, 18, 2, "#384445");
    };
    function room() {
      c.clearRect(0, 0, 480, 340);
      // Floor foundation, then warm alternating parquet with original grain marks.
      poly(
        [iso(0, 8), iso(10, 8), iso(10, 0), [438, 216], [262, 304], [42, 194]],
        "#152b32",
      );
      for (let v = 0; v < 8; v++)
        for (let u = 0; u < 10; u++) {
          poly(
            [iso(u, v), iso(u + 1, v), iso(u + 1, v + 1), iso(u, v + 1)],
            (u + v) % 2 ? "#bea47c" : "#c8ae86",
          );
          line(iso(u, v), iso(u + 1, v), "#af956f");
          line(iso(u, v), iso(u, v + 1), "#b09974");
          line(iso(u + 0.2, v + 0.25), iso(u + 0.6, v + 0.25), "#b29a75");
          line(iso(u + 0.55, v + 0.7), iso(u + 0.85, v + 0.7), "#d0b68e");
        }
      // Two isometric walls; baseboards and top caps.
      poly([iso(0, 0, 72), iso(0, 8, 72), iso(0, 8), iso(0, 0)], "#87a6a3");
      poly([iso(0, 0, 72), iso(10, 0, 72), iso(10, 0), iso(0, 0)], "#a7b9ad");
      poly([iso(0, 0, 4), iso(0, 8, 4), iso(0, 8), iso(0, 0)], "#4a696c");
      poly([iso(0, 0, 4), iso(10, 0, 4), iso(10, 0), iso(0, 0)], "#738b7f");
      line(iso(0, 8, 72), iso(0, 0, 72), "#d5debc");
      line(iso(0, 0, 72), iso(10, 0, 72), "#e0dfbd");
      for (let v = 1; v < 8; v++) line(iso(0, v, 68), iso(0, v, 8), "#7c9997");
      // Left window with night-blue panes, city blocks and a wooden sill.
      poly(
        [iso(0, 2, 58), iso(0, 5.9, 58), iso(0, 5.9, 25), iso(0, 2, 25)],
        "#48626e",
      );
      poly(
        [
          iso(0, 2.15, 55),
          iso(0, 5.75, 55),
          iso(0, 5.75, 28),
          iso(0, 2.15, 28),
        ],
        "#c1d9cf",
      );
      for (let j = 0; j < 3; j++) {
        let v = 2.3 + j * 1.1;
        poly(
          [
            iso(0, v, 53),
            iso(0, v + 0.9, 53),
            iso(0, v + 0.9, 30),
            iso(0, v, 30),
          ],
          "#638994",
        );
        poly(
          [
            iso(0, v, 36),
            iso(0, v + 0.9, 41),
            iso(0, v + 0.9, 30),
            iso(0, v, 30),
          ],
          "#8aabb1",
        );
      }
      box(0, 1.95, 0.18, 4.1, 24, "#d6bc8c", "#8d795d", "#baa176");
      // Right wall pinboard, pinned sheets and NFC print.
      poly(
        [iso(2, 0, 57), iso(5.1, 0, 57), iso(5.1, 0, 28), iso(2, 0, 28)],
        "#7c6251",
      );
      poly(
        [
          iso(2.12, 0, 54),
          iso(4.98, 0, 54),
          iso(4.98, 0, 31),
          iso(2.12, 0, 31),
        ],
        "#c6a179",
      );
      for (let i = 0; i < 3; i++) {
        const [x, y] = iso(2.4 + i * 0.8, 0, 49);
        rect(x, y, 10, 12, i === 1 ? "#e8cf9b" : "#e8e2c7");
        rect(x + 4, y, 2, 2, "#bd7353");
        rect(x + 2, y + 5, 6, 1, "#a99f86");
      }
      const [sx, sy] = iso(7.3, 0, 52);
      rect(sx - 13, sy - 6, 35, 22, "#304c51");
      rect(sx - 11, sy - 4, 31, 18, "#d0c9a6");
      c.fillStyle = "#3c6362";
      c.font = "bold 9px monospace";
      c.fillText("NFC", sx - 6, sy + 8);
      // Sideboard and original books.
      box(0.45, 6.65, 0.65, 1.05, 28, "#a1815f", "#785f4e", "#8f7157");
      const [bx, by] = iso(0.65, 6.9, 29);
      for (let i = 0; i < 5; i++)
        rect(
          bx - 6 + i * 4,
          by - 8 + i,
          3,
          9,
          ["#547c80", "#c88866", "#ded4a4", "#829b64", "#8996b3"][i],
        );
      // Lounge sofa on the right, cushions and coffee table.
      box(8.55, 1.25, 1.0, 2.2, 13, "#61868a", "#3c616a", "#426970");
      box(9.3, 1.25, 0.25, 2.2, 30, "#749b98", "#50777a", "#426970");
      box(8.55, 1.2, 1, 0.25, 23, "#7b9b94", "#53787a", "#426970");
      box(8.55, 3.3, 1, 0.25, 23, "#7b9b94", "#53787a", "#426970");
      box(8.5, 2.2, 0.6, 0.65, 16, "#8ca89a", "#658587", "#5b7e7b");
      box(8.35, 5.2, 0.9, 1.3, 12, "#e1c395", "#a2805e", "#987657");
      const [tx, ty] = iso(8.6, 5.5, 13);
      rect(tx - 2, ty - 2, 9, 5, "#dfdec7");
      rect(tx, ty - 1, 5, 1, "#769491");
      plant(0.65, 0.75);
      plant(8.9, 0.65);
      plant(0.6, 7.45);
      plant(9, 7.1);
      // Entrance mat and engraved floor accent.
      poly([iso(4.1, 7), iso(6.8, 7), iso(6.8, 7.8), iso(4.1, 7.8)], "#637b78");
      line(iso(4.4, 7.2), iso(6.4, 7.2), "#a5b0a0");
      line(iso(4.4, 7.55), iso(6.4, 7.55), "#a5b0a0");
      [...agents].sort((a, b) => a.x + a.y - b.x - b.y).forEach(desk);
    }
    // Hand-authored 14×23 sprite map, shared silhouette and distinct palettes.
    const pixels = [
      "....HHHHHH....",
      "...HHHHHHHH...",
      "...HHHHHHHH...",
      "...HSSSSSSH...",
      "...HSESS ESH...".replaceAll(" ", ""),
      "....SSSSSS....",
      ".....SSSS.....",
      "....CCCCCC....",
      "...CCCCCCCC...",
      "..SCCCCCCCCS..",
      "..SCCCCCCCCS..",
      "...CCCCCCCC...",
      "....CCCCCC....",
      "....PPPPPP....",
      "....PP.PPP....",
      "....PP.PPP....",
      "....BB.BBB....",
    ];
    function person(a, x, y, frame, status, scale = 1) {
      const palette = {
        H: a.hair,
        S: a.skin,
        E: "#27383e",
        C: a.shirt,
        P: "#354451",
        B: "#26333b",
      };
      const bob =
        status === "working"
          ? frame % 2
          : status === "done"
            ? [0, 2, 3, 2, 0, 0][frame % 6]
            : frame % 12 === 0
              ? 1
              : 0;
      if (status === "idle" && frame % 32 === 0) palette.E = a.skin;
      pixels.forEach((row, ry) =>
        [...row].forEach((p, rx) => {
          if (palette[p])
            rect(
              x + (rx - 7) * scale,
              y + (ry - 17) * scale - bob,
              scale,
              scale,
              palette[p],
            );
        }),
      );
      if (a.id === "finanzas") {
        rect(
          x - 4 * scale,
          y - 13 * scale - bob,
          3 * scale,
          2 * scale,
          "#98c3cc",
        );
        rect(x + scale, y - 13 * scale - bob, 3 * scale, 2 * scale, "#98c3cc");
      }
      if (a.id === "prospeccion")
        rect(x + 4 * scale, y - 16 * scale - bob, 3 * scale, 5 * scale, a.hair);
      if (status === "working") {
        rect(
          x - 8 * scale,
          y - 8 * scale + (frame % 2) * 2,
          3 * scale,
          2 * scale,
          a.skin,
        );
        rect(
          x + 6 * scale,
          y - 8 * scale + ((frame + 1) % 2) * 2,
          3 * scale,
          2 * scale,
          a.skin,
        );
      }
      if (status === "done") {
        rect(x + 7 * scale, y - 15 * scale, 5 * scale, 5 * scale, "#b2d6ad");
        rect(x + 8 * scale, y - 13 * scale, scale, scale, "#33574d");
        rect(x + 9 * scale, y - 12 * scale, scale, scale, "#33574d");
        rect(x + 10 * scale, y - 14 * scale, scale, 2 * scale, "#33574d");
      }
    }
    return { room, person, rect, poly, context: c };
  }
  function portrait(a) {
    const canvas = make("canvas", "agent-portrait");
    canvas.width = 48;
    canvas.height = 48;
    canvas.setAttribute("aria-hidden", "true");
    painter(canvas).person(a, 24, 42, 1, "idle", 2);
    return canvas;
  }
  function mount(host, { state, executeAgent, navigate }) {
    if (!document.createElement("canvas").getContext("2d")) {
      host.append(
        make("p", "office-subtitle", "Este navegador no puede dibujar la oficina. Todas tus herramientas siguen disponibles en la vista administrativa."),
        click("Abrir vista administrativa", () => navigate("dashboard")),
      );
      return () => {};
    }
    let disposed = false,
      frame = 0,
      raf = 0,
      previous = 0,
      paused = false,
      contextKey = "";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stage = make("section", "office-view");
    const heading = make("div", "office-heading");
    const titles = make("div", "");
    titles.append(
      make("p", "eyebrow", "TU ESPACIO DE TRABAJO"),
      make("h1", "", "Un pequeño lugar.\nGrandes ideas."),
      make(
        "p",
        "office-subtitle",
        "Tu negocio y tus agentes, en la misma oficina.",
      ),
    );
    const badge = make("span", "office-version", "◈  NFC OFFICE / ESTUDIO 01");
    heading.append(titles, badge);
    stage.append(heading);
    const layout = make("div", "office-layout"),
      world = make("section", "office-world");
    const toolbar = make("div", "world-toolbar");
    toolbar.append(make("span", "world-title", "PLANTA 01 · OPERACIONES"));
    const pause = click(
      "Pausar animación",
      () => {
        paused = !paused;
        syncAnimation();
        pause.textContent = paused ? "Reanudar animación" : "Pausar animación";
        pause.setAttribute("aria-pressed", String(paused));
      },
      "world-control",
    );
    pause.setAttribute("aria-pressed", "false");
    toolbar.append(pause);
    world.append(toolbar);
    const scene = make("div", "office-scene");
    const canvas = make("canvas", "office-canvas");
    canvas.width = 480;
    canvas.height = 340;
    canvas.setAttribute(
      "aria-label",
      "Oficina isométrica con cuatro escritorios, plantas y sala de descanso. Selecciona un agente con los botones de la escena o la lista inferior.",
    );
    canvas.setAttribute("role", "img");
    scene.append(canvas);
    const base = document.createElement("canvas");
    base.width = 480;
    base.height = 340;
    painter(base).room();
    const art = painter(canvas);
    const hotspots = [];
    function choose(id, focus = false) {
      selected = id;
      contextKey = "";
      update();
      if (focus) {
        context.focus({ preventScroll: true });
        if (innerWidth < 1100)
          context.scrollIntoView({
            behavior: reduced.matches ? "instant" : "smooth",
            block: "start",
          });
      }
    }
    for (const a of agents) {
      const [x, y] = iso(a.x + 0.25, a.y + 1.05);
      const b = click("", () => choose(a.id, true), "agent-hotspot");
      b.dataset.agent = a.id;
      b.style.left = `${(x / 480) * 100}%`;
      b.style.top = `${((y - 5) / 340) * 100}%`;
      b.style.setProperty("--agent-color", a.color);
      b.append(
        make("span", "agent-tag-name", a.name),
        make("span", "agent-tag-state", "Disponible"),
      );
      scene.append(b);
      hotspots.push(b);
    }
    // Furnishing hotspots are keyboard-accessible shortcuts to existing business tools.
    const objects = [
      {
        name: "Abrir tareas en el tablero",
        x: 295,
        y: 99,
        page: "tasks",
        mark: "▤",
      },
      {
        name: "Abrir CRM en el librero",
        x: 80,
        y: 153,
        page: "crm",
        mark: "▥",
      },
    ];
    for (const o of objects) {
      const b = click(o.mark, () => navigate(o.page), "object-hotspot");
      b.style.left = `${(o.x / 480) * 100}%`;
      b.style.top = `${(o.y / 340) * 100}%`;
      b.setAttribute("aria-label", o.name);
      b.title = o.name;
      scene.append(b);
    }
    world.append(scene);
    const worldFoot = make("div", "world-footer");
    const active = make("span", "", "");
    active.setAttribute("aria-live", "polite");
    worldFoot.append(
      make("span", "", "Selecciona un personaje para comenzar"),
      active,
    );
    world.append(worldFoot);
    const roster = make("div", "office-roster");
    roster.setAttribute("aria-label", "Equipo de agentes");
    const rosterButtons = [];
    for (const a of agents) {
      const b = click("", () => choose(a.id, true), "roster-agent");
      const text = make("span", "");
      text.append(make("strong", "", a.name), make("small", "", a.role));
      b.append(portrait(a), text);
      roster.append(b);
      rosterButtons.push(b);
    }
    const workspace = make("div", "office-workspace");
    workspace.append(world, roster);
    const stats = make("div", "office-stats");
    const money = (n) =>
      new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        maximumFractionDigits: 2,
      }).format(n / 100);
    for (const [label, value, target] of [
      ["Negocios registrados", state.metrics.prospects, "crm"],
      ["Tareas pendientes", state.tasks.filter((t) => !t.done).length, "tasks"],
      ["Cobrado · MXN", money(state.metrics.collected), "orders"],
    ]) {
      const b = click("", () => navigate(target), "office-stat");
      b.append(
        make("span", "", label),
        make("strong", "", String(value)),
        make("span", "stat-arrow", "→"),
      );
      stats.append(b);
    }
    workspace.append(stats);
    const context = make("aside", "office-context");
    context.tabIndex = -1;
    context.setAttribute("aria-label", "Herramientas del agente");
    layout.append(workspace, context);
    stage.append(layout);
    host.append(stage);
    function update() {
      if (disposed) return;
      const running = agents.filter(
        (a) => current(a.id).status === "working",
      ).length;
      active.textContent = running
        ? `${running} solicitud${running > 1 ? "es" : ""} en curso`
        : "Sin solicitudes en curso";
      agents.forEach((a, i) => {
        const job = current(a.id),
          b = hotspots[i];
        b.dataset.status = job.status;
        b.classList.toggle("selected", a.id === selected);
        b.setAttribute("aria-pressed", String(a.id === selected));
        b.setAttribute("aria-label", `${a.name}: ${labels[job.status]}`);
        b.querySelector(".agent-tag-state").textContent = labels[job.status];
        rosterButtons[i].classList.toggle("selected", a.id === selected);
        rosterButtons[i].setAttribute(
          "aria-pressed",
          String(a.id === selected),
        );
      });
      const a = agents.find((a) => a.id === selected),
        job = current(a.id);
      const key = `${selected}:${job.status}:${job.result?.id || ""}`;
      if (key === contextKey) return;
      contextKey = key;
      context.replaceChildren();
      context.style.setProperty("--agent-color", a.color);
      const top = make("div", "context-profile");
      top.append(portrait(a));
      const identity = make("div", "");
      identity.append(
        make("p", "eyebrow", "TU EQUIPO / AGENTE"),
        make("h2", "", a.name),
      );
      top.append(identity);
      context.append(top);
      const status = make("p", "context-status", labels[job.status]);
      status.dataset.status = job.status;
      status.setAttribute("role", "status");
      context.append(status, make("p", "context-description", a.description));
      const f = make("form", "office-agent-form");
      if (a.id === "ventas" || a.id === "prospeccion") {
        const label = make("label", "", "Negocio a trabajar");
        const select = make("select", "field");
        select.name = "prospect_id";
        select.required = true;
        select.setAttribute("aria-label", "Negocio a trabajar");
        const placeholder = make(
          "option",
          "",
          state.prospects.length
            ? "Selecciona un negocio"
            : "Primero registra un negocio",
        );
        placeholder.value = "";
        select.append(placeholder);
        for (const p of state.prospects) {
          const opt = make("option", "", p.business);
          opt.value = p.id;
          select.append(opt);
        }
        select.value = selectedProspects.get(a.id) || "";
        select.onchange = () => {
          selectedProspects.set(a.id, select.value);
        };
        select.disabled = job.status === "working";
        label.append(select);
        f.append(label);
      }
      const submit = make(
        "button",
        "office-button primary",
        job.status === "working" ? "Ejecutando solicitud…" : a.tool + " →",
      );
      submit.type = "submit";
      submit.disabled =
        job.status === "working" ||
        (["ventas", "prospeccion"].includes(a.id) && !state.prospects.length);
      f.append(submit);
      f.onsubmit = async (e) => {
        e.preventDefault();
        const pid = new FormData(f).get("prospect_id") || null;
        try {
          await executeAgent(a.id, pid);
        } catch {
          /* State and server error are rendered by execute(). */
        }
      };
      context.append(
        f,
        click(a.link + " →", () => navigate(a.page), "context-link"),
      );
      if (job.status === "error") {
        const error = make(
          "p",
          "office-error",
          "No se pudo confirmar la ejecución. " +
            job.error +
            " Consulta el historial antes de volver a intentarlo.",
        );
        error.setAttribute("role", "alert");
        context.append(error);
      }
      const saved = state.runs.find((r) => r.agent === a.id);
      const latest = job.result && (!saved || job.result.id >= saved.id) ? job.result : saved;
      const output = make("section", "office-result");
      output.append(
        make(
          "p",
          "eyebrow",
          latest ? "ÚLTIMO RESULTADO GUARDADO" : "LISTO CUANDO TÚ LO ESTÉS",
        ),
      );
      if (latest) {
        output.append(
          make(
            "span",
            "result-meta",
            `#${latest.id} · ${latest.mode === "plantilla" ? "Plantilla · sin modelo" : latest.mode === "reglas" ? "Reglas · datos internos" : "Ollama · revisar contenido"}`,
          ),
          make("pre", "office-output", latest.result),
        );
        const copy = click(
          "Copiar para revisar",
          async () => {
            try {
              await navigator.clipboard.writeText(latest.result);
              copy.textContent = "Copiado";
            } catch {
              copy.textContent = "Selecciona el texto para copiar";
            }
          },
          "context-link",
        );
        output.append(copy);
      } else {
        output.append(
          make("div", "empty-result-icon", "◇"),
          make("p", "", "Aún no hay resultados de este agente."),
          make(
            "small",
            "",
            "Tú decides cuándo empezar. Aquí aparecerá el resultado de la herramienta.",
          ),
        );
      }
      context.append(
        output,
        make(
          "p",
          "office-trust",
          "Estado de solicitudes de esta pestaña. Los informes guardados pueden estar desactualizados. Ningún agente actúa por su cuenta.",
        ),
      );
      draw(performance.now());
    }
    function draw(time) {
      if (disposed) return;
      art.context.clearRect(0, 0, 480, 340);
      art.context.drawImage(base, 0, 0);
      for (const a of [...agents].sort((a, b) => a.x + a.y - b.x - b.y)) {
        const [x, y] = iso(a.x + 0.25, a.y + 1.05);
        const job = current(a.id);
        if (a.id === selected) {
          art.poly(
            [
              [x - 17, y + 1],
              [x, y - 7],
              [x + 17, y + 1],
              [x, y + 9],
            ],
            "#d4cca1",
          );
          art.poly(
            [
              [x - 13, y + 1],
              [x, y - 5],
              [x + 13, y + 1],
              [x, y + 7],
            ],
            "#97aaa0",
          );
        }
        let status =
          job.status === "done" && time - job.completed > 2400
            ? "idle"
            : job.status;
        art.person(a, x, y, paused || reduced.matches ? 1 : frame, status, 2);
      }
    }
    function tick(time) {
      raf = 0;
      if (disposed || paused || reduced.matches || document.hidden) return;
      if (time - previous >= 125) {
        previous = time;
        frame++;
        draw(time);
      }
      raf = requestAnimationFrame(tick);
    }
    function syncAnimation() {
      cancelAnimationFrame(raf);
      raf = 0;
      if (!disposed && !paused && !reduced.matches && !document.hidden)
        raf = requestAnimationFrame(tick);
    }
    const onMotion = () => {
      draw(performance.now());
      syncAnimation();
    };
    reduced.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", syncAnimation);
    listeners.add(update);
    update();
    syncAnimation();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      listeners.delete(update);
      reduced.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", syncAnimation);
    };
  }
  return { mount, execute, reset };
})();
