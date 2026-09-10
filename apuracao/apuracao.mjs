import { GoogleGenAI } from "@google/genai";
import admin from "firebase-admin";

// Carrega as credenciais do Firebase (via variável de ambiente na nuvem ou arquivo local)
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
    const { readFileSync } = await import("fs");
    serviceAccount = JSON.parse(readFileSync(new URL('./serviceAccountKey.json', import.meta.url)));
}

// Inicializa o Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "AIzaSyDfO3OgLopr1H5lSzDf8Ee2kswU6xRFwlw" });

async function rodarBotApurgacao() {
    console.log(`\n[${new Date().toLocaleTimeString('pt-BR')}] 🔍 Iniciando ciclo de varredura no Firestore...`);

    try {
        const usuariosSnapshot = await db.collection("usuarios").get();
        
        if (usuariosSnapshot.empty) {
            console.log("Nenhum usuário encontrado no banco.");
            return;
        }

        for (const docUser of usuariosSnapshot.docs) {
            const userId = docUser.id;
            const dadosUser = docUser.data();
            let historico = dadosUser.historicoApostas || [];
            let houveAlteracao = false;

            console.log(`\n👤 Verificando usuário: ${userId}`);

            for (let i = 0; i < historico.length; i++) {
                let aposta = historico[i];
                let statusAtual = (aposta.status || "").trim().toLowerCase();

                // Processa apenas as apostas que estão pendentes
                if (statusAtual === "pendente") {
                    console.log(`    ⏳ Analisando dados via JSON oficial: [${aposta.partida}] -> Palpite: "${aposta.selecao}"`);

                    // Consulta o Gemini passando o JSON estruturado obtido através da urlStats
                    const vereditoGemini = await consultarGeminiComJson(aposta);

                    console.log(`    🤖 Veredito do Gemini: ${vereditoGemini.status} (${vereditoGemini.motivo})`);

                    // Se o Gemini definiu como Ganha ou Perdida, atualiza o status na aposta
                    if (vereditoGemini.status === "Ganha" || vereditoGemini.status === "Perdida") {
                        aposta.status = vereditoGemini.status;
                        houveAlteracao = true;
                    }
                }
            }

            // Se alguma aposta mudou de status, salva o array atualizado no Firestore
            if (houveAlteracao) {
                await db.collection("usuarios").doc(userId).update({
                    historicoApostas: historico
                });
                console.log(`    ✅ Firestore atualizado para o usuário ${userId}! O front-end calculará o saldo automaticamente.`);
            } else {
                console.log(`    ✨ Nenhuma alteração necessária para este usuário.`);
            }
        }

        console.log(`\n[${new Date().toLocaleTimeString('pt-BR')}] 🏁 Ciclo concluído.`);

    } catch (error) {
        console.error("❌ Erro ao processar apuração no banco:", error);
    }
}

async function consultarGeminiComJson(aposta) {
    // Extrai o ID exato diretamente do campo urlStats salvo no banco
    const match = (aposta.urlStats || "").match(/\/([a-f0-9]{24})\/main/i);
    const gameId = match ? match[1] : null;

    if (!gameId) {
        console.log(`    ⚠️ Aposta ignorada: Não foi possível extrair o gameId de urlStats.`);
        return { status: "Pendente", motivo: "URL de estatísticas inválida ou sem gameId" };
    }

    const url = `https://eventsstat.com/en/services-api/SiteService/Game?gameId=${gameId}&ln=pt`;
    
    console.log(`    🌐 Baixando dados oficiais da API: ${url}`);
    
    try {
        const responseApi = await fetch(url);
        const dadosPartida = await responseApi.json();
        
        const prompt = `
            Você é um motor analítico de apuração de apostas esportivas altamente técnico e preciso.
            
            Analise o JSON oficial da partida fornecido abaixo e determine o status exato da aposta.
            - Partida: "${aposta.partida}"
            - Palpite do usuário: "${aposta.selecao}"
            - Dados oficiais da partida (JSON): ${JSON.stringify(dadosPartida)}

            Regras estritas para definir o status:
            1. "Pendente": Se o jogo ainda não terminou ou o JSON indicar que está em andamento.
            2. "Ganha": Se os dados do JSON provam inquestionavelmente que a condição do palpite ("${aposta.selecao}") ocorreu.
            3. "Perdida": Se os dados do JSON provam que o evento terminou e o palpite NÃO ocorreu.

            Responda APENAS em formato JSON estrito, sem blocos de código markdown ou textos adicionais, exatamente assim:
            {
                "status": "Ganha" (ou "Perdida" ou "Pendente"),
                "motivo": "Explicação técnica curta baseada nos dados do JSON"
            }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        const textoLimpo = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(textoLimpo);

    } catch (error) {
        console.error("Erro ao buscar dados da API ou processar com o Gemini:", error);
        return { status: "Pendente", motivo: "Erro ao consultar API de resultados" };
    }
}

// Executa a apuração imediatamente ao chamar o script
rodarBotApurgacao();
