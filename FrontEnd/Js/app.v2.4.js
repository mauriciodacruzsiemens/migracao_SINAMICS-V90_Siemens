let appState = {
    grauProtecaoSelecionado: "IP65",
    mode: null,
    motorV90: null,
    driveV90: null,
    motorS200: null,
    driveS200: null,
    communication: null,
    warnings: [],
    currentStep: 1,
};
function updateS200Products(e, t) {
    let o = "https://sieportal.siemens.com/en-us/products-services/detail/",
        n = document.getElementById("s200-drive-link"),
        r = document.getElementById("s200-motor-link");
    n && (n.href = o + e), r && (r.href = o + t);
}
function updateProgress() {
    let e = (appState.currentStep / 3) * 100;
    document.getElementById("progress-bar").style.width = e + "%";
    let t = document.querySelectorAll(".progress-step");
    t.forEach((e, t) => {
        t + 1 <= appState.currentStep ? e.classList.add("active") : e.classList.remove("active");
    });
}
function goHome() {
    (appState = {
        mode: null,
        motorV90: null,
        driveV90: null,
        motorS200: null,
        driveS200: null,
        communication: null,
        warnings: [],
        currentStep: 1,
    }),
        showPage("page-selection", 1);
}
function showPage(e, t = null) {
    document.querySelectorAll(".page").forEach((e) => e.classList.remove("active")),
        document.getElementById(e).classList.add("active"),
        t && ((appState.currentStep = t), updateProgress()),
        window.scrollTo(0, 0);
}
function fillProductPowers(e) {
    document.querySelectorAll(".product-card").forEach((t) => {
        let o = t.dataset.powerField,
            n = t.dataset.suffix || "",
            r = e[o],
            l = t.querySelector(".auto-power");
        l && (l.textContent = r ? ` ${r} ${n}` : "");
    });
}
window.addEventListener("load", async () => {
    try {
        await fetch("https://migracao-sinamics-v90-siemens.onrender.com/health");
        console.log("backend aquecido");
    } catch (e) {
        console.log("warmup falhou");
    }
});
function selectMode(e) {
    appState.mode = e;
    let t = document.getElementById("communication-group"),
        o = document.querySelectorAll('input[name="communication"]');
    "motor" === e
        ? ((document.getElementById("drive-group").style.display = "none"),
          (t.style.display = "block"),
          o.forEach((e) => (e.required = !0)),
          (document.getElementById("input-title").textContent = "Informar C\xf3digo do Motor"))
        : ((document.getElementById("drive-group").style.display = "block"),
          (t.style.display = "none"),
          o.forEach((e) => (e.required = !1)),
          (document.getElementById("input-title").textContent = "Informar Motor e Drive")),
        document.getElementById("input-form").reset(),
        document.getElementById("input-error").classList.remove("show");
        let protectionGroup = document.getElementById("protection-group");
            if (protectionGroup) {
                protectionGroup.style.display = "block";
            }
        
        showPage("page-input", 2);
}
function goBack() {
    (appState = {
        mode: null,
        motorV90: null,
        driveV90: null,
        motorS200: null,
        driveS200: null,
        communication: null,
        warnings: [],
        currentStep: 1,
    }),
        showPage("page-selection", 1);
}
function validateMotor() {
    let e = document.getElementById("motor-mlfb"),
        t = e.value.trim().toUpperCase();
    if (!t.startsWith("1FL6")) throw ((e.style.borderColor = "red"), Error("Motor inv\xe1lido: deve iniciar com 1FL6"));
    return (e.style.borderColor = ""), t;
}
function validateDrive() {
    let e = document.getElementById("drive-mlfb"),
        t = e.value.trim().toUpperCase();
    if ("motor-drive" === appState.mode && !t.startsWith("6SL3210"))
        throw ((e.style.borderColor = "red"), Error("Drive inv\xe1lido: deve iniciar com 6SL3210"));
    return (e.style.borderColor = ""), t;
}
function newSearch() {
    goBack();
}
async function handleSearch(e) {
    e.preventDefault();
    const protection = document.querySelector('input[name="protection"]:checked')?.value || "IP65";
    let t = document.getElementById("search-btn"),
        o = t.querySelector(".btn-text"),
        n = t.querySelector(".btn-loading"),
        r = document.getElementById("input-error"),
        l = (e) => {
            (t.disabled = e),
                (o.style.display = e ? "none" : "inline-flex"),
                (n.style.display = e ? "inline-flex" : "none");
        };
    r.classList.remove("show"), l(!0), await new Promise((e) => requestAnimationFrame(() => requestAnimationFrame(e)));
    try {
        let a = validateMotor(),
            i = validateDrive(),
            s = null;
        if ("motor" === appState.mode) {
            let c = document.querySelector('input[name="communication"]:checked');
            if (!c) throw Error("Selecione a comunica\xe7\xe3o");
            s = c.value;
        }
        let d = await fetch("https://migracao-sinamics-v90-siemens.onrender.com/migrar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ motor: a, drive: i || null, comunicacao: s, grau_protecao: protection}),
            }),
            m = await d.json();
        if (!m || !m.atual || !m.sucessor) {
            showPage("page-error", 3);
            return;
        }
        (appState.motorV90 = m.atual),
            (appState.motorS200 = m.sucessor),
            (appState.communication = m.atual.comunicacao),
            (appState.warnings = m.desvios || []),
            displayResult(),
            showPage("page-result", 3);
    } catch (p) {
        (r.textContent = "❌ " + p.message), r.classList.add("show");
    } finally {
        l(!1);
    }
}
async function exportToExcel() {
    await loadXLSX();
    let { motorV90: e, motorS200: t } = appState,
        o = [
            {
                Descrição: "Conjunto SINAMICS V90 + SIMOTICS 1FL6 (Atual)",
                "Article Number Servomotor": formatMLFB(e.motor) || formatMLFB(e.mlfb) || "-",
                "Article Number Servodrive": formatMLFB(e.drive) || "-",
                "Pot\xeancia (kW)": e.potencia_kw || e.potencia || "-",
                "Torque (Nm)": e.torque_nm || e.torque || "-",
                RPM: e.velocidade_rpm || e.velocidade || "-",
                Tensão: e.tensao || "-",
                Fases: e.fases || "-",
                Comunicação: e.comunicacao || "-",
                "Altura de eixo (mm)": e.altura_eixo_mm || "-",
            },
            {
                Descrição: "Conjunto SINAMICS S200 + SIMOTICS 1FL2 (Sucessor)",
                "Article Number Servomotor": formatMLFB(appState.motorS200.motor) || formatMLFB(t.mlfb) || "-",
                "Article Number Servodrive": formatMLFB(t.drive) || "-",
                "Pot\xeancia (kW)": t.potencia_kw || t.potencia || "-",
                "Torque (Nm)": t.torque_nm || t.torque || "-",
                RPM: t.velocidade_rpm || t.velocidade || "-",
                Tensão: t.tensao || "-",
                Fases: t.fases || "-",
                Comunicação: t.comunicacao || "-",
                "Altura de eixo (mm)": t.altura_eixo_mm || "-",
            },
        ],
        n = XLSX.utils.json_to_sheet(o),
        r = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(r, n, "Resultado Migra\xe7\xe3o"), XLSX.writeFile(r, "analise_migracao_siemens.xlsx");
}
function displayResult() {
    let { motorV90: e, motorS200: t, warnings: o } = appState;
    (document.getElementById("result-motor-v90").textContent = formatMLFB(e.motor || e.mlfb) || "-"),
        e.drive &&
            ((document.getElementById("result-drive-v90-container").style.display = "block"),
            (document.getElementById("result-drive-v90").textContent = formatMLFB(e.drive))),
        (document.getElementById("spec-power-v90").innerHTML =
            `<span class="highlight">${e.potencia_kw || e.potencia || "-"}</span> kW`),
        (document.getElementById("spec-drive-power-v90").innerHTML =
            `<span class="highlight">${e.potencia_kw_drive || e.potencia || "-"}</span> kW`),
        (document.getElementById("spec-torque-v90").innerHTML =
            `<span class="highlight">${e.torque_nm || e.torque || "-"}</span> Nm`),
        (document.getElementById("spec-speed-v90").innerHTML =
            `<span class="highlight">${e.velocidade_rpm || e.velocidade || "-"}</span> rpm`),
        (document.getElementById("spec-voltage-v90").innerHTML =
            `<span class="highlight">${e.tensao || "-"} </span> V`),
        (document.getElementById("spec-phases-v90").textContent = e.fases || "-"),
        (document.getElementById("spec-comm-v90").textContent = e.comunicacao || "-"),
        (document.getElementById("spec-encoder-v90").textContent = e.encoder || "-"),
        (document.getElementById("spec-shaft-v90").textContent = e.eixo || "-"),
        (document.getElementById("spec-brake-v90").textContent = e.freio || "-"),
        (document.getElementById("spec-height-v90").innerHTML = `${e.altura_eixo_mm || "-"} mm`);

        let motorBase = t.motor || t.mlfb;

        // aplica IP atual
        let motorAtual = applyProtectionToMLFB(
            motorBase,
            appState.grauProtecaoSelecionado
        );

        document.getElementById("result-motor-s200").textContent = formatMLFB(motorAtual);
        t.drive &&
            ((document.getElementById("result-drive-s200-container").style.display = "block"),
            (document.getElementById("result-drive-s200").textContent = formatMLFB(t.drive))),
        (document.getElementById("spec-power-s200").innerHTML =
            `<span class="highlight">${t.potencia_kw || t.potencia || "-"}</span> kW`),
        (document.getElementById("spec-torque-s200").innerHTML =
            `<span class="highlight">${t.torque_nm || t.torque || "-"}</span> Nm`),
        (document.getElementById("spec-speed-s200").innerHTML =
            `<span class="highlight">${t.velocidade_rpm || t.velocidade || "-"}</span> rpm`),
        (document.getElementById("spec-voltage-s200").innerHTML =
            `<span class="highlight">${t.tensao || "-"} </span> V`),
        (document.getElementById("spec-phases-s200").textContent = t.fases || "-"),
        (document.getElementById("spec-comm-s200").textContent = t.comunicacao || "-"),
        (document.getElementById("spec-encoder-s200").textContent = t.encoder || "-"),
        (document.getElementById("spec-shaft-s200").textContent = t.eixo || "-"),
        (document.getElementById("spec-brake-s200").textContent = t.freio || "-"),
        (document.getElementById("spec-height-s200").innerHTML = `${t.altura_eixo_mm || "-"} mm`),
        (document.getElementById("spec-drive-power-s200").innerHTML =
            ` <span class="highlight"> ${t.potencia_kw_drive || "-"} </span> kW`),
        fillProductPowers(t),
       updateS200Products(
            t.drive,
            appState.motorS200.motor || t.motor
        );
    let n = document.getElementById("warnings-section"),
        r = document.getElementById("warnings-list");
    o && o.length > 0
        ? ((n.style.display = "block"),
          (r.innerHTML = `
    <ul class="warning-list">
        ${o.map((e) => `<li>${e}</li>`).join("")}
    </ul>
`))
        : (n.style.display = "none");

                       let toggleContainer = document.getElementById("ip-toggle-container");

            if (t.permite_ip54) {
                toggleContainer.style.display = "block";

               toggleContainer.innerHTML = `
                    <div class="ip-wrapper">

                        <!-- LINHA 1 -->
                        <div class="ip-label">
                            Grau de proteção do motor

                            ${
                                t.permite_ip54
                                    ? `
                                <div class="info-icon">
                                   <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M11 10h2v7h-2zm0-4h2v2h-2zm1-4C6.48 2 2 6.48 2 12s4.48 10 
                                        10 10 10-4.48 10-10S17.52 2 12 2z"/>
                                    </svg>
                                    <div class="info-tooltip">
                                        Para motores com altura de eixo SH20 (20mm) e SH30 (30mm), 
                                        é possível selecionar grau de proteção IP54 ou IP65, conforme necessidade da aplicação.
                                    </div>
                                </div>
                            `
                                    : ""
                            }
                        </div>

                        <!-- LINHA 2 -->
                        <div class="ip-row">
                            <div class="ip-segmented">
                                <div class="ip-slider" id="ip-slider"></div>
                                <button id="seg-ip65" class="ip-segment active">IP65</button>
                                <button id="seg-ip54" class="ip-segment">IP54</button>
                            </div>

                            <div id="ip-feedback" class="ip-feedback"></div>
                        </div>

                    </div>
                `;

                document.getElementById("seg-ip65").onclick = () => updateIP("IP65", motorBase);
                document.getElementById("seg-ip54").onclick = () => updateIP("IP54", motorBase);

            } else {
                toggleContainer.style.display = "none";
            }

          document.querySelectorAll(".info-icon").forEach(icon => {
    icon.onclick = (e) => {
        e.stopPropagation();

        let tooltip = icon.querySelector(".info-tooltip");

        let isVisible = tooltip.classList.contains("show");

        // fecha todos
        document.querySelectorAll(".info-tooltip").forEach(t => {
            t.classList.remove("show");
        });

        // abre o clicado (se não estava aberto)
        if (!isVisible) {
            tooltip.classList.add("show");
        }
    };
});

// clique fora fecha
document.addEventListener("click", () => {
    document.querySelectorAll(".info-tooltip").forEach(t => {
        t.classList.remove("show");
    });
});

    }

