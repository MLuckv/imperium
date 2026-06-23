"""Génère data/map/territories.json depuis Natural Earth admin-1 (provinces, 10m).

Chaque pays est découpé en PLUSIEURS provinces de jeu (regroupement CONTIGU des
provinces admin-1 en ~K régions par pays, croissance depuis graines + union shapely).
Pavage garanti SANS trou ni chevauchement : snap sur une grille de précision commune
(set_precision, topologie préservée), puis tous les trous internes résiduels (lacs,
frontières inter-pays non jointives) sont absorbés par la province voisine. Côtes
naturelles, adjacence terre/mer précise. Seules les 3 capitales reçoivent une faction.

Dépendances : shapely (dans game/backend/.venv).
Lancer :  game/backend/.venv/bin/python tools/build_map.py
Source :  https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
          (téléchargé dans /tmp/ne_admin1_10m.geojson)
"""
import json, math, re, unicodedata
from collections import defaultdict
from pathlib import Path
from shapely import set_precision
from shapely.geometry import shape, box, Point, LineString, Polygon
from shapely.ops import unary_union, nearest_points

SRC = Path('/tmp/ne_admin1_10m.geojson')
GAME = Path('/Users/vmoulin/Documents/Code/civ-history/game')
OUT_TERR = GAME / 'data/map/territories.json'
OUT_START = GAME / 'data/map/starting_positions.json'

LON0, LON1 = -11.0, 40.0
LAT0, LAT1 = 23.0, 58.5   # sud abaissé : l'Égypte (Nil) et le Sahara ont plus de place
W = 1400
LATMID = math.radians((LAT0 + LAT1) / 2)
LON_SPAN = (LON1 - LON0) * math.cos(LATMID)
LAT_SPAN = (LAT1 - LAT0)
H = round(W * LAT_SPAN / LON_SPAN)
WINDOW = box(LON0, LAT0, LON1, LAT1)

AREA_DIV = 5.5       # deg² par province de jeu (ajuste la densité : ~France 6-7)
KMAX = 8
GRID = 0.045         # deg : grille de précision COMMUNE (snap topologique → 0 sliver/trou)
MAIN_MIN = 0.12      # deg² : aire min. d'un corps principal (sinon micro-état ignoré)
ISLAND_MIN = 0.30    # deg² : aire min. d'une île détachée (garde Crète/Eubée, pas le confetti)
MIN_K = {'Greece': 5}  # nombre min. de provinces pour certains pays (petite superficie)
LAND_EPS = 0.04      # deg : régions qui se touchent = frontière terrestre
SEA_MAX = 2.6        # deg : traversée maritime possible (détroits/mers étroites)
SEA_K = 5

# Capitales 5 av. J.-C. (distribution anachronique) : Rome/Néron (Italie),
# Égypte/Ptolémée (Alexandrie), Macédoine/Alexandre (Macédoine), Sparte/Léonidas (Péloponnèse).
CAPS = {'rome': (12.48, 41.90), 'carthage': (29.90, 31.00),
        'macedoine': (22.50, 40.80), 'sparte': (22.40, 37.10)}

NOM_FR = {
    'France': 'France', 'Italy': 'Italie', 'Spain': 'Espagne', 'Portugal': 'Portugal',
    'Tunisia': 'Tunisie', 'Algeria': 'Algérie', 'Morocco': 'Maroc', 'Libya': 'Libye',
    'Egypt': 'Égypte', 'Greece': 'Grèce', 'Turkey': 'Turquie', 'Albania': 'Albanie',
    'Bulgaria': 'Bulgarie', 'North Macedonia': 'Macédoine du Nord', 'Macedonia': 'Macédoine du Nord',
    'Germany': 'Allemagne', 'Austria': 'Autriche', 'Switzerland': 'Suisse',
    'Croatia': 'Croatie', 'Slovenia': 'Slovénie', 'Serbia': 'Serbie', 'Bosnia and Herzegovina': 'Bosnie',
    'Montenegro': 'Monténégro', 'Kosovo': 'Kosovo', 'Romania': 'Roumanie', 'Hungary': 'Hongrie',
    'Czechia': 'Tchéquie', 'Slovakia': 'Slovaquie', 'Poland': 'Pologne', 'Belgium': 'Belgique',
    'Netherlands': 'Pays-Bas', 'United Kingdom': 'Bretagne', 'Ireland': 'Irlande',
    'Syria': 'Syrie', 'Lebanon': 'Liban', 'Israel': 'Judée', 'Palestine': 'Judée',
    'Jordan': 'Arabie', 'Cyprus': 'Chypre', 'Malta': 'Malte', 'Luxembourg': 'Luxembourg',
    'Denmark': 'Danemark', 'Ukraine': 'Scythie', 'Moldova': 'Moldavie', 'Belarus': 'Sarmatie',
}

