# CI/CD Module Lesson Plan

## Full Course Topics Overview

1. Introduction to the CI/CD World
2. Introduction to GitHub Actions
3. Workflows, Events, and Runners
4. Working with YAML and Building Pipelines
5. Automated Build Processes
6. Integrating Docker into CI/CD
7. Working with Secrets and Environment Variables
8. Automated Deployments
9. Working with Cloud Providers
10. Monitoring, Logs, and Debugging
11. CI/CD Best Practices and Modern Architecture

---

## 1. Introduction to the CI/CD World

Based on Presentation 8.1

### 1.1 Moving from Manual Work to Automation

Explain that in modern environments applications are constantly changing, developers work simultaneously, and new code is pushed to GitHub every few minutes. In this reality it is no longer possible to rely on manual work or local builds on a developer laptop because every developer works with a different environment, different versions, and different dependencies. The goal is to help students understand why organizations need a centralized and consistent process that can pull the latest code, perform builds, run tests, and verify that the system can actually work correctly.

Things the central server should know how to do:

- Pull code automatically
- Run builds
- Execute tests
- Create Docker images
- Store secrets and passwords
- Perform deployments
- Work consistently without human dependency

The main point is that the goal of DevOps is to reduce as many manual operations as possible and move them into stable, fast, and reliable automation.

---

### 1.2 Why Manual Processes No Longer Work

Explain why manual processes are no longer suitable for modern systems. In the past, build and deployment processes were done manually, which consumed a lot of time and created many human errors. A single forgotten command or incorrect version could break the entire production environment.

Examples of a manual process:

- Developer pushes code to GitHub
- Files are copied manually to a server
- Build is executed manually
- Files are uploaded manually to a testing server
- QA checks are performed manually
- Deployment to Production is done manually

Emphasize that this process is:

- Slow
- Unstable
- Not scalable
- Highly dependent on people

---

### 1.3 The Importance of Automated Testing

Explain the importance of automated testing before every deployment. In modern environments it is impossible to rely on someone remembering to test the system manually. Once code is pushed, the system should automatically verify that everything still works correctly before moving to the next stages.

Basic flow:

1. Developer pushes code
2. Build process starts
3. Automated tests run
4. If something fails, the process stops
5. If everything passes, deployment continues

The goal is to prevent broken code from reaching Production.

---

### 1.4 Initial Introduction to CI/CD

Introduce the concepts of CI/CD in a simple way without going too deep technically. Explain that CI, Continuous Integration, is the process where every code change is automatically tested and built, while CD, Continuous Delivery / Deployment, is the stage where the system automatically deploys changes into different environments.

It is important to connect students to real-world scenarios and explain that modern systems usually contain multiple workflows, where each workflow is responsible for a different task inside the automation pipeline.

Examples of common workflows:

- Workflow that runs tests when a Pull Request is opened
- Workflow that performs a build after a push to main
- Workflow that creates and pushes a Docker image to a registry
- Workflow that performs automatic deployment to Production
- Workflow that runs nightly backups or security scans

The main idea is understanding that the entire process works automatically without depending on human interaction.

---

### 1.5 Introduction to Common CI/CD Tools

Present the main CI/CD tools in a high-level way and explain that all of them work around the same idea: detecting code changes, running pipelines, performing builds, running tests, and eventually deploying automatically.

Main tools:

- Jenkins
- GitHub Actions
- GitLab CI/CD

Explain that the course will mainly focus on GitHub Actions because of its simplicity and native integration with GitHub.

---

### 1.6 The Big Picture: How a Modern System Works

Present the big picture of a modern infrastructure and explain how all components connect together into one automated process.

General flow:

1. Developers push code to GitHub
2. CI/CD pipeline is triggered
3. Build process starts
4. Docker image is created
5. Automated tests run
6. Deployment to testing environment
7. After approval, deployment to Production
8. Kubernetes runs the containers
9. Monitoring systems track the environment

The goal is to demonstrate that this entire chain can work automatically from start to finish.

---

### 1.7 DevOps as a Culture

Conclude by explaining that DevOps is not only about tools, but about an entire culture focused on creating faster, more stable, and more automated collaboration between development, infrastructure, and QA teams.

Main concepts:

- Automation
- Collaboration
- CI/CD
- Monitoring
- Fast and continuous delivery
- Reducing human errors

