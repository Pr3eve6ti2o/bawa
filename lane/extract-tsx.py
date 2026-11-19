import re
import sys

text = open(sys.argv[1]).read()
m = re.search(r'```tsx\n(.*)\n```', text, re.S)
assert m, 'no tsx block found'
open(sys.argv[2], 'w').write(m.group(1) + '\n')
print('extracted', len(m.group(1).splitlines()), 'lines')
