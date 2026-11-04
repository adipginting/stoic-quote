# K3s Deployment for Stoic Quote

These manifests deploy the **Stoic Quote** stack (NestJS API + TanStack Start
web) to a [K3s](https://k3s.io/) cluster. The images are built by GitHub
Actions and pushed to Docker Hub; the `deploy` job pins the running
deployments to the pushed commit SHA with `kubectl set image`.

## Files

| File | Purpose |
|------|---------|
| `namespace.yaml` | Isolates the stack in its own namespace (`stoic-quote`). |
| `api-pvc.yaml` | 1Gi `local-path` volume holding the production SQLite file. |
| `api-deployment.yaml` | Single API pod (SQLite single writer, `Recreate`), PVC at `/data`, probes on `/health`, secrets. |
| `api-service.yaml` | Exposes the API inside the cluster via `ClusterIP` (80 → 3000). |
| `web-deployment.yaml` | Two web pods with rolling updates, probes on `/`, `API_URL` pointing at the API service. |
| `web-service.yaml` | Exposes the web app inside the cluster via `ClusterIP` (80 → 3000). |
| `ingress.yaml` | Routes `stoic.jktlug.id` → web and `api.stoic.jktlug.id` → api. |
| `web-hpa.yaml` | Scales the web deployment 2 → 6 on CPU/memory utilization. |
| `web-pdb.yaml` | Keeps at least one web pod available during node maintenance. |
| `dev/` | Overlay for a local single-node k3s (see below). |

There is intentionally **no HPA or PDB for the API**: it is a single-replica,
`Recreate` workload because `better-sqlite3` cannot share one SQLite file
across pods, and its `local-path` volume is `ReadWriteOnce`.

## Prerequisites

1. A running K3s cluster (single-node is fine; K3s ships with Traefik).
2. The GitHub Actions CI/CD workflow has pushed images to Docker Hub:
   ```
   <DOCKERHUB_USERNAME>/stoic-quote-api:latest
   <DOCKERHUB_USERNAME>/stoic-quote-web:latest
   ```
   If your Docker Hub repository is private, create a pull secret and add it
   to both deployments:
   ```bash
   kubectl create secret docker-registry dockerhub-pull-secret \
     --namespace stoic-quote \
     --docker-server=https://index.docker.io/v1/ \
     --docker-username=<DOCKERHUB_USERNAME> \
     --docker-password=<DOCKERHUB_TOKEN>
   ```
3. DNS A/AAAA records pointing `stoic.jktlug.id` and `api.stoic.jktlug.id` to
   your K3s node(s) or a load balancer in front of them.

## Application secret

The API reads four optional keys. Every reference uses `optional: true`, so
pods start even when the secret (or some of its keys) does not exist yet.

```bash
kubectl create secret generic stoic-quote-secrets \
  --namespace stoic-quote \
  --from-literal=DEEPSEEK_API_KEY=... \
  --from-literal=UNSPLASH_ACCESS_KEY=...
```

Add `--from-literal=DEEPSEEK_BASE_URL=...` and
`--from-literal=DEEPSEEK_MODEL=...` as needed.

### Observability (optional)

Traces and logs are exported over OTLP only when `OTEL_EXPORTER_OTLP_ENDPOINT`
is set; with the key absent the SDK is a no-op and both services just log JSON
to stdout. Add the endpoint and its authorization header to the same secret:

```bash
--from-literal=OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-<zone>.grafana.net/otlp \
--from-literal=OTEL_EXPORTER_OTLP_HEADERS='Authorization=Basic <base64(instanceId:token)>'
```

The two services report as `stoic-quote-api` and `stoic-quote-web`; pino log
lines include `trace_id`/`span_id`, and web→api requests share one trace via
W3C `traceparent` propagation.

## Quick start

Apply in this order — the namespace first, then the SQLite volume, then the
workloads:

```bash
kubectl apply -f k3s/namespace.yaml
kubectl apply -f k3s/api-pvc.yaml
kubectl apply -f k3s/
```

Check the rollout and the exposed endpoints:

```bash
kubectl rollout status deployment/stoic-quote-api -n stoic-quote
kubectl rollout status deployment/stoic-quote-web -n stoic-quote

kubectl get pods -n stoic-quote
kubectl get ingress -n stoic-quote
```

Roll back or re-pin an image:

```bash
kubectl rollout undo deployment/stoic-quote-api -n stoic-quote
kubectl set image deployment/stoic-quote-api \
  api=<DOCKERHUB_USERNAME>/stoic-quote-api:<sha> -n stoic-quote
```

## TLS / Let's Encrypt

The `tls` block in `ingress.yaml` is commented out. To enable HTTPS, install
**cert-manager** plus a `ClusterIssuer` (e.g. the Let's Encrypt production
issuer), then uncomment the block:

```yaml
tls:
  - hosts:
      - stoic.jktlug.id
      - api.stoic.jktlug.id
    secretName: stoic-quote-tls
```

cert-manager creates the `stoic-quote-tls` secret; do not create it manually.

## Local testing without real DNS

```bash
# Reach the API by port-forward
kubectl port-forward -n stoic-quote svc/stoic-quote-api 3000:80

# Reach the web app by port-forward
kubectl port-forward -n stoic-quote svc/stoic-quote-web 8080:80
```

## Dev overlay (`k3s/dev/`)

`k3s/dev/` deploys the same stack into the `stoic-quote-dev` namespace from
locally built images (`docker.io/library/stoic-quote-api:dev` /
`stoic-quote-web:dev`, `imagePullPolicy: IfNotPresent`), with one replica each
and an `emptyDir` instead of a PVC — dev SQLite state is disposable.

Use the helper script from the repository root:

```bash
bin/dev-deploy.sh              # build, import into k3s, apply, roll out
bin/dev-deploy.sh --skip-build # reuse the existing local images
```

The script saves both images and imports them with
`sudo k3s ctr images import -`, applies `k3s/dev/`, and restarts both
deployments.

Endpoints (k3s Klipper LB binds the LoadBalancer ports on the host):

| URL | Service |
|-----|---------|
| http://localhost:8080 | web |
| http://localhost:8081 | api |

For ingress-based access, add the Traefik IP to `/etc/hosts` (the script
prints the exact line):

```
<traefik-ip>  stoic-quote.local api.stoic-quote.local
```

Then open <http://stoic-quote.local> and <http://api.stoic-quote.local>.

The dev pods read the same `stoic-quote-secrets` references with
`optional: true`, so you only need to create that secret in the dev namespace
if you want the AI/Unsplash features locally:

```bash
kubectl create secret generic stoic-quote-secrets \
  --namespace stoic-quote-dev \
  --from-literal=DEEPSEEK_API_KEY=... \
  --from-literal=UNSPLASH_ACCESS_KEY=...
```
