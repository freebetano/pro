import express from "express";
import admin from "firebase-admin";

// Carrega as credenciais da mesma forma que seu script de apuração
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
    const { readFileSync } = await import("fs");
    serviceAccount = JSON.parse(readFileSync(new URL('./serviceAccountKey.json', import.meta.url)));
}

// Inicializa o Firebase Admin caso ainda não esteja ativo
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const app = express();
app.use(express.json());

// Senha mestra do painel (pode vir de variável de ambiente ou padrão)
const ADMIN_SECRET = process.env.ADMIN_PANEL_KEY || "minhasenha123";

// Middleware simples para validar a chave de moderação
function verificarAdmin(req, res, next) {
    const authHeader = req.headers['x-admin-key'];
    if (!authHeader || authHeader !== ADMIN_SECRET) {
        return res.status(401).json({ erro: "Chave de administrador inválida." });
    }
    next();
}

// ROTA 1: Listar todas as apostas diretamente do Firestore
app.get("/api/apostas", verificarAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection("usuarios").get();
        let todasApostas = [];

        snapshot.forEach(doc => {
            const uid = doc.id;
            const dados = doc.data();
            const historico = Array.isArray(dados.historicoApostas) ? dados.historicoApostas : [];

            historico.forEach(ap => {
                todasApostas.push({
                    ...ap,
                    userId: uid,
                    userName: dados.nome || dados.displayName || `Usuário (${uid.substring(0, 5)})`
                });
            });
        });

        res.json(todasApostas);
    } catch (e) {
        console.error("Erro ao listar apostas:", e);
        res.status(500).json({ erro: e.message });
    }
});

// ROTA 2: Alterar status e sincronizar com o modelo da sua aplicação
app.post("/api/atualizar-status", verificarAdmin, async (req, res) => {
    const { userId, idUnico, novoStatus } = req.body;

    if (!userId || !idUnico || !novoStatus) {
        return res.status(400).json({ erro: "Parâmetros ausentes." });
    }

    try {
        const userRef = db.collection("usuarios").doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            return res.status(404).json({ erro: "Usuário não encontrado." });
        }

        const data = userDoc.data();
        let historico = Array.isArray(data.historicoApostas) ? data.historicoApostas : [];
        let saldoAtual = typeof data.saldo === 'number' ? data.saldo : 10000.00;

        const aposta = historico.find(a => a.idUnico === idUnico);
        if (!aposta) {
            return res.status(404).json({ erro: "Aposta não encontrada no histórico." });
        }

        const statusAnterior = (aposta.status || "pendente").trim().toLowerCase();
        const statusNovo = novoStatus.trim().toLowerCase();
        const retornoVal = parseFloat(aposta.retorno || 0);

        // Se reverter uma aposta que já havia sido creditada no cliente
        if (statusAnterior === 'ganha' && aposta.recompensado && statusNovo !== 'ganha') {
            saldoAtual -= retornoVal;
            if (saldoAtual < 0) saldoAtual = 0;
            aposta.recompensado = false;
        }

        // Se o admin aprovar como Ganha e ela ainda não foi recompensada
        if (statusNovo === 'ganha' && !aposta.recompensado) {
            saldoAtual += retornoVal;
            aposta.recompensado = true;
        }

        // Reseta o gatilho de solicitação de verificação se foi reavaliada
        if (statusNovo !== 'pendente') {
            aposta.jaPediuVerificacao = true;
        }

        aposta.status = novoStatus;

        await userRef.update({
            historicoApostas: historico,
            saldo: saldoAtual
        });

        console.log(`[ADMIN] Aposta ${idUnico} do usuário ${userId} alterada para: ${novoStatus}`);
        res.json({ sucesso: true, status: novoStatus });
    } catch (e) {
        console.error("Erro ao alterar aposta:", e);
        res.status(500).json({ erro: e.message });
    }
});

// Serve a interface web
app.use(express.static("public"));

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`\n🚀 Painel Administrativo rodando em: http://localhost:${PORT}/admin.html`);
});
