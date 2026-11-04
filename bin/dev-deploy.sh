#!/usr/bin/env bash
# Local dev loop: rebuild the app images, load them into k3s, roll out the
# dev deployments.
#
# Usage:
#   bin/dev-deploy.sh             # rebuild api + web, import, roll out
#   bin/dev-deploy.sh --skip-build # reuse the existing local images
#
# Requires: docker, kubectl, and sudo for `k3s ctr images import`.
set -euo pipefail

cd "$(dirname "$0")/.."

API_IMAGE="docker.io/library/stoic-quote-api:dev"
WEB_IMAGE="docker.io/library/stoic-quote-web:dev"
NAMESPACE="stoic-quote-dev"

if [[ "${1:-}" != "--skip-build" ]]; then
    echo "==> Building image $API_IMAGE"
    docker build -f apps/api/Dockerfile -t "$API_IMAGE" .

    echo "==> Building image $WEB_IMAGE"
    docker build -f apps/web/Dockerfile -t "$WEB_IMAGE" .
fi

echo "==> Importing images into k3s containerd (may prompt for sudo password)"
# Resolve the full path: sudo's secure_path may not include /usr/local/bin
K3S_BIN="$(command -v k3s || echo /usr/local/bin/k3s)"
docker save "$API_IMAGE" "$WEB_IMAGE" | sudo "$K3S_BIN" ctr images import -

echo "==> Applying k3s/dev manifests"
kubectl apply -f k3s/dev/

echo "==> Rolling out"
kubectl rollout restart deployment/stoic-quote-api -n "$NAMESPACE"
kubectl rollout restart deployment/stoic-quote-web -n "$NAMESPACE"
kubectl rollout status deployment/stoic-quote-api -n "$NAMESPACE"
kubectl rollout status deployment/stoic-quote-web -n "$NAMESPACE"

TRAEFIK_IP="$(kubectl get svc traefik -n kube-system \
    -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)"

cat <<EOF

==> Done. The dev stack is exposed via k3s Klipper LB:

    http://localhost:8080        (web)
    http://localhost:8081        (api)

    # Alternative: ingress via Traefik — add to /etc/hosts:
    ${TRAEFIK_IP:-<traefik-ip>}  stoic-quote.local api.stoic-quote.local
    # then open http://stoic-quote.local and http://api.stoic-quote.local
EOF
