export interface Question {
  question: string;
  options: string[];
  correct: number;
  code?: string;
  explanation?: string;
}

export const questions: Question[] = [
  {
    question:
      "In a GitOps workflow, the target system must be managed declaratively. What does this principle strictly require?",
    options: [
      "The system automatically parses application source code on each commit and generates the required deployment commands, which are applied sequentially to each target environment to reach the correct operational state.",
      "The desired state of the system is expressed as configuration files (such as Kubernetes manifests) that define the final expected outcome, rather than scripts detailing the steps to achieve it.",
      "The infrastructure must be provisioned through a web-based GUI in which an administrator configures and declares each required resource and its settings, which the platform then applies to the target environment.",
      "Developers must formally document and declare their deployment intentions in an approved change management ticketing system before they are permitted to trigger any automated deployment pipeline run.",
      "The CI/CD pipeline executes imperative shell commands enhanced with declarative configuration flags, which are interpreted by the cluster's API server to directly modify the current running workload state.",
    ],
    correct: 1,
  },
  {
    question:
      "What is the primary architectural reason for separating the application source code and the deployment configuration into two distinct Git repositories in a GitOps workflow?",
    options: [
      "It enables the production cluster to directly fetch raw application source code from the version control system and compile each release internally, ensuring that compiled binaries never leave the secure cluster network boundary.",
      "It satisfies a strict technical requirement of the Kubernetes API, which is architecturally incapable of correctly parsing or validating repositories that mix raw application source code with YAML deployment manifest definitions.",
      "It isolates application build triggers from infrastructure state changes, preventing a continuous integration loop from automatically altering the cluster state without explicit configuration updates.",
      "It enforces role-based access segregation by preventing application developers from reading the deployment configuration, ensuring only authorized security administrators can inspect or modify the current live cluster state.",
      "It significantly reduces storage and bandwidth costs on the version control platform by distributing build artifacts and compiled binaries across multiple independently versioned and deduplicated repository segments per service.",
    ],
    correct: 2,
  },
  {
    question:
      "A Kubernetes Deployment is managed by a GitOps agent. The configuration repository contains the definition below. A cluster administrator manually scales the deployment to 5 replicas. What is the immediate resulting state in the GitOps workflow?",
    code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-api
spec:
  replicas: 3`,
    options: [
      "The GitOps agent automatically commits a manifest update to the repository, changing the replicas value from 3 to 5 to align the declared desired state with the administrator's manually applied live cluster change.",
      "The cluster rejects the administrator's manual kubectl command outright, since Deployment resources actively tracked by a GitOps agent are automatically protected against any direct imperative modification via the API.",
      "The GitOps agent removes the current Deployment resource and immediately recreates it from the manifest stored in Git, enforcing the declared replica count of 3 through a complete resource teardown and rebuild cycle.",
      "The GitOps agent continuously monitors the live cluster, detects that the live state (5 replicas) diverges from the desired state (3 replicas) in Git, and marks the application as out-of-sync.",
      "The manual scale operation succeeds and persists in the cluster, while the GitOps agent silently updates its internal reconciliation cache to treat 5 replicas as the new permanent desired baseline going forward.",
    ],
    correct: 3,
  },
  {
    question:
      "A team manages their infrastructure using GitOps. They use the following image tag in their production deployment manifest. Why does this configuration violate the GitOps principle of versioned and immutable state?",
    code: `containers:
  - name: web-server
    image: registry.example.com/web-server:latest`,
    options: [
      "The tag points to a mutable reference that changes over time, meaning the exact same Git commit could result in completely different software running in the cluster depending on when it is pulled.",
      "The container name web-server is a system-reserved identifier in Kubernetes that conflicts with an internal controller namespace, making it invalid for use in any GitOps-managed deployment manifest within the cluster.",
      "The container registry URL does not include the required https:// scheme prefix, which causes the GitOps agent's credential helper to fail image pull authentication and prevents the container from being scheduled.",
      "GitOps mandates that all production container images be hosted in a registry running inside the cluster's internal network, rather than referencing any external registry service reachable over the public internet.",
      "The deployment configuration is missing the required imagePullPolicy directive, which in a GitOps-managed environment defaults to Never, causing the kubelet to skip the image pull and fail to start the container.",
    ],
    correct: 0,
  },
  {
    question:
      "How does the pull mechanism in GitOps fundamentally improve security compared to a traditional CI/CD pipeline?",
    options: [
      "The external CI/CD server issues scoped, ephemeral tokens per pipeline run, using them to push manifests to the cluster and immediately invalidating the credential once deployment is fully confirmed complete.",
      "The cluster enforces strict inbound network policies that disable all external ingress routes by default, preventing any external party from accessing the deployed applications or interacting with internal services.",
      "The cluster authenticates all update requests by requiring operators to physically connect a registered hardware security key to an authorized workstation before any pull cycle or configuration change can proceed.",
      "The version control system opens a persistent reverse SSH tunnel to the cluster's control plane, through which the repository server actively streams new configuration payloads to the Kubernetes API endpoint.",
      "The cluster pulls its own configuration from the version control system, eliminating the need to expose cluster administrative credentials to an external CI/CD server.",
    ],
    correct: 4,
  },
  {
    question:
      "A GitOps agent is configured with automatic synchronization enabled. The configuration repository contains the Service definition below. A developer accidentally deletes this Service using a command-line interface. What sequence of events immediately follows?",
    code: `apiVersion: v1
kind: Service
metadata:
  name: cache-service
spec:
  type: ClusterIP
  ports:
    - port: 6379`,
    options: [
      "The agent detects that the live resource is missing, compares it against the Git repository which dictates it should exist, and automatically recreates the Service to restore the desired state.",
      "The agent suspends its sync cycle and sends a critical alert to the operations team, holding the cluster in a suspended reconciliation state until an administrator manually approves the recreation of the Service.",
      "The agent detects the deletion event and automatically commits a manifest removal directly to the configuration repository, updating the declared desired state to reflect the current live state of the cluster.",
      "The cluster's control plane enters a hard-crash failure state when the essential Service is deleted, disrupting networking for all dependent workloads and requiring a complete reboot of the affected node pool to recover.",
      "The agent ignores the deletion event because its reconciliation loop is configured to track resource updates and creations only, with resource deletions explicitly excluded from the set of cluster events it monitors.",
    ],
    correct: 0,
  },
];
