# DevSecOps Module

## Overview

DevSecOps integrates security practices into every phase of the DevOps pipeline — shifting security left so that vulnerabilities are caught early, automatically, and continuously rather than as an afterthought at release time.

---

## Core Topics

1. Introduction to DevSecOps
2. Threat Modeling and Security by Design
3. Static Application Security Testing (SAST)
4. Software Composition Analysis (SCA)
5. Container and Image Security
6. Secrets Management
7. Dynamic Application Security Testing (DAST)
8. Infrastructure Security and IaC Scanning
9. CI/CD Pipeline Security
10. Compliance as Code
11. Incident Response and Security Monitoring

---

## 1. Introduction to DevSecOps

### 1.1 What Is DevSecOps?

DevSecOps is the practice of embedding security controls, tooling, and culture directly into the DevOps workflow. Instead of a separate security review gate at the end of development, every developer, operations engineer, and security professional shares responsibility for security throughout the software delivery lifecycle.

Key principles:
- **Shift Left** — find and fix security issues as early as possible (ideally at the developer's workstation)
- **Automation First** — manual security reviews do not scale; automate checks in every pipeline stage
- **Continuous Feedback** — developers receive immediate, actionable security findings
- **Shared Responsibility** — security is not a separate team's job; it belongs to everyone

### 1.2 Why DevSecOps Matters

Traditional security models gate releases on a final audit, which creates bottlenecks and surfaces problems too late to fix cheaply. Common consequences:

- Vulnerabilities discovered in production are 100× more expensive to fix than those caught at code commit
- Compliance frameworks (SOC 2, PCI-DSS, ISO 27001) increasingly require automated evidence of continuous security controls
- Supply-chain attacks (e.g., compromised open-source packages) require automated dependency scanning at every build

---

## 2. Threat Modeling and Security by Design

### 2.1 STRIDE Model

| Threat | Description | Example |
|---|---|---|
| Spoofing | Impersonating another user or system | Stolen JWT tokens |
| Tampering | Modifying data in transit or at rest | Altering API request payloads |
| Repudiation | Denying an action was taken | No audit logs for admin actions |
| Information Disclosure | Exposing sensitive data | Returning stack traces to clients |
| Denial of Service | Making a service unavailable | Unbounded resource consumption |
| Elevation of Privilege | Gaining unauthorized permissions | SSRF to access cloud metadata |

### 2.2 Applying Threat Modeling in a DevOps Context

- Model threats during the design phase (before code is written)
- Review the threat model when architecture changes
- Use data-flow diagrams (DFDs) to identify trust boundaries
- Automate control checks (e.g., enforce HTTPS, validate JWT signatures) in code and pipeline gates

---

## 3. Static Application Security Testing (SAST)

SAST tools analyze source code without executing it, looking for insecure patterns.

### Common Tools

| Tool | Language Support | Notes |
|---|---|---|
| Semgrep | Multi-language | Rule-based, highly configurable |
| Bandit | Python | Lightweight, easy CI integration |
| ESLint security plugins | JavaScript/TypeScript | Integrates with existing linters |
| Checkov | Terraform / IaC | Infrastructure-focused SAST |

### Pipeline Integration Example (GitHub Actions)

```yaml
- name: Run Semgrep
  uses: returntocorp/semgrep-action@v1
  with:
    config: p/owasp-top-ten
```

---

## 4. Software Composition Analysis (SCA)

SCA scans third-party dependencies for known vulnerabilities (CVEs).

### Common Tools

- **Dependabot** — native GitHub integration, auto-raises PRs for vulnerable packages
- **Snyk** — deep language support, license compliance checks
- **OWASP Dependency-Check** — open-source, integrates with most CI systems
- **Trivy** — scans containers, filesystems, and Git repositories

### Best Practices

- Pin dependency versions and use lock files (`package-lock.json`, `poetry.lock`, `go.sum`)
- Block builds on critical/high CVEs
- Review and merge dependency update PRs promptly
- Maintain a software bill of materials (SBOM) — `syft` or `cyclonedx` can generate one automatically

---

## 5. Container and Image Security

### Image Hardening

- Use minimal base images (`distroless`, `alpine`)
- Run containers as a non-root user
- Set the filesystem to read-only where possible
- Remove unnecessary tools from the final image (multi-stage builds)

### Scanning Images

```bash
# Scan a local image with Trivy
trivy image myapp:latest

# Fail the build if HIGH or CRITICAL vulnerabilities are found
trivy image --exit-code 1 --severity HIGH,CRITICAL myapp:latest
```

### Kubernetes Security Context

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop:
      - ALL
```

---

## 6. Secrets Management

### The Golden Rule

**Never commit secrets to source control.** Not even in private repositories. Rotation and revocation become nearly impossible once a secret is in git history.

### Tools and Approaches

| Approach | Tool | Use Case |
|---|---|---|
| Secret scanning | `gitleaks`, `trufflehog`, GitHub Secret Scanning | Detect accidental commits |
| CI/CD secrets | GitHub Actions Secrets, GitLab CI Variables | Inject at runtime, never logged |
| Runtime secrets | HashiCorp Vault, AWS Secrets Manager, Azure Key Vault | Dynamic credentials, rotation |
| Kubernetes | External Secrets Operator, Sealed Secrets | Sync secrets into cluster safely |

### Detecting Leaked Secrets in Pipelines

```yaml
- name: Detect secrets with Gitleaks
  uses: gitleaks/gitleaks-action@v2
```

---

## 7. Dynamic Application Security Testing (DAST)

DAST tests a running application by sending malicious inputs, simulating an attacker.

### Common Tools

- **OWASP ZAP** — open-source, active and passive scanning modes
- **Burp Suite** — industry standard for manual and automated web testing
- **Nuclei** — template-based, fast, community-driven

### Pipeline Integration

```yaml
- name: ZAP Baseline Scan
  uses: zaproxy/action-baseline@v0.12.0
  with:
    target: 'https://staging.example.com'
```

---

## 8. Infrastructure Security and IaC Scanning

Infrastructure as Code introduces the same risk surface as application code: misconfigurations can expose resources publicly or grant excessive permissions.

### Tools

| Tool | Targets | Notes |
|---|---|---|
| Checkov | Terraform, CloudFormation, Kubernetes | 1000+ built-in checks |
| tfsec | Terraform | Fast, integrates with `terraform plan` output |
| Kube-score | Kubernetes manifests | Scores manifests against best practices |
| kube-bench | Running Kubernetes nodes | CIS Kubernetes Benchmark checks |

### Example Checkov Run

```bash
checkov -d ./terraform --framework terraform --compact
```

---

## 9. CI/CD Pipeline Security

The pipeline itself is an attack surface. Compromising a pipeline gives an attacker the ability to inject code into every artifact it produces.

### Best Practices

- **Pin action versions** to a commit SHA, not a mutable tag (`uses: actions/checkout@11bd71901...`)
- **Least-privilege tokens** — use `permissions:` blocks in GitHub Actions to restrict the `GITHUB_TOKEN`
- **Isolated runners** — avoid sharing runners between untrusted repositories
- **Review third-party actions** before use; prefer official actions
- **Protect the default branch** — require PR reviews and passing status checks before merge
- **Audit pipeline logs** — store and alert on anomalies

### Minimal Permissions Example

```yaml
permissions:
  contents: read
  id-token: write   # only if OIDC is needed
```

---

## 10. Compliance as Code

Security compliance requirements (SOC 2, PCI-DSS, HIPAA) can be enforced automatically using policy-as-code tools.

### Tools

- **Open Policy Agent (OPA) / Gatekeeper** — Kubernetes admission control
- **Conftest** — test configuration files against OPA policies
- **AWS Config / Azure Policy** — cloud resource compliance
- **InSpec** — infrastructure compliance testing

### Example OPA Policy (deny public S3 buckets)

```rego
deny[msg] {
  input.resource_changes[_].type == "aws_s3_bucket"
  input.resource_changes[_].change.after.acl == "public-read"
  msg := "S3 bucket must not have public-read ACL"
}
```

---

## 11. Incident Response and Security Monitoring

### Key Capabilities

- **Centralized logging** — aggregate logs from all services (ELK Stack, Loki, CloudWatch)
- **SIEM** — correlate events and alert on anomalies (Splunk, Elastic SIEM, Microsoft Sentinel)
- **Runtime threat detection** — detect malicious behavior inside running containers (Falco, Sysdig)
- **Alerting** — PagerDuty, Opsgenie, or Slack integrations for critical security events

### Falco Rule Example

```yaml
- rule: Unexpected outbound connection from container
  desc: Detects unexpected network connections from a container
  condition: >
    outbound and container and not proc.name in (allowed_processes)
  output: >
    Unexpected outbound connection (user=%user.name command=%proc.cmdline
    connection=%fd.name container=%container.name)
  priority: WARNING
```

---

## Quick Reference: DevSecOps Toolchain

| Pipeline Stage | Security Action | Recommended Tool |
|---|---|---|
| Pre-commit | Secret scanning | `gitleaks` |
| Build | SAST | Semgrep, Bandit |
| Build | SCA | Snyk, Trivy, Dependabot |
| Build | Container scan | Trivy |
| Build | IaC scan | Checkov, tfsec |
| Deploy | Policy enforcement | OPA/Gatekeeper |
| Runtime | Threat detection | Falco |
| Runtime | Monitoring/SIEM | ELK, Splunk |

---

## Further Reading

- [OWASP DevSecOps Guideline](https://owasp.org/www-project-devsecops-guideline/)
- [NIST Secure Software Development Framework (SSDF)](https://csrc.nist.gov/Projects/ssdf)
- [CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks)
- [CNCF Security Whitepaper](https://github.com/cncf/tag-security/blob/main/security-whitepaper/CNCF_cloud-native-security-whitepaper-May2022-v2.pdf)
