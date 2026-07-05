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
# Modèle Ollama (surchargez via la variable d'environnement IMPERIUM_MODELE).
# qwen2.5:7b retenu après benchmark : compréhension et français nettement meilleurs
# que llama3.1:8b (camps d'alliance corrects, ton en caractère), vitesse équivalente.
import os as _os
MODELE = _os.environ.get("IMPERIUM_MODELE", "qwen2.5:7b")
# Délai de génération. Sur cette machine (M2, mode éco possible), une réponse peut
# prendre ~20-25 s : mieux vaut attendre que basculer en repli générique. Le chat
# joueur passe par le STREAMING (premiers mots en ~2 s), donc ce délai ne concerne
# que les appels internes (conseiller, analyse d'accords, messages spontanés).
TIMEOUT_S = 35.0

# Mapping faction -> fichier de profil dirigeant (fiches « ressentis », 1re personne).
FICHIERS_DIRIGEANTS: dict[str, str] = {
    "carthage": "carthage_ptolemee.md",
    "macedoine": "macedoine_alexandre.md",
    "rome": "rome_neron.md",
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
    bloc = re.search(r"##\s*(?:Phrases types|Éclats de voix[^\n]*)\s*(.+?)(?:\n##|\Z)",
                     profil, re.DOTALL)
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
TEMPLATE_SYSTEME_DIRIGEANT = """Tu es {NOM_DIRIGEANT}, souverain de {PAYS} ({DATE_JEU}) — pas un assistant : un roi qui poursuit SES buts.

{PROFIL}

MA SITUATION : {SITUATION_IA}
L'INTERLOCUTEUR ({PAYS_JOUEUR}), selon mes espions : {SITUATION_JOUEUR}
LES AUTRES ROIS (tous VIVANTS, régnant en ce moment) : {RIVAUX}

FIL DE LA CONVERSATION :
{HISTORIQUE}

RÈGLES :
- Comprends QUI est visé (alliance CONTRE X = X est l'ennemi proposé ; ne confonds jamais
  les camps) ; les faits ci-dessus sont la vérité, ne réattribue aucun royaume.
- NÉGOCIE selon tes intérêts : accepte, pose des conditions, marchande ou refuse en le
  motivant. Adapte le ton aux forces en présence. Souviens-toi du fil et des trahisons.
- Un accord qui sert CLAIREMENT tes intérêts mérite d'être accepté — ne refuse pas par
  posture. Quand tu conclus, énonce-le SANS ambiguïté (« Marché conclu : je donne X, tu
  donnes Y ») ; quand tu refuses, motive-le en une phrase. Pas d'entre-deux flou.
- Tu ne connais que l'Antiquité (concept moderne = sorcellerie/hérésie, jamais expliqué) ;
  tu n'es ni une IA ni un personnage, tu ne sors jamais du rôle.
- Les QUATRE rois de ce monde (toi compris) sont VIVANTS, ici et maintenant : n'évoque
  JAMAIS la mort, la fin ou l'héritage posthume d'aucun d'entre eux.
- VARIE tes ouvertures (jamais deux fois la même adresse, pas d'onomatopées) et ne
  RECOPIE jamais des phrases de tes propres réponses précédentes ; paroles directes,
  sans narration ni parenthèses.
- FRANÇAIS impeccable UNIQUEMENT (alphabet latin, aucun autre), 1 à 3 phrases denses.

{PAYS_JOUEUR} te dit : "{MESSAGE}"

{NOM_DIRIGEANT} répond :"""

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
#  Conseiller du joueur (chat + directives libres → projets)
# =====================================================================
# Identité du conseiller selon la civilisation du JOUEUR (ton culturel).
CONSEILLERS = {
    "rome": ("Cassius, conseiller romain", "sénateur retors et loyal ; parle avec la gravité "
             "de Rome, cite le Sénat, la gloire, l'aigle et la pourpre ; vouvoie « Auguste maître »."),
    "macedoine": ("Cleitos, Compagnon du roi", "hétaïre macédonien franc et martial ; parle de "
                  "phalange, de conquête, d'honneur ; appelle le joueur « mon roi »."),
    "sparte": ("l'Éphore de Sparte", "magistrat austère et laconique ; phrases brèves et "
               "tranchantes ; méprise le luxe ; parle de discipline, de fer et de liberté."),
    "carthage": ("Manéthon, vizir d'Égypte", "vizir lettré et calculateur ; parle du Nil, du "
                 "grain, de l'or, des scribes et de la Bibliothèque ; appelle le joueur « Pharaon »."),
}

TEMPLATE_CONSEILLER = """Tu es {IDENTITE}, le conseiller fidèle du souverain de {PAYS} en {DATE}.
Profil : {STYLE}. Tu t'adresses à TON souverain (le joueur), jamais à un étranger.

ÉTAT ACTUEL DU ROYAUME : {SITUATION}
PROJETS SECRETS EN COURS : {PROJETS}
RENSEIGNEMENTS DE TES ESPIONS (rapporte-les FIDÈLEMENT si on te demande un rapport) :
{RENSEIGNEMENTS}
PUISSANCES VOISINES (et leur capitale) : {RIVAUX}

TON RÔLE :
- Faire le point sur l'état du royaume et conseiller CONCRÈTEMENT quoi améliorer.
- Si on te demande un rapport, décris l'avancement des projets en cours (ci-dessus).
- RÈGLE D'OR : dès que le souverain ORDONNE une entreprise concrète et PLAUSIBLE pour
  l'Antiquité (engage, envoie, espionne, forme, lève, bâtis, sabote, infiltre, soulève,
  finance une rébellion…), tu l'organises et tu REMPLIS "directive" : tu fixes un coût en
  or et une DURÉE EN MOIS raisonnables. directive QUE pour un ordre concret.
- LIMITES — tu REFUSES tout ordre impossible, magique, fantastique, anachronique ou qui
  briserait le monde (invoquer un démon, lancer une arme moderne ou un explosif, faire
  DISPARAÎTRE une cité ou une province, ressusciter les morts, téléporter une armée…) :
  alors directive=null et tu réponds par un refus EN CARACTÈRE (incompréhension, ironie).
  Tu ne peux JAMAIS faire tomber ni faire disparaître une CAPITALE ennemie par ces moyens.
- DURÉES en MOIS (1 mois = 1 tour) : une entreprise ambitieuse (lever une rébellion,
  bâtir un réseau d'influence) prend des ANNÉES — souvent 12 à 36 mois.

Tu réponds en JSON STRICT, rien d'autre. Schéma :
{{"reponse": "<ce que tu dis à voix haute, EN CARACTÈRE, 2 à 4 phrases>",
  "directive": null | {{"nom":"<nom court>","type":"espionnage|garnison|sabotage|rebellion|commerce|autre",
  "cible_faction":"<un id parmi {RIVAUX} ou null>","cout_or":<entier>,"duree":<entier en MOIS>,
  "rapport":"<une phrase sur ce que fait ce projet>"}}}}

EXEMPLES (réponds EXACTEMENT dans ce format) :
Souverain: "Envoie des espions chez les Spartiates." →
{{"reponse":"Il en sera fait, mon souverain : nos agents partent dès ce soir.","directive":{{"nom":"Espions à Sparte","type":"espionnage","cible_faction":"sparte","cout_or":90,"duree":4,"rapport":"Nos agents s'infiltrent dans les hautes sphères spartiates."}}}}
Souverain: "Finance une rébellion pour soulever une province d'Égypte." →
{{"reponse":"J'allume la révolte chez les Lagides, mais cela prendra des années et beaucoup d'or.","directive":{{"nom":"Rébellion en Égypte","type":"rebellion","cible_faction":"carthage","cout_or":350,"duree":18,"rapport":"Nos agents arment et soulèvent une province égyptienne."}}}}
Souverain: "Forme une armée pour prendre une province d'Égypte, sans toucher Alexandrie." →
{{"reponse":"Des troupes se lèveront pour fondre sur leurs provinces, jamais sur leur capitale.","directive":{{"nom":"Campagne d'Égypte","type":"rebellion","cible_faction":"carthage","cout_or":320,"duree":15,"rapport":"Une armée se forme pour arracher une province à l'Égypte."}}}}
Souverain: "Invoque un démon pour détruire Sparte." →
{{"reponse":"Mon souverain... les démons n'obéissent pas au Sénat. Donnez-moi des hommes et de l'or, pas des sortilèges.","directive":null}}
Souverain: "Comment se porte le royaume ?" →
{{"reponse":"Rome prospère, mais l'armée est faible ; renforçons-la.","directive":null}}

Coûts indicatifs : espionnage 60-150 or (3-6 mois), garnison 80-220 or (3-8 mois),
sabotage 100-220 or (4-8 mois), rébellion 250-500 or (12-36 mois).

ORDRE / QUESTION DU SOUVERAIN : "{MESSAGE}"
JSON :"""


def conseil(faction: str, message: str, situation: str, projets: list[dict],
            historique: list[dict] | None = None, date_jeu: str = "5-03",
            renseignements: str = "", pays_data: dict | None = None) -> dict:
    """Réponse du conseiller du joueur + éventuelle directive (projet à créer).
    Retourne {reponse, directive, source}."""
    ident, style = CONSEILLERS.get(faction, ("ton conseiller", "fidèle et avisé"))
    proj_txt = "; ".join(f"{p.get('nom')} ({p.get('statut')}, {p.get('tours_restants',0)} tours restants)"
                         for p in projets) or "(aucun)"
    prompt = _remplir(TEMPLATE_CONSEILLER, {
        "IDENTITE": ident, "STYLE": style, "PAYS": _nom_pays(faction),
        "DATE": _date_lisible(date_jeu), "SITUATION": situation,
        "PROJETS": proj_txt,
        "RENSEIGNEMENTS": renseignements or "(aucun espion n'a encore livré de rapport)",
        "RIVAUX": ", ".join(f"{_nom_pays(f)} [id={f}]" for f in CONSEILLERS if f != faction),
        "MESSAGE": message,
    })
    if historique:
        prompt = f"FIL RÉCENT AVEC TON SOUVERAIN :\n{_formater_historique(historique)}\n\n" + prompt
    brut = _appel_ollama(prompt, temperature=0.7, num_predict=240, format_json=True)
    data = None
    if brut:
        try:
            data = json.loads(brut)
        except Exception:
            m = re.search(r"\{.*\}", brut, re.DOTALL)
            if m:
                try:
                    data = json.loads(m.group(0))
                except Exception:
                    data = None
    if isinstance(data, dict) and data.get("reponse"):
        rep = _nettoyer_reponse(str(data["reponse"]))
        directive = data.get("directive")
        if not isinstance(directive, dict):
            directive = None
        return {"reponse": rep, "directive": directive, "source": "ollama"}
    # Repli déterministe (Ollama absent/échec) : DIAGNOSTIC réel du royaume.
    return {"reponse": _conseil_repli(faction, message, situation, pays_data),
            "directive": None, "source": "fallback"}


def _conseil_repli(faction: str, message: str, situation: str,
                   pays: dict | None = None) -> str:
    """Conseil de secours PERTINENT : analyse l'état réel et recommande du concret."""
    ident = CONSEILLERS.get(faction, ("ton conseiller", ""))[0].split(",")[0]
    if not pays:
        return f"{situation} Donne-moi un ordre précis, mon souverain, et je m'en charge."
    avis = []
    prod = pays.get("production", {})
    res = pays.get("ressources", {})
    stab = pays.get("stabilite", 60)
    if stab < 45:
        basses = pays.get("stabilite_basses", [])
        ou = f" — surtout {basses[0]['nom']}" if basses else ""
        avis.append(f"le peuple gronde (stabilité {stab}){ou} : nomme des gouverneurs, "
                    f"organise des jeux ou allège l'impôt")
    if prod.get("nourriture", 0) < 1:
        avis.append("les greniers se vident : bâtis des fermes (et un grenier)")
    if prod.get("eau", 0) < 1:
        avis.append("l'eau manque : puits ou aqueduc")
    if prod.get("or", 0) < 3:
        avis.append("le trésor s'essouffle : un marché, ou des impôts plus lourds")
    nb_u = sum(u.get("effectif", 1) for u in pays.get("unites", []))
    if nb_u < 3:
        avis.append(f"notre armée est maigre ({nb_u} unités) : recrute, le fer des mines arme les légions")
    if pays.get("inflation", 0) > 12:
        avis.append(f"l'or dort et se déprécie (inflation {pays['inflation']:.0f}%) : dépense — "
                    f"chantiers, merveilles, mercenaires")
    if pays.get("corruption", 0) > 10:
        avis.append(f"la corruption ronge {pays['corruption']:.0f}% de nos revenus : gouverneurs et forum y remédient")
    if not avis:
        avis.append("le royaume est sain ; c'est l'heure d'oser — expansion, merveilles, ou renseignement chez nos rivaux")
    return f"({ident}) Mon souverain, voici mon rapport : " + " ; ".join(avis[:3]) + "."


# =====================================================================
#  1) Réponse diplomatique d'un dirigeant à un message joueur
# =====================================================================
def prompt_diplomatique(
    faction_cible: str,
    message_joueur: str,
    etat_monde: str = "",
    historique: list[dict] | None = None,
    date_jeu: str = "264-03",
    pays_joueur: str = "rome",
    situation_joueur: str = "",
    situation_ia: str = "",
) -> str:
    """Construit le prompt complet d'une réponse de dirigeant (partagé stream/non-stream)."""
    template = _charger_template("systeme_dirigeant.md", TEMPLATE_SYSTEME_DIRIGEANT)
    return _remplir(
        template,
        {
            "NOM_DIRIGEANT": nom_dirigeant(faction_cible),
            "PAYS": _nom_pays(faction_cible),
            "PAYS_JOUEUR": _nom_pays(pays_joueur),
            "DATE_JEU": _date_lisible(date_jeu),
            "PROFIL": _persona_diplomatie(faction_cible) or "(profil indisponible)",
            "RIVAUX": ", ".join(f"{n} ({_nom_pays(f)})" for f, n in NOMS_DIRIGEANTS.items()
                                if f != faction_cible) or "(aucun)",
            "SITUATION_JOUEUR": situation_joueur or "(situation du joueur mal connue)",
            "SITUATION_IA": situation_ia or "(rien de particulier à signaler)",
            "ETAT_MONDE": "",  # retiré du template (redondant avec les situations)
            "HISTORIQUE": _formater_historique(historique),
            "MESSAGE": message_joueur,
        },
    )


def flux_ollama(prompt: str, temperature: float = 0.72, num_predict: int = 90):
    """Générateur : chunks de texte streamés depuis Ollama (vide si indisponible).
    Permet d'afficher les premiers mots en ~1-2 s au lieu d'attendre la fin."""
    if not modele_pret():
        return
    try:
        with httpx.stream("POST", OLLAMA_GENERATE, json={
            "model": MODELE, "prompt": prompt, "stream": True, "keep_alive": "30m",
            "options": {"temperature": temperature, "num_predict": num_predict,
                        "seed": random.randint(1, 2_000_000_000),
                        "top_p": 0.92, "repeat_penalty": 1.18},
        }, timeout=90.0) as r:
            if r.status_code != 200:
                return
            for ligne in r.iter_lines():
                if not ligne:
                    continue
                try:
                    d = json.loads(ligne)
                except Exception:
                    continue
                morceau = d.get("response") or ""
                if morceau:
                    # Garde anti-glissement : si un caractère non latin (CJK…)
                    # apparaît, on coupe et on ARRÊTE le flux proprement.
                    m = re.search(r"[　-ヿ一-鿿가-힯＀-￯]", morceau)
                    if m:
                        if m.start() > 0:
                            yield morceau[:m.start()]
                        return
                    yield morceau
                if d.get("done"):
                    return
    except Exception:
        return


def reponse_diplomatique(
    faction_cible: str,
    message_joueur: str,
    etat_monde: str = "",
    historique: list[dict] | None = None,
    date_jeu: str = "264-03",
    pays_joueur: str = "rome",
    situation_joueur: str = "",
    situation_ia: str = "",
) -> dict:
    """Génère la réponse d'un dirigeant IA (non-stream). {reponse, auteur, source}."""
    auteur = nom_dirigeant(faction_cible)
    prompt = prompt_diplomatique(faction_cible, message_joueur, etat_monde, historique,
                                 date_jeu, pays_joueur, situation_joueur, situation_ia)
    # Température modérée : moins de « glissements » de style/faits, tout en gardant
    # de la variété (la graine aléatoire par appel fait le reste).
    texte = _nettoyer_reponse(_appel_ollama(prompt, temperature=0.72, num_predict=110))
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
#  Message SPONTANÉ : un dirigeant IA contacte le joueur de lui-même
# =====================================================================
TEMPLATE_MESSAGE_SPONTANE = """Tu es {NOM_DIRIGEANT}, dirigeant de {PAYS} en {DATE_JEU}.
PROFIL : {PROFIL}

Tu écris SPONTANÉMENT, de ta propre initiative, au dirigeant de {PAYS_JOUEUR}.
RAISON qui te pousse à écrire : {RAISON}
Ce que tes espions savent de son royaume : {SITUATION_JOUEUR}
Vos relations actuelles : {RELATION}

Écris un message COURT (2 à 4 phrases), EN CARACTÈRE (ton ton, tes manies), qui colle à
la RAISON et à ton tempérament. Tu peux menacer, reprocher, lancer un ultimatum, proposer
une alliance, déclarer la guerre, ou rester mesuré — selon ta personnalité et la gravité.
Anachronismes du monde moderne = hérésie. Ne sors jamais du rôle.

Réponds en JSON STRICT : {{"message":"<ton message>","intent":"reproche|menace|ultimatum|alliance|guerre|neutre"}}"""


def message_spontane(faction: str, raison: str, situation_joueur: str = "",
                     relation: str = "neutres", date_jeu: str = "5-03",
                     pays_joueur: str = "rome", utiliser_ia: bool = True) -> dict:
    """Génère un message qu'un dirigeant IA adresse SPONTANÉMENT au joueur.
    `utiliser_ia=False` (avance rapide de plusieurs tours) → repli déterministe VARIÉ,
    sans appel Ollama. Retourne {message, intent, source}."""
    auteur = nom_dirigeant(faction)
    if utiliser_ia:
        prompt = _remplir(TEMPLATE_MESSAGE_SPONTANE, {
            "NOM_DIRIGEANT": auteur, "PAYS": _nom_pays(faction),
            "PAYS_JOUEUR": _nom_pays(pays_joueur), "DATE_JEU": _date_lisible(date_jeu),
            "PROFIL": _persona_diplomatie(faction) or "(profil indisponible)",
            "RAISON": raison, "SITUATION_JOUEUR": situation_joueur or "(mal connu)",
            "RELATION": relation,
        })
        brut = _appel_ollama(prompt, temperature=0.85, num_predict=120, format_json=True)
        if brut:
            try:
                data = json.loads(brut)
            except Exception:
                m = re.search(r"\{.*\}", brut, re.DOTALL)
                data = json.loads(m.group(0)) if m else None
            if isinstance(data, dict) and data.get("message"):
                intent = str(data.get("intent", "neutre")).lower().strip()
                if intent not in ("reproche", "menace", "ultimatum", "alliance", "guerre", "neutre"):
                    intent = "neutre"
                return {"message": _nettoyer_reponse(str(data["message"])), "intent": intent,
                        "auteur": auteur, "source": "ollama"}
    # Repli déterministe VARIÉ : une phrase type + une ligne liée à la raison.
    phrases = _phrases_types(faction) or ["Sache que je te surveille."]
    if "manœuvre" in raison or "secrè" in raison:
        intent, ouvertures = "reproche", [
            "On me rapporte tes intrigues. {P}", "Tes ombres rôdent chez moi. {P}",
            "Crois-tu que je ne vois rien ? {P}"]
    elif "armée" in raison or "frontière" in raison:
        intent, ouvertures = "menace", [
            "Tes soldats campent trop près de mes terres. {P}",
            "Éloigne tes lances de ma frontière. {P}", "Je vois tes étendards depuis mes murs. {P}"]
    elif "allian" in raison:
        intent, ouvertures = "alliance", [
            "Le moment est venu de parler d'alliance. {P}",
            "Nos intérêts convergent, parlons-en. {P}"]
    elif "faibl" in raison:
        intent, ouvertures = "menace", [
            "Ton royaume vacille, et le monde le sait. {P}",
            "La faiblesse attire les loups. {P}"]
    else:
        intent, ouvertures = "neutre", ["{P}", "Écoute bien : {P}"]
    msg = random.choice(ouvertures).replace("{P}", random.choice(phrases))
    return {"message": msg, "intent": intent, "auteur": auteur, "source": "fallback"}


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
# Chronique annuelle 100 % CODE (aucun appel IA : fin de tour instantanée).
# Le style « livre d'histoire » vient de viviers de tournures piochés au hasard.
_CHRONIQUE_OUVERTURES = [
    "L'an {A} restera gravé dans les mémoires.",
    "Ainsi passa l'an {A}, et les chroniqueurs veillaient.",
    "En l'an {A}, le destin battit les cartes des royaumes.",
    "Que l'on retienne de l'an {A} ceci :",
    "L'an {A} fut de ceux dont parlent longtemps les vieillards.",
]
_CHRONIQUE_LIAISONS = [". Dans le même temps, ", ". Puis ", ". On rapporte aussi ceci : ",
                       ". Les mois suivants, ", ". Et tandis que le monde retenait son souffle, "]
_CHRONIQUE_CLOTURES = [
    "Ainsi vont les empires : de bruit, d'or et de poussière.",
    "Les dieux seuls savent ce que la suite réserve.",
    "Le reste appartient déjà à la légende.",
    "Et le monde, une fois encore, changea de visage.",
]
_CHRONIQUE_PAISIBLE = [
    "L'an {A} s'écoula, paisible : les moissons rentrèrent, les frontières dormirent.",
    "Nulle grande affaire en l'an {A} — et les peuples, pour une fois, s'en réjouirent.",
    "L'an {A} passa sans fracas : on bâtit, on négocia, on attendit.",
]


def chronique_annuelle(annee_txt: str, faits: str) -> dict:
    """Chronique annuelle rédigée PAR CODE (déterministe + tournures variées)."""
    lignes = [l.strip("-• ").strip().rstrip(" .!") for l in (faits or "").splitlines() if l.strip()]
    # Nettoie les emojis/préfixes techniques pour une prose propre.
    lignes = [re.sub(r"^[⚔🕊🤝✦👑✉\s]+", "", l) for l in lignes if len(l) > 8][:5]
    if not lignes:
        return {"texte": random.choice(_CHRONIQUE_PAISIBLE).format(A=annee_txt), "source": "code"}
    _PROPRES = ("Rome", "Égypte", "Macédoine", "Sparte", "Néron", "Ptolémée",
                "Alexandre", "Léonidas", "RÉVOLTE", "Mutinerie", "Merveille")
    def _cas(l: str, debut_phrase: bool) -> str:
        premier = l.split(" ", 1)[0]
        if debut_phrase or premier in _PROPRES or premier.isupper():
            return l
        return l[0].lower() + l[1:]
    corps = lignes[0]
    derniere = None
    for l in lignes[1:]:
        choix = [x for x in _CHRONIQUE_LIAISONS if x != derniere] or _CHRONIQUE_LIAISONS
        liaison = random.choice(choix)
        derniere = liaison
        corps += liaison + _cas(l, liaison.rstrip().endswith((".", ":")))
    texte = re.sub(r"  +", " ", random.choice(_CHRONIQUE_OUVERTURES).format(A=annee_txt) + " " + corps + ". "
             + random.choice(_CHRONIQUE_CLOTURES))
    return {"texte": texte, "source": "code"}


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


_RE_META = re.compile(
    r"\s*\([^)]*\b(notez?|nb|je précise|sous-entend|ironie|concise|pause|réponse)\b[^)]*\)",
    re.IGNORECASE)

def _nettoyer_reponse(texte: str | None) -> str | None:
    """Retire les apartés méta que le modèle ajoute parfois (« (Notez: …) », « (Pause) »)
    pour que le dirigeant ne sorte jamais de son rôle."""
    if not texte:
        return texte
    t = _RE_META.sub("", texte)
    # Interjections d'ouverture parasites (tics du modèle) : coupées net.
    t = re.sub(r"^(?:Ahem|Hum+|Hmm+|Euh|Eh bien)\s*[,.!…]*\s*", "", t, flags=re.I)
    # Coupe un éventuel bloc d'explication détaché en fin de réponse.
    for sep in ("\n\n(", "\n(Notez", "\nNotez", "\n\nJe sais ce que"):
        i = t.find(sep)
        if i > 40:
            t = t[:i]
    # GLISSEMENT de langue (qwen peut dériver vers le chinois) : on coupe net au
    # premier caractère non latin (CJK, kana, hangul…).
    m = re.search(r"[　-ヿ一-鿿가-힯＀-￯]", t)
    if m:
        t = t[:m.start()]
    t = t.strip()
    # Si la réponse a été tronquée en plein milieu (cap de tokens), on la ramène à la
    # dernière phrase complète — fin nette, jamais de mot coupé.
    if t and t[-1] not in '.!?…»"':
        fins = list(re.finditer(r'[.!?…»"]', t))
        if fins and fins[-1].end() > 40:
            t = t[:fins[-1].end()].strip()
    return t or None


_RE_IMPOSSIBLE = re.compile(
    r"\b(d[ée]mon|diable|enfer|magie|magique|sortil[èe]ge|mal[ée]diction|maudi|dragon|"
    r"bombe|nucl[ée]aire|atomique|missile|fus[ée]e|explos|poudre|t[ée]l[ée]port|"
    r"ressuscit|zombie|mort[- ]vivant|miracle|invoque|invocation|disparai|"
    r"an[ée]antis|raser? la capitale|d[ée]truis? la capitale|efface)\b", re.I)

def ordre_impossible(texte: str) -> bool:
    """Vrai si l'ordre est manifestement impossible/magique/anachronique ou briserait le
    monde (filet de sécurité au-dessus du refus du modèle)."""
    return bool(_RE_IMPOSSIBLE.search(texte or ""))


def resume_situation(pays: dict, nom: str) -> str:
    """Résumé LISIBLE de l'état d'un royaume (stabilité, prospérité, puissance) pour
    que les dirigeants y réagissent. Pur (ne dépend pas de game_engine)."""
    if not pays:
        return f"{nom} : royaume mal connu de tes espions."
    stab = int(pays.get("stabilite", 60))
    res = pays.get("ressources", {})
    orr = res.get("or", 0)
    pop = res.get("population", 0)
    nb_terr = len(pays.get("territoires", []))
    nb_u = sum(u.get("effectif", 1) for u in pays.get("unites", []))
    age = pays.get("age")
    s_stab = ("très stable" if stab >= 75 else "stable" if stab >= 55 else
              "fragile" if stab >= 35 else "au bord de la révolte")
    s_pros = ("florissant" if orr >= 800 else "prospère" if orr >= 300 else
              "modeste" if orr >= 80 else "exsangue")
    s_mil = ("redoutable" if nb_u >= 6 else "modeste" if nb_u >= 2 else "dérisoire")
    s_taille = ("vaste" if nb_terr >= 8 else "moyen" if nb_terr >= 3 else "petit")
    extra = " ; il connaît un ÂGE D'OR" if age == "or" else " ; il sombre dans un ÂGE SOMBRE" if age == "sombre" else ""
    return (f"{nom} est un royaume {s_taille} ({nb_terr} province(s), ~{int(pop)} habitants), "
            f"actuellement {s_stab} (stabilité {stab}/100), au trésor {s_pros}, "
            f"à l'armée {s_mil}{extra}.")


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


def _formater_historique(historique: list[dict] | None, recents: int = 10) -> str:
    """Formate l'historique pour le prompt SANS perdre le fil sur les longues
    conversations : on garde TOUTES les paroles du JOUEUR (elles portent les faits —
    noms, offres, accords) + les `recents` derniers échanges intégralement ; on ne
    coupe que les anciennes répliques du dirigeant (verbeuses) pour borner la taille."""
    if not historique:
        return "(aucune interaction antérieure)"
    n = len(historique)
    lignes = []
    for i, h in enumerate(historique):
        recent = i >= n - recents
        if "role" in h:  # message de conversation
            est_ia = h.get("role") == "ia"
            if est_ia and not recent:
                continue  # on omet tes anciennes répliques pour garder de la place
            qui = "Toi" if est_ia else "Le joueur"
            txt = h.get("texte", "")
            if not recent:
                txt = _trim(txt, 140)  # compresse les anciens messages du joueur
            lignes.append(f"- {qui} : {txt}")
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
    vie = _trim(_section_profil(faction, "Ma vie, telle que je la raconte"), 340)
    caractere = _trim(_section_profil(faction, "Caractère profond")
                      or _section_profil(faction, "Personnalité"), 320)
    parler = _trim(_section_profil(faction, "Façon de parler"), 230)
    ressentis = _trim(_section_profil(faction, "Ressentis envers les autres dirigeants")
                      or _section_profil(faction, "Opinions sur les autres dirigeants"), 500)
    reactions = _trim(_section_profil(faction, "Ce qui me fait réagir"), 260)
    buts = _trim(_section_profil(faction, "Mes buts dans cette partie")
                 or _section_profil(faction, "Priorités"), 150)
    autres = ", ".join(n for f2, n in NOMS_DIRIGEANTS.items() if f2 != faction)
    parties = [f"CE MONDE : les quatre rois — moi et {autres} — régnons SIMULTANÉMENT, "
               f"tous VIVANTS, ici et maintenant. Si l'on me dit que l'un de nous est mort, "
               f"c'est un mensonge ou une folie : je le corrige."]
    if vie:
        parties.append(f"MA VIE (je ne connais pas ma fin) : {vie}")
    if caractere:
        parties.append(f"MON CARACTÈRE : {caractere}")
    if parler:
        parties.append(f"MA FAÇON DE PARLER (à imiter) : {parler}")
    if ressentis:
        parties.append(f"MES RESSENTIS envers les autres rois : {ressentis}")
    if reactions:
        parties.append(f"MES RÉACTIONS (flatterie/menace/trahison/offres) : {reactions}")
    if buts:
        parties.append(f"MES BUTS : {buts}")
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
