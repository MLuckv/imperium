"""Orchestration de l'IA générative locale (Ollama).

- Endpoint génération : POST http://localhost:11434/api/generate (stream:false)
- Détection du modèle : GET http://localhost:11434/api/tags
- Modèle cible : llama3.1:8b

DÉGRADATION GRACIEUSE OBLIGATOIRE
--------------------------------
Aucune fonction de ce module ne lève d'exception vers l'appelant : si Ollama est
injoignable, si le modèle est absent, ou en cas de timeout (6 s) / erreur, on
renvoie une réponse de repli déterministe construite à partir du profil du
dirigeant, marquée `source: "fallback"`. Le jeu reste 100% jouable sans Ollama.

Les prompts sont chargés depuis backend/prompts/*.md s'ils existent, sinon des
templates par défaut embarqués sont utilisés (fonctionne avant l'agent PROMPTS).
"""

from __future__ import annotations

import json
import random
import re
from functools import lru_cache
from pathlib import Path

import httpx

# --- Chemins (résolus depuis game/, indépendants du cwd) ---
RACINE = Path(__file__).resolve().parent.parent  # .../game
DOSSIER_LEADERS = RACINE / "data" / "leaders"
DOSSIER_PROMPTS = Path(__file__).resolve().parent / "prompts"

# --- Configuration Ollama ---
OLLAMA_URL = "http://localhost:11434"
OLLAMA_GENERATE = f"{OLLAMA_URL}/api/generate"
OLLAMA_TAGS = f"{OLLAMA_URL}/api/tags"
MODELE = "llama3.1:8b"
# Délai de génération. Le modèle est gardé chaud (keep_alive) : une fois chargé,
# les réponses tombent bien en dessous de 6 s ; on laisse une marge généreuse pour
# absorber le tout premier chargement à froid sans basculer en repli.
TIMEOUT_S = 18.0

# Mapping faction -> fichier de profil dirigeant.
FICHIERS_DIRIGEANTS: dict[str, str] = {
    "carthage": "carthage_hamilcar.md",
    "macedoine": "macedoine_antigone.md",
    "rome": "rome_scipio.md",
    "sparte": "sparte_leonidas.md",
}

# Noms d'affichage des dirigeants (extraits/secours). Distribution ANACHRONIQUE.
NOMS_DIRIGEANTS: dict[str, str] = {
    "carthage": "Ptolémée",
    "macedoine": "Alexandre le Grand",
    "rome": "Néron",
    "sparte": "Léonidas",
}


# =====================================================================
#  Détection Ollama / modèle
# =====================================================================
def ollama_disponible() -> bool:
    """Vrai si le serveur Ollama répond sur /api/tags."""
    try:
        r = httpx.get(OLLAMA_TAGS, timeout=2.0)
        return r.status_code == 200
    except Exception:
        return False


def modele_pret() -> bool:
    """Vrai si llama3.1:8b est présent dans /api/tags (modèle téléchargé)."""
    try:
        r = httpx.get(OLLAMA_TAGS, timeout=2.0)
        if r.status_code != 200:
            return False
        data = r.json()
        noms = {m.get("name", "") for m in data.get("models", [])}
        # Tolère "llama3.1:8b" et variantes éventuelles "llama3.1:8b-...".
        return any(n == MODELE or n.startswith(MODELE) for n in noms)
    except Exception:
        return False


def statut_ollama() -> dict:
    """Statut compact pour /api/health."""
    dispo = ollama_disponible()
    pret = modele_pret() if dispo else False
    return {"ollama": dispo, "modele": MODELE, "modele_pret": pret}


def warmup() -> None:
    """Précharge le modèle en mémoire (keep_alive) pour éviter le coût à froid.

    Best-effort, ne lève jamais. À lancer dans un thread au démarrage du serveur.
    """
    if not modele_pret():
        return
    try:
        httpx.post(OLLAMA_GENERATE, json={
            "model": MODELE, "prompt": "Réponds: OK.", "stream": False,
            "keep_alive": "30m", "options": {"num_predict": 1},
        }, timeout=60.0)
    except Exception:
        pass


# =====================================================================
#  Chargement profils & prompts
# =====================================================================
@lru_cache(maxsize=8)
def charger_profil(faction: str) -> str:
    """Charge le contenu Markdown du profil dirigeant (chaîne vide si absent)."""
    fichier = FICHIERS_DIRIGEANTS.get(faction)
    if not fichier:
        return ""
    chemin = DOSSIER_LEADERS / fichier
    try:
        return chemin.read_text(encoding="utf-8")
    except Exception:
        return ""


