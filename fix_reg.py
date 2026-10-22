with open('make_template_report.py', 'r', encoding='utf-8') as f:
    content = f.read()
old = '"PON SAMYAK M S (310624148061)"'
new = '"PON SAMYAK M S (310624148061 / 310622104088)"'
content = content.replace(old, new)
with open('make_template_report.py', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done.')
