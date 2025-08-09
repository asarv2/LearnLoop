#!/bin/bash
set -e

PRIVATE_IP=$(hostname -I | awk '{print $1}')

exec turnserver \
   --lt-cred-mech \
   --realm="${TURN_REALM}" \
   --user="${TURN_USERNAME}:${TURN_PASSWORD}" \
   --listening-ip="${PRIVATE_IP}" \
   --relay-ip="${PRIVATE_IP}" \
   --external-ip="${TURN_PUBLIC_IP}/${PRIVATE_IP}" \
   --allocation-default-address-family=ipv4 \
   --listening-port=3478 \
   --alt-listening-port=3479 \
   --tls-listening-port=5349 \
   --min-port=49152 \
   --max-port=49552 \
   --cert=/etc/coturn/certs/fullchain.pem \
   --pkey=/etc/coturn/certs/privkey.pem \
   --fingerprint \
   --log-file=stdout \
   --verbose

