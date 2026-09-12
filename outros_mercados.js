// ==========================================
// MÓDULO: OUTROS_MERCADOS.JS (POLLING ATIVO + CAPTURA CORRETA DE CONFRONTO)
// ==========================================

const MercadoManager = {
    _intervaloId: null,
    _jogoIdAtivo: null,
    _emRequisicao: false,

    limparTextoTecnico(texto) {
        if (!texto || typeof texto !== 'string') return texto;
        return texto.replace(/\s*\([^)]*\)/g, '').trim();
    },

    formatarNomeOpcao(ev, gId, op1, op2, tiposMapa) {
        const tId = String(ev.type || '');
        let nomeFinal = tiposMapa[tId] || tId;

        if (nomeFinal === "Casa" || nomeFinal === "Competidor 1") {
            nomeFinal = op1;
        } else if (nomeFinal === "Fora" || nomeFinal === "Competidor 2") {
            nomeFinal = op2;
        }

        if (ev.parameter !== undefined && ev.parameter !== null && ev.parameter !== "") {
            let valParam = parseFloat(ev.parameter);
            let paramFormatado = (!isNaN(valParam) && valParam > 0) ? `+${valParam}` : `${ev.parameter}`;
            return `${nomeFinal} (<span style="color: #10B981; font-weight: 600;">${paramFormatado}</span>)`;
        }

        return this.limparTextoTecnico(nomeFinal);
    },

    coletarTodosOsGrupos(jogo) {
        let todosOsGrupos = [];
        if (Array.isArray(jogo.eventGroups)) todosOsGrupos = todosOsGrupos.concat(jogo.eventGroups);
        if (Array.isArray(jogo.centralBlockEventGroups)) todosOsGrupos = todosOsGrupos.concat(jogo.centralBlockEventGroups);
        if (Array.isArray(jogo.subGamesForMainGame)) {
            jogo.subGamesForMainGame.forEach(sg => {
                const subNome = sg.subGameName ? ` (${sg.subGameName})` : "";
                if (Array.isArray(sg.eventGroups)) {
                    sg.eventGroups.forEach(g => todosOsGrupos.push({ ...g, _subGameName: subNome }));
                }
            });
        }
        return todosOsGrupos;
    },

    pararPolling() {
        if (this._intervaloId) {
            clearInterval(this._intervaloId);
            this._intervaloId = null;
            this._jogoIdAtivo = null;
        }
    },

    iniciarPolling(jogoId, containerId = 'containerOutrosMercados') {
        this.pararPolling();
        this._jogoIdAtivo = String(jogoId);

        this.requisitarAtualizar(jogoId, containerId, false);

        this._intervaloId = setInterval(() => {
            const container = document.getElementById(containerId);
            if (!container) {
                this.pararPolling();
                return;
            }
            if (!this._emRequisicao) {
                this.requisitarAtualizar(jogoId, containerId, true);
            }
        }, 5000);
    },

    async requisitarAtualizar(jogoId, containerId, isSilencioso) {
        const container = document.getElementById(containerId);
        if (!container) return;

        this._emRequisicao = true;

        try {
            const tipoEndpoint = (typeof modoExibicaoAtual !== 'undefined' && modoExibicaoAtual === 'line') ? 'line' : 'live';
            const urlApi = `https://api.freebetano12.workers.dev/?type=${tipoEndpoint}&gameId=${jogoId}`;
            const res = await fetch(urlApi);
            if (!res.ok) throw new Error("Erro API");

            const jsonResp = await res.json();
            let dadosJogo = null;

            if (Array.isArray(jsonResp)) {
                dadosJogo = jsonResp.find(j => String(j.id) === String(jogoId)) || jsonResp[0];
            } else if (jsonResp && String(jsonResp.id) === String(jogoId)) {
                dadosJogo = jsonResp;
            } else if (jsonResp && jsonResp.value) {
                const val = jsonResp.value;
                dadosJogo = Array.isArray(val) ? (val.find(j => String(j.id) === String(jogoId)) || val[0]) : val;
            }

            if (!dadosJogo) return;

            // 1. Extrai primeiro do cabeçalho H2 renderizado na tela (garantia visual do confronto)
            let nomeConfrontoDOM = null;
            const tituloH2 = document.querySelector('.match-card h2');
            if (tituloH2 && tituloH2.textContent.includes(' vs ')) {
                const partes = tituloH2.textContent.split(' vs ');
                if (partes.length === 2) {
                    nomeConfrontoDOM = { op1: partes[0].trim(), op2: partes[1].trim() };
                }
            }

            // 2. Busca no cache da tela principal
            const jogoCache = (typeof cacheJogosAtuais !== 'undefined') 
                ? cacheJogosAtuais.find(j => String(j.id) === String(jogoId)) 
                : null;

            // 3. Fallbacks sequenciais cobrindo todas as chaves da BetConstruct
            const op1 = nomeConfrontoDOM?.op1 
                || jogoCache?.opponent1?.fullName 
                || jogoCache?.team1?.name 
                || dadosJogo.opponent1?.fullName 
                || dadosJogo.homeName 
                || dadosJogo.homeTeam 
                || dadosJogo.team1?.name 
                || (dadosJogo.participants && dadosJogo.participants[0]?.name) 
                || "Casa";

            const op2 = nomeConfrontoDOM?.op2 
                || jogoCache?.opponent2?.fullName 
                || jogoCache?.team2?.name 
                || dadosJogo.opponent2?.fullName 
                || dadosJogo.awayName 
                || dadosJogo.awayTeam 
                || dadosJogo.team2?.name 
                || (dadosJogo.participants && dadosJogo.participants[1]?.name) 
                || "Fora";

            const op1Escapado = op1.replace(/'/g, "\\'");
            const op2Escapado = op2.replace(/'/g, "\\'");

            const gruposMapa = (typeof opcoesMapa !== 'undefined' && opcoesMapa.grupos) ? opcoesMapa.grupos : {};
            const tiposMapa = (typeof opcoesMapa !== 'undefined' && opcoesMapa.tipos) ? opcoesMapa.tipos : {};
            const todosOsGrupos = this.coletarTodosOsGrupos(dadosJogo);

            // ====================================================
            // SEGUNDO PLANO (A CADA 5s): APENAS ATUALIZA AS ODDS
            // ====================================================
            if (isSilencioso && container.querySelector('.market-block')) {
                todosOsGrupos.forEach((grupo, gIndex) => {
                    if (Array.isArray(grupo.events)) {
                        grupo.events.forEach((subLista, sIndex) => {
                            subLista.forEach((ev, eIndex) => {
                                const btnId = `market_extra_${jogoId}_${gIndex}_${sIndex}_${eIndex}`;
                                const btnElement = document.getElementById(btnId);
                                if (!btnElement) return;

                                const oddSpan = btnElement.querySelector('.odd-val');
                                const novaOdd = ev.cfView || "-";

                                if (oddSpan && oddSpan.textContent !== novaOdd) {
                                    oddSpan.textContent = novaOdd;
                                    oddSpan.style.color = 'var(--brand-orange)';
                                    setTimeout(() => {
                                        if (oddSpan) oddSpan.style.color = 'var(--brand-teal)';
                                    }, 1200);

                                    if (typeof selecoesApostas !== 'undefined') {
                                        const apostaNoBoletim = selecoesApostas.find(s => s.elementoId === btnId);
                                        if (apostaNoBoletim && !isNaN(parseFloat(novaOdd))) {
                                            apostaNoBoletim.odd = parseFloat(novaOdd);
                                            if (typeof renderizarBetslip === 'function') renderizarBetslip();
                                        }
                                    }
                                }

                                if (novaOdd === "-") {
                                    btnElement.style.opacity = "0.4";
                                    btnElement.style.cursor = "not-allowed";
                                    btnElement.onclick = null;
                                }
                            });
                        });
                    }
                });
                return;
            }

            // ====================================================
            // PRIMEIRA CARGA: MONTAGEM DO HTML
            // ====================================================
            let htmlMercados = '';
            let blocosCount = 0;

            todosOsGrupos.forEach((grupo, gIndex) => {
                const gId = String(grupo.groupId || 'geral');
                const tituloBase = gruposMapa[gId] || `Mercado (${gId})`;
                const tituloGrupo = tituloBase + (grupo._subGameName || "");

                let opcoesValidasHTML = '';
                let totalOpcoesValidas = 0;

                if (Array.isArray(grupo.events)) {
                    grupo.events.forEach((subLista, sIndex) => {
                        subLista.forEach((ev, eIndex) => {
                            let oddCf = ev.cfView || "-";
                            const nomeTipoFormatado = this.formatarNomeOpcao(ev, gId, op1, op2, tiposMapa);
                            totalOpcoesValidas++;

                            const btnIdMarket = `market_extra_${jogoId}_${gIndex}_${sIndex}_${eIndex}`;
                            const isSel = (typeof selecoesApostas !== 'undefined' && selecoesApostas.some(s => s.elementoId === btnIdMarket)) ? 'selected' : '';
                            const isDesativado = oddCf === "-";
                            const estiloMarket = isDesativado ? 'opacity: 0.4; cursor: not-allowed; background: var(--bg-color);' : 'background: var(--bg-color); cursor: pointer;';
                            
                            const selecaoParaBoleto = nomeTipoFormatado.replace(/<[^>]*>/g, '').replace(/'/g, "\\'");
                            const tituloGrupoEscapado = tituloGrupo.replace(/'/g, "\\'");
                            const onclickMarket = isDesativado ? '' : `onclick="alternarOdd('${op1Escapado} vs ${op2Escapado}', '${tituloGrupoEscapado}: ${selecaoParaBoleto}', '${oddCf}', '${jogoId}', '${btnIdMarket}', this, ${gIndex}, ${sIndex}, ${eIndex})"`;

                            opcoesValidasHTML += `
                                <div id="${btnIdMarket}" class="market-option-btn ${isSel}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0.6rem 0.4rem; border-radius: 6px; border: 1px solid var(--border-color); text-align: center; gap: 0.2rem; transition: all 0.2s; ${estiloMarket}" ${onclickMarket}>
                                    <span style="font-size: 0.78rem; color: var(--text-main); line-height: 1.2; text-align: center;">${nomeTipoFormatado}</span>
                                    <span class="odd-val" style="font-weight: bold; color: var(--brand-teal); font-size: 0.9rem;">${oddCf}</span>
                                </div>
                            `;
                        });
                    });
                }

                if (totalOpcoesValidas > 0) {
                    blocosCount++;
                    const classeGrid = totalOpcoesValidas === 3 ? 'market-options-grid cols-3' : 'market-options-grid';
                    const blocoId = `bloco_extra_${jogoId}_${gIndex}`;

                    htmlMercados += `
                        <div class="market-block" style="background-color: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                            <div class="market-group-title" onclick="const el = document.getElementById('${blocoId}'); el.style.display = el.style.display === 'none' ? 'grid' : 'none';" style="font-size: 0.95rem; font-weight: bold; color: var(--brand-orange); margin-bottom: 0.75rem; text-align: center; text-transform: uppercase; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                                <span>${tituloGrupo}</span>
                                <span style="font-size: 0.8rem; color: var(--text-muted);">▼</span>
                            </div>
                            <div id="${blocoId}" class="${classeGrid}" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.5rem;">
                                ${opcoesValidasHTML}
                            </div>
                        </div>
                    `;
                }
            });

            container.innerHTML = blocosCount > 0 ? htmlMercados : `<p style="color: var(--text-muted); padding: 1rem; text-align: center;">Nenhum mercado adicional detalhado disponível.</p>`;

        } catch (e) {
            console.error("Erro no polling de mercados:", e);
        } finally {
            this._emRequisicao = false;
        }
    },

    carregarMaisMercadosAPI(jogoId, containerDestinoId) {
        this.iniciarPolling(jogoId, containerDestinoId);
    }
};
