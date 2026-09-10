// ==========================================
// MÓDULO EXCLUSIVO - PRÉ-JOGO (LINE.JS)
// ==========================================

async function carregarJogosPorEsporte(msValue, nomeEsporte, tipo = 'line') {
    modoExibicaoAtual = tipo;
    const container = document.getElementById('contentCenterArea');
    
    // Spinner moderno com a cor verde (Pré-jogo)
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; gap: 1rem;">
            <div style="width: 42px; height: 42px; border: 4px solid rgba(23, 145, 114, 0.2); border-top: 4px solid var(--brand-teal); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
            <span style="color: var(--text-muted); font-size: 0.9rem; font-weight: 500;">Carregando confrontos (Pré-jogo)...</span>
        </div>
        <style>
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
    `;

    const workerUrl = `https://api.freebetano12.workers.dev/?type=${tipo}&ms=${encodeURIComponent(msValue)}`;

    try {
        const response = await fetch(workerUrl);
        if (!response.ok) throw new Error("Erro ao acessar o worker");
        
        const jsonBruto = await response.json();
        const jogosBrutos = Array.isArray(jsonBruto) ? jsonBruto : (jsonBruto.value || jsonBruto.games || []);

        cacheJogosAtuais = jogosBrutos.filter(jogo => {
            const op1 = jogo.opponent1 ? jogo.opponent1.fullName : "";
            const op2 = jogo.opponent2 ? jogo.opponent2.fullName : "";

            if (!op1 || !op2) return false;
       
            // FILTRO ADICIONADO: Exclui jogos que não possuem estatísticas (gameId)
            if (!jogo.statisticInfo || !jogo.statisticInfo.gameId) return false;
            
            const ehGenerico = (
                op1.includes("Home") || op2.includes("Away") ||
                op1.includes("Special bets") ||
                op1 === "1" || op2 === "2"
            );

            return !ehGenerico;
        });

        renderizarListaJogosLine(cacheJogosAtuais, nomeEsporte);
    } catch (erro) {
        console.error(erro);
        container.innerHTML = `<div class="error-box">Não foi possível carregar os confrontos no momento.</div>`;
    }
}

