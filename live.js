// ==========================================
// MÓDULO EXCLUSIVO - AO VIVO (LIVE.JS COMPLETO E CORRIGIDO)
// ==========================================

let livePollInterval = null;
let liveClockInterval = null;
let tempoJogosLocal = {}; 

function limparTimersAoVivo() {
    if (livePollInterval) {
        clearInterval(livePollInterval);
        livePollInterval = null;
    }
    if (liveClockInterval) {
        clearInterval(liveClockInterval);
        liveClockInterval = null;
    }
}

async function carregarJogosAoVivo(msValue, nomeEsporte, silencioso = false) {
    modoExibicaoAtual = 'live';
    const container = document.getElementById('contentCenterArea');
    
    if (!silencioso) {
        limparTimersAoVivo();
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; gap: 1rem;">
                <div style="width: 42px; height: 42px; border: 4px solid rgba(247, 92, 46, 0.2); border-top: 4px solid var(--brand-orange); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                <span style="color: var(--text-muted); font-size: 0.9rem; font-weight: 500;">Carregando confrontos Ao Vivo...</span>
            </div>
            <style>
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        `;
    }

    const workerUrl = `https://api.freebetano12.workers.dev/?type=live&ms=${encodeURIComponent(msValue)}`;

    try {
        const response = await fetch(workerUrl);
        if (!response.ok) throw new Error("Erro ao acessar o worker ao vivo");
        
        const jsonBruto = await response.json();
        const jogosBrutos = Array.isArray(jsonBruto) ? jsonBruto : (jsonBruto.value || jsonBruto.games || []);

        const jogosFiltrados = jogosBrutos.filter(jogo => {
            const op1 = jogo.opponent1 ? jogo.opponent1.fullName : "";
            const op2 = jogo.opponent2 ? jogo.opponent2.fullName : "";

            if (!op1 || !op2) return false;
            
            const ehGenerico = (
                op1.includes("Home") || op2.includes("Away") ||
                op1.includes("Special bets") ||
                op1 === "1" || op2 === "2"
            );

            return !ehGenerico;
        });

        let novosTemposLocais = {};
        jogosFiltrados.forEach(jogo => {
            if (jogo.scores && jogo.scores.timer && typeof jogo.scores.timer.timeSec === 'number') {
                novosTemposLocais[jogo.id] = (tempoJogosLocal[jogo.id] !== undefined) ? Math.max(tempoJogosLocal[jogo.id], jogo.scores.timer.timeSec) : jogo.scores.timer.timeSec;
            }
        });
        tempoJogosLocal = novosTemposLocais;

        cacheJogosAtuais = jogosFiltrados;

        if (silencioso) {
            if (document.getElementById('matchesTableContainer')) {
                renderizarListaJogosAoVivo(cacheJogosAtuais, nomeEsporte);
            } else {
                atualizarDOMJogosAoVivoSilencioso();
            }
        } else {
            renderizarListaJogosAoVivo(cacheJogosAtuais, nomeEsporte);
            iniciarTimersBackground(msValue, nomeEsporte);
        }

    } catch (erro) {
        console.error(erro);
        if (!silencioso) {
            container.innerHTML = `<div class="error-box">Não foi possível carregar os jogos ao vivo no momento.</div>`;
        }
    }
}

function iniciarTimersBackground(msValue, nomeEsporte) {
    limparTimersAoVivo();

    liveClockInterval = setInterval(() => {
        if (modoExibicaoAtual !== 'live') return;

        Object.keys(tempoJogosLocal).forEach(jogoId => {
            const jogo = cacheJogosAtuais.find(j => String(j.id) === String(jogoId));
            
            const statusPeriodo = (jogo && jogo.scores && jogo.scores.currentPeriodName) ? jogo.scores.currentPeriodName.toLowerCase() : "";
            const estaEncerrada = statusPeriodo.includes("encerrada") || statusPeriodo.includes("fim") || statusPeriodo.includes("ft");

            if (jogo && jogo.scores && jogo.scores.timer && !jogo.scores.isBreak && !estaEncerrada) {
                tempoJogosLocal[jogoId] += 1;
            }
        });

        atualizarElementosRelogioNaTela();
    }, 1000);

    livePollInterval = setInterval(() => {
        if (modoExibicaoAtual !== 'live') {
            limparTimersAoVivo();
            return;
        }
        carregarJogosAoVivo(msValue, nomeEsporte, true);
    }, 8000);
}

function formatarTempoPlacarAoVivo(jogo) {
    let statusPeriodo = "Ao Vivo";
    let tempoTextoFormatado = "";
    
    if (jogo.scores) {
        if (jogo.scores.isBreak) {
            statusPeriodo = "Intervalo";
        } else if (jogo.scores.currentPeriodName) {
            statusPeriodo = jogo.scores.currentPeriodName;
        }
        
        const statusLower = statusPeriodo.toLowerCase();
        const estaEncerrada = statusLower.includes("encerrada") || statusLower.includes("fim") || statusLower.includes("ft");

        const segundosAtuais = (tempoJogosLocal[jogo.id] !== undefined) ? tempoJogosLocal[jogo.id] : (jogo.scores.timer ? jogo.scores.timer.timeSec : 0);

        if (estaEncerrada) {
            tempoTextoFormatado = "";
        } else if (segundosAtuais && !jogo.scores.isBreak) {
            const minutos = Math.floor(segundosAtuais / 60);
            const segundos = segundosAtuais % 60;
            const segundosStr = segundos < 10 ? `0${segundos}` : segundos;
            
            if (minutos >= 0) {
                tempoTextoFormatado = `${statusPeriodo} - ${minutos}:${segundosStr}`;
            }
        }
    }

    const textoTempoFinal = tempoTextoFormatado ? tempoTextoFormatado : statusPeriodo;

    let gol1 = "";
    let gol2 = "";
    
    if (jogo.scores && jogo.scores.fullScore) {
        const partes = jogo.scores.fullScore.split("-");
        if (partes.length === 2) {
            gol1 = partes[0].trim();
            gol2 = partes[1].trim();
        }
    } else if (jogo.score1 !== undefined && jogo.score2 !== undefined) {
        gol1 = String(jogo.score1);
        gol2 = String(jogo.score2);
    }

    return {
        tempoTexto: textoTempoFinal,
        gols1: gol1,
        gols2: gol2
    };
}

function atualizarElementosRelogioNaTela() {
    cacheJogosAtuais.forEach(jogo => {
        const info = formatarTempoPlacarAoVivo(jogo);
        
        const timeEl = document.getElementById(`time_text_${jogo.id}`);
        if (timeEl) {
            timeEl.innerText = info.tempoTexto;
        }

        const timeDetailEl = document.getElementById(`time_detail_text_${jogo.id}`);
        if (timeDetailEl) {
            timeDetailEl.innerText = info.tempoTexto;
        }
    });
}

// Captura direta baseada estritamente no primeiro grupo de odds do JSON para qualquer esporte ao vivo
function extrairOddsMatch(jogo) {
    let odd1 = "-", oddX = "-", odd2 = "-";
    let temEmpate = false;

    if (jogo.eventGroups && jogo.eventGroups.length > 0) {
        const g = jogo.eventGroups[0];
        if (g && g.events) {
            try {
                if (g.events.length >= 3) {
                    temEmpate = true;
                    odd1 = g.events[0]?.[0]?.cfView || "-";
                    oddX = g.events[1]?.[0]?.cfView || "-";
                    odd2 = g.events[2]?.[0]?.cfView || "-";
                } else if (g.events.length === 2) {
                    temEmpate = false;
                    odd1 = g.events[0]?.[0]?.cfView || "-";
                    odd2 = g.events[1]?.[0]?.cfView || "-";
                } else if (g.events.length === 1 && g.events[0].length >= 2) {
                    temEmpate = false;
                    odd1 = g.events[0][0]?.cfView || "-";
                    odd2 = g.events[0][1]?.cfView || "-";
                }
            } catch(e) {}
        }
    }

    return { odd1, oddX, odd2, temEmpate };
}

function atualizarDOMJogosAoVivoSilencioso() {
    cacheJogosAtuais.forEach(jogo => {
        const jogoId = jogo.id;
        const info = formatarTempoPlacarAoVivo(jogo);

        const timeEl = document.getElementById(`time_text_${jogoId}`);
        if (timeEl) timeEl.innerText = info.tempoTexto;

        const timeDetailEl = document.getElementById(`time_detail_text_${jogoId}`);
        if (timeDetailEl) timeDetailEl.innerText = info.tempoTexto;

        const gol1El = document.getElementById(`gols1_${jogoId}`);
        const gol2El = document.getElementById(`gols2_${jogoId}`);
        if (gol1El) gol1El.innerText = info.gols1;
        if (gol2El) gol2El.innerText = info.gols2;

        const golDetailEl = document.getElementById(`gols_detail_${jogoId}`);
        if (golDetailEl && info.gols1 !== "") {
            golDetailEl.innerText = `${info.gols1} - ${info.gols2}`;
        }

        const oddsMatch = extrairOddsMatch(jogo);
        const op1 = jogo.opponent1 ? jogo.opponent1.fullName : "Casa";
        const op2 = jogo.opponent2 ? jogo.opponent2.fullName : "Fora";

        const atualizarBotaoOdd = (btnId, valorOdd, opNome, rotulo) => {
            const btn = document.getElementById(btnId);
            if (btn) {
                const valEl = btn.querySelector('.odd-val');
                if (valEl) valEl.innerText = valorOdd;
                
                if (valorOdd === "-" || valorOdd === undefined || valorOdd === null) {
                    btn.style.opacity = "0.4";
                    btn.style.cursor = "not-allowed";
                    btn.removeAttribute('onclick');
                } else {
                    btn.style.opacity = "1";
                    btn.style.cursor = "pointer";
                    btn.setAttribute('onclick', `alternarOdd('${opNome}', '${rotulo}', '${valorOdd}', '${jogoId}', '${btnId}', this)`);
                }
            }
        };

        atualizarBotaoOdd(`odd_${jogoId}_1`, oddsMatch.odd1, `${op1} vs ${op2}`, `1 (${op1})`);
        if (document.getElementById(`odd_${jogoId}_X`)) {
            atualizarBotaoOdd(`odd_${jogoId}_X`, oddsMatch.oddX, `${op1} vs ${op2}`, `X (Empate)`);
        }
        atualizarBotaoOdd(`odd_${jogoId}_2`, oddsMatch.odd2, `${op1} vs ${op2}`, `2 (${op2})`);

        if (jogo.eventGroups && jogo.eventGroups.length > 0) {
            jogo.eventGroups.forEach((grupo, gIndex) => {
                if (grupo.events) {
                    grupo.events.forEach((subLista, sIndex) => {
                        subLista.forEach((ev, eIndex) => {
                            const btnIdMarket = `market_${jogoId}_${gIndex}_${sIndex}_${eIndex}`;
                            const btnMarketEl = document.getElementById(btnIdMarket);
                            if (btnMarketEl) {
                                const oddValEl = btnMarketEl.querySelector('.odd-val');
                                const valStr = ev.cfView || "-";
                                if (oddValEl) {
                                    oddValEl.innerText = valStr;
                                }
                                if (valStr === "-") {
                                    btnMarketEl.style.opacity = "0.4";
                                    btnMarketEl.style.cursor = "not-allowed";
                                    btnMarketEl.removeAttribute('onclick');
                                } else {
                                    btnMarketEl.style.opacity = "1";
                                    btnMarketEl.style.cursor = "pointer";
                                }
                            }
                        });
                    });
                }
            });
        }
    });
}

function renderizarListaJogosAoVivo(jogos, nomeEsporte) {
    const container = document.getElementById('contentCenterArea');

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
                
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span class="sport-title-text" style="font-size: 1.25rem; font-weight: bold; color: var(--text-main); display: flex; align-items: center; gap: 0.5rem;">${nomeEsporte}</span>
                </div>

                <div class="sport-tabs-container" style="display: flex; gap: 0.75rem; background: var(--bg-color); padding: 4px; border-radius: 6px; border: 1px solid var(--border-color);">
                    <button onclick="trocarAbaEsporte('live')" style="${estiloAoVivo} padding: 0.4rem 1rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 600; transition: all 0.2s;">🔴 Ao Vivo</button>
                    <button onclick="trocarAbaEsporte('line')" style="${estiloPreJogo} padding: 0.4rem 1rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 600; transition: all 0.2s;">📋 Pré-jogo</button>
                </div>

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
        html += `<div class="loading">Nenhum confronto ao vivo disponível no momento para este esporte.</div>`;
        container.innerHTML = html;
        return;
    }

    html += `<div class="matches-table" id="matchesTableContainer">`;

    jogos.forEach(jogo => {
        const op1 = jogo.opponent1 ? jogo.opponent1.fullName : "Casa";
        const op2 = jogo.opponent2 ? jogo.opponent2.fullName : "Fora";
        const ligaNome = jogo.liga ? jogo.liga.name : "Competição";
        const jogoId = jogo.id;
        
        const infoAoVivo = formatarTempoPlacarAoVivo(jogo);
        const oddsMatch = extrairOddsMatch(jogo);

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

        const isDesativado1 = odd1 === "-";
        const isDesativadoX = oddX === "-";
        const isDesativado2 = odd2 === "-";

        const estiloBtn1 = isDesativado1 ? 'opacity: 0.4; cursor: not-allowed;' : '';
        const onclickBtn1 = isDesativado1 ? '' : `onclick="alternarOdd('${op1} vs ${op2}', '1 (${op1})', '${odd1}', '${jogoId}', '${btnId1}', this)"`;

        const estiloBtnX = isDesativadoX ? 'opacity: 0.4; cursor: not-allowed;' : '';
        const onclickBtnX = isDesativadoX ? '' : `onclick="alternarOdd('${op1} vs ${op2}', 'X (Empate)', '${oddX}', '${jogoId}', '${btnIdX}', this)"`;

        const estiloBtn2 = isDesativado2 ? 'opacity: 0.4; cursor: not-allowed;' : '';
        const onclickBtn2 = isDesativado2 ? '' : `onclick="alternarOdd('${op1} vs ${op2}', '2 (${op2})', '${odd2}', '${jogoId}', '${btnId2}', this)"`;

        const estiloGrid = temEmpate ? 'grid-template-columns: repeat(3, 1fr);' : 'grid-template-columns: repeat(2, 1fr);';
        const termoBusca = `${op1} ${op2} ${ligaNome}`.toLowerCase();

        html += `
            <div class="match-row-card" data-search="${termoBusca}">
                <div class="match-info-area" style="display: flex; flex-direction: column; gap: 0.35rem;">
                    <div class="match-league-row" style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">${ligaNome}</div>
                    <div class="match-main-line" style="display: flex; align-items: center; gap: 1rem;">
                        <div class="match-time" style="font-size: 0.80rem; white-space: nowrap; min-width: 135px; display: flex; align-items: center; gap: 6px;">
                            <span style="display: inline-block; width: 8px; height: 8px; background-color: var(--brand-orange); border-radius: 50%; box-shadow: 0 0 6px var(--brand-orange);"></span>
                            <span id="time_text_${jogoId}" style="color: var(--brand-orange); font-weight: 600;">${infoAoVivo.tempoTexto}</span>
                        </div>
                        <div class="match-teams-col" style="display: flex; flex-direction: column; gap: 0.2rem; min-width: 180px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                                <span class="team-name" style="color: var(--text-main); font-size: 0.95rem; font-weight: 600;">${op1}</span>
                                <span id="gols1_${jogoId}" style="font-weight: bold; color: var(--brand-teal); font-size: 0.95rem; min-width: 15px; text-align: right;">${infoAoVivo.gols1}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                                <span class="team-name" style="color: var(--text-main); font-size: 0.95rem; font-weight: 600;">${op2}</span>
                                <span id="gols2_${jogoId}" style="font-weight: bold; color: var(--brand-teal); font-size: 0.95rem; min-width: 15px; text-align: right;">${infoAoVivo.gols2}</span>
                            </div>
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