# Jenkins Course Labs

Hands-on labs for each topic in `transcript_chunks/`, actually built and run end-to-end against a
real local Jenkins (Docker) + Docker Cloud agent setup — not just written instructions.

## Layout

```
labs/
  01_intro_theory/
    README.md                     theory only — nothing to run
  02_install_jenkins/
    README.md
    Dockerfile                    Jenkins master image
    plugins.txt                   plugins baked into the master
    scripts/01_build_images.sh    builds master + both agent images
    scripts/02_network.sh         creates the jenkins-lab docker network
    scripts/03_run.sh             runs the master container
    scripts/_session.sh           auth/crumb helper for the curl calls in later labs
  03_freestyle_projects/
    README.md
    my_first_job.xml              freestyle job: hello world + env vars
    my_python_job.xml             freestyle job: clone repo, run helloworld.py
  04_agents_docker_cloud/
    README.md
    Dockerfile.agent-alpine       plain agent image (label docker-agent-alpine)
    Dockerfile.agent-python       agent image with python3/pip (label docker-agent-python)
    jenkins.yaml                  Configuration-as-Code: admin user + docker cloud + templates
  05_pipelines_jenkinsfile/
    README.md
    my_first_build_pipeline.xml   pipeline job pointing at repo/Jenkinsfile
  06_blue_ocean/
    README.md

  repo/       fixture git repo the jobs clone from (file:///repo) — shared across labs 03/05
```

Each numbered folder's README explains that lab's slice of the transcript and includes the actual
verified output from running it — not just what's supposed to happen. The only shared piece is
`repo/`, since one git fixture serves both the freestyle and pipeline jobs.

The `repo/` fixture is synced from `jenkins-101-master/` at the repo root, which is the
instructor's real companion repo for this course (added after the labs were first scaffolded) —
`myapp/hello.py`, `helloworld.py`, and `Jenkinsfile` all match that source, with two intentional
deviations documented in Lab 05's README (a `pipes`-module Python compat fix and a git
safe-directory fix), both being environment quirks of running this in 2026 rather than mistakes in
the original material.

## Running it yourself

```bash
cd labs
bash 02_install_jenkins/scripts/01_build_images.sh
bash 02_install_jenkins/scripts/02_network.sh
bash 02_install_jenkins/scripts/03_run.sh
# wait for http://localhost:8081/login to return 200, then:
source 02_install_jenkins/scripts/_session.sh   # sets $JENKINS_URL, $AUTH, $COOKIE_JAR, $CRUMB_HEADER
```

From there, each lab README shows the exact `curl` calls used to create/trigger its job(s).

## What's verified, end to end

- **Lab 02**: image builds, network, container boots, CasC applies (admin/admin, no manual unlock).
- **Lab 03**: both freestyle jobs built successfully on real docker agents.
- **Lab 04**: Docker cloud + both agent templates provisioned real, throwaway containers per build.
- **Lab 05**: full declarative pipeline (Build/Test/Deliver) green, including the fixture repo's
  fire-based CLI app; pollSCM auto-triggered a build on a new commit, unprompted.
- **Lab 06**: Blue Ocean REST API confirms the same three green stages.

## Cleaning up

```bash
docker rm -f jenkins-lab
docker volume rm jenkins-lab-home   # only if you want to wipe all job history/config too
docker network rm jenkins-lab
```

The lab container (`jenkins-lab`) is currently left running on `http://localhost:8081` — stop/remove
it with the above whenever you're done poking at it.