AFRIQUE_NORD = {'Egypt', 'Libya', 'Algeria', 'Tunisia', 'Morocco', 'Sudan', 'Western Sahara'}

def classer_terrain(lon, lat, admin):
    """Type de terrain (pilote la production agricole réaliste)."""
    if admin == 'Egypt':
        return 'fertile' if 29.5 <= lon <= 33.5 else 'desert'  # vallée du Nil vs désert
    if admin in AFRIQUE_NORD and lat < 31.5:
        return 'desert'  # Sahara
    if 7.0 <= lon <= 13.5 and 44.5 <= lat <= 47.3:
        return 'montagne'  # Alpes
    if 8.0 <= lon <= 12.5 and 44.0 <= lat <= 45.8:
        return 'fertile'  # plaine du Pô
    return 'plaine'

def project(lon, lat):
    return [round((lon - LON0) * math.cos(LATMID) / LON_SPAN * W, 1),
            round((LAT1 - lat) / LAT_SPAN * H, 1)]

def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    s = re.sub(r'[^a-zA-Z0-9]+', '_', s).strip('_').lower()
    return s or 'prov'

def nettoyer_nom(name, country_fr):
    """Nom de province cohérent à partir du nom admin-1 (retire les préfixes admin)."""
    if not name:
        return country_fr
    n = re.sub(r'^(Provincia di|Provincia de|Province de|Région de|Regione|Departamento de|'
              r'Nomós|Nomos|Wilaya de|Governorate of|Muhafazat|Pav‹|İl|Ili)\s+', '', name, flags=re.I)
    return n.strip() or country_fr