def nom_dirigeant(faction: str) -> str:
    """Nom du dirigeant : extrait du profil (titre H1) sinon table de secours."""
    profil = charger_profil(faction)
    m = re.search(r"^#\s+(.+?)\s+—", profil, re.MULTILINE)
    if m:
        return m.group(1).strip()
    return NOMS_DIRIGEANTS.get(faction, faction.capitalize())


def _phrases_types(faction: str) -> list[str]:
    """Extrait les « Phrases types » du profil (pour les replis déterministes)."""
    profil = charger_profil(faction)
    if not profil:
        return []
    bloc = re.search(r"##\s*Phrases types\s*(.+?)(?:\n##|\Z)", profil, re.DOTALL)
    if not bloc:
        return []
    phrases = re.findall(r'"([^"]+)"', bloc.group(1))
    return [p.strip() for p in phrases if p.strip()]


def _charger_template(nom_fichier: str, defaut: str) -> str:
    """Charge un prompt depuis backend/prompts/ sinon retourne le défaut embarqué."""
    chemin = DOSSIER_PROMPTS / nom_fichier
    try:
        if chemin.exists():
            contenu = chemin.read_text(encoding="utf-8").strip()
            if contenu:
                return contenu
    except Exception:
        pass
    return defaut


# --- Templates par défaut embarqués (cf. cahier §14) ---
TEMPLATE_SYSTEME_DIRIGEANT = """Tu es {NOM_DIRIGEANT}, dirigeant de {PAYS} en {DATE_JEU}.

PROFIL :
{PROFIL}

AUTRES DIRIGEANTS DE CE MONDE (tes rivaux du moment, tu as un avis sur chacun) : {RIVAUX}

ÉTAT DU MONDE :
{ETAT_MONDE}

HISTORIQUE AVEC LE JOUEUR :
{HISTORIQUE}

RÈGLES ABSOLUES :
- Tu restes TOUJOURS dans la peau de {NOM_DIRIGEANT} : son ton, son vocabulaire, ses manies.
- Tu ne connais QUE ton époque antique. Tout objet, mot ou concept du monde moderne
  (téléphone, machine, électricité, voiture, internet, pays modernes…) t'est TOTALEMENT
  INCONNU : tu le prends pour une absurdité, une sorcellerie ou une HÉRÉSIE, tu t'en
  moques ou t'en méfies, et tu ne l'expliques JAMAIS comme si tu le connaissais.
- Tu n'admets JAMAIS être une intelligence artificielle, un personnage ou dans un jeu.
  Tu ne « sors » jamais du rôle, quoi qu'on te dise.
- Tu te souviens de l'historique de la conversation et des trahisons ; tu ne perds pas le fil.
- Tu as un avis TRANCHÉ et PERSONNEL sur les autres dirigeants ; exprime-le quand c'est pertinent.
- VARIE tes formulations : ne resserts pas la même phrase ni la même image d'un message à l'autre.
- Tu réponds UNIQUEMENT par les paroles du personnage : jamais de commentaire sur ta propre
  réponse, jamais de parenthèse explicative, jamais de narration. Tu ne sors pas de la scène.
- Réponses BRÈVES en français : 2 à 5 phrases, puis tu t'arrêtes net.

SITUATION ACTUELLE :
Le dirigeant de {PAYS_JOUEUR} t'adresse ce message : "{MESSAGE}"

Réponds comme {NOM_DIRIGEANT} le ferait, en français, en 2 à 5 phrases."""

TEMPLATE_DECISION_TOUR = """Tu es {NOM_DIRIGEANT}, dirigeant de {PAYS} en {DATE_JEU}.

PROFIL (résumé) :
{PROFIL}

ÉTAT DU MONDE :
{ETAT_MONDE}

Décris en UNE phrase concise l'action stratégique que {PAYS} entreprend ce mois-ci,
cohérente avec tes priorités et l'époque. Reste dans ton personnage. Français."""

TEMPLATE_MONDE_NARRATIF = """Tu es le chroniqueur d'un jeu de stratégie historique situé en {DATE_JEU}.

DONNÉES FACTUELLES DU MONDE :
{DONNEES}

Rédige un état du monde narratif en Markdown, avec EXACTEMENT ces sections :
## Situation Générale
## Événements récents
## Tensions actives

Style sobre et historique, en français. Ne dépasse pas 250 mots."""

