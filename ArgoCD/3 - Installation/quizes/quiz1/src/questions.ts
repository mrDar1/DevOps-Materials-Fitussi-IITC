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
      "In a traditional CI/CD pipeline deployment flow, how is the state of the target environment (such as a Kubernetes cluster) ultimately altered?",
    options: [
      "The CI/CD pipeline executes imperative deployment commands (such as kubectl apply or helm upgrade) directly against the target environment's API after successful build and test stages.",
      "An agent running inside the target environment continuously polls the CI/CD server for new container images and autonomously applies them to the cluster whenever a version difference is detected.",
      "The target environment exposes a secure webhook that the Git repository calls on each commit, delivering the updated source payload directly to the cluster's internal build and reconciliation system.",
      "Developers must manually download compiled build artifacts from the CI/CD platform's artifact storage and securely upload them to the target cluster via an approved administrative transfer protocol.",
      "The CI/CD pipeline merges all approved changes into a dedicated deployment branch that maps directly to the cluster's persistent storage layer, bypassing any external network API calls entirely.",
    ],
    correct: 0,
  },
  {
    question:
      "A team uses the following CI/CD pipeline script to deploy their application. What is the primary operational flaw in this deployment approach regarding infrastructure state?",
    code: `stages:
  - build
  - deploy

build_image:
  stage: build
  script:
    - docker build -t webapp:\${CI_COMMIT_SHA} .
    - docker push registry.example.com/webapp:\${CI_COMMIT_SHA}

deploy_to_cluster:
  stage: deploy
  script:
    - kubectl set image deployment/webapp container=registry.example.com/webapp:\${CI_COMMIT_SHA}`,
    options: [
      "It imperatively alters the live cluster state without updating the declarative manifest files stored in the Git repository, resulting in immediate configuration drift.",
      "The docker build command does not specify a Dockerfile path, causing the build stage to fail with a context resolution error before the pipeline ever reaches the deployment stage.",
      "The pipeline executes the deployment stage before the image upload to the registry is fully confirmed, creating a race condition in the Kubernetes deployment controller that can cause pod failures.",
      "The kubectl set image command requires the target deployment to be temporarily suspended before the container image can be safely swapped, resulting in an entirely unnecessary and avoidable service downtime window.",
      "It uses a specific commit SHA as the image tag rather than the conventional latest tag, which causes the cluster to reject the pull request entirely due to local node image caching validation rules.",
    ],
    correct: 0,
  },
  {
    question:
      "A deployment manifest in Git defines replicas: 2 and was deployed via a push pipeline. An admin manually runs 'kubectl scale deployment frontend --replicas=8' during a traffic spike. Later, a minor README typo fix triggers the pipeline, ending with 'kubectl apply -f deployment.yaml'. What is the exact outcome?",
    options: [
      "The pipeline detects the configuration drift, pauses the deployment process, and requires a manual approval step from the administrator to explicitly resolve the replica count conflict.",
      "The cluster's admission controller blocks the pipeline's apply request because the live state was modified manually and the resource is now considered locked against further automated changes.",
      "The pipeline overrides the manual intervention, instantly scaling the deployment from 8 replicas back down to 2, potentially causing a service outage.",
      "The pipeline apply succeeds but intelligently merges the configurations, preserving the administrator's 8 replicas while only updating the pod template annotations tied to the new Git commit hash.",
      "The deployment first scales down to zero replicas briefly, then back up to 2, ensuring a fully clean and atomic application of the new desired state as defined in the repository manifest.",
    ],
    correct: 2,
  },
  {
    question:
      "Why does the traditional push deployment model frequently lead to poor auditability in production environments?",
    options: [
      "Because most CI/CD platforms are configured to automatically purge execution logs and pipeline run history after a retention window, making the complete history of automated deployments permanently inaccessible to auditors.",
      "Because emergency changes and scaling operations are often executed directly via the cluster API, bypassing the version control system and leaving no persistent history of the intent or author.",
      "Because the Kubernetes API server does not persistently record the originating IP address or authenticated username for every deployment command, making it technically impossible to trace the source of any given cluster change.",
      "Because push-based pipelines authenticate to the cluster using shared service accounts, causing every automated deployment to appear in audit logs as the CI/CD system account rather than the individual developer who triggered it.",
      "Because compiled container images are inherently opaque binary artifacts, meaning security and compliance teams have no reliable way to reconstruct or audit the exact runtime contents of a previously pushed deployment.",
    ],
    correct: 1,
  },
  {
    question:
      "Four microservices (A, B, C, D) are deployed via separate CI/CD push pipelines. A coordinated feature update to all four causes critical errors. Why is rollback highly stressful and complex in a traditional push model?",
    options: [
      "The Kubernetes cluster automatically suspends all Deployment controllers when a CrashLoopBackOff is detected across any pod, blocking every external pipeline from applying further rollout updates until the affected nodes are fully recovered.",
      "The push-based registry cleanup policy automatically removes outdated container image tags to optimize storage, forcing the team to fully recompile each microservice from source code before any rollback pipeline can be executed.",
      "A Kubernetes Deployment cannot safely revert to a previous image version without completely removing the live resource first and tolerating total service downtime throughout the entire pod recreation and startup period.",
      "Operators must manually determine the last known good combination of artifact versions across all four services and individually re-run the respective pipelines with those older versions.",
      "Git enforces strict immutability on commits that have already triggered and completed a CI/CD pipeline run, preventing any revert and requiring the team to author a completely new forward-fix patch instead of rolling back.",
    ],
    correct: 3,
  },
  {
    question:
      "A team uses the following pipeline to promote apps from staging to production. What is the primary architectural vulnerability regarding environment consistency?",
    code: `promote_to_production:
  stage: promote
  script:
    - export KUBECONFIG=$PROD_CLUSTER_CREDENTIALS
    - helm upgrade main-app ./helm-charts \\
        --set environment=production \\
        --set db_host=$PROD_DB \\
        --set replicas=5`,
    options: [
      "The helm upgrade command is missing the --install flag, causing it to fail with a release-not-found error when the application chart has not been previously deployed to this specific production environment.",
      "Injecting database connection strings and sensitive environment variables directly through Helm --set flags causes the built-in schema validator to reject the release and abort the entire production deployment process.",
      "Exporting a KUBECONFIG credential file as a plain shell variable inside a shared CI/CD runner directly violates cluster network security protocols and will be blocked by the production environment's firewall rules.",
      "The pipeline references the raw Helm chart source directory (./helm-charts) directly without first packaging it into a versioned artifact, causing the release controller to reject the uncompiled chart payload on ingestion.",
      "Crucial configuration details (such as replica counts and environment flags) are embedded directly within the imperative pipeline execution script rather than being version-controlled.",
    ],
    correct: 4,
  },
];
