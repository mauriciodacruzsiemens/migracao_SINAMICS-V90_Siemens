
    let appState = {
        mode: null,
        motorV90: null,
        driveV90: null,
        motorS200: null,
        driveS200: null,
        communication: null,
        warnings: [],
        currentStep: 1
    };



    /* função atualizar links*/
    
   function updateS200Products(driveCode, motorCode) {

    const baseURL = "https://sieportal.siemens.com/en-us/products-services/detail/";

    const driveLink = baseURL + driveCode;
    const motorLink = baseURL + motorCode;

    const driveEl = document.getElementById("s200-drive-link");
    const motorEl = document.getElementById("s200-motor-link");

    if (driveEl) driveEl.href = driveLink;
    if (motorEl) motorEl.href = motorLink;
}

    function updateProgress() {
    const totalSteps = 3;
    const progress = (appState.currentStep / totalSteps) * 100;

    document.getElementById('progress-bar').style.width = progress + '%';

    const steps = document.querySelectorAll('.progress-step');

    steps.forEach((step, index) => {
        const stepNumber = index + 1;

        if (stepNumber <= appState.currentStep) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
}

    function showPage(pageId, stepNum = null) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');

        if (stepNum) {
            appState.currentStep = stepNum;
            updateProgress();
        }

        window.scrollTo(0, 0);
    }

    function fillProductPowers(dataObj) {
    document.querySelectorAll(".product-card").forEach(card => {

        const field = card.dataset.powerField;
        const suffix = card.dataset.suffix || "";

        const value = dataObj[field];

        const span = card.querySelector(".auto-power");

        if (span) {
            span.textContent = value ? ` ${value} ${suffix}` : "";
        }
    });
}


    function selectMode(mode) {
    appState.mode = mode;

    const commGroup = document.getElementById('communication-group');
    const commInputs = document.querySelectorAll('input[name="communication"]');

    if (mode === 'motor') {
        document.getElementById('drive-group').style.display = 'none';
        commGroup.style.display = 'block';

        // ATIVA required
        commInputs.forEach(el => el.required = true);

        document.getElementById('input-title').textContent = 'Informar Código do Motor';

    } else {
        document.getElementById('drive-group').style.display = 'block';
        commGroup.style.display = 'none';

        // DESATIVA required
        commInputs.forEach(el => el.required = false);

        document.getElementById('input-title').textContent = 'Informar Motor e Drive';
    }

    document.getElementById('input-form').reset();
    document.getElementById('input-error').classList.remove('show');

    showPage('page-input', 2);
}

    function goBack() {
        appState = {
            mode: null,
            motorV90: null,
            driveV90: null,
            motorS200: null,
            driveS200: null,
            communication: null,
            warnings: [],
            currentStep: 1
        };
        showPage('page-selection', 1);
    }
        
                function validateMotor() {
                const input = document.getElementById('motor-mlfb');
                const value = input.value.trim().toUpperCase();

                if (!value.startsWith("1FL6")) {
                    input.style.borderColor = "red";
                    throw new Error("Motor inválido: deve iniciar com 1FL6");
                }

                input.style.borderColor = "";
                return value;
            }

            function validateDrive() {
                const input = document.getElementById('drive-mlfb');
                const value = input.value.trim().toUpperCase();

                // Só valida se estiver no modo motor+drive
                if (appState.mode === 'motor-drive') {
                    if (!value.startsWith("6SL3210")) {
                        input.style.borderColor = "red";
                        throw new Error("Drive inválido: deve iniciar com 6SL3210");
                    }
                }

    input.style.borderColor = "";
    return value;
}

    function newSearch() {
        goBack();
    }

    async function handleSearch(event) {
        event.preventDefault();

        const errorDiv = document.getElementById('input-error');
        errorDiv.classList.remove('show');

        try {
                const motor = validateMotor();
                const drive = validateDrive();

            let comunicacao = null;

            if (appState.mode === 'motor') {
                const radio = document.querySelector('input[name="communication"]:checked');
                if (!radio) throw new Error("Selecione a comunicação");
                comunicacao = radio.value;
            }

           const response = await fetch("https://migracao-sinamics-v90-siemens.onrender.com/migrar", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    motor: motor,
                    drive: drive || null,
                    comunicacao: comunicacao
                })
            });

            const data = await response.json();

            if (!data || !data.atual || !data.sucessor) {
            showPage('page-error', 3);
            return;
}

            // CORREÇÃO: Usar data.data.melhor_opcao em vez de data.sucessor
            appState.motorV90 = data.atual;
            appState.motorS200 = data.sucessor;
            appState.communication = data.atual.comunicacao;
            appState.warnings = data.desvios || [];

            displayResult();
            showPage('page-result', 3);

        } catch (error) {
            errorDiv.textContent = '❌ ' + error.message;
            errorDiv.classList.add('show');
        }
    }

    function exportToExcel() {
        const { motorV90, motorS200 } = appState;

        const data = [
            {
                "Descrição": "Conjunto SINAMICS V90 + SIMOTICS 1FL6 (Atual)",
                "Article Number Servomotor": formatMLFB(motorV90.motor) || formatMLFB(motorV90.mlfb) || "-",
                "Article Number Servodrive": motorV90.drive || "-",
                "Potência (kW)": motorV90.potencia_kw || motorV90.potencia || "-",
                "Torque (Nm)": motorV90.torque_nm || motorV90.torque || "-",
                "RPM": motorV90.velocidade_rpm || motorV90.velocidade || "-",
                "Tensão": motorV90.tensao || "-",
                "Fases": motorV90.fases || "-",
                "Comunicação": motorV90.comunicacao || "-",
                "Altura de eixo (mm)": motorV90.altura_eixo_mm || "-"
            },
            {
                "Descrição": "Conjunto SINAMICS S200 + SIMOTICS 1FL2 (Sucessor)",
                "Article Number Servomotor": formatMLFB(motorS200.motor) || formatMLFB(motorS200.mlfb) || "-",
                "Article Number Servodrive": formatMLFB(motorS200.drive) || "-",
                "Potência (kW)": motorS200.potencia_kw || motorS200.potencia || "-",
                "Torque (Nm)": motorS200.torque_nm || motorS200.torque || "-",
                "RPM": motorS200.velocidade_rpm || motorS200.velocidade || "-",
                "Tensão": motorS200.tensao || "-",
                "Fases": motorS200.fases || "-",
                "Comunicação": motorS200.comunicacao || "-",
                "Altura de eixo (mm)": motorS200.altura_eixo_mm || "-"
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();


        

        XLSX.utils.book_append_sheet(workbook, worksheet, "Resultado Migração");

        XLSX.writeFile(workbook, "analise_migracao_siemens.xlsx");
    }


    function displayResult() {
    const { motorV90, motorS200, warnings } = appState;

    // =========================
    // V90 (ORIGEM)
    // =========================
    document.getElementById('result-motor-v90').textContent = formatMLFB(motorV90.motor || motorV90.mlfb) || '-';

    if (motorV90.drive) {
        document.getElementById('result-drive-v90-container').style.display = 'block';
        document.getElementById('result-drive-v90').textContent = formatMLFB(motorV90.drive);
    }

    document.getElementById('spec-power-v90').innerHTML =
        `<span class="highlight">${motorV90.potencia_kw || motorV90.potencia || '-'}</span> kW`;


    document.getElementById('spec-drive-power-v90').innerHTML =
        `<span class="highlight">${motorV90.potencia_kw_drive || motorV90.potencia || '-'}</span> kW`;

    document.getElementById('spec-torque-v90').innerHTML =
        `<span class="highlight">${motorV90.torque_nm || motorV90.torque || '-'}</span> Nm`;

    document.getElementById('spec-speed-v90').innerHTML =
        `<span class="highlight">${motorV90.velocidade_rpm || motorV90.velocidade || '-'}</span> rpm`;

    document.getElementById('spec-voltage-v90').innerHTML =
        `<span class="highlight">${motorV90.tensao || '-'} </span> V`;
    document.getElementById('spec-phases-v90').textContent = motorV90.fases || '-';
    document.getElementById('spec-comm-v90').textContent = motorV90.comunicacao || '-';
    document.getElementById('spec-encoder-v90').textContent = motorV90.encoder || '-';
    document.getElementById('spec-shaft-v90').textContent = motorV90.eixo || '-';
    document.getElementById('spec-brake-v90').textContent = motorV90.freio || '-';
    document.getElementById('spec-height-v90').innerHTML =
    `${motorV90.altura_eixo_mm || '-'} mm`;




    // =========================
    // S200 (DESTINO)
    // =========================
    document.getElementById('result-motor-s200').textContent = formatMLFB(motorS200.motor || motorS200.mlfb);

    if (motorS200.drive) {
        document.getElementById('result-drive-s200-container').style.display = 'block';
        document.getElementById('result-drive-s200').textContent = formatMLFB (motorS200.drive);
    }

    document.getElementById('spec-power-s200').innerHTML =
        `<span class="highlight">${motorS200.potencia_kw || motorS200.potencia || '-'}</span> kW`;

    document.getElementById('spec-torque-s200').innerHTML =
        `<span class="highlight">${motorS200.torque_nm || motorS200.torque || '-'}</span> Nm`;

    document.getElementById('spec-speed-s200').innerHTML =
        `<span class="highlight">${motorS200.velocidade_rpm || motorS200.velocidade || '-'}</span> rpm`;

    document.getElementById('spec-voltage-s200').innerHTML =
        `<span class="highlight">${motorS200.tensao || '-'} </span> V`;
    document.getElementById('spec-phases-s200').textContent = motorS200.fases || '-';
    document.getElementById('spec-comm-s200').textContent = motorS200.comunicacao || '-';
    document.getElementById('spec-encoder-s200').textContent = motorS200.encoder || '-';
    document.getElementById('spec-shaft-s200').textContent = motorS200.eixo || '-';
    document.getElementById('spec-brake-s200').textContent = motorS200.freio || '-';
    document.getElementById('spec-height-s200').innerHTML =
    `${motorS200.altura_eixo_mm || '-'} mm`;
    document.getElementById('spec-drive-power-s200').innerHTML =
      ` <span class="highlight"> ${motorS200.potencia_kw_drive || '-'} </span> kW`;
    

    // =========================
    // LINKS S200 (NOVO BLOCO)
    // =========================
    fillProductPowers(motorS200);
    updateS200Products(
        motorS200.drive_code || motorS200.drive,
        motorS200.motor_code || motorS200.motor
    );

    // =========================
    // WARNINGS
    // =========================
    const warningsSection = document.getElementById('warnings-section');
    const warningsList = document.getElementById('warnings-list');

    if (warnings && warnings.length > 0) {
        warningsSection.style.display = 'block';
        warningsList.innerHTML = `
    <ul class="warning-list">
        ${warnings.map(w => `<li>${w}</li>`).join('')}
    </ul>
`;
    } else {
        warningsSection.style.display = 'none';
    }
}

function formatMLFB(value) {
    if (!value) return "-";

    const clean = value.replace(/\s/g, "");

    // caso já venha correto
    if (clean.includes("-")) return clean;

    // padrão Siemens típico: 3 blocos
    return clean.replace(
        /^(.{7})(.{5})(.{4})$/,
        "$1-$2-$3"
    );
}

    function copyToClipboard() {

            const driveS200 = document.getElementById('result-drive-s200')?.textContent || '-';
            const motorS200 = document.getElementById('result-motor-s200')?.textContent || '-';

            const text = 
        `SERVODRIVE S200: ${driveS200}
        SERVOMOTOR 1FL2: ${motorS200}`;

            navigator.clipboard.writeText(text).then(() => {
                const feedback = document.getElementById('copy-feedback');
                feedback.classList.add('show');
                setTimeout(() => feedback.classList.remove('show'), 3000);
            });
    }

    document.addEventListener("DOMContentLoaded", () => {
    appState.currentStep = 1;
    updateProgress();
    });
    
