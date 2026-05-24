import re

js = open('frontend_v2/app.js', 'r', encoding='utf-8').read()
html = open('frontend_v2/index.html', 'r', encoding='utf-8').read()

js_ids = sorted(set(re.findall(r"getElementById\('([^']+)'\)", js)))
html_ids = sorted(set(re.findall(r'id="([^"]+)"', html)))

missing = [x for x in js_ids if x not in html_ids]
extra = [x for x in html_ids if x not in js_ids]

print(f"JS refs: {len(js_ids)}")
for x in js_ids:
    tag = " *** MISSING ***" if x in missing else ""
    print(f"  - {x}{tag}")

print(f"\nHTML ids: {len(html_ids)}")
print(f"\nMissing in HTML (JS needs, HTML missing):")
for x in missing:
    print(f"  *** {x}")
