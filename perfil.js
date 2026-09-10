// ==========================================
// MÓDULO EXCLUSIVO - GESTÃO DE PERFIL E FIREBASE (PERFIL.JS)
// ==========================================

(function() {
    window.usuarioLogadoFirebase = null;
    window.saldo = 10000.00;

    window.mostrarToast = function(mensagem, tipo = 'info') {
        let containerToast = document.getElementById('toastContainerModerno');
        if (!containerToast) {
            containerToast = document.createElement('div');
            containerToast.id = 'toastContainerModerno';
            containerToast.style.cssText = `
                position: fixed; top: 20px; right: 20px; z-index: 99999;
                display: flex; flex-direction: column; gap: 10px; pointer-events: none;
            `;
            document.body.appendChild(containerToast);
        }

        const corBorda = tipo === 'erro' ? '#ef4444' : (tipo === 'sucesso' ? '#10b981' : 'var(--brand-orange, #f75c2e)');
        
        const toast = document.createElement('div');
        toast.style.cssText = `
            background: #161922; color: #fff; border: 1px solid rgba(255,255,255,0.12);
            border-left: 4px solid ${corBorda}; padding: 0.8rem 1.1rem; border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.6); font-size: 0.85rem; font-weight: 500;
            pointer-events: auto; backdrop-filter: blur(10px); opacity: 0; transform: translateY(-10px);
            transition: opacity 0.3s ease, transform 0.3s ease; max-width: 300px;
        `;
        toast.innerText = mensagem;
        containerToast.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 10);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    };

    window.mostrarModalConfirmacaoCustomizado = function(titulo, texto, corBotaoConfirmar, callbackConfirmar) {
        let modalOverlay = document.getElementById('customConfirmModalOverlay');
        if (modalOverlay) modalOverlay.remove();

        modalOverlay = document.createElement('div');
        modalOverlay.id = 'customConfirmModalOverlay';
        modalOverlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(6px);
            display: flex; align-items: center; justify-content: center; z-index: 100000;
            animation: fadeInModal 0.2s ease;
        `;

        modalOverlay.innerHTML = `
            <div style="background: #12151d; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; padding: 1.5rem; width: 340px; box-shadow: 0 15px 40px rgba(0,0,0,0.8); font-family: inherit; text-align: center;">
                <h3 style="color: #fff; font-size: 1.05rem; margin-bottom: 0.5rem; font-weight: 700;">${titulo}</h3>
                <p style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 1.2rem; line-height: 1.4;">${texto}</p>
                <div style="display: flex; gap: 10px;">
                    <button id="btnModalCancelarCustom" style="flex: 1; background: #1e222d; color: #fff; border: 1px solid rgba(255,255,255,0.08); padding: 0.6rem; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.85rem;">Cancelar</button>
                    <button id="btnModalConfirmarCustom" style="flex: 1; background: ${corBotaoConfirmar}; color: #fff; border: none; padding: 0.6rem; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.85rem; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">Confirmar</button>
                </div>
            </div>
        `;

        document.body.appendChild(modalOverlay);

        document.getElementById('btnModalCancelarCustom').onclick = () => modalOverlay.remove();
        document.getElementById('btnModalConfirmarCustom').onclick = () => {
            modalOverlay.remove();
            if (typeof callbackConfirmar === 'function') callbackConfirmar();
        };
    };

    // Monitora o estado de autenticação do Firebase em tempo real
    window.addEventListener('DOMContentLoaded', () => {
        const checkFirebaseReady = setInterval(() => {
            if (window.firebaseAuth && window.onAuthStateChanged) {
                clearInterval(checkFirebaseReady);
                
                onAuthStateChanged(window.firebaseAuth, async (user) => {
                    if (user) {
                        window.usuarioLogadoFirebase = user;
                        await carregarOuCriarDadosUsuarioFirestore(user);
                    } else {
                        window.usuarioLogadoFirebase = null;
                        window.saldo = 10000.00;
                        if (typeof atualizarSaldoUI === 'function') atualizarSaldoUI();
                    }
                    if (typeof atualizarBadgeIconePerfil === 'function') atualizarBadgeIconePerfil();
                });
            }
        }, 100);
    });

    async function carregarOuCriarDadosUsuarioFirestore(user) {
        const userRef = doc(window.firebaseDb, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            // Novo usuário: Cria com 10.000 de crédito inicial e histórico vazio
            await setDoc(userRef, {
                nome: user.displayName || "Usuário",
                email: user.email,
                saldo: 10000.00,
                historicoApostas: []
            });
            window.saldo = 10000.00;
        } else {
            const data = userSnap.data();
            window.saldo = typeof data.saldo === 'number' ? data.saldo : 10000.00;
        }

        if (typeof atualizarSaldoUI === 'function') atualizarSaldoUI();
    }

    window.fazerLoginGoogle = async function() {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(window.firebaseAuth, provider);
            window.mostrarToast("✨ Login realizado com sucesso!", "sucesso");
            setTimeout(() => location.reload(), 600);
        } catch (error) {
            console.error(error);
            window.mostrarToast("Erro ao realizar login com o Google.", "erro");
        }
    };

    window.deslogarPerfil = async function() {
        const dropdown = document.getElementById('profileDropdown');
        if (dropdown) dropdown.style.display = 'none';

        window.mostrarModalConfirmacaoCustomizado(
            "Sair da Conta",
            "Deseja realmente sair da sua sessão?",
            "var(--brand-orange, #f75c2e)",
            async () => {
                try {
                    await signOut(window.firebaseAuth);
                    window.mostrarToast("Sessão encerrada com sucesso.", "info");
                    setTimeout(() => location.reload(), 600);
                } catch(e) {
                    window.mostrarToast("Erro ao sair da conta.", "erro");
                }
            }
        );
    };

    window.toggleMenuPerfil = function(event) {
        if (event) event.stopPropagation();
        let dropdown = document.getElementById('profileDropdown');
        
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.id = 'profileDropdown';
            dropdown.style.cssText = `
                position: absolute; right: 0; top: 48px; background: #111;
                border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 0.85rem;
                width: 275px; box-shadow: 0 12px 35px rgba(0,0,0,0.8); z-index: 1100; display: none;
                backdrop-filter: blur(12px); font-family: inherit; box-sizing: border-box;
            `;
            const profileBtn = document.querySelector('.profile-icon');
            if (profileBtn && profileBtn.parentElement) {
                profileBtn.parentElement.style.position = 'relative';
                profileBtn.parentElement.appendChild(dropdown);
            } else {
                document.body.appendChild(dropdown);
            }
        }

        renderizarConteudoDropdownPerfil(dropdown);
        const isOpen = dropdown.style.display === 'block';
        dropdown.style.display = isOpen ? 'none' : 'block';
    };

   function renderizarConteudoDropdownPerfil(dropdown) {
        if (!window.usuarioLogadoFirebase) {
            dropdown.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 1rem; box-sizing: border-box; padding: 0.2rem;" onclick="event.stopPropagation()">
                    <div style="display: flex; align-items: center; gap: 12px; padding: 0.8rem; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px;">
                        <div style="width: 38px; height: 38px; background: linear-gradient(135deg, rgba(247, 92, 46, 0.2), rgba(247, 92, 46, 0.05)); border: 1px solid rgba(247, 92, 46, 0.3); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: var(--brand-orange, #f75c2e); font-weight: bold; font-size: 1.1rem; flex-shrink: 0;">G</div>
                        <div style="overflow: hidden; display: flex; flex-direction: column; gap: 2px;">
                            <span style="font-size: 0.9rem; font-weight: 700; color: #ffffff; line-height: 1.2;">Conta Google</span>
                            <span style="font-size: 0.75rem; color: #94a3b8; line-height: 1.3;">Conecte para começar</span>
                        </div>
                    </div>
                    <button onclick="fazerLoginGoogle()" style="background: linear-gradient(135deg, #f75c2e 0%, #e04b20 100%); color: white; border: none; padding: 0.75rem 1rem; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 0.9rem; width: 100%; box-shadow: 0 6px 20px rgba(247, 92, 46, 0.35); text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span>Entrar com o Google</span>
                    </button>
                </div>
            `;
        } else {
            const user = window.usuarioLogadoFirebase;
            const saldoFormatado = window.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            const qtdAbertas = typeof obterQuantidadeApostasAbertas === 'function' ? obterQuantidadeApostasAbertas() : 0;
            const nomeExibicao = user.displayName || user.email || 'Usuário';

            // Aumentamos a largura base do dropdown inline para acomodar perfeitamente os textos longos
            dropdown.style.width = '310px';

            dropdown.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 0.75rem; box-sizing: border-box; padding: 0.2rem;" onclick="event.stopPropagation()">
                    
                    <!-- Perfil Logado com quebra limpa do nome -->
                    <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 0.8rem 0.9rem; display: flex; align-items: center; gap: 12px;">
                        <img src="${user.photoURL || ''}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;" onerror="this.style.display='none'">
                        <div style="display: flex; flex-direction: column; overflow: hidden; width: 100%;">
                            <span style="font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">CONTA</span>
                            <span style="font-size: 0.88rem; color: #fff; font-weight: 600; line-height: 1.3; word-break: break-word; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${nomeExibicao}</span>
                        </div>
                    </div>

                    <!-- Saldo Disponível Organizado -->
                    <div style="background: rgba(23, 145, 114, 0.08); border: 1px solid rgba(23, 145, 114, 0.25); border-radius: 12px; padding: 0.8rem 0.9rem; display: flex; flex-direction: column; gap: 4px;">
                        <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">Saldo Disponível</span>
                        <span style="font-size: 1.15rem; color: var(--accent-color, #10b981); font-weight: 800; letter-spacing: 0.3px;">R$ ${saldoFormatado}</span>
                    </div>

                    <!-- Menu de Opções -->
                    <div style="display: flex; flex-direction: column; gap: 0.45rem; margin-top: 0.2rem;">
                        <button onclick="abrirBoletimApostasMenu()" style="background: rgba(255, 255, 255, 0.03); color: #fff; border: 1px solid rgba(255, 255, 255, 0.06); padding: 0.75rem 0.9rem; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 0.85rem; text-align: left; display: flex; align-items: center; justify-content: space-between; transition: background 0.2s;" onmouseover="this.style.background='rgba(255, 255, 255, 0.06)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.03)'">
                            <span>Boletim de Apostas</span>
                            <span style="background: var(--brand-orange, #f75c2e); color: #fff; font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 10px;">${qtdAbertas}</span>
                        </button>

                        <button onclick="deslogarPerfil()" style="background: rgba(239, 68, 68, 0.06); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.15); padding: 0.75rem 0.9rem; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 0.85rem; text-align: left; transition: background 0.2s;" onmouseover="this.style.background='rgba(239, 68, 68, 0.12)'" onmouseout="this.style.background='rgba(239, 68, 68, 0.06)'">
                            Sair da Conta
                        </button>
                    </div>
                </div>
            `;
        }
    }

    window.abrirBoletimApostasMenu = function() {
        const dropdown = document.getElementById('profileDropdown');
        if (dropdown) dropdown.style.display = 'none';
        if (typeof abrirHistorico === 'function') abrirHistorico();
    };

    window.addEventListener('click', function(event) {
        const dropdown = document.getElementById('profileDropdown');
        if (dropdown && !dropdown.contains(event.target) && !event.target.closest('.profile-icon')) {
            dropdown.style.display = 'none';
        }
    });
})();