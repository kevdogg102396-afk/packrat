import sys, tiktoken
enc = tiktoken.get_encoding("cl100k_base")
print(len(enc.encode(sys.stdin.read())))