Finish with the message that CI/CD is one of the main foundations that enables modern DevOps practices to work efficiently.

---

## 2. Introduction to GitHub Actions

Based on Presentation 8.2

### 2.1 Understanding the Purpose of GitHub Actions

Explain that GitHub Actions is GitHub's built-in automation platform that allows us to automate development and DevOps processes directly from the repository itself. The goal at this stage is not to go too deep technically, but to help students understand that GitHub can react to events and automatically execute operations.

Examples of common operations:

- Running automated tests
- Building applications
- Creating Docker images
- Deploying applications
- Running scheduled automations
- Triggering workflows after Pull Requests or Push events

Emphasize that modern DevOps environments rely heavily on event-driven automation.

---

### 2.2 High-Level Understanding of the GitHub Actions Architecture

Introduce the basic hierarchy of GitHub Actions in a simple and visual way.

Explain the relationship between:

- Workflow
- Job
- Step
- Runner

The goal is not to memorize syntax yet, but to understand the execution flow.

Basic explanation:

- Workflow = the full automation process
- Job = a group of operations running together
- Step = a single action or command
- Runner = the machine that executes the workflow

Emphasize that GitHub Actions eventually executes regular commands on a machine, and the YAML file simply defines what should happen and when.

---

### 2.3 Understanding Events and Workflow Triggers

Explain that workflows do not run randomly. Every workflow listens to specific events inside GitHub.

Common trigger examples:

- `push`
- `pull_request`
- `workflow_dispatch`
- `schedule`

Explain that once the defined event occurs, GitHub scans the repository, detects the workflow file inside `.github/workflows`, and starts the automation process automatically.

---

### 2.4 Short Introduction to GitHub Actions Pricing

Briefly mention that GitHub Actions is free for public repositories and includes limited free usage for private repositories. Explain that organizations usually pay based on runner minutes and storage usage.

There is no need to go deep into billing at this stage.

---

## 3. First Practical Demonstration: Creating the First Workflow

### 3.1 Creating a Basic Repository from the GitHub UI

Start the first live demonstration directly from GitHub without using an IDE yet. The purpose is to simplify the first interaction and show students that GitHub Actions can initially be managed entirely from the browser.

Repository setup:

- Create a new public repository
- Initialize with README
- Suggested name: `gh-first-action`

Explain that at this stage there is intentionally no local project yet.

---

### 3.2 Creating the First Workflow from the Actions Tab

Move into the Actions tab and explain that this is the central place where GitHub manages automation processes.

Demonstrate:

- Creating a new workflow
- Selecting "Set up a workflow yourself"
- Creating the YAML file directly from the browser

Explain that GitHub only recognizes workflow files located under:

```text
.github/workflows/
```

Emphasize that workflows are simply YAML configuration files stored inside the repository like any other file.

---

### 3.3 Writing the First Basic Workflow

Create the first minimal workflow together with the students.

The workflow should:

- Run manually using `workflow_dispatch`
- Contain one job
- Run on `ubuntu-latest`
- Execute simple `echo` commands

Explain the workflow section by section:

- `name`
- `on`
- `jobs`
- `runs-on`
- `steps`
- `run`

The goal is to remove the fear from YAML files and help students understand that GitHub Actions is mostly configuration that executes shell commands.

---

### 3.4 Executing and Monitoring the Workflow

After committing the workflow, move back to the Actions tab and demonstrate how GitHub automatically detects the workflow.

Demonstrate:

- Running the workflow manually
- Viewing execution status
- Opening the job logs
- Viewing the output of every step

Explain that this is one of the most important concepts in CI/CD environments: visibility and observability of automation processes.

Students should understand that:

- Every step produces logs
- Every command can succeed or fail
- GitHub provides full visibility into the execution process

---

### 3.5 Cloning the Repository Locally

After the workflow successfully runs, perform a clone of the repository to the local machine and open it in VS Code.

The goal here is extremely important:

Students need to understand that GitHub Actions workflows are simply regular YAML files stored inside the repository.

Show the students the actual structure:

```text
.github/
+-- workflows/
    +-- first-action.yml
```

Emphasize:

- GitHub Actions is not "magic"
- GitHub scans the repository for YAML files
- The workflows are version controlled like any other file
- Everything eventually becomes configuration + shell commands

This is one of the most important mindset moments in the entire introduction section.

---