def partition_contigu(geoms, k):
    """Partitionne les provinces d'un pays en k groupes CONTIGUS (croissance depuis
    des graines espacées). Garantit que chaque région est d'un seul tenant : aucune
    aire détachée n'est perdue → pas de trous. Les îles (sans voisin terrestre) sont
    rattachées au groupe le plus proche."""
    n = len(geoms)
    if k <= 1 or n <= 1:
        return [0] * n
    if n <= k:
        return list(range(n))
    cents = [g.representative_point() for g in geoms]
    # Adjacence : deux provinces se touchent (après snap, distance ~0).
    adj = [set() for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            if geoms[i].distance(geoms[j]) <= LAND_EPS:
                adj[i].add(j); adj[j].add(i)
    # Graines : la plus grande province, puis échantillonnage du point le plus éloigné.
    seeds = [max(range(n), key=lambda i: geoms[i].area)]
    while len(seeds) < k:
        best, bd = None, -1.0
        for i in range(n):
            if i in seeds:
                continue
            d = min(cents[i].distance(cents[s]) for s in seeds)
            if d > bd:
                bd, best = d, i
        seeds.append(best)
    label = [-1] * n
    sizes = [0.0] * k
    for idx, s in enumerate(seeds):
        label[s] = idx
        sizes[idx] = geoms[s].area
    # Croissance équilibrée : à chaque pas, le plus petit groupe annexe la province
    # voisine non assignée la plus proche de sa graine.
    while any(l == -1 for l in label):
        progressed = False
        for L in sorted(range(k), key=lambda L: sizes[L]):
            frontier = [i for i in range(n) if label[i] == -1
                        and any(label[j] == L for j in adj[i])]
            if not frontier:
                continue
            pick = min(frontier, key=lambda i: cents[i].distance(cents[seeds[L]]))
            label[pick] = L
            sizes[L] += geoms[pick].area
            progressed = True
            break
        if not progressed:  # restes isolés (îles) → groupe le plus proche
            for i in range(n):
                if label[i] == -1:
                    L = min(range(k), key=lambda L: cents[i].distance(cents[seeds[L]]))
                    label[i] = L
                    sizes[L] += geoms[i].area
            break
    return label


def largest_poly(geom):
    if geom.geom_type == 'Polygon':
        return geom
    polys = [g for g in geom.geoms if g.geom_type == 'Polygon']
    return max(polys, key=lambda g: g.area) if polys else None

def ring_to_game(poly):
    ext = list(poly.exterior.coords)
    pts = [project(lon, lat) for lon, lat in ext]
    ded = []
    for p in pts:
        if not ded or ded[-1] != p:
            ded.append(p)
    while len(ded) > 2 and ded[0] == ded[-1]:
        ded.pop()
    return ded

def main():
    data = json.loads(SRC.read_text())
    by_country = defaultdict(list)
    for f in data['features']:
        pr = f.get('properties', {})
        admin = pr.get('admin')
        geom = f.get('geometry')
        if not admin or not geom:
            continue
        try:
            g = shape(geom)
            if not g.is_valid:
                g = g.buffer(0)
            g = g.intersection(WINDOW)
            # Snap sur une grille COMMUNE : les sommets partagés s'alignent à
            # l'identique → l'union des provinces voisines pave sans sliver ni trou.
            g = set_precision(g, GRID)
            if not g.is_valid:
                g = g.buffer(0)
        except Exception:
            continue
        if g.is_empty or g.area < 0.02:
            continue
        by_country[admin].append((g, pr.get('name') or pr.get('gn_name') or admin))

    regions = []  # {id, nom, geom(lonlat), faction}
    used = set()
    for admin, members in by_country.items():
        geoms = [m[0] for m in members]
        names = [m[1] for m in members]
        total = sum(g.area for g in geoms)
        k = max(1, min(KMAX, round(total / AREA_DIV)))
        k = max(k, MIN_K.get(admin, 0))  # minimum imposé pour certains pays (Grèce…)
        labels = partition_contigu(geoms, k)
        nclusters = max(labels) + 1
        for j in range(nclusters):
            idxs = [i for i in range(len(geoms)) if labels[i] == j]
            if not idxs:
                continue
            grp = unary_union([geoms[i] for i in idxs])
            if grp.is_empty:
                continue
            best = max(idxs, key=lambda i: geoms[i].area)
            nom = nettoyer_nom(names[best], NOM_FR.get(admin, admin))
            # Le groupe est contigu : son union est un seul polygone (corps principal),
            # éventuellement + des îles. On garde le corps principal (toujours) et
            # seulement les ÎLES assez grandes (pas de mini-province). Aucun buffer ni
            # simplify par région : le snap commun garantit déjà un pavage net.
            morceaux = [grp] if grp.geom_type == "Polygon" else list(grp.geoms)
            morceaux = sorted((p for p in morceaux if p.geom_type == "Polygon"),
                              key=lambda p: p.area, reverse=True)
            for pi, poly in enumerate(morceaux):
                seuil = MAIN_MIN if pi == 0 else ISLAND_MIN
                if poly.area < seuil:
                    continue
                if not poly.is_valid:
                    poly = poly.buffer(0)
                    if poly.geom_type != "Polygon":
                        poly = largest_poly(poly)
                if poly is None or poly.is_empty or len(poly.exterior.coords) < 4:
                    continue
                nm = nom if pi == 0 else f"{nom} ({pi + 1})"
                sid = slug(nm)
                while sid in used:
                    sid = slug(nm) + str(len(used) % 997)
                used.add(sid)
                regions.append({'id': sid, 'nom': nm, 'admin': admin,
                                'geom': poly, 'faction': None})

    # Bouche TOUS les trous résiduels : aux frontières internationales, les provinces
    # de pays voisins (numérisées séparément) ne se joignent pas toujours, et les lacs
    # forment des anneaux. On absorbe chaque trou de l'union globale dans la province
    # qui borde le plus ce trou → couverture totale, aucune zone de mer à l'intérieur.
    union_globale = unary_union([r['geom'] for r in regions])
    parts = [union_globale] if union_globale.geom_type == 'Polygon' else list(union_globale.geoms)
    trous = []
    for part in parts:
        for ring in part.interiors:
            hp = Polygon(ring)
            if hp.is_valid and not hp.is_empty and hp.area > 1e-7:
                trous.append(hp)
    for hp in trous:
        hb = hp.buffer(GRID)  # marge pour capter les provinces qui le bordent
        best, blen = None, -1.0
        for r in regions:
            if not r['geom'].intersects(hb):
                continue
            L = r['geom'].boundary.intersection(hb).length
            if L > blen:
                blen, best = L, r
        if best is not None:
            merged = unary_union([best['geom'], hp])
            if merged.geom_type != 'Polygon':
                merged = largest_poly(merged)
            if merged is not None and not merged.is_empty:
                best['geom'] = merged

    # Projection + champs de jeu.
    for r in regions:
        r['polygone'] = ring_to_game(r['geom'])
        rp = r['geom'].representative_point()
        r['centre'] = project(rp.x, rp.y)
        r['terrain'] = classer_terrain(rp.x, rp.y, r['admin'])
        r['ressources'] = []
        # Population prédéfinie de la province (gagnée lors de l'annexion).
        r['population'] = max(4, min(22, round(r['geom'].area * 2.4)))
        r['adjacents'] = []
        r['adjacents_mer'] = []

    # Adjacence terre (touche) / mer (proche, segment traversant la mer).
    nstr = len(regions)
    allgeom = [r['geom'] for r in regions]
    sea_cand = {i: [] for i in range(nstr)}
    for i in range(nstr):
        gi = allgeom[i]
        for j in range(i + 1, nstr):
            gj = allgeom[j]
            d = gi.distance(gj)
            if d <= LAND_EPS:
                regions[i]['adjacents'].append(regions[j]['id'])
                regions[j]['adjacents'].append(regions[i]['id'])
            elif d <= SEA_MAX:
                p1, p2 = nearest_points(gi, gj)
                line = LineString([p1, p2])
                crosses = any(k != i and k != j and allgeom[k].intersects(line) for k in range(nstr))
                if not crosses:
                    sea_cand[i].append((d, j))
                    sea_cand[j].append((d, i))
    for i in range(nstr):
        for d, j in sorted(sea_cand[i])[:SEA_K]:
            jid = regions[j]['id']
            if jid not in regions[i]['adjacents'] and jid not in regions[i]['adjacents_mer']:
                regions[i]['adjacents_mer'].append(jid)
    for i in range(nstr):
        for jid in list(regions[i]['adjacents_mer']):
            j = next((k for k in range(nstr) if regions[k]['id'] == jid), None)
            if j is not None and regions[i]['id'] not in regions[j]['adjacents_mer'] \
               and regions[i]['id'] not in regions[j]['adjacents']:
                regions[j]['adjacents_mer'].append(regions[i]['id'])

    # Capitales : région contenant le point historique (nom thématique imposé).
    CAP_NAMES = {'rome': 'Latium', 'carthage': 'Égypte', 'macedoine': 'Macédoine', 'sparte': 'Laconie'}
    caps = {}
    for fid, (lon, lat) in CAPS.items():
        pt = Point(lon, lat)
        cap = next((r for r in regions if r['geom'].contains(pt)), None)
        if cap is None:
            cap = min(regions, key=lambda r: r['geom'].distance(pt))
        caps[fid] = cap
        cap['faction'] = fid
        cap['capitale'] = True
        cap['nom'] = CAP_NAMES[fid]

    out_terr = []
    for r in regions:
        d = {'id': r['id'], 'nom': r['nom'], 'faction': r['faction'], 'terrain': r['terrain'],
             'ressources': r['ressources'], 'population': r['population'],
             'polygone': r['polygone'], 'centre': r['centre'],
             'adjacents': r['adjacents'], 'adjacents_mer': r['adjacents_mer']}
        if r.get('capitale'):
            d['capitale'] = True
        out_terr.append(d)
    OUT_TERR.write_text(json.dumps({'monde': {'largeur': W, 'hauteur': H}, 'territoires': out_terr}, ensure_ascii=False), encoding='utf-8')

    start = json.loads(OUT_START.read_text())
    for fid, cap in caps.items():
        if cap and fid in start:
            for v in start[fid].get('villes', []):
                v['territoire'] = cap['id']
            for u in start[fid].get('unites', []):
                u['territoire'] = cap['id']
    OUT_START.write_text(json.dumps(start, ensure_ascii=False, indent=2), encoding='utf-8')

    # Stats
    per_country = defaultdict(int)
    for r in regions:
        per_country[r['admin']] += 1
    isolated = sum(1 for r in regions if not r['adjacents'] and not r['adjacents_mer'])
    print(f'monde {W}x{H} | provinces={len(regions)} | isolées={isolated}')
    print('capitales:', {k: (v and v['id']) for k, v in caps.items()})
    for c in ('France', 'Italy', 'Spain', 'Greece', 'Turkey', 'Germany', 'Tunisia', 'Algeria'):
        print(f'  {c}: {per_country.get(c,0)} provinces')
    print('taille:', OUT_TERR.stat().st_size, 'octets')

main()
