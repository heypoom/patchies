jump start

add_pattern:
    push 0xAA        ; 170
    push 0b11001100  ; 204
    push 01024       ; 1024
    return

start:
    call add_pattern
    call add_pattern
