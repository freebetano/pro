// ==========================================
// NÚCLEO DA APLICAÇÃO (SCRIPT.JS ORIGINAL + LIMPEZA DE PARÊNTESES)
// ==========================================
let saldo = 10000.00;
let selecoesApostas = []; 
let historicoApostas = [];
let cacheJogosAtuais = [];
let esporteAtualSelecionado = null;
let modoExibicaoAtual = 'live'; 
let boletimMinimizado = false; 

let esportesLista = [];
let opcoesMapa = {};
let ordenacaoAlfabetica = false; 

const esportesFallback = [
    { "id": "1.1,2.1,10.1", "nome": "⚽ Futebol" },
    { "id": "1.3,2.3,10.2", "nome": "🏀 Basquete" },
    { "id": "1.4,2.4,10.3", "nome": "🎾 Tênis" },
    { "id": "1.6,2.6,10.4", "nome": "🏐 Vôlei" },
    { "id": "1.5,2.5,10.5", "nome": "⚾ Beisebol" },
    { "id": "1.2,2.2,10.6", "nome": "🏒 Hóquei no Gelo" },
    { "id": "1.13,2.13,10.7", "nome": "🏈 Futebol Americano" }
];

const opcoesFallback = {
    "grupos": {
        "1": "Resultado Final",
        "7": "Vencedor do Jogo",
        "101": "Moneyline",
        "8": "Dupla Hipótese",
        "17": "Total de Gols/Pontos",
        "19": "Ambas as Equipes Marcam"
    },
    "tipos": {
        "1": "Casa", "2": "Empate", "3": "Fora", "7": "Competidor 1", "8": "Competidor 2", "9": "Mais", "10": "Menos", "180": "Sim", "181": "Não"
    }
};

// ==========================================
// CONTROLE DE MENU DO PERFIL (HEADER)
// ==========================================
function toggleMenuPerfil(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('profileDropdown');
    dropdown.classList.toggle('show');
}

window.onclick = function(event) {
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown && dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
    }
};

// ==========================================
// CARREGAMENTO DE DADOS EXTERNOS (JSON)
// ==========================================
async function carregarDadosExternos() {
    try {
        const resEsp = await fetch('esportes.json');
        esportesLista = resEsp.ok ? await resEsp.json() : esportesFallback;
    } catch (e) {
        esportesLista = esportesFallback;
    }

    try {
        const resOp = await fetch('opcoes.json');
        opcoesMapa = resOp.ok ? await resOp.json() : opcoesFallback;
    } catch (e) {
        opcoesMapa = opcoesFallback;
    }

    inicializarMenuEsportes();
}

// ==========================================
// RENDERIZAÇÃO E ORDENAÇÃO DE ESPORTES
// ==========================================
function alternarOrdenacao() {
    ordenacaoAlfabetica = !ordenacaoAlfabetica;
    const btnSort = document.getElementById('btnSort');
    btnSort.innerText = ordenacaoAlfabetica ? "⭐ Popular" : "🔤 A-Z";
    btnSort.style.color = ordenacaoAlfabetica ? "var(--accent-color)" : "var(--text-muted)";
    btnSort.style.borderColor = ordenacaoAlfabetica ? "var(--accent-color)" : "var(--border-color)";
    
    renderizarMenuEsportes();
}