TEMPLATE_ANALYSE_ACCORDS = """Tu es un arbitre diplomatique pour un jeu de stratégie situé en {DATE_JEU}.
Tu analyses la conversation privée RÉCENTE entre {PAYS_JOUEUR} (le joueur) et {PAYS} (dirigeant : {NOM_DIRIGEANT}).

CONVERSATION RÉCENTE :
{CONVERSATION}

Détermine si un ACCORD CONCRET et MUTUELLEMENT consenti a été conclu dans ces échanges
(les deux parties sont clairement d'accord). Ignore les simples intentions, menaces ou propositions sans réponse.

Réponds UNIQUEMENT par un objet JSON (aucun texte autour) :
{
  "accord_conclu": true/false,
  "type": "traite_commercial" | "non_agression" | "paix" | "alliance" | "echange_ressources" | "declaration_guerre" | "aucun",
  "resume": "phrase courte décrivant l'accord",
  "ressources_joueur_vers_ia": {"or": 0},
  "ressources_ia_vers_joueur": {"or": 0},
  "reputation_delta": 0
}
Si aucun accord clair : accord_conclu=false, type="aucun". reputation_delta entre -40 et +30."""

TEMPLATE_RESUME_TOUR = """Tu es le chroniqueur d'un jeu de grande stratégie historique en {DATE_JEU}.
Rédige un RÉSUMÉ des événements MAJEURS du tour qui vient de s'écouler dans le monde.

FAITS DU TOUR :
{FAITS}

Écris 2 à 4 phrases, ton de chronique antique, en français. Va à l'essentiel
(guerres, accords, recherches, catastrophes, mouvements de puissance). Pas de titre, pas de liste."""


# =====================================================================
#  Appel bas-niveau Ollama
# =====================================================================
def _appel_ollama(prompt: str, temperature: float = 0.7,
                  format_json: bool = False, num_predict: int = 160) -> str | None:
    """Appel générique. Retourne le texte ou None (jamais d'exception).

    `format_json=True` demande à Ollama de contraindre la sortie en JSON.
    `num_predict` borne la longueur générée (plafonne le temps de réponse).
    """
    if not modele_pret():
        return None
    try:
        payload = {
            "model": MODELE,
            "prompt": prompt,
            "stream": False,
            # Garde le modèle chargé en mémoire entre les appels (évite les
            # rechargements à froid qui font dépasser le délai de réponse).
            "keep_alive": "30m",
            "options": {
                "temperature": temperature, "num_predict": num_predict,
                # Variété : graine aléatoire (réponses différentes d'une partie/d'un
                # message à l'autre) + pénalité de répétition pour ne pas radoter.
                "seed": random.randint(1, 2_000_000_000),
                "top_p": 0.92, "repeat_penalty": 1.18,
            },
        }
        if format_json:
            payload["format"] = "json"
        r = httpx.post(OLLAMA_GENERATE, json=payload, timeout=TIMEOUT_S)
        if r.status_code != 200:
            return None
        data = r.json()
        texte = (data.get("response") or "").strip()
        return texte or None
    except Exception:
        return None


