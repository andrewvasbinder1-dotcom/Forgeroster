"""Extract factual fields from saved Wahapedia 11th-edition faction pages."""
import json
import re
import sys
from pathlib import Path

from lxml import html


def elements(root, classname, direct=False):
    axis = './*' if direct else './/*'
    return root.xpath(f"{axis}[contains(concat(' ', normalize-space(@class), ' '), $classname)]",
                      classname=f' {classname} ')


def content(node):
    return ' '.join(node.text_content().split())


def texts(root, classname):
    return [content(element) for element in elements(root, classname)]


def profiles(banner):
    result = []
    invulnerable_saves = texts(banner, 'dsCharInvulValue')
    invulnerable_labels = texts(banner, 'dsCharInvulText')
    wrappers = elements(banner, 'dsProfileWrap')
    stat_keys = ('m', 't', 'sv', 'w', 'ld', 'oc')
    for wrapper in wrappers:
        stats = {}
        for index, stat in enumerate(wrapper.xpath('./*[starts-with(@class, "dsCharWrap")]')):
            names = texts(stat, 'dsCharName')
            values = texts(stat, 'dsCharValue')
            if values and index < len(stat_keys):
                stats[names[0].lower() if names else stat_keys[index]] = values[0]
        label = wrapper.getparent().getnext()
        if label is not None:
            title = re.split(r'\(', content(label), maxsplit=1)[0].strip()
            if title:
                stats['name'] = title
        if len(wrappers) == len(invulnerable_saves) == 1:
            stats['inv'] = invulnerable_saves[0]
            if any('*' in value for value in invulnerable_labels):
                stats['inv'] += '*'
        if stats:
            result.append(stats)
    return result


def weapons(body):
    result = []
    for table in elements(body, 'wTable'):
        heading = content(table[0]).upper()
        if heading.startswith('RANGED WEAPONS'):
            kind = 'ranged'
        elif heading.startswith('MELEE WEAPONS'):
            kind = 'melee'
        else:
            continue
        for row in elements(table, 'dsWeaponRow'):
            values = [content(cell) for cell in row]
            names = texts(row, 'dsWeaponName')
            if not names or len(values) < 8 or not names[0]:
                continue
            entry = {'name': names[0], 'kind': kind}
            entry.update(zip(('range', 'a', 'skill', 's', 'ap', 'd'), values[-6:]))
            keywords = texts(row, 'kwbw')
            if keywords:
                entry['keywords'] = list(dict.fromkeys(keywords))
            result.append(entry)
    return result


def extract(tree):
    units = []
    for frame in elements(tree, 'datasheet'):
        header = elements(frame, 'dsH2Header')
        body = elements(frame, 'ds2col', direct=True)
        if not header or not body:
            continue
        name = content(header[0][0])
        id_anchor = frame.getprevious()
        key_cols = elements(frame, 'ds2colKWFlat', direct=True)
        keywords = []
        if key_cols:
            for column in key_cols[0]:
                raw = column.find('span')
                if raw is not None:
                    keywords.extend(word.strip().title() for word in content(raw).split(';') if word.strip())
        abilities = []
        for cls in ('dsAbility', 'dsWargearAbilityText'):
            for rule in elements(body[0], cls):
                for label in rule.xpath('./b[1]'):
                    name_text = content(label)
                    if not name_text or not name_text.endswith(':') or len(name_text) > 130:
                        continue
                    if re.search('equipped with|is armed with|is accompanied by', name_text, re.I):
                        continue
                    abilities.append({'name': name_text.rstrip(':')})
        units.append({
            'name': name,
            'anchor': id_anchor.get('id') if id_anchor is not None else None,
            'legends': 'sLegendary' in frame.get('class', '').split(),
            'stats': profiles(elements(frame, 'dsBannerWrap', direct=True)[0]),
            'weapons': weapons(body[0]),
            'keywords': list(dict.fromkeys(keywords)),
            'abilities': abilities,
        })
    return units


capture = Path(sys.argv[1])
for source in sorted(capture.glob('waha-*.html')):
    units = extract(html.parse(source))
    assert units, f'{source} has no recognizable datasheets'
    source.with_suffix('.json').write_text(json.dumps(units, ensure_ascii=False), encoding='utf-8')
    print(source.stem, len(units))
