// ==========================================
// MÓDULO EXCLUSIVO - GESTÃO DE SALDO E HISTÓRICO NO FIRESTORE (HISTORY_BET.JS)
// ==========================================

(function injetarEstilosHistorico() {
    const styleId = 'history-bet-dynamic-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            @keyframes piscarLaranja {
                0% { background-color: transparent; transform: scale(1); }
                50% { background-color: var(--brand-orange, #f75c2e); transform: scale(1.15); box-shadow: 0 0 12px var(--brand-orange, #f75c2e); }
                100% { background-color: transparent; transform: scale(1); }
            }
            .piscar-icone-perfil {
                animation: piscarLaranja 0.6s ease-in-out 3;
                border-radius: 50%;
            }
        `;
        document.head.appendChild(style);
    }
})();

let abaHistoricoAtual = 'pendentes';
let historicoCacheNuvem = [];

document.addEventListener("DOMContentLoaded", () => {
    if (typeof window.atualizarSaldoUI === 'function') {
        window.atualizarSaldoUI();
    }
    iniciarOuvinteFirestore();
});

// Delegação de eventos global para os botões de estatísticas
document.addEventListener("click", function(event) {
    const btn = event.target.closest('.btn-ver-resultados');
    if (btn) {
        const idJogo = btn.getAttribute('data-id-jogo');
        if (idJogo && typeof window.abrirEstatisticasModal === 'function') {
            window.abrirEstatisticasModal(idJogo);
        }
    }
});

function iniciarOuvinteFirestore() {
    const checkReady = setInterval(() => {
        const temAuth = window.firebaseAuth || (window.firebase && window.firebase.auth);
        const temDb = window.firebaseDb || (window.firebase && window.firebase.firestore);

        if (temAuth && temDb) {
            clearInterval(checkReady);

            const authInstance = window.firebaseAuth || window.firebase.auth();

            const registrarOuvinteAuth = typeof window.onAuthStateChanged === 'function'
                ? window.onAuthStateChanged
                : (auth, cb) => auth.onAuthStateChanged(cb);

            registrarOuvinteAuth(authInstance, async (user) => {
                if (user) {
                    window.usuarioLogadoFirebase = user;

                    const db = window.firebaseDb || window.firebase.firestore();

                    // Suporte tanto para Firebase v9+ modular quanto para v8 compat
                    if (typeof window.onSnapshot === 'function' && typeof window.doc === 'function') {
                        window.onSnapshot(window.doc(db, "usuarios", user.uid), (docSnap) => processarDadosUsuario(docSnap));
                    } else if (db.collection) {
                        db.collection("usuarios").doc(user.uid).onSnapshot((docSnap) => processarDadosUsuario(docSnap));
                    }
                } else {
                    window.usuarioLogadoFirebase = null;
                    historicoCacheNuvem = [];
                }
            });
        }
    }, 200);
}

async function processarDadosUsuario(docSnap) {
    if (!docSnap.exists || (typeof docSnap.exists === 'function' && !docSnap.exists())) return;

    const data = typeof docSnap.data === 'function' ? docSnap.data() : docSnap;
    let historicoBanco = Array.isArray(data.historicoApostas) ? data.historicoApostas : [];
    let saldoBanco = typeof data.saldo === 'number' ? data.saldo : 10000.00;

    let saldoPrecisaAtualizar = false;

    let historicoModificado = historicoBanco.map(ap => {
        const status = (ap.status || 'pendente').trim().toLowerCase();

        if (status === 'ganha' && !ap.recompensado) {
            saldoBanco += parseFloat(ap.retorno || 0);
            ap.recompensado = true;
            saldoPrecisaAtualizar = true;
        }
        return ap;
    });

    if (saldoPrecisaAtualizar) {
        window.saldo = saldoBanco;
        historicoCacheNuvem = historicoModificado;
        await salvarEstadoNuvem(historicoCacheNuvem, window.saldo);
    } else {
        window.saldo = saldoBanco;
        historicoCacheNuvem = historicoBanco;
    }

    if (typeof window.atualizarSaldoUI === 'function') {
        window.atualizarSaldoUI();
    }

    const modal = document.getElementById('historyModal');
    if (modal && modal.style.display === 'flex') {
        renderizarListaHistorico();
    }
}

window.atualizarSaldoUI = function() {
    const elSaldo = document.getElementById('userBalance');
    const valorAtual = typeof window.saldo !== 'undefined' ? window.saldo : 10000.00;

    if (elSaldo) {
        const valorFormatado = valorAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        elSaldo.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; white-space: nowrap; gap: 10px;">
                <span style="font-size: 0.85rem; color: #ffffff; font-weight: 500; text-transform: uppercase;">Saldo:</span>
                <span style="font-size: 0.95rem; font-weight: bold; color: var(--accent-color, #10B981);">R$ ${valorFormatado}</span>
            </div>
        `;
    }
};

async function salvarEstadoNuvem(novoHistorico, novoSaldo) {
    if (!window.usuarioLogadoFirebase) return;
    try {
        const uid = window.usuarioLogadoFirebase.uid;
        const db = window.firebaseDb || (window.firebase && window.firebase.firestore());

        // Compatibilidade Modular (v9+)
        if (typeof window.updateDoc === 'function' && typeof window.doc === 'function') {
            const userRef = window.doc(db, "usuarios", uid);
            await window.updateDoc(userRef, {
                saldo: novoSaldo,
                historicoApostas: novoHistorico
            });
        // Compatibilidade Namespaced (v8 / compat)
        } else if (db && db.collection) {
            await db.collection("usuarios").doc(uid).update({
                saldo: novoSaldo,
                historicoApostas: novoHistorico
            });
        }
    } catch (e) {
        console.error("Erro ao salvar no Firestore:", e);
    }
}

window.registrarNovaApostaNoHistorico = async function(item) {
    if (!window.usuarioLogadoFirebase) return;

    const novaAposta = {
        idUnico: 'aposta_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        idJogo: item.id || item.idJogo || '1',
        partida: item.partida || 'Partida',
        selecao: item.selecao || 'Palpite',
        odd: parseFloat(item.odd || 1).toFixed(2),
        valor: parseFloat(item.valor || 0),
        retorno: (parseFloat(item.valor || 0) * parseFloat(item.odd || 1)).toFixed(2),
        data: new Date().toLocaleString('pt-BR'),
        status: 'Pendente',
        recompensado: false,
        jaPediuVerificacao: false,
        urlStats: item.urlStats || '',
        gIndex: item.gIndex !== undefined ? item.gIndex : null,
        sIndex: item.sIndex !== undefined ? item.sIndex : null,
        eIndex: item.eIndex !== undefined ? item.eIndex : null
    };

    historicoCacheNuvem.unshift(novaAposta);
    await salvarEstadoNuvem(historicoCacheNuvem, window.saldo);
    animarIconePerfil();
};

window.obterQuantidadeApostasAbertas = function() {
    return historicoCacheNuvem.filter(ap => {
        const status = (ap.status || 'pendente').trim().toLowerCase();
        return status === 'pendente';
    }).length;
};

function animarIconePerfil() {
    const perfilIcon = document.querySelector('.profile-icon');
    if (perfilIcon) {
        perfilIcon.classList.remove('piscar-icone-perfil');
        void perfilIcon.offsetWidth;
        perfilIcon.classList.add('piscar-icone-perfil');
    }
}

window.pedirVerificacaoAposta = async function(idUnico) {
    const aposta = historicoCacheNuvem.find(ap => ap.idUnico === idUnico);
    const containerMsg = document.getElementById(`msg_rev_${idUnico}`);
    if (!aposta) return;

    // Caso já tenha sido revisada anteriormente
    if (aposta.jaPediuVerificacao) {
        if (containerMsg) {
            containerMsg.innerHTML = `<span style="color: #EF4444; font-size: 0.75rem; font-weight: 600; display: inline-block; margin-top: 4px;">Esta aposta já foi revisada anteriormente e não pode ser solicitada de novo.</span>`;
        }
        return;
    }

    // Marca a flag de verificação
    aposta.jaPediuVerificacao = true;

    // Desativa o link "Pedir Revisão" imediatamente para evitar cliques duplos
    const containerAcao = document.getElementById(`box_rev_link_${idUnico}`);
    if (containerAcao) {
        containerAcao.style.pointerEvents = 'none';
        containerAcao.style.opacity = '0.5';
    }

    // 1. Exibe a mensagem em vermelho ANTES de qualquer alteração no banco
    if (containerMsg) {
        containerMsg.innerHTML = `<span style="color: #179172; font-size: 0.75rem; font-weight: 600; display: inline-block; margin-top: 4px;">Seu resultado foi cancelado e enviado novamente para analise.</span>`;
    }

    // 2. Aguarda 2.5 segundos com a mensagem visível na tela antes de alterar o status e salvar
    setTimeout(async () => {
        const statusLower = (aposta.status || '').trim().toLowerCase();
        if (statusLower === 'ganha' || statusLower === 'ganhou') {
            const valorRetorno = parseFloat(aposta.retorno || (aposta.valor * aposta.odd));
            let saldoAtual = typeof window.saldo !== 'undefined' ? window.saldo : 10000.00;

            saldoAtual -= valorRetorno;
            if (saldoAtual < 0) saldoAtual = 0;

            window.saldo = saldoAtual;
            aposta.recompensado = false;

            if (typeof window.atualizarSaldoUI === 'function') {
                window.atualizarSaldoUI();
            }
        }

        // 3. Agora muda o status para Pendente e sincroniza no Firestore
        aposta.status = 'Pendente';
        await salvarEstadoNuvem(historicoCacheNuvem, window.saldo);

        // Atualiza a visualização da aba
        const modal = document.getElementById('historyModal');
        if (modal && modal.style.display === 'flex') {
            renderizarListaHistorico();
        }
    }, 2500);
};

window.mudarAbaHistorico = function(aba) {
    abaHistoricoAtual = aba;
    const btnPendentes = document.getElementById('tabPendentes');
    const btnResolvidas = document.getElementById('tabResolvidas');

    if (btnPendentes && btnResolvidas) {
        if (aba === 'pendentes') {
            btnPendentes.style.background = 'var(--brand-orange, #f75c2e)';
            btnPendentes.style.color = '#fff';
            btnPendentes.style.border = '1px solid var(--brand-orange, #f75c2e)';

            btnResolvidas.style.background = 'transparent';
            btnResolvidas.style.color = 'var(--text-muted, #94a3b8)';
            btnResolvidas.style.border = '1px solid var(--border-color, #334155)';
        } else {
            btnResolvidas.style.background = 'var(--brand-orange, #f75c2e)';
            btnResolvidas.style.color = '#fff';
            btnResolvidas.style.border = '1px solid var(--brand-orange, #f75c2e)';

            btnPendentes.style.background = 'transparent';
            btnPendentes.style.color = 'var(--text-muted, #94a3b8)';
            btnPendentes.style.border = '1px solid var(--border-color, #334155)';
        }
    }
    renderizarListaHistorico();
};

function renderizarListaHistorico() {
    const lista = document.getElementById('historyList');
    if (!lista) return;

    if (!window.usuarioLogadoFirebase) {
        lista.innerHTML = `<div class="empty-msg" style="color: var(--text-muted, #94a3b8); text-align: center; padding: 1.5rem;">Faça login para visualizar suas apostas.</div>`;
        return;
    }

    const itensFiltrados = historicoCacheNuvem.filter(ap => {
        const statusLower = (ap.status || 'pendente').trim().toLowerCase();
        if (abaHistoricoAtual === 'pendentes') {
            return statusLower === 'pendente';
        } else {
            return statusLower === 'ganha' || statusLower === 'ganhou' || statusLower === 'perdida' || statusLower === 'perdeu';
        }
    });

    const saldoFormatado = (typeof window.saldo !== 'undefined' ? window.saldo : 10000).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    let html = `
        <div style="background: var(--card-bg, #1e293b); border: 1px solid var(--border-color, #334155); padding: 0.6rem 0.9rem; border-radius: 6px; margin-bottom: 0.8rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem;">
            <span>👤 Conta: <strong style="color: var(--brand-teal, #14b8a6);">${window.usuarioLogadoFirebase.displayName || 'Usuário'}</strong></span>
            <span>💰 Saldo: <strong style="color: var(--accent-color, #10B981);">R$ ${saldoFormatado}</strong></span>
        </div>
    `;

    if (itensFiltrados.length === 0) {
        html += `<div class="empty-msg" style="color: var(--text-muted, #94a3b8); text-align: center; padding: 1.5rem;">Nenhuma aposta ${abaHistoricoAtual} encontrada.</div>`;
        lista.innerHTML = html;
        return;
    }

    itensFiltrados.forEach(ap => {
        let statusLower = (ap.status || 'pendente').trim().toLowerCase();
        let corStatus = 'var(--accent-color, #f75c2e)';
        let textoStatus = ap.status || 'Pendente';

        if (statusLower === 'ganha' || statusLower === 'ganhou') {
            corStatus = '#10B981';
            textoStatus = 'Ganha ✅';
        } else if (statusLower === 'perdida' || statusLower === 'perdeu') {
            corStatus = '#EF4444';
            textoStatus = 'Perdida ❌';
        } else {
            textoStatus = 'Pendente ⏳';
        }

        const temIdJogo = ap.idJogo !== undefined && ap.idJogo !== null && ap.idJogo !== '';
        const botaoStatsHtml = temIdJogo ? `
            <button type="button" class="btn-ver-resultados" data-id-jogo="${ap.idJogo}" title="Ver Estatísticas da Partida" style="background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-color, #334155); color: var(--text-main, #f8fafc); border-radius: 6px; cursor: pointer; padding: 0.3rem 0.6rem; display: inline-flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 600; transition: all 0.2s;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--brand-orange, #f75c2e);">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                <span>Resultados</span>
            </button>
        ` : '';

        let secaoVerificacaoHtml = '';
        if (abaHistoricoAtual === 'resolvidas') {
            secaoVerificacaoHtml = `
                <hr style="border: none; border-top: 1px solid #334155; width: 100%; margin: 0.6rem 0 0.4rem 0;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div id="box_rev_link_${ap.idUnico}" style="font-size: 0.78rem; text-align: left;">
                        <span style="color: #ffffff;">Aposta Resolvida Errada? </span>
                        <span onclick="pedirVerificacaoAposta('${ap.idUnico}')" style="color: var(--brand-orange, #f75c2e); cursor: pointer; font-weight: 600; text-decoration: underline;">Pedir Revisão</span>
                    </div>
                    <div id="msg_rev_${ap.idUnico}" style="text-align: left;"></div>
                </div>
            `;
        }

        html += `
            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color, #334155); padding: 0.85rem; border-radius: 8px; font-size: 0.85rem; margin-bottom: 0.75rem;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; color: var(--text-muted, #94a3b8); font-size: 0.75rem; margin-bottom: 0.4rem;">
                    <span>📅 ${ap.data}</span>
                    <span style="font-weight: bold; color: ${corStatus}; font-size: 0.82rem;">${textoStatus}</span>
                </div>
                <div style="font-weight: bold; color: var(--text-main, #f8fafc); margin-bottom: 0.2rem; font-size: 0.9rem;">${ap.partida}</div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.4rem;">
                    <div>
                        <div style="font-size: 0.80rem; color: var(--text-muted, #94a3b8); margin-bottom: 0.2rem;">Palpite: <strong style="color: var(--brand-orange, #f75c2e);">${ap.selecao}</strong></div>
                        <div style="font-size: 0.80rem; color: var(--text-main, #f8fafc);">Odd: <strong>${ap.odd}</strong> | Valor: <strong>R$ ${parseFloat(ap.valor || 0).toFixed(2).replace('.', ',')}</strong> | Retorno: <strong style="color: var(--accent-color, #10B981);">R$ ${parseFloat(ap.retorno || 0).toFixed(2).replace('.', ',')}</strong></div>
                    </div>
                    <div>
                        ${botaoStatsHtml}
                    </div>
                </div>
                ${secaoVerificacaoHtml}
            </div>
        `;
    });

    lista.innerHTML = html;
}

window.abrirHistorico = function() {
    const modal = document.getElementById('historyModal');
    if (!modal) return;

    modal.style.display = 'flex';

    const btnPendentes = document.getElementById('tabPendentes');
    const btnResolvidas = document.getElementById('tabResolvidas');
    if (btnPendentes && btnResolvidas) {
        btnPendentes.onclick = () => window.mudarAbaHistorico('pendentes');
        btnResolvidas.onclick = () => window.mudarAbaHistorico('resolvidas');
    }

    renderizarListaHistorico();
};

window.fecharHistorico = function() {
    const modal = document.getElementById('historyModal');
    if (modal) modal.style.display = 'none';
};
