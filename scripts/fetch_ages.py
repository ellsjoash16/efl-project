#!/usr/bin/env python3
"""
Fetch real player ages from TheSportsDB and update playerDB.json.
Saves after each match so progress is never lost if interrupted.
Run: python3 scripts/fetch_ages.py
"""
import json, urllib.request, urllib.parse, time
from datetime import date

DB_PATH = 'src/playerDB.json'
TODAY = date(2026, 4, 24)
DELAY = 3.0       # seconds between requests — stay well under rate limit
DEFAULT_AGE = 26  # original placeholder age in DB

def search_name(raw: str) -> str:
    parts = raw.strip().split()
    if parts[0].endswith('.') and len(parts[0]) <= 2:
        parts = parts[1:]
    return ' '.join(p.title() for p in parts)

def fetch_player(query: str):
    url = 'https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=' + urllib.parse.quote(query)
    for attempt in range(4):
        wait = [0, 10, 30, 60][attempt]
        if wait:
            print(f'  (waiting {wait}s before retry {attempt})...', end=' ', flush=True)
            time.sleep(wait)
        try:
            with urllib.request.urlopen(url, timeout=12) as r:
                data = json.loads(r.read())
                return data.get('player') or []
        except Exception as e:
            print(f'  ⚠ {e}', end=' ', flush=True)
    return []

def calc_age(birth_str: str):
    try:
        bd = date.fromisoformat(birth_str[:10])
        return TODAY.year - bd.year - ((TODAY.month, TODAY.day) < (bd.month, bd.day))
    except Exception:
        return None

def best_match(results: list, query: str):
    soccer = [r for r in results if r.get('strSport', '').lower() == 'soccer']
    pool = soccer if soccer else []
    if not pool:
        return None

    q = query.lower()
    q_words = q.split()

    # Exact full name match
    for r in pool:
        if r.get('strPlayer', '').lower() == q:
            return r
    # All query words present in player name
    for r in pool:
        name = r.get('strPlayer', '').lower()
        if all(w in name for w in q_words):
            return r
    # Exact surname match (last word)
    surname = q_words[-1]
    matches = [r for r in pool if r.get('strPlayer', '').lower().split()[-1] == surname]
    if len(matches) == 1:
        return matches[0]
    return None

def main():
    data = json.load(open(DB_PATH, encoding='utf-8'))

    to_update = [p for p in data if p['age'] == DEFAULT_AGE]
    already_done = len(data) - len(to_update)
    print(f'{already_done} players already updated, {len(to_update)} remaining.\n')

    updated = 0
    failed = []

    for i, p in enumerate(to_update):
        query = search_name(p['name'])
        print(f"[{i+1:3}/{len(to_update)}] {p['name']!r:30} → '{query}' ...", end=' ', flush=True)

        results = fetch_player(query)
        match = best_match(results, query)

        if match and match.get('dateBorn'):
            age = calc_age(match['dateBorn'])
            if age and 15 <= age <= 45:
                p['age'] = age
                # Save immediately so progress isn't lost
                json.dump(data, open(DB_PATH, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
                print(f"✓ {match['strPlayer']} born {match['dateBorn']} → age {age}")
                updated += 1
            else:
                print(f"✗ bad age ({age}) — {match.get('strPlayer')}")
                failed.append(p['name'])
        else:
            got = len([r for r in results if r.get('strSport','').lower()=='soccer'])
            print(f"✗ no soccer match (got {len(results)} total, {got} soccer)")
            failed.append(p['name'])

        time.sleep(DELAY)

    print(f'\nDone — updated {updated}/{len(to_update)} this run ({already_done + updated} total).')
    if failed:
        print(f'\nNo match found ({len(failed)}):')
        for n in failed: print(f'  {n}')

if __name__ == '__main__':
    main()
