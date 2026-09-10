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

// Delegação de eventos global para garantir que os botões de estatísticas funcionem em qualquer aba
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
        if (window.firebaseAuth && window.firebaseDb && window.onAuthStateChanged) {
            clearInterval(checkReady);
            window.onAuthStateChanged(window.firebaseAuth, async (user) => {
                if (user) {
                    window.usuarioLogadoFirebase = user;
                    const { doc, onSnapshot } = window;
                    
                    onSnapshot(doc(window.firebaseDb, "usuarios", user.uid), async (docSnap) => {
                        if (docSnap.exists()) {
                            const data = docSnap.data();
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
                                window.abrirHistorico();
                            }
                        }
                    });
                } else {
                    window.usuarioLogadoFirebase = null;
                    historicoCacheNuvem = [];
                }
            });
        }
    }, 200);
}

window.atualizarSaldoUI = function() {
    const elSaldo = document.getElementById('userBalance');
    const valorAtual = typeof window.saldo !== 'undefined' ? window.saldo : 10000.00;
    
    if (elSaldo) {
        const valorFormatado = valorAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        elSaldo.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; white-space: nowrap; gap: 10px;">
                <span style="font-size: 0.85rem; color: #ffffff; font-weight: 500; text-transform: uppercase;">Saldo:</span>
                <span style="font-size: 0.95rem; font-weight: bold; color: var(--accent-color);">R$ ${valorFormatado}</span>
            </div>
        `;
    }
};

async function salvarEstadoNuvem(novoHistorico, novoSaldo) {
    if (!window.usuarioLogadoFirebase) return;
    try {
        const userRef = window.doc(window.firebaseDb, "usuarios", window.usuarioLogadoFirebase.uid);
        await window.updateDoc(userRef, {
            saldo: novoSaldo,
            historicoApostas: novoHistorico
        });
    } catch (e) {
        console.error("Erro ao salvar no Firestore:", e);
    }
}

window.registrarNovaApostaNoHistorico = async function(item) {
    if (!window.usuarioLogadoFirebase) {
        alert("Você precisa estar logado com o Google para apostar!");
        return;
    }

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

window.mudarAbaHistorico = function(aba) {
    abaHistoricoAtual = aba;
    const btnPendentes = document.getElementById('tabPendentes');
    const btnResolvidas = document.getElementById('tabResolvidas');

    if (btnPendentes && btnResolvidas) {
        if (aba === 'pendentes') {
            btnPendentes.style.background = 'var(--brand-orange)';
            btnPendentes.style.color = '#fff';
            btnPendentes.style.border = '1px solid var(--brand-orange)';
            
            btnResolvidas.style.background = 'transparent';
            btnResolvidas.style.color = 'var(--text-muted)';
            btnResolvidas.style.border = '1px solid var(--border-color)';
        } else {
            btnResolvidas.style.background = 'var(--brand-orange)';
            btnResolvidas.style.color = '#fff';
            btnResolvidas.style.border = '1px solid var(--brand-orange)';
            
            btnPendentes.style.background = 'transparent';
            btnPendentes.style.color = 'var(--text-muted)';
            btnPendentes.style.border = '1px solid var(--border-color)';
        }
    }
    window.abrirHistorico();
};

window.abrirHistorico = async function() {
    const modal = document.getElementById('historyModal');
    const lista = document.getElementById('historyList');
    if (!modal || !lista) return;

    modal.style.display = 'flex';
    lista.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2.5rem; gap: 10px; color: var(--text-muted);">
            <div style="width: 28px; height: 28px; border: 3px solid var(--border-color); border-top-color: var(--brand-orange); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
            <span style="font-size: 0.85rem;">Carregando suas apostas do banco...</span>
        </div>
    `;

    if (!document.getElementById('spinner-style')) {
        const spinnerStyle = document.createElement('style');
        spinnerStyle.id = 'spinner-style';
        spinnerStyle.innerHTML = `@keyframes spin { to { transform: rotate(360deg); } }`;
        document.head.appendChild(spinnerStyle);
    }

    if (!window.usuarioLogadoFirebase && window.firebaseAuth && window.firebaseAuth.currentUser) {
        window.usuarioLogadoFirebase = window.firebaseAuth.currentUser;
    }

    if (!window.usuarioLogadoFirebase) {
        lista.innerHTML = `<div class="empty-msg" style="color: var(--text-muted); text-align: center; padding: 1rem;">Faça login com o Google para ver suas apostas.</div>`;
        return;
    }

    const btnPendentes = document.getElementById('tabPendentes');
    const btnResolvidas = document.getElementById('tabResolvidas');
    if (btnPendentes && btnResolvidas) {
        btnPendentes.onclick = () => window.mudarAbaHistorico('pendentes');
        btnResolvidas.onclick = () => window.mudarAbaHistorico('resolvidas');
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
        <div style="background: var(--card-bg); border: 1px solid var(--border-color); padding: 0.6rem 0.9rem; border-radius: 6px; margin-bottom: 0.8rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem;">
            <span>👤 Conta: <strong style="color: var(--brand-teal);">${window.usuarioLogadoFirebase.displayName || 'Google User'}</strong></span>
            <span>💰 Saldo: <strong style="color: var(--accent-color);">R$ ${saldoFormatado}</strong></span>
        </div>
    `;

    if (itensFiltrados.length === 0) {
        html += `<div class="empty-msg" style="color: var(--text-muted); text-align: center; padding: 1.5rem;">Nenhuma aposta ${abaHistoricoAtual} encontrada.</div>`;
        lista.innerHTML = html;
        return;
    }

    itensFiltrados.forEach(ap => {
        let statusLower = (ap.status || 'pendente').trim().toLowerCase();
        let corStatus = 'var(--accent-color)';
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
            <button type="button" class="btn-ver-resultados" data-id-jogo="${ap.idJogo}" title="Ver Estatísticas da Partida" style="background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 6px; cursor: pointer; padding: 0.3rem 0.6rem; display: inline-flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 600; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--brand-orange)'; this.style.color='var(--brand-orange)';" onmouseout="this.style.borderColor='var(--border-color)'; this.style.color='var(--text-main)';">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--brand-orange);">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                <span>Resultados</span>
            </button>
        ` : '';

        html += `
            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); padding: 0.85rem; border-radius: 8px; font-size: 0.85rem; margin-bottom: 0.75rem;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; color: var(--text-muted); font-size: 0.75rem; margin-bottom: 0.4rem;">
                    <span>📅 ${ap.data}</span>
                    <span style="font-weight: bold; color: ${corStatus}; font-size: 0.82rem;">${textoStatus}</span>
                </div>
                <div style="font-weight: bold; color: var(--text-main); margin-bottom: 0.2rem; font-size: 0.9rem;">${ap.partida}</div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.4rem;">
                    <div>
                        <div style="font-size: 0.80rem; color: var(--text-muted); margin-bottom: 0.2rem;">Palpite: <strong style="color: var(--brand-orange);">${ap.selecao}</strong></div>
                        <div style="font-size: 0.80rem; color: var(--text-main);">Odd: <strong>${ap.odd}</strong> | Valor: <strong>R$ ${parseFloat(ap.valor || 0).toFixed(2).replace('.', ',')}</strong> | Retorno: <strong style="color: var(--accent-color);">R$ ${parseFloat(ap.retorno || 0).toFixed(2).replace('.', ',')}</strong></div>
                    </div>
                    <div>
                        ${botaoStatsHtml}
                    </div>
                </div>
            </div>
        `;
    });

    lista.innerHTML = html;
};

window.fecharHistorico = function() {
    const modal = document.getElementById('historyModal');
    if (modal) modal.style.display = 'none';
};