function renderizarMenuEsportes() {
    const container = document.getElementById('sportListContainer');
    container.innerHTML = '';

    let listaExibicao = [...esportesLista];

    if (ordenacaoAlfabetica) {
        listaExibicao.sort((a, b) => {
            const nomeA = a.nome.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim().toLowerCase();
            const nomeB = b.nome.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim().toLowerCase();
            return nomeA.localeCompare(nomeB);
        });
    }

    listaExibicao.forEach((esp) => {
        const btn = document.createElement('button');
        const isActive = esporteAtualSelecionado && esporteAtualSelecionado.id === esp.id ? 'active' : '';
        btn.className = `sport-btn ${isActive}`;
        
        let nomeFormatado = esp.nome.trim();
        const temEmojiOuSimbolo = /^[^a-zA-ZÀ-ÿ0-9]/.test(nomeFormatado);
        if (!temEmojiOuSimbolo) {
            nomeFormatado = `📌 ${nomeFormatado}`;
        }

        btn.innerHTML = `<span>${nomeFormatado}</span>`;
        btn.onclick = () => {
            document.querySelectorAll('.sport-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            esporteAtualSelecionado = esp;
            modoExibicaoAtual = 'live';
            
            if (typeof carregarJogosAoVivo === 'function') {
                carregarJogosAoVivo(esp.id, esp.nome);
            }
            fecharMenuMobile();
        };

        container.appendChild(btn);
    });
}

function inicializarMenuEsportes() {
    renderizarMenuEsportes();
    if (esportesLista.length > 0) {
        esporteAtualSelecionado = esportesLista[0];
        modoExibicaoAtual = 'live';
        
        setTimeout(() => {
            if (typeof carregarJogosAoVivo === 'function') {
                carregarJogosAoVivo(esportesLista[0].id, esportesLista[0].nome);
            }
        }, 50);
    }
}

// ==========================================
// PONTE INTELIGENTE DE ABAS (LIVE vs LINE)
// ==========================================
function trocarAbaEsporte(tipo) {
    if (!esporteAtualSelecionado) return;
    modoExibicaoAtual = tipo;

    if (tipo === 'live') {
        if (typeof carregarJogosAoVivo === 'function') {
            carregarJogosAoVivo(esporteAtualSelecionado.id, esporteAtualSelecionado.nome);
        }
    } else {
        if (typeof carregarJogosPorEsporte === 'function') {
            carregarJogosPorEsporte(esporteAtualSelecionado.id, esporteAtualSelecionado.nome, 'line');
        }
    }
}

function voltarParaLista() {
    if (esporteAtualSelecionado) {
        if (modoExibicaoAtual === 'live' && typeof carregarJogosAoVivo === 'function') {
            carregarJogosAoVivo(esporteAtualSelecionado.id, esporteAtualSelecionado.nome);
        } else if (typeof carregarJogosPorEsporte === 'function') {
            carregarJogosPorEsporte(esporteAtualSelecionado.id, esporteAtualSelecionado.nome, 'line');
        }
    }
}

// ==========================================
// CONTROLE DO MENU MOBILE E PESQUISA
// ==========================================
function toggleMenuMobile() {
    const sidebar = document.querySelector('.sidebar-left');
    if (sidebar) sidebar.classList.toggle('mobile-drawer-open');
}

function fecharMenuMobile() {
    const sidebar = document.querySelector('.sidebar-left');
    if (sidebar) sidebar.classList.remove('mobile-drawer-open');
}

function toggleSearchMobile(btn) {
    const container = btn.closest('.search-container');
    const titleText = container.parentElement.querySelector('.sport-title-text');
    const input = container.querySelector('.match-search-input');
    
    container.classList.add('expanded');
    if (titleText) titleText.style.display = 'none';
    input.focus();
}

function fecharSearchMobile(btn) {
    const container = btn.closest('.search-container');
    const titleText = container.parentElement.querySelector('.sport-title-text');
    const input = container.querySelector('.match-search-input');
    
    container.classList.remove('expanded');
    if (titleText) titleText.style.display = 'block';
    input.value = '';
    filtrarJogosNaTela();
}

function filtrarJogosNaTela() {
    const input = document.getElementById('searchInput');
    if (!input) return;
    const termo = input.value.toLowerCase().trim();
    const cards = document.querySelectorAll('.match-row-card');

    cards.forEach(card => {
        const dadosBusca = card.getAttribute('data-search') || '';
        if (dadosBusca.includes(termo)) {
            card.style.display = 'grid';
        } else {
            card.style.display = 'none';
        }
    });
}


// ==========================================
// DETALHES DE CONFRONTO E CARREGAMENTO DO MÓDULO EXTERNO
// ==========================================
function abrirDetalhesConfronto(jogoId) {
    const jogo = cacheJogosAtuais.find(j => String(j.id) === String(jogoId));
    if (!jogo) return;

    const op1 = jogo.opponent1 ? jogo.opponent1.fullName : "Casa";
    const op2 = jogo.opponent2 ? jogo.opponent2.fullName : "Fora";
    const nomeConfronto = `${op1} vs ${op2}`;
    
    let infoCabecalhoHtml = '';

    if (modoExibicaoAtual === 'line') {
        let dataHoraFormatada = "Horário sob consulta";
        const timestamp = jogo.startTs || jogo.time || jogo.startDate || jogo.begin;
        if (timestamp) {
            const data = new Date(timestamp * 1000);
            dataHoraFormatada = `📅 ${data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
        }
        infoCabecalhoHtml = `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; margin-top: 0.4rem;">
                <span style="color: var(--brand-teal); font-weight: 600; font-size: 0.9rem;">${dataHoraFormatada}</span>
            </div>
        `;
    } else {
        let infoObj = { tempoTexto: "Ao Vivo", gols1: "", gols2: "" };
        if (typeof formatarTempoPlacarAoVivo === 'function') {
            infoObj = formatarTempoPlacarAoVivo(jogo);
        }
        infoCabecalhoHtml = `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; margin-top: 0.4rem;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="display: inline-block; width: 8px; height: 8px; background-color: var(--brand-orange); border-radius: 50%; box-shadow: 0 0 6px var(--brand-orange);"></span>
                    <span id="time_detail_text_${jogoId}" style="color: var(--brand-orange); font-weight: 600; font-size: 0.85rem;">${infoObj.tempoTexto}</span>
                </div>
                <div id="gols_detail_${jogoId}" style="font-weight: bold; color: var(--brand-teal); font-size: 1.05rem;">${infoObj.gols1} - ${infoObj.gols2}</div>
            </div>
        `;
    }
    
    let pais = "Internacional";
    let competicao = jogo.liga ? jogo.liga.name : "Competição";
    if (jogo.liga && jogo.liga.nameEng) {
        const partes = jogo.liga.nameEng.split(".");
        if (partes.length > 1) {
            pais = partes[0].trim();
        }
    }

    const nomeEsporte = esporteAtualSelecionado ? esporteAtualSelecionado.nome : "Esporte";
    const container = document.getElementById('contentCenterArea');
    
    let html = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
            <div class="breadcrumb" style="margin-bottom: 0; font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 75%;">
                <span onclick="voltarParaLista()" style="cursor: pointer;">${nomeEsporte}</span> &gt; 
                <span>${pais}</span> &gt; 
                <span>${competicao}</span>
            </div>
            <button onclick="voltarParaLista()" style="background-color: var(--border-color); color: var(--text-main); border: none; padding: 0.35rem 0.7rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600;">
                ← Voltar
            </button>
        </div>
        <div class="match-card" style="border: none; background: transparent; padding: 0;">
            <div style="background-color: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.1rem 1rem; margin-bottom: 1rem; box-shadow: 0 4px 12px rgba(0,0,0,0.25); display: flex; flex-direction: column; align-items: center; gap: 0.2rem;">
                <h2 style="font-size: 1.2rem; color: var(--brand-orange); font-weight: 700; text-align: center; margin: 0;">${nomeConfronto}</h2>
                ${infoCabecalhoHtml}
            </div>

            <div id="containerOutrosMercados">
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem 1rem; background-color: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; gap: 1rem;">
                    <div style="width: 40px; height: 40px; border: 4px solid var(--border-color); border-top: 4px solid var(--brand-orange); border-radius: 50%; animation: spin 1.0s linear infinite;"></div>
                    <span style="color: var(--text-muted); font-size: 0.85rem;">Carregando mercados da API...</span>
                </div>
            </div>
        </div>

        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;

    container.innerHTML = html;
    container.scrollTop = 0;

    // Dispara a rotina de injeção e busca dos mercados extras
    executarCarregamentoOutrosMercados(jogoId);
}

function executarCarregamentoOutrosMercados(jogoId) {
    const scriptId = 'script_outros_mercados_modulo';
    const scriptExistente = document.getElementById(scriptId);
    if (scriptExistente) scriptExistente.remove();

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'outros_mercados.js';

    script.onload = function() {
        // Assim que carregar o arquivo com sucesso, chama a função do objeto MercadoManager
        if (typeof MercadoManager !== 'undefined' && typeof MercadoManager.carregarMaisMercadosAPI === 'function') {
            MercadoManager.carregarMaisMercadosAPI(jogoId, 'containerOutrosMercados');
        } else {
            console.error("O objeto MercadoManager ou o método carregarMaisMercadosAPI não foram encontrados no arquivo outros_mercados.js");
        }
    };

    script.onerror = function() {
        // Mantém girando se o arquivo não existir fisicamente na pasta
        console.warn("O arquivo outros_mercados.js não foi encontrado. O carregamento continuará em looping.");
    };

    document.head.appendChild(script);
}



// ==========================================
// BOLETIM DE APOSTAS & TRANSAÇÕES COM FEEDBACK VISUAL
// ==========================================
function alternarOdd(partida, selecao, odd, jogoId, elementoId, elementoDom, gIndex = null, sIndex = null, eIndex = null) {
    if (odd === "-" || odd === undefined || odd === null) return;
    
    const index = selecoesApostas.findIndex(s => s.elementoId === elementoId);

    if (index > -1) {
        selecoesApostas.splice(index, 1);
        elementoDom.classList.remove('selected');
    } else {
        selecoesApostas.push({
            id: jogoId,
            partida: partida,
            selecao: selecao,
            odd: parseFloat(odd),
            valor: 10,
            elementoId: elementoId,
            gIndex: gIndex,
            sIndex: sIndex,
            eIndex: eIndex,
            mensagemErro: null,
            mensagemSucesso: null,
            indisponivel: false
        });
        elementoDom.classList.add('selected');
    }

    if (selecoesApostas.length > 0) {
        document.getElementById('mainLayout').classList.add('with-betslip');
        boletimMinimizado = false;
    } else {
        document.getElementById('mainLayout').classList.remove('with-betslip');
        boletimMinimizado = false;
    }

    renderizarBetslip();
    atualizarCirculoFlutuante();
}

function removerItemBetslip(elementoId) {
    const index = selecoesApostas.findIndex(s => s.elementoId === elementoId);
    if (index > -1) {
        selecoesApostas.splice(index, 1);
        const el = document.getElementById(elementoId);
        if (el) el.classList.remove('selected');
    }

    if (selecoesApostas.length > 0) {
        renderizarBetslip();
    } else {
        fecharBetslip();
    }
    atualizarCirculoFlutuante();
}

function fecharBetslip() {
    selecoesApostas.forEach(s => {
        const el = document.getElementById(s.elementoId);
        if (el) el.classList.remove('selected');
    });
    selecoesApostas = [];
    boletimMinimizado = false;
    renderizarBetslip();
    atualizarCirculoFlutuante();
}

function minimizarBetslip() {
    boletimMinimizado = true;
    renderizarBetslip();
    atualizarCirculoFlutuante();
}

function restaurarBetslip() {
    if (selecoesApostas.length > 0) {
        boletimMinimizado = false;
        renderizarBetslip();
        atualizarCirculoFlutuante();
    }
}

function renderizarBetslip() {
    const container = document.getElementById('betslipContainer');
    const mainLayout = document.getElementById('mainLayout');

    if (selecoesApostas.length === 0) {
        container.innerHTML = '';
        mainLayout.classList.remove('with-betslip');
        boletimMinimizado = false;
        atualizarCirculoFlutuante();
        return;
    }

    if (boletimMinimizado) {
        mainLayout.classList.remove('with-betslip');
        container.innerHTML = '';
        return;
    } else {
        mainLayout.classList.add('with-betslip');
    }

    let itensHtml = `
        <div class="betslip-header">
            <h3>Boletim de Apostas (${selecoesApostas.length})</h3>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <button onclick="minimizarBetslip()" title="Minimizar" style="background:none; border:none; color:var(--text-muted); font-size:1.1rem; cursor:pointer; padding:0.2rem 0.4rem; font-weight:bold;">—</button>
                <button class="close-betslip" onclick="fecharBetslip()" title="Fechar e limpar">✕</button>
            </div>
        </div>
        <div id="betslipItemsList" style="display: flex; flex-direction: column; gap: 0.75rem; overflow-y: auto; max-height: calc(100vh - 150px); padding-right: 2px;">
    `;

    selecoesApostas.forEach((item, idx) => {
        const retorno = (item.valor * item.odd).toFixed(2);
        
        let avisoHtml = '';
        if (item.mensagemErro) {
            avisoHtml = `
                <div style="background: rgba(247, 92, 46, 0.15); border: 1px solid var(--brand-orange); color: var(--brand-orange); padding: 0.4rem 0.6rem; border-radius: 4px; font-size: 0.75rem; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 6px;">
                    <span>⚠️</span>
                    <span>${item.mensagemErro}</span>
                </div>
            `;
        }

        let sucessoHtml = '';
        if (item.mensagemSucesso) {
            sucessoHtml = `
                <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10B981; color: #10B981; padding: 0.4rem 0.6rem; border-radius: 4px; font-size: 0.75rem; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 6px;">
                    <span>✅</span>
                    <span>${item.mensagemSucesso}</span>
                </div>
            `;
        }

        let borderColor = 'var(--border-color)';
        if (item.mensagemErro) borderColor = 'var(--brand-orange)';
        if (item.mensagemSucesso) borderColor = '#10B981';

        let estiloBotaoApostar = '';
        let onclickApostar = `apostarIndividual(${idx})`;
        if (item.indisponivel) {
            estiloBotaoApostar = 'opacity: 0.4; cursor: not-allowed; background-color: var(--border-color);';
            onclickApostar = ''; 
        }

        itensHtml += `
            <div class="betslip-item" style="border-color: ${borderColor}; background: var(--card-bg); border-width: 1px; border-style: solid; border-radius: 8px; padding: 0.85rem; position: relative; display: flex; flex-direction: column; gap: 0.4rem;">
                <button class="btn-remove-item" onclick="removerItemBetslip('${item.elementoId}')" title="Remover" style="position: absolute; top: 10px; right: 10px; background: none; border: none; color: var(--text-muted); font-size: 0.9rem; cursor: pointer;">✕</button>
                <div class="match" style="font-size: 0.82rem; font-weight: 600; color: var(--text-main); padding-right: 1.2rem;">${item.partida}</div>
                <div class="selection" style="font-size: 0.8rem; color: var(--text-muted);">Palpite: <strong style="color: var(--brand-orange);">${item.selecao}</strong></div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.2rem;">Odd: <span id="odd_val_text_${idx}" style="font-weight: bold; color: var(--text-main);">${item.odd}</span></div>
                
                ${avisoHtml}
                ${sucessoHtml}

                <div class="bet-inline-group" style="display: flex; gap: 0.5rem; margin-top: 0.3rem; align-items: center;">
                    <input type="number" id="input_val_${idx}" value="${item.valor}" min="1" max="${saldo}" oninput="atualizarValorItem(${idx}, this.value)" ${item.indisponivel ? 'disabled style="opacity:0.5; width:100%;"' : 'style="flex: 1; background: var(--bg-color); border: 1px solid var(--border-color); color: var(--text-main); padding: 0.4rem 0.6rem; border-radius: 6px; font-size: 0.85rem;"'} >
                    <button class="btn-place-single" style="background-color: var(--brand-orange); color: #ffffff; border: none; padding: 0.4rem 0.9rem; border-radius: 6px; font-weight: 600; font-size: 0.85rem; cursor: pointer; white-space: nowrap; ${estiloBotaoApostar}" onclick="${onclickApostar}">Apostar</button>
                </div>
                <div class="item-return" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">
                    <span>Retorno:</span>
                    <strong id="ret_item_${idx}" style="color: var(--accent-color);">R$ ${retorno.replace('.', ',')}</strong>
                </div>
            </div>
        `;
    });

    itensHtml += `</div>`;
    container.innerHTML = itensHtml;
}

function atualizarCirculoFlutuante() {
    let circulo = document.getElementById('betslipFloatCircle');
    
    if (selecoesApostas.length > 0 && boletimMinimizado) {
        if (!circulo) {
            circulo = document.createElement('div');
            circulo.id = 'betslipFloatCircle';
            circulo.onclick = restaurarBetslip;
            document.body.appendChild(circulo);
        }
        circulo.innerHTML = `<span>${selecoesApostas.length}</span>`;
        circulo.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; width: 56px; height: 56px;
            background-color: var(--brand-orange); color: white; border-radius: 50%;
            display: flex; align-items: center; justify-content: center; font-size: 1.25rem;
            font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.6); cursor: pointer; z-index: 1050;
        `;
    } else {
        if (circulo) circulo.remove();
    }
}

function atualizarValorItem(index, val) {
    const num = parseFloat(val) || 0;
    selecoesApostas[index].valor = num;
    const retorno = (num * selecoesApostas[index].odd).toFixed(2);
    document.getElementById(`ret_item_${index}`).innerText = `R$ ${retorno.replace('.', ',')}`;
}

// ==========================================
// VALIDAÇÃO CIRÚRGICA DA ODD NA API E REGISTRO
// ==========================================
async function apostarIndividual(index) {
    const item = selecoesApostas[index];
    let saldoAtual = typeof window.saldo !== 'undefined' ? window.saldo : saldo;

    const valorAposta = parseFloat(item.valor) || 0;
    if (valorAposta <= 0) {
        item.mensagemErro = "Digite um valor válido para apostar.";
        renderizarBetslip();
        return;
    }

    if (valorAposta > saldoAtual) {
        item.mensagemErro = "Saldo insuficiente para realizar esta aposta!";
        renderizarBetslip();
        return;
    }

    item.mensagemErro = null;
    item.mensagemSucesso = null;
    item.indisponivel = false;

    if (esporteAtualSelecionado) {
        try {
            const tipoEndpoint = modoExibicaoAtual === 'line' ? 'line' : 'live';
            const workerUrl = `https://api.freebetano12.workers.dev/?type=${tipoEndpoint}&ms=${encodeURIComponent(esporteAtualSelecionado.id)}`;
            const response = await fetch(workerUrl);
            
            if (response.ok) {
                const jsonBruto = await response.json();
                const jogosBrutos = Array.isArray(jsonBruto) ? jsonBruto : (jsonBruto.value || jsonBruto.games || []);
                const jogoAtualizado = jogosBrutos.find(j => String(j.id) === String(item.id));

                if (jogoAtualizado && jogoAtualizado.eventGroups) {
                    let oddAtualizada = null;

                    if (item.gIndex !== null && item.sIndex !== null && item.eIndex !== null) {
                        try {
                            const grupoAPI = jogoAtualizado.eventGroups[item.gIndex];
                            if (grupoAPI && grupoAPI.events && grupoAPI.events[item.sIndex] && grupoAPI.events[item.sIndex][item.eIndex]) {
                                const valorBrutoOdd = grupoAPI.events[item.sIndex][item.eIndex].cfView;
                                if (valorBrutoOdd && valorBrutoOdd !== "-") {
                                    oddAtualizada = parseFloat(valorBrutoOdd);
                                }
                            }
                        } catch (e) {}
                    }

                    if (oddAtualizada === null || isNaN(oddAtualizada)) {
                        const grupoOficial = jogoAtualizado.eventGroups.find(g => g.groupId === 1 || g.groupId === 101 || g.groupId === 7 || g.groupId === 3);
                        if (grupoOficial && grupoOficial.events && grupoOficial.events.length > 0) {
                            try {
                                if (item.selecao.includes("1") || item.selecao.startsWith("1")) {
                                    oddAtualizada = parseFloat(grupoOficial.events[0]?.[0]?.cfView);
                                } else if (item.selecao.includes("X") || item.selecao.startsWith("X")) {
                                    oddAtualizada = parseFloat(grupoOficial.events[1]?.[0]?.cfView);
                                } else if (item.selecao.includes("2") || item.selecao.startsWith("2")) {
                                    const idx2 = grupoOficial.events.length >= 3 ? 2 : 1;
                                    oddAtualizada = parseFloat(grupoOficial.events[idx2]?.[0]?.cfView);
                                }
                            } catch (e) {}
                        }
                    }

                    if (oddAtualizada === null || isNaN(oddAtualizada)) {
                        item.indisponivel = true;
                        item.mensagemErro = "Mercado indisponível ou suspenso na API.";
                        renderizarBetslip();
                        return;
                    }

                    if (oddAtualizada !== item.odd) {
                        item.odd = oddAtualizada;
                        item.mensagemErro = `Odd alterada para ${oddAtualizada.toFixed(2)}. Verifique e confirme.`;
                        renderizarBetslip();
                        return;
                    }
                } else {
                    item.indisponivel = true;
                    item.mensagemErro = "Este evento foi encerrado ou não está mais disponível.";
                    renderizarBetslip();
                    return;
                }
            }
        } catch (erro) {
            console.warn("Não foi possível revalidar a odd em tempo real na API, prosseguindo.", erro);
        }
    }

    saldoAtual -= valorAposta;
    if (typeof window.saldo !== 'undefined') {
        window.saldo = saldoAtual;
    } else {
        saldo = saldoAtual;
    }
    
    if (typeof atualizarSaldoUI === 'function') {
        atualizarSaldoUI();
    }

    let urlStatsGerada = "";
    if (typeof cacheJogosAtuais !== 'undefined' && cacheJogosAtuais.length > 0) {
        const jogoEncontrado = cacheJogosAtuais.find(j => String(j.id) === String(item.id));
        if (jogoEncontrado && typeof gerarUrlEstatisticas === 'function') {
            urlStatsGerada = gerarUrlEstatisticas(jogoEncontrado) || "";
        }
    }

    const dadosApostaParaHistorico = {
        id: item.id || '1',
        partida: item.partida,
        selecao: item.selecao,
        odd: item.odd,
        valor: valorAposta,
        urlStats: urlStatsGerada,
        gIndex: item.gIndex,
        sIndex: item.sIndex,
        eIndex: item.eIndex
    };

    if (typeof registrarNovaApostaNoHistorico === 'function') {
        registrarNovaApostaNoHistorico(dadosApostaParaHistorico);
    }

    item.mensagemSucesso = "Aposta realizada com sucesso!";
    renderizarBetslip();

    if (typeof animarIconePerfil === 'function') {
        animarIconePerfil();
    }

    setTimeout(() => {
        removerItemBetslip(item.elementoId);
    }, 1800);
}

function atualizarSaldoUI() {
    const elSaldo = document.getElementById('userBalance');
    const valorAtual = typeof window.saldo !== 'undefined' ? window.saldo : saldo;
    
    if (elSaldo) {
        const valorFormatado = valorAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        elSaldo.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; white-space: nowrap; gap: 10px;">
                <span style="font-size: 0.85rem; color: #ffffff; font-weight: 500; text-transform: uppercase;">Saldo:</span>
                <span style="font-size: 0.95rem; font-weight: bold; color: var(--accent-color);">R$ ${valorFormatado}</span>
            </div>
        `;
    }
    
    if (typeof getStorageKey === 'function') {
        localStorage.setItem(getStorageKey('user_balance'), valorAtual);
    } else {
        localStorage.setItem('user_balance', valorAtual);
    }
}

// ==========================================
// HISTÓRICO E GESTOS TOUCH
// ==========================================
function abrirHistorico() {
    const lista = document.getElementById('historyList');
    if (!lista) return;
    if (historicoApostas.length === 0) {
        lista.innerHTML = '<div class="empty-msg">Nenhuma aposta realizada ainda.</div>';
    } else {
        let html = '';
        historicoApostas.forEach(ap => {
            html += `
                <div style="background: rgba(15, 23, 42, 0.4); border: 1px solid var(--border-color); padding: 0.75rem; border-radius: 6px; margin-bottom: 0.5rem; font-size: 0.85rem;">
                    <div style="display: flex; justify-content: space-between; color: var(--text-muted); font-size: 0.75rem;">
                        <span>${ap.data}</span>
                        <span style="color: var(--accent-color);">${ap.status}</span>
                    </div>
                    <div style="font-weight: bold; margin: 0.2rem 0;">${ap.partida}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.2rem;">Palpite: ${ap.selecao}</div>
                    <div>Odd: ${ap.odd} | Valor: R$ ${ap.valor.toFixed(2)} | Retorno: R$ ${(ap.valor * ap.odd).toFixed(2)}</div>
                </div>
            `;
        });
        lista.innerHTML = html;
    }
    const modal = document.getElementById('historyModal');
    if (modal) modal.style.display = 'flex';
}

function fecharHistorico() {
    const modal = document.getElementById('historyModal');
    if (modal) modal.style.display = 'none';
}

function deslogar() {
    if (confirm("Deseja realmente sair da conta?")) {
        alert("Sessão encerrada.");
        location.reload();
    }
}

let touchStartX = 0;
let touchEndX = 0;

window.addEventListener('touchstart', (e) => {
    if (e.changedTouches && e.changedTouches[0]) {
        touchStartX = e.changedTouches[0].screenX;
    }
}, { passive: true });

window.addEventListener('touchend', (e) => {
    if (e.changedTouches && e.changedTouches[0]) {
        touchEndX = e.changedTouches[0].screenX;
        tratarSwipeMobile();
    }
}, { passive: true });

function tratarSwipeMobile() {
    const distancia = touchEndX - touchStartX;
    const sidebar = document.querySelector('.sidebar-left');
    if (distancia > 70 && touchStartX < 50) {
        if (sidebar) sidebar.classList.add('mobile-drawer-open');
    }
    if (distancia < -70) {
        if (sidebar) sidebar.classList.remove('mobile-drawer-open');
    }
}

window.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.sidebar-left');
    const hamburger = document.querySelector('.hamburger-btn');
    if (sidebar && sidebar.classList.contains('mobile-drawer-open')) {
        if (!sidebar.contains(e.target) && hamburger && !hamburger.contains(e.target)) {
            fecharMenuMobile();
        }
    }
});

window.onload = async () => {
    atualizarSaldoUI();
    await carregarDadosExternos();
};