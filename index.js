const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Nettoie les espaces ou guillemets éventuels et accepte plusieurs noms possibles
function lireEnv(noms) {
  for (const nom of noms) {
    const val = process.env[nom];
    if (typeof val === "string") {
      const propre = val.trim().replace(/^["']|["']$/g, "");
      if (propre.length > 0) {
        return { valeur: propre, source: nom };
      }
    }
  }
  return { valeur: "", source: null };
}

const tokenInfo = lireEnv(["DISCORD_TOKEN", "TOKEN", "BOT_TOKEN"]);
const apiUrlInfo = lireEnv(["API_URL"]);
const apiKeyInfo = lireEnv(["API_KEY"]);
const salonIdInfo = lireEnv(["SALON_ID"]);

const DISCORD_TOKEN = tokenInfo.valeur;
const API_URL = apiUrlInfo.valeur;
const API_KEY = apiKeyInfo.valeur;
const SALON_ID = salonIdInfo.valeur;

async function envoyerMessageSalon(texte) {
  if (!SALON_ID) return;
  try {
    const salon = await client.channels.fetch(SALON_ID);
    if (salon && salon.isTextBased()) {
      await salon.send(texte);
    }
  } catch (err) {
    console.error("Impossible d'envoyer le message dans le salon :", err.message);
  }
}

async function relancerServeur() {
  if (!API_URL || !API_KEY) {
    console.log("API_URL ou API_KEY manquante dans les variables d'environnement.");
    return;
  }

  try {
    const reponse = await axios.post(
      API_URL,
      {},
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    console.log("Appel API réussi. Statut :", reponse.status);
    await envoyerMessageSalon(`Demande de démarrage envoyée à l'API (statut HTTP : ${reponse.status}).`);
  } catch (erreur) {
    const codeStatut = erreur.response ? erreur.response.status : "sans réponse";
    console.error("Erreur lors de l'appel API :", codeStatut, erreur.message);
    await envoyerMessageSalon(`Échec de l'appel API (statut : ${codeStatut}).`);
  }
}

function demarrerCycle() {
  // 4 heures en millisecondes : 4h * 60m * 60s * 1000ms = 14 400 000 ms
  const QUATRE_HEURES = 4 * 60 * 60 * 1000;

  setInterval(() => {
    console.log("Déclenchement du cycle de 4 heures...");
    relancerServeur();
  }, QUATRE_HEURES);
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection :", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception :", err);
});

client.once("clientReady", () => {
  console.log(`Bot connecté en tant que ${client.user.tag} (via ${tokenInfo.source})`);
  demarrerCycle();
});

// Fallback si une version plus ancienne de discord.js émet "ready"
client.once("ready", () => {
  if (!client.user) return;
  console.log(`Bot connecté en tant que ${client.user.tag} (via ${tokenInfo.source})`);
  demarrerCycle();
});

if (!DISCORD_TOKEN) {
  console.error("ALERTE : Aucun token trouvé (DISCORD_TOKEN / TOKEN / BOT_TOKEN).");
  console.log("Noms des variables d'environnement détectées :", Object.keys(process.env));
  // On garde le processus actif 10 min pour lire les logs sans crash immédiat
  setInterval(() => {
    console.log("En attente d'une variable de token valide sur Railway...");
  }, 60 * 1000);
} else {
  console.log(`Token détecté via "${tokenInfo.source}" (longueur : ${DISCORD_TOKEN.length}). Connexion...`);
  client.login(DISCORD_TOKEN).catch((err) => {
    console.error("Échec de client.login :", err.message);
  });
}