function formatMLFB(e) {
    if (!e) return "-";
    let t = e.replace(/\s/g, "");
    return t.includes("-") ? t : t.replace(/^(.{7})(.{5})(.{4})$/, "$1-$2-$3");
}

function applyProtectionToMLFB(mlfb, ip) {
    if (!mlfb || mlfb.length < 12) return mlfb;

    let code = mlfb.replace(/-/g, "").split("");

    // 12º dígito (index 11)
    code[11] = ip === "IP54" ? "0" : "1";

    return code.join("");
}

function copyToClipboard() {
    let e = document.getElementById("result-drive-s200")?.textContent || "-",
        t = document.getElementById("result-motor-s200")?.textContent || "-",
        o = `SERVODRIVE S200: ${e}
        SERVOMOTOR 1FL2: ${t}`;
    navigator.clipboard.writeText(o).then(() => {
        let e = document.getElementById("copy-feedback");
        e.classList.add("show"), setTimeout(() => e.classList.remove("show"), 3e3);
    });
}
document.addEventListener("DOMContentLoaded", () => {
    (appState.currentStep = 1), updateProgress();
});

function updateIP(ip, motorBase) {
    appState.grauProtecaoSelecionado = ip;

    let motorAtual = applyProtectionToMLFB(motorBase, ip);

    document.getElementById("result-motor-s200").textContent =
        formatMLFB(motorAtual);

    // ELEMENTOS
    const btn65 = document.getElementById("seg-ip65");
    const btn54 = document.getElementById("seg-ip54");
    const slider = document.getElementById("ip-slider");

    // RESET
    btn65.classList.remove("active");
    btn54.classList.remove("active");

    // MOVE SLIDER
    if (ip === "IP65") {
        btn65.classList.add("active");
        slider.style.transform = "translateX(0%)";
    } else {
        btn54.classList.add("active");
        slider.style.transform = "translateX(100%)";
    }

    // FEEDBACK
    const feedback = document.getElementById("ip-feedback");

        feedback.innerHTML = `
            <span class="feedback-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11 10h2v7h-2zm0-4h2v2h-2zm1-4C6.48 2 2 6.48 2 12s4.48 10 
                    10 10 10-4.48 10-10S17.52 2 12 2z"/>
                </svg>
            </span>
            Código ajustado para ${ip}
        `;
        feedback.classList.add("show");

        // opcional: sumir depois de 2s
        setTimeout(() => {
            feedback.classList.remove("show");
        }, 4000);
        }