### 3.6 Connecting the Idea to Real DevOps Environments

Conclude the practical section by connecting the demonstration to real-world systems.

Explain that in production environments these workflows become much larger and can include:

- Running automated tests
- Installing dependencies
- Building React or Node.js applications
- Creating Docker images
- Deploying applications to cloud environments
- Running security scans
- Triggering deployments only after tests succeed

The goal is to help students understand that they already built the foundation of a real CI/CD pipeline, even if the current workflow is still very simple.

---

## 4. Moving to a Real React Project

Based on Presentation 8.2, Slide 31

### 4.1 Transition from Simple Demo to Real Project

Explain that until now the students worked with a very small workflow whose purpose was mainly understanding the architecture of GitHub Actions. At this stage the goal is to move into a more realistic example that behaves closer to real DevOps environments.

Introduce a simple React application and explain that from this point the workflows will start interacting with actual project dependencies, tests, and build processes.

Emphasize that this is the point where CI, Continuous Integration, starts becoming meaningful.

---

### 4.2 Introducing the React Project Structure

Present the example React project and explain that the project already contains:

- Basic React application
- Standard `package.json` configuration
- Simple UI components
- Unit tests
- Node.js dependency structure

The goal is not to teach React itself, but to use a realistic application as the target for CI/CD processes.

Explain that in real companies GitHub Actions usually interacts with projects exactly like this.

---

### 4.3 Running the Project Locally

Run the project locally together with the students before introducing automation.

Commands demonstrated:

```bash
npm install
npm run dev
```

Explain that before automating systems in CI/CD environments, developers first verify that the application works correctly locally.

Demonstrate:

- Installing dependencies
- Starting the local development server
- Accessing the application in the browser

This stage helps students connect the workflow to an actual working application instead of abstract YAML files.

---

### 4.4 Running the Tests Locally

Run the tests locally before introducing GitHub Actions automation.

Command demonstrated:

```bash
npm test
```

Explain that this is extremely important because GitHub Actions will later execute the exact same commands automatically.

The students should understand:

- CI/CD pipelines are mostly automation of commands developers already run manually
- GitHub Actions is not inventing new logic
- The workflow simply executes the same commands on a remote runner

This is one of the most important concepts in the entire section.

---

### 4.5 Creating the Workflow Structure Locally

Move into the project folder and create the GitHub Actions structure manually.

Required structure:

```text
.github/workflows/
```

Create the first real workflow file:

- `test.yml`

Explain that GitHub only scans workflow files from this exact location.

Emphasize again that GitHub Actions workflows are simply YAML configuration files stored inside the repository.

---

### 4.6 Creating the First Real CI Workflow

Create the first real testing workflow together with the students.

The workflow should:

- Trigger on `push`
- Use `ubuntu-latest`
- Checkout the repository
- Install Node.js
- Install dependencies
- Run tests

Important concepts introduced during this section:

- `actions/checkout`
- `uses` vs `run`
- `npm ci`
- `npm test`

Explain that this is already a real Continuous Integration process.

Every push now automatically verifies that the project still builds and passes tests.

---

### 4.7 Explaining actions/checkout

Pause and explain one of the most important concepts students usually misunderstand.

Explain that until now the workflows only executed `echo` commands, but real workflows require access to the repository code itself.

This is the role of:

- `actions/checkout`

Explain:

- `uses` = using a reusable GitHub Action
- `actions/checkout` = official GitHub action for cloning the repository into the runner
- Without checkout the runner does not have the project files

This is a critical mindset moment because students begin understanding that workflows execute on temporary remote machines.

---

### 4.8 Installing Dependencies in the Workflow

After explaining `actions/checkout`, continue to the next important step: installing the project dependencies inside the GitHub Actions runner.

Explain that the runner is a clean temporary machine. Even though the repository files are now available after checkout, the `node_modules` folder does not exist yet.

This is why the workflow must install dependencies before running tests.

Recommended command for CI:

```bash
npm ci
```

Explain:

- `npm ci` installs dependencies based on `package-lock.json`
- `npm ci` is usually preferred in CI/CD because it is clean and predictable
- Without installing dependencies, commands like `npm test` may fail
- The pipeline should reproduce the same setup every time it runs

Emphasize that this step connects the local development process to automation:

- Locally, developers run `npm install`
- In CI, the workflow usually runs `npm ci`
- After dependencies are installed, the workflow can safely run tests or builds

