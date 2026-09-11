"""Bounded, secretless conversation service payload for the explicit local fixture.

The shell payload is submitted and verified exactly like other adapter artifacts. It does not
claim queue ownership or perform external effects; its only result is an attributed reply.
"""


PROGRAM = r'''set -eu
c() { /usr/local/bin/ouroboros-cli --instance request "$@"; }
w=$(c GET /conditions --select /work_id)
g=$(c GET /conditions --select /delegations/0)
channel=$(c GET /work/$w/conversations --select /items/0/id)
test "$channel" != null
base=/conversations/$channel/messages
completed=0
round=0
while [ "$completed" -lt 2 ] && [ "$round" -lt 3 ]; do
  round=$((round+1))
  answered=' '
  cursor=0
  pages=0
  while [ "$pages" -lt 4 ]; do
    pages=$((pages+1))
    end=$(c GET "$base?cursor=$cursor" --select /cursor)
    i=0
    while [ "$i" -lt 8 ] && [ "$((cursor+i))" -lt "$end" ]; do
      id=$(c GET "$base?cursor=$cursor" --select /messages/$i/id)
      [ "$id" != null ] || break
      reply=$(c GET "$base?cursor=$cursor" --select /messages/$i/reply_to)
      [ "$reply" = null ] || answered="$answered$reply "
      i=$((i+1))
    done
    more=$(c GET "$base?cursor=$cursor" --select /has_more)
    [ "$more" = true ] || break
    cursor=$(c GET "$base?cursor=$cursor" --select /cursor)
  done
  cursor=0
  pages=0
  while [ "$pages" -lt 4 ] && [ "$completed" -lt 2 ]; do
    pages=$((pages+1))
    end=$(c GET "$base?cursor=$cursor" --select /cursor)
    i=0
    while [ "$i" -lt 8 ] && [ "$((cursor+i))" -lt "$end" ] && [ "$completed" -lt 2 ]; do
      id=$(c GET "$base?cursor=$cursor" --select /messages/$i/id)
      [ "$id" != null ] || break
      text=$(c GET "$base?cursor=$cursor" --select /messages/$i/text)
      case "$text" in
        service-request-*)
          case "$answered" in
            *" $id "*) ;;
            *)
              printf '{"delegation_id":"%s","text":"service-response","reply_to":"%s"}' "$g" "$id" > /workspace/reply.json
              c POST "$base" --input /workspace/reply.json --key "service-reply-$id" --select /resource_id > /workspace/reply-id
              completed=$((completed+1))
              answered="$answered$id "
              ;;
          esac
          ;;
      esac
      i=$((i+1))
    done
    more=$(c GET "$base?cursor=$cursor" --select /has_more)
    [ "$more" = true ] || break
    cursor=$(c GET "$base?cursor=$cursor" --select /cursor)
  done
  [ "$completed" -eq 2 ] || sleep 1
done
test "$completed" -eq 2
printf 'approved-adapter-result\n'
'''.encode()

# Same approved command/input on each instance. Completed result replay uses current inspect
# authority and the original protected receipt; no new effect or old instance identity is needed.
DB_PROGRAM = PROGRAM.replace(b"completed=0\n", b'''printf '%s' '{"operation":"record_result","parameters":{"marker":"bounded-service-state"}}' > /workspace/service-db.json
c POST /db/transactions --input /workspace/service-db.json --key service-state --select /result_id > /workspace/service-state-id
test -s /workspace/service-state-id
completed=0
''', 1)

DB_PROGRAM = DB_PROGRAM.replace(b'"text":"service-response"', b'"text":"service-response-%s"').replace(
    b'"$g" "$id" > /workspace/reply.json',
    b'"$g" "$(cat /workspace/service-state-id)" "$id" > /workspace/reply.json',
)

# Each request has a stable DB effect key. A failed first call stops this instance; a
# replacement can recover a claimed identity and explicitly reconcile, never auto-redispatch.
FAULT_PROGRAM = PROGRAM.replace(
    b'''              printf '{"delegation_id":"%s","text":"service-response","reply_to":"%s"}' "$g" "$id" > /workspace/reply.json''',
    b'''              printf '{"operation":"record_result","parameters":{"marker":"service-effect-%s"}}' "$id" > /workspace/effect.json
              intent=$(c POST /db/transactions --input /workspace/effect.json --key "service-effect-$id" --select /intent_id)
              result=$(c POST /resource-intents/$intent/reconcile --select /result_id)
              printf '{"delegation_id":"%s","text":"service-response-%s","reply_to":"%s"}' "$g" "$result" "$id" > /workspace/reply.json''',
)
assert FAULT_PROGRAM != PROGRAM
