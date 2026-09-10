// ==========================================
// MÓDULO SEPARADO: OUTROS_MERCADOS.JS (LIMPO E CORRIGIDO)
// ==========================================

const MercadoManager = {
    limparTextoTecnico(texto) {
        if (!texto || typeof texto !== 'string') return texto;
        return texto.replace(/\s*\([^)]*\)/g, '').trim();
    },

    formatarNomeOpcao(ev, gId, tituloGrupo, op1, op2, sIndex, tiposMapa) {
        const tId = String(ev.type || '');
        let nomeTipo = tiposMapa[tId] ? tiposMapa[tId] : null;

        if (tId === "1" || nomeTipo === "Competidor 1") nomeTipo = op1;
        if (tId === "3" || tId === "2" || nomeTipo === "Competidor 2") {
            nomeTipo = (gId === "1" && tId === "2") ? "Empate (X)" : op2;
        }
        if (tId === "7") nomeTipo = op1;
        if (tId === "8") nomeTipo = op2;

        const tituloLower = tituloGrupo.toLowerCase();

        if (gId === "2" || gId === "88" || gId === "2766" || gId === "2854" || tituloLower.includes("handicap")) {
            let ladoTime = (sIndex === 1 || tId === "3" || tId === "8" || tId === "402" || tId === "3655" || nomeTipo === "Competidor 2") ? op2 : op1;
            if (nomeTipo === "Competidor 1") ladoTime = op1;

            if (ev.parameter !== undefined && ev.parameter !== null && ev.parameter !== "") {
                let valParam = parseFloat(ev.parameter);
                let sinal = valParam > 0 ? `+${valParam}` : `${valParam}`;
                return `${ladoTime} (<span style="color: #10B981; font-weight: 600;">${sinal}</span>)`;
            }
            return ladoTime;
        }

        if (ev.parameter !== undefined && ev.parameter !== null && ev.parameter !== "") {
            let tipoPrefixo = nomeTipo || "Total";
            if (tId === "9" || tId === "11" || tId === "13" || tId === "3827" || tituloLower.includes("mais") || sIndex === 0) {
                tipoPrefixo = "Mais";
            } else if (tId === "10" || tId === "12" || tId === "14" || tId === "3828" || tituloLower.includes("menos") || sIndex === 1) {
                tipoPrefixo = "Menos";
            }
            return `${tipoPrefixo} (<span style="color: #10B981; font-weight: 600;">${ev.parameter}</span>)`;
        }

        if (!nomeTipo || /^\d+$/.test(nomeTipo)) {
            if (ev.eventParams && ev.eventParams.params && ev.eventParams.params.length > 0) {
                let pRaw = ev.eventParams.params[0];
                if (typeof pRaw === 'string') {
                    nomeTipo = this.limparTextoTecnico(pRaw);
                }
            }
        }

        if (!nomeTipo || /^\d+$/.test(nomeTipo)) {
            if (ev.eventParams && ev.eventParams.playerNames && ev.eventParams.playerNames.length > 0) {
                nomeTipo = ev.eventParams.playerNames.join(" / ");
            } else {
                nomeTipo = `Opção ${tId}`;
            }
        }

        return this.limparTextoTecnico(nomeTipo);
    },

    coletarTodosOsGrupos(jogo) {
        let todosOsGrupos = [];
        if (jogo.eventGroups && Array.isArray(jogo.eventGroups)) {
            todosOsGrupos = todosOsGrupos.concat(jogo.eventGroups);
        }
        if (jogo.centralBlockEventGroups && Array.isArray(jogo.centralBlockEventGroups)) {
            todosOsGrupos = todosOsGrupos.concat(jogo.centralBlockEventGroups);
        }
        if (jogo.subGamesForMainGame && Array.isArray(jogo.subGamesForMainGame)) {
            jogo.subGamesForMainGame.forEach(sg => {
                const subNome = sg.subGameName ? ` (${sg.subGameName})` : "";
                if (sg.eventGroups && Array.isArray(sg.eventGroups)) {
                    sg.eventGroups.forEach(g => {
                        todosOsGrupos.push({ ...g, _subGameName: subNome });
                    });
                }
            });
        }
        return todosOsGrupos;
    },

    async carregarMaisMercadosAPI(jogoId, containerDestinoId) {
        const container = document.getElementById(containerDestinoId);
        if (!container) return;

        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem 1rem; gap: 1rem; background-color: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px;">
                <div style="width: 40px; height: 40px; border: 4px solid var(--border-color); border-top: 4px solid var(--brand-orange); border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <span style="color: var(--text-muted); font-size: 0.85rem;">Buscando todos os mercados da API...</span>
            </div>
        `;

        try {
            const tipoEndpoint = (typeof modoExibicaoAtual !== 'undefined' && modoExibicaoAtual === 'line') ? 'line' : 'live';
            const urlApi = `https://api.freebetano12.workers.dev/?type=${tipoEndpoint}&gameId=${jogoId}`;
            
            const response = await fetch(urlApi);
            if (!response.ok) throw new Error("Erro na requisição da API");

            const jsonResp = await response.json();
            let dadosJogo = null;

            if (Array.isArray(jsonResp)) {
                dadosJogo = jsonResp.find(j => String(j.id) === String(jogoId)) || jsonResp[0];
            } else if (jsonResp && String(jsonResp.id) === String(jogoId)) {
                dadosJogo = jsonResp;
            } else if (jsonResp && jsonResp.value) {
                const val = jsonResp.value;
                dadosJogo = Array.isArray(val) ? (val.find(j => String(j.id) === String(jogoId)) || val[0]) : val;
            }

            if (!dadosJogo) {
                container.innerHTML = `<p style="color: var(--text-muted); padding: 1rem; text-align: center;">Nenhum mercado adicional encontrado para este jogo.</p>`;
                return;
            }

            const jogoCache = (typeof cacheJogosAtuais !== 'undefined') ? cacheJogosAtuais.find(j => String(j.id) === String(jogoId)) : null;

            const op1 = dadosJogo.opponent1?.fullName || dadosJogo.homeName || dadosJogo.homeTeam || dadosJogo.team1?.name || (dadosJogo.participants && dadosJogo.participants[0]?.name) || jogoCache?.opponent1?.fullName || "Casa";
            const op2 = dadosJogo.opponent2?.fullName || dadosJogo.awayName || dadosJogo.awayTeam || dadosJogo.team2?.name || (dadosJogo.participants && dadosJogo.participants[1]?.name) || jogoCache?.opponent2?.fullName || "Fora";

            const gruposMapa = (typeof opcoesMapa !== 'undefined' && opcoesMapa.grupos) ? opcoesMapa.grupos : {};
            const tiposMapa = (typeof opcoesMapa !== 'undefined' && opcoesMapa.tipos) ? opcoesMapa.tipos : {};

            const todosOsGrupos = this.coletarTodosOsGrupos(dadosJogo);
            let htmlMercados = '';
            let blocosCount = 0;

            todosOsGrupos.forEach((grupo, gIndex) => {
                const gId = String(grupo.groupId || 'geral');

                if (typeof mercadoPermitidoNoEsporte === 'function' && mercadoPermitidoNoEsporte(gId)) {
                    return;
                }

                const tituloBase = gruposMapa[gId] ? gruposMapa[gId] : `Mercado (${gId})`;
                const tituloGrupo = tituloBase + (grupo._subGameName || "");

                let opcoesValidasHTML = '';
                let totalOpcoesValidas = 0;

                if (grupo.events && Array.isArray(grupo.events)) {
                    grupo.events.forEach((subLista, sIndex) => {
                        subLista.forEach((ev, eIndex) => {
                            const nomeTipoFormatado = this.formatarNomeOpcao(ev, gId, tituloGrupo, op1, op2, sIndex, tiposMapa);
                            
                            totalOpcoesValidas++;
                            const oddCf = ev.cfView || "-";
                            
                            const btnIdMarket = `market_extra_${jogoId}_${gIndex}_${sIndex}_${eIndex}`;
                            const isSel = (typeof selecoesApostas !== 'undefined' && selecoesApostas.some(s => s.elementoId === btnIdMarket)) ? 'selected' : '';

                            const isDesativadoMarket = oddCf === "-";
                            const estiloMarket = isDesativadoMarket ? 'opacity: 0.4; cursor: not-allowed; background: var(--bg-color);' : 'background: var(--bg-color); cursor: pointer;';
                            
                            const selecaoParaBoleto = nomeTipoFormatado.replace(/<[^>]*>/g, '');
                            const onclickMarket = isDesativadoMarket ? '' : `onclick="alternarOdd('${op1} vs ${op2}', '${tituloGrupo}: ${selecaoParaBoleto}', '${oddCf}', '${jogoId}', '${btnIdMarket}', this, ${gIndex}, ${sIndex}, ${eIndex})"`;

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

            container.innerHTML = blocosCount > 0 ? htmlMercados : `<p style="color: var(--text-muted); padding: 1rem; text-align: center;">Nenhum mercado adicional detalhado disponível no momento.</p>`;

        } catch (e) {
            console.error("Erro ao buscar mercados extras:", e);
            container.innerHTML = `<p style="color: var(--brand-orange); padding: 1rem; text-align: center;">Erro ao carregar mais mercados.</p>`;
        }
    }
};