---

### 4.9 Running Tests in the Workflow

After the dependencies are installed, add the test command to the workflow.

Command used in the workflow:

```bash
npm test
```

Explain that this is the main CI validation step. The workflow is no longer only preparing the project; it is now checking whether the code actually works.

Students should understand:

- Tests run automatically after every push
- If the tests pass, the workflow can continue
- If the tests fail, the workflow stops and marks the pipeline as failed
- This prevents broken code from silently moving forward

Emphasize that this is the core idea of Continuous Integration: every new code change is automatically verified before it is trusted.

---

### 4.10 Executing the Workflow and Viewing the Pipeline

Commit and push the workflow file to GitHub.

Demonstrate how the workflow automatically starts after push.

Inside the Actions tab demonstrate:

- Repository checkout
- Dependency installation
- Test execution
- Successful workflow completion

Explain that students are now watching a real CI pipeline execute automatically.

---

### 4.11 Introducing Workflow Failures

Intentionally break one of the tests inside the React project.

The goal is to demonstrate one of the most important ideas in CI/CD:

A pipeline should fail when the code is broken.

Demonstrate:

- Breaking a test
- Running tests locally
- Committing the broken code
- Push triggering the workflow
- Failed workflow inside GitHub Actions

Open the logs and explain how developers debug pipeline failures in real environments.

---

### 4.12 Adding a Second Job: Deploy

After the test workflow is working, continue by expanding the workflow into a simple CI/CD pipeline with a second job.

Explain that until now the workflow only tested the application. The next step is to add another job that simulates deployment.

Update the workflow:

- Change the workflow name to `Deploy`
- Rename the workflow file from `test.yml` to `deploy.yml`
- Keep the existing test job
- Add a second job for deployment

The new deploy job should:

- Checkout the repository
- Install dependencies using `npm i`
- Build the project using `npm run build`
- Run an `echo` command that simulates deployment

Example deploy steps:

```yaml
deploy:
  runs-on: ubuntu-latest

  steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Install dependencies
      run: npm i

    - name: Build project
      run: npm run build

    - name: Simulate deployment
      run: echo "Deployment"
```

Explain that this is not a real production deployment yet. It is only a simulation that helps students understand the pipeline structure before connecting real servers, Docker, Kubernetes, or cloud providers.

---

### 4.13 Using `needs` Between Jobs

After adding the deploy job, explain an important problem:

By default, jobs can run independently. In a real pipeline, deployment must not happen if tests fail.

Introduce the `needs` keyword.

Example:

```yaml
deploy:
  needs: test
  runs-on: ubuntu-latest
```

Explain:

- `needs: test` means the deploy job depends on the test job
- GitHub Actions will run the deploy job only after the test job succeeds
- If the test job fails, the deploy job will be skipped
- This protects the deployment stage from broken code

Emphasize that this is one of the most important CI/CD rules:

Do not deploy if the validation stage failed.

---

### 4.14 Using Multiple Workflow Triggers

After explaining job dependencies, introduce the idea that a workflow can have more than one trigger.

Until now the workflow ran mainly after a `push`. Add a manual trigger as well so the workflow can be started from the GitHub UI.

Example:

```yaml
on:
  push:
  workflow_dispatch:
```

Explain:

- `push` runs the workflow automatically when code is pushed
- `workflow_dispatch` allows running the workflow manually from the Actions tab
- A workflow can support both automatic and manual execution

This helps students understand that GitHub Actions workflows can react to different events depending on the use case.

---

### 4.15 Introduction to Expressions and GitHub Context

Introduce expressions in GitHub Actions at a very basic level.

Explain that expressions allow the workflow to read dynamic information from GitHub and use it inside jobs and steps.

Basic expression syntax:

```yaml
${{ expression }}
```

Example using the GitHub context:

```yaml
- name: Print branch name
  run: echo "Branch: ${{ github.ref_name }}"
```

Another example:

```yaml
- name: Print commit SHA
  run: echo "Commit: ${{ github.sha }}"
```

Explain:

- `github` is a context object provided by GitHub Actions
- `github.ref_name` contains the branch or tag name
- `github.sha` contains the commit SHA that triggered the workflow
- Expressions make workflows more dynamic and reusable

At this stage, keep the explanation simple. The goal is only to introduce the idea that workflows can use information from the event that triggered them.