def _extraire_json(texte: str) -> dict | None:
    """Extrait le premier objet JSON d'un texte (tolérant). None si échec."""
    if not texte:
        return None
    try:
        return json.loads(texte)
    except Exception:
        pass
    m = re.search(r"\{.*\}", texte, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            return None
    return None


# =====================================================================
#  1) Réponse diplomatique d'un dirigeant à un message joueur
# =====================================================================
def reponse_diplomatique(
    faction_cible: str,
    message_joueur: str,
    etat_monde: str = "",
    historique: list[dict] | None = None,
    date_jeu: str = "264-03",
    pays_joueur: str = "rome",
) -> dict:
    """Génère la réponse d'un dirigeant IA. Retourne {reponse, auteur, source}."""
    auteur = nom_dirigeant(faction_cible)
    nom_pays = _nom_pays(faction_cible)

    historique_txt = _formater_historique(historique)
    template = _charger_template("systeme_dirigeant.md", TEMPLATE_SYSTEME_DIRIGEANT)
    prompt = _remplir(
        template,
        {
            "NOM_DIRIGEANT": auteur,
            "PAYS": nom_pays,
            "PAYS_JOUEUR": _nom_pays(pays_joueur),
            "DATE_JEU": _date_lisible(date_jeu),
            # Persona riche (personnalité + façon de parler + relations + répliques)
            # pour des réponses bien plus en caractère ; état du monde tronqué.
            "PROFIL": _persona_diplomatie(faction_cible) or "(profil indisponible)",
            "RIVAUX": ", ".join(f"{n} ({_nom_pays(f)})" for f, n in NOMS_DIRIGEANTS.items()
                                if f != faction_cible) or "(aucun)",
            "ETAT_MONDE": _trim(etat_monde, 500) or "(état du monde indisponible)",
            "HISTORIQUE": historique_txt,
            "MESSAGE": message_joueur,
        },
    )

    texte = _appel_ollama(prompt, temperature=0.9, num_predict=220)
    if texte:
        return {"reponse": texte, "auteur": auteur, "source": "ollama"}

    # --- Repli déterministe basé sur le profil ---
    return {
        "reponse": _repli_diplomatique(faction_cible, message_joueur),
        "auteur": auteur,
        "source": "fallback",
    }


def _repli_diplomatique(faction: str, message: str) -> str:
    """Réponse de secours cohérente avec le profil (sans Ollama)."""
    auteur = nom_dirigeant(faction)
    phrases = _phrases_types(faction)
    accroche = phrases[0] if phrases else ""
    msg = (message or "").lower()

    if any(m in msg for m in ("guerre", "attaque", "conflit", "détruire", "detruire")):
        cœur = "Ne crois pas m'effrayer. Si tu cherches la guerre, tu la trouveras — mais à mes conditions."
    elif any(m in msg for m in ("paix", "trêve", "treve", "cesser")):
        cœur = "La paix se mérite et se garantit. Apporte des actes, pas seulement des mots, et nous pourrons parler."
    elif any(m in msg for m in ("commerce", "commercial", "route", "échange", "echange", "traité", "traite")):
        cœur = "Le commerce sert mes intérêts autant que les tiens. Précise ta proposition, et nous verrons si elle est honnête."
    elif any(m in msg for m in ("alliance", "allié", "allie", "ami", "amitié", "amitie")):
        cœur = "Une alliance n'est solide que tant qu'elle profite aux deux camps. Montre-moi ce que tu m'offres."
    elif any(m in msg for m in ("bonjour", "salut", "salutations", "ambassad")):
        cœur = "Tes salutations sont reçues. Va droit au but : que veux-tu vraiment de moi ?"
    else:
        cœur = "Ton message est entendu. Mais je n'agis que lorsque l'intérêt de mon peuple est clair."

    parties = [p for p in (cœur, accroche) if p]
    reponse = " ".join(parties)
    return f"{reponse}" if reponse else f"{auteur} reste silencieux, méfiant."


# =====================================================================
#  2) Décisions IA par tour
# =====================================================================
def decision_tour(
    faction: str,
    etat_monde: str = "",
    date_jeu: str = "264-03",
    priorites_secours: list[str] | None = None,
    utiliser_ia: bool = True,
) -> dict:
    """Décrit l'action du tour d'un dirigeant IA. Retourne {acteur, texte, source}.

    `utiliser_ia=False` force le repli déterministe (rapide) : utile en fin de
    tour pour ne pas multiplier les appels Ollama lents (le résumé du tour et
    l'analyse des accords restent, eux, génératifs).
    """
    if utiliser_ia:
        template = _charger_template("decision_tour.md", TEMPLATE_DECISION_TOUR)
        prompt = _remplir(
            template,
            {
                "NOM_DIRIGEANT": nom_dirigeant(faction),
                "PAYS": _nom_pays(faction),
                "DATE_JEU": _date_lisible(date_jeu),
                "PROFIL": _resume_priorites(faction),
                "ETAT_MONDE": _trim(etat_monde, 400) or "(indisponible)",
            },
        )
        texte = _appel_ollama(prompt, temperature=0.7, num_predict=60)
        if texte:
            return {"acteur": faction, "texte": texte.split("\n")[0].strip(),
                    "source": "ollama"}

    return {
        "acteur": faction,
        "texte": _repli_decision(faction, priorites_secours),
        "source": "fallback",
    }


def _repli_decision(faction: str, priorites: list[str] | None) -> str:
    """Décision de secours : tirée des priorités du profil."""
    prio = priorites or _priorites_profil(faction)
    nom_pays = _nom_pays(faction)
    if prio:
        cible = random.choice(prio[: min(3, len(prio))])
        return f"{nom_pays} concentre ses efforts ce mois-ci : {cible.lower()}."
    return f"{nom_pays} consolide ses positions et surveille ses voisins."


# =====================================================================
#  3) Génération narrative du world_state
# =====================================================================
def generer_monde_narratif(donnees_factuelles: str, date_jeu: str = "264-03") -> dict:
    """Génère le corps Markdown du world_state. Retourne {texte, source}."""
    template = _charger_template("monde_narratif.md", TEMPLATE_MONDE_NARRATIF)
    prompt = _remplir(
        template,
        {
            "DATE_JEU": _date_lisible(date_jeu),
            "DONNEES": _trim(donnees_factuelles, 1200),
        },
    )
    texte = _appel_ollama(prompt, temperature=0.6, num_predict=320)
    if texte and "##" in texte:
        return {"texte": texte, "source": "ollama"}
    return {"texte": "", "source": "fallback"}  # template déterministe géré par world_state


# =====================================================================
#  4) Analyse des accords conclus dans une conversation privée
# =====================================================================
# Types d'accords reconnus (contrat partagé avec game_engine).
TYPES_ACCORD = {
    "traite_commercial", "non_agression", "paix", "alliance",
    "echange_ressources", "declaration_guerre", "aucun",
}


def analyser_accords(
    faction: str,
    conversation_recente: list[dict],
    date_jeu: str = "264-03",
    pays_joueur: str = "rome",
) -> dict:
    """Détecte un accord conclu dans la conversation récente joueur↔IA.

    Retourne un dict normalisé :
      {accord_conclu, type, resume, ressources_joueur_vers_ia,
       ressources_ia_vers_joueur, reputation_delta, source}
    Dégradation gracieuse : si Ollama indisponible, heuristique par mots-clés.
    """
    vide = {
        "accord_conclu": False, "type": "aucun", "resume": "",
        "ressources_joueur_vers_ia": {}, "ressources_ia_vers_joueur": {},
        "reputation_delta": 0, "source": "fallback",
    }
    if not conversation_recente:
        return vide

    conv_txt = _trim(_formater_conversation(
        conversation_recente, nom_dirigeant(faction), _nom_pays(pays_joueur)), 900)
    template = _charger_template("analyse_accords.md", TEMPLATE_ANALYSE_ACCORDS)
    prompt = _remplir(template, {
        "DATE_JEU": _date_lisible(date_jeu),
        "PAYS": _nom_pays(faction),
        "PAYS_JOUEUR": _nom_pays(pays_joueur),
        "NOM_DIRIGEANT": nom_dirigeant(faction),
        "CONVERSATION": conv_txt,
    })
    texte = _appel_ollama(prompt, temperature=0.2, format_json=True, num_predict=200)
    data = _extraire_json(texte) if texte else None
    if data is not None:
        return _normaliser_accord(data, source="ollama")

    # --- Repli déterministe par mots-clés (analyse des 2 derniers échanges) ---
    return _repli_analyse_accords(conversation_recente)


def _normaliser_accord(data: dict, source: str) -> dict:
    typ = str(data.get("type", "aucun"))
    if typ not in TYPES_ACCORD:
        typ = "aucun"
    conclu = bool(data.get("accord_conclu")) and typ != "aucun"

    def _res(d):
        out = {}
        if isinstance(d, dict):
            for k, v in d.items():
                try:
                    fv = float(v)
                except Exception:
                    continue
                if fv > 0:
                    out[k] = fv
        return out

    try:
        rep = int(data.get("reputation_delta", 0) or 0)
    except Exception:
        rep = 0
    rep = max(-40, min(30, rep))
    return {
        "accord_conclu": conclu,
        "type": typ if conclu else "aucun",
        "resume": str(data.get("resume", "")).strip(),
        "ressources_joueur_vers_ia": _res(data.get("ressources_joueur_vers_ia")),
        "ressources_ia_vers_joueur": _res(data.get("ressources_ia_vers_joueur")),
        "reputation_delta": rep,
        "source": source,
    }


def _repli_analyse_accords(conversation: list[dict]) -> dict:
    """Heuristique sans Ollama : cherche un accord MUTUEL dans les derniers messages.

    Exige un message joueur (proposition) ET une réponse IA assentie pour conclure.
    """
    base = {
        "accord_conclu": False, "type": "aucun", "resume": "",
        "ressources_joueur_vers_ia": {}, "ressources_ia_vers_joueur": {},
        "reputation_delta": 0, "source": "fallback",
    }
    textes_ia = " ".join(m.get("texte", "").lower()
                         for m in conversation if m.get("role") == "ia")
    textes_joueur = " ".join(m.get("texte", "").lower()
                             for m in conversation if m.get("role") == "joueur")
    if not textes_ia or not textes_joueur:
        return base

    # L'IA marque un assentiment ?
    assentiment = any(w in textes_ia for w in (
        "j'accepte", "jaccepte", "accepté", "accepte", "d'accord", "daccord",
        "marché conclu", "marche conclu", "entendu", "soit", "qu'il en soit ainsi",
        "nous avons un accord", "topez", "j'y consens", "convenu",
    ))
    if not assentiment:
        return base

    sujet = (textes_joueur + " " + textes_ia)
    if any(w in sujet for w in ("paix", "trêve", "treve", "cessez", "cesser le feu")):
        return {**base, "accord_conclu": True, "type": "paix",
                "resume": "Cessation des hostilités convenue.", "reputation_delta": 20}
    if any(w in sujet for w in ("alliance", "allié", "allie", "allions")):
        return {**base, "accord_conclu": True, "type": "alliance",
                "resume": "Alliance scellée.", "reputation_delta": 25}
    if any(w in sujet for w in ("non-agression", "non agression", "pacte")):
        return {**base, "accord_conclu": True, "type": "non_agression",
                "resume": "Pacte de non-agression conclu.", "reputation_delta": 15}
    if any(w in sujet for w in ("commerce", "commercial", "route", "échange", "echange", "négoce", "negoce")):
        return {**base, "accord_conclu": True, "type": "traite_commercial",
                "resume": "Traité commercial conclu.", "reputation_delta": 15}
    return base


# =====================================================================
#  5) Résumé narratif du tour écoulé
# =====================================================================
def resumer_tour(faits: str, date_jeu: str = "264-03") -> dict:
    """Génère un résumé des événements majeurs du tour. {texte, source}."""
    if not (faits or "").strip():
        return {"texte": "Le monde retient son souffle : rien de notable ce mois-ci.",
                "source": "fallback"}
    template = _charger_template("resume_tour.md", TEMPLATE_RESUME_TOUR)
    prompt = _remplir(template, {"DATE_JEU": _date_lisible(date_jeu),
                                 "FAITS": _trim(faits, 1100)})
    texte = _appel_ollama(prompt, temperature=0.6, num_predict=140)
    if texte:
        return {"texte": texte.strip(), "source": "ollama"}
    # Repli : reformulation compacte des faits fournis.
    lignes = [l.strip("-• ").strip() for l in faits.splitlines() if l.strip()]
    resume = " ".join(lignes[:4])
    return {"texte": resume or "Le calme précaire se maintient sur la Méditerranée.",
            "source": "fallback"}


# =====================================================================
#  Helpers
# =====================================================================
def _formater_conversation(messages: list[dict], nom_ia: str, nom_joueur: str) -> str:
    """Met en forme un fil de discussion pour un prompt."""
    if not messages:
        return "(aucun échange)"
    lignes = []
    for m in messages:
        if m.get("role") == "ia":
            qui = m.get("auteur") or nom_ia
        else:
            qui = nom_joueur
        lignes.append(f"{qui} : {m.get('texte', '')}")
    return "\n".join(lignes)


def _remplir(template: str, variables: dict[str, str]) -> str:
    out = template
    for cle, val in variables.items():
        out = out.replace("{" + cle + "}", str(val))
    return out


def _nom_pays(faction: str) -> str:
    from models.country import META_FACTIONS

    return META_FACTIONS.get(faction, {}).get("nom", faction.capitalize())


def _date_lisible(date_jeu: str) -> str:
    """Convertit '264-03' en 'Mars 264 av. J.C.'."""
    mois_noms = [
        "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
        "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
    ]
    try:
        annee, mois = date_jeu.split("-")
        m = int(mois)
        return f"{mois_noms[m]} {int(annee)} av. J.C."
    except Exception:
        return f"{date_jeu} av. J.C."


def _formater_historique(historique: list[dict] | None) -> str:
    """Formate l'historique pour le prompt (gère fils de conversation et actions)."""
    if not historique:
        return "(aucune interaction antérieure)"
    lignes = []
    for h in historique[-12:]:
        if "role" in h:  # message de conversation
            qui = "Toi" if h.get("role") == "ia" else "Le joueur"
            lignes.append(f"- {qui} : {h.get('texte', '')}")
        else:  # entrée d'historique_actions
            lignes.append(f"- [{h.get('acteur', '?')}] {h.get('texte', '')}")
    return "\n".join(lignes)


def _priorites_profil(faction: str) -> list[str]:
    """Extrait la liste numérotée des priorités du profil."""
    profil = charger_profil(faction)
    if not profil:
        return []
    bloc = re.search(r"##\s*Priorités.*?\n(.+?)(?:\n##|\Z)", profil, re.DOTALL)
    if not bloc:
        return []
    items = re.findall(r"^\s*\d+\.\s*(.+)$", bloc.group(1), re.MULTILINE)
    return [i.strip().rstrip(".") for i in items]


def _resume_priorites(faction: str) -> str:
    prio = _priorites_profil(faction)
    if not prio:
        return charger_profil(faction)[:400]
    return "Priorités : " + " ; ".join(prio[:4])


def _trim(texte: str, n: int) -> str:
    """Tronque proprement un texte à n caractères (pour limiter le prompt)."""
    if not texte:
        return ""
    texte = texte.strip()
    return texte if len(texte) <= n else texte[:n].rsplit(" ", 1)[0] + "…"


def _section_profil(faction: str, titre: str) -> str:
    """Extrait le contenu d'une section ## du profil (vide si absente)."""
    profil = charger_profil(faction)
    m = re.search(rf"##\s*{titre}.*?\n(.+?)(?:\n##|\Z)", profil, re.DOTALL | re.IGNORECASE)
    return m.group(1).strip() if m else ""


@lru_cache(maxsize=8)
def _persona_diplomatie(faction: str) -> str:
    """Persona RICHE pour la conversation : personnalité + façon de parler + relations +
    répliques. Plus fourni que le brief → réponses bien plus en caractère."""
    perso = _trim(_section_profil(faction, "Personnalité"), 420)
    parler = _trim(_section_profil(faction, "Façon de parler"), 520)
    opinions = _trim(_section_profil(faction, "Opinions sur les autres dirigeants"), 650)
    enn = _trim(_section_profil(faction, "Ennemis"), 180)
    phrases = _phrases_types(faction)
    parties = []
    if perso:
        parties.append(f"PERSONNALITÉ : {perso}")
    if parler:
        parties.append(f"FAÇON DE PARLER (imite ce style, sans copier mot pour mot) : {parler}")
    if opinions:
        parties.append(f"TON AVIS SUR LES AUTRES DIRIGEANTS (exprime-le quand on t'en parle) : {opinions}")
    if enn:
        parties.append(f"ENNEMIS HISTORIQUES : {enn}")
    if phrases:
        parties.append("EXEMPLES DE TON (ne les répète PAS mot pour mot, inspire-t'en) : "
                        + " / ".join(f"« {p} »" for p in phrases[:5]))
    return "\n".join(parties) or _trim(charger_profil(faction), 900)


@lru_cache(maxsize=8)
def _brief_dirigeant(faction: str) -> str:
    """Brief COMPACT du dirigeant (≈ 500 c.) : personnalité + priorités + 1 phrase.

    Remplace l'envoi du profil complet dans les prompts pour accélérer le prefill
    (le prefill domine le temps de réponse sur Apple Silicon en mode low-VRAM).
    """
    perso = _trim(_section_profil(faction, "Personnalité"), 260)
    prio = _priorites_profil(faction)
    style = _trim(_section_profil(faction, "Style diplomatique"), 200)
    phrases = _phrases_types(faction)
    parties = []
    if perso:
        parties.append(f"Personnalité : {perso}")
    if prio:
        parties.append("Priorités : " + " ; ".join(prio[:3]))
    if style:
        parties.append(f"Style : {style}")
    if phrases:
        parties.append(f"Tu dis parfois : « {phrases[0]} »")
    return "\n".join(parties) or _trim(charger_profil(faction), 500)