function formatarDataHoraLine(jogo) {
    const timestamp = jogo.startTs || jogo.time || jogo.startDate || jogo.begin;
    if (!timestamp) return "Horário sob consulta";

    const data = new Date(timestamp * 1000);
    return `📅 ${data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
}

// Captura direta baseada estritamente no primeiro grupo de odds do JSON para qualquer esporte
function extrairOddsMatchLine(jogo) {
    let odd1 = "-", oddX = "-", odd2 = "-";
    let temEmpate = false;
    let gIndexUsado = null;
    let sIndex1 = null, eIndex1 = null;
    let sIndexX = null, eIndexX = null;
    let sIndex2 = null, eIndex2 = null;

    if (jogo.eventGroups && jogo.eventGroups.length > 0) {
        // Pega obrigatoriamente o primeiro grupo disponível no array do jogo
        const grupoAlvo = jogo.eventGroups[0];

        if (grupoAlvo && grupoAlvo.events) {
            gIndexUsado = 0;
            const eventos = grupoAlvo.events;

            // Se tiver 3 ou mais eventos (Ex: 1X2 com Empate)
            if (eventos.length >= 3) {
                temEmpate = true;
                try {
                    odd1 = eventos[0]?.[0]?.cfView || "-";
                    oddX = eventos[1]?.[0]?.cfView || "-";
                    odd2 = eventos[2]?.[0]?.cfView || "-";
                    sIndex1 = 0; eIndex1 = 0;
                    sIndexX = 1; eIndexX = 0;
                    sIndex2 = 2; eIndex2 = 0;
                } catch(e) {}
            } 
            // Se tiver 2 ou mais eventos (Ex: Basquete/Tênis com Casa e Fora)
            else if (eventos.length >= 2) {
                temEmpate = false;
                try {
                    odd1 = eventos[0]?.[0]?.cfView || "-";
                    odd2 = eventos[1]?.[0]?.cfView || "-";
                    sIndex1 = 0; eIndex1 = 0;
                    sIndex2 = 1; eIndex2 = 0;
                } catch(e) {}
            } 
            // Caso venha tudo dentro de um único sub-array com 2 elementos
            else if (eventos.length === 1 && eventos[0].length >= 2) {
                temEmpate = false;
                try {
                    odd1 = eventos[0][0]?.cfView || "-";
                    odd2 = eventos[0][1]?.cfView || "-";
                    sIndex1 = 0; eIndex1 = 0;
                    sIndex2 = 0; eIndex2 = 1;
                } catch(e) {}
            }
        }
    }

    return { odd1, oddX, odd2, temEmpate, gIndexUsado, sIndex1, eIndex1, sIndexX, eIndexX, sIndex2, eIndex2 };
}

function renderizarListaJogosLine(jogos, nomeEsporte) {
    const container = document.getElementById('contentCenterArea');

    // Estilos dinâmicos correspondentes para os botões da aba (Ao Vivo vs Pré-jogo)
    const isLive = modoExibicaoAtual === 'live';
    const estiloAoVivo = isLive 
        ? 'background: var(--brand-orange); color: #fff; border: 1px solid var(--brand-orange);' 
        : 'background: transparent; color: var(--text-muted); border: 1px solid var(--brand-orange);';
    
    const estiloPreJogo = !isLive 
        ? 'background: var(--brand-teal); color: #fff; border: 1px solid var(--brand-teal);' 
        : 'background: transparent; color: var(--text-muted); border: 1px solid var(--brand-teal);';

    let html = `
        <div class="sport-top-header-panel mobile-sport-header" style="background-color: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1.25rem; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
            
            <div class="sport-header-inner-row" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; width: 100%;">
                
                <!-- Nome do Esporte -->
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span class="sport-title-text" style="font-size: 1.25rem; font-weight: bold; color: var(--text-main); display: flex; align-items: center; gap: 0.5rem;">${nomeEsporte}</span>
                </div>

                <!-- Botões Ao Vivo (Laranja) e Pré-jogo (Verde) com espaçamento e cores idênticas ao live.js -->
                <div class="sport-tabs-container" style="display: flex; gap: 0.75rem; background: var(--bg-color); padding: 4px; border-radius: 6px; border: 1px solid var(--border-color);">
                    <button onclick="trocarAbaEsporte('live')" style="${estiloAoVivo} padding: 0.4rem 1rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 600; transition: all 0.2s;">🔴 Ao Vivo</button>
                    <button onclick="trocarAbaEsporte('line')" style="${estiloPreJogo} padding: 0.4rem 1rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 600; transition: all 0.2s;">📋 Pré-jogo</button>
                </div>

                <!-- Barra de Pesquisa -->
                <div class="search-container" style="display: flex; align-items: center; position: relative;">
                    <button class="search-icon-btn" onclick="toggleSearchMobile(this)" title="Buscar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </button>
                    <input type="text" id="searchInput" class="match-search-input" placeholder="Buscar time ou campeonato..." oninput="filtrarJogosNaTela()">
                    <button class="search-close-btn" onclick="fecharSearchMobile(this)" title="Fechar">✕</button>
                </div>

            </div>

        </div>
    `;

    if (!jogos || jogos.length === 0) {
        html += `<div class="loading">Nenhum confronto de pré-jogo disponível no momento.</div>`;
        container.innerHTML = html;
        return;
    }

    html += `<div class="matches-table" id="matchesTableContainer">`;

    jogos.forEach(jogo => {
        const op1 = jogo.opponent1 ? jogo.opponent1.fullName : "Casa";
        const op2 = jogo.opponent2 ? jogo.opponent2.fullName : "Fora";
        const ligaNome = jogo.liga ? jogo.liga.name : "Competição";
        const jogoId = jogo.id;
        
        const dataHoraFormatada = formatarDataHoraLine(jogo);
        const oddsMatch = extrairOddsMatchLine(jogo);

        const odd1 = oddsMatch.odd1;
        const oddX = oddsMatch.oddX;
        const odd2 = oddsMatch.odd2;
        const temEmpate = oddsMatch.temEmpate;

        const btnId1 = `odd_${jogoId}_1`;
        const btnIdX = `odd_${jogoId}_X`;
        const btnId2 = `odd_${jogoId}_2`;

        const sel1 = selecoesApostas.some(s => s.elementoId === btnId1) ? 'selected' : '';
        const selX = selecoesApostas.some(s => s.elementoId === btnIdX) ? 'selected' : '';
        const sel2 = selecoesApostas.some(s => s.elementoId === btnId2) ? 'selected' : '';

        // Blindagem estricta: se a odd for "-", desativa o botão e bloqueia o clique
        const isDesativado1 = odd1 === "-";
        const isDesativadoX = oddX === "-";
        const isDesativado2 = odd2 === "-";

        const estiloBtn1 = isDesativado1 ? 'opacity: 0.4; cursor: not-allowed;' : '';
        const onclickBtn1 = isDesativado1 ? '' : `onclick="alternarOdd('${op1} vs ${op2}', '1 (${op1})', '${odd1}', '${jogoId}', '${btnId1}', this, ${oddsMatch.gIndexUsado}, ${oddsMatch.sIndex1}, ${oddsMatch.eIndex1})"`;

        const estiloBtnX = isDesativadoX ? 'opacity: 0.4; cursor: not-allowed;' : '';
        const onclickBtnX = isDesativadoX ? '' : `onclick="alternarOdd('${op1} vs ${op2}', 'X (Empate)', '${oddX}', '${jogoId}', '${btnIdX}', this, ${oddsMatch.gIndexUsado}, ${oddsMatch.sIndexX}, ${oddsMatch.eIndexX})"`;

        const estiloBtn2 = isDesativado2 ? 'opacity: 0.4; cursor: not-allowed;' : '';
        const onclickBtn2 = isDesativado2 ? '' : `onclick="alternarOdd('${op1} vs ${op2}', '2 (${op2})', '${odd2}', '${jogoId}', '${btnId2}', this, ${oddsMatch.gIndexUsado}, ${oddsMatch.sIndex2}, ${oddsMatch.eIndex2})"`;

        const estiloGrid = temEmpate ? 'grid-template-columns: repeat(3, 1fr);' : 'grid-template-columns: repeat(2, 1fr);';
        const termoBusca = `${op1} ${op2} ${ligaNome}`.toLowerCase();

        html += `
            <div class="match-row-card" data-search="${termoBusca}">
                <div class="match-info-area" style="display: flex; flex-direction: column; gap: 0.35rem;">
                    <div class="match-league-row" style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">${ligaNome}</div>
                    <div class="match-main-line" style="display: flex; align-items: center; gap: 1.25rem;">
                        <div class="match-time" style="font-size: 0.8rem; color: var(--brand-teal); font-weight: 600; white-space: nowrap; min-width: 135px;">${dataHoraFormatada}</div>
                        <div class="match-teams-col" style="display: flex; flex-direction: column; gap: 0.1rem;">
                            <div class="team-name" style="color: var(--text-main); font-size: 0.95rem; font-weight: 600;">${op1}</div>
                            <div class="team-name" style="color: var(--text-main); font-size: 0.95rem; font-weight: 600;">${op2}</div>
                        </div>
                    </div>
                </div>
                <div class="match-action-area">
                    <div class="match-odds-grid" style="${estiloGrid}">
                        <button id="${btnId1}" class="odd-row-btn ${sel1}" style="${estiloBtn1}" ${onclickBtn1}>
                            <span style="font-size: 0.65rem; color: var(--text-muted);">1</span>
                            <span class="odd-val">${odd1}</span>
                        </button>
                        ${temEmpate ? `
                        <button id="${btnIdX}" class="odd-row-btn ${selX}" style="${estiloBtnX}" ${onclickBtnX}>
                            <span style="font-size: 0.65rem; color: var(--text-muted);">X</span>
                            <span class="odd-val">${oddX}</span>
                        </button>` : ''}
                        <button id="${btnId2}" class="odd-row-btn ${sel2}" style="${estiloBtn2}" ${onclickBtn2}>
                            <span style="font-size: 0.65rem; color: var(--text-muted);">2</span>
                            <span class="odd-val">${odd2}</span>
                        </button>
                    </div>
                    <button class="btn-more-markets-row" onclick="abrirDetalhesConfronto('${jogoId}')">+ Outros Mercados</button>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    container.innerHTML = html;
}
