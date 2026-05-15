import { useState } from 'react'
import './App.css'

const MODULES = [
  {
    id: 'what',
    title: '1 · What is an artifact?',
    summary: 'Files a job keeps after it finishes',
    body: (
      <>
        <p>
          An artifact is any set of files a workflow job produces and stores so
          it outlives the runner — <code>dist/</code>, coverage reports, logs, a
          compiled binary.
        </p>
        <p>
          The runner is destroyed when the job ends. Without an artifact, that
          output is gone.
        </p>
      </>
    ),
  },
  {
    id: 'upload',
    title: '2 · Uploading',
    summary: 'actions/upload-artifact stores the files',
    body: (
      <>
        <p>Add a step after the build that names and uploads a path:</p>
        <pre>
          {`- uses: actions/upload-artifact@v4
  with:
    name: build-output
    path: dist/`}
        </pre>
        <p>The zip is attached to the workflow run.</p>
      </>
    ),
  },
  {
    id: 'download',
    title: '3 · Downloading in another job',
    summary: 'A later job pulls them with the same name',
    body: (
      <>
        <p>
          A dependent job restores the files with the exact name used on upload:
        </p>
        <pre>
          {`- uses: actions/download-artifact@v4
  with:
    name: build-output`}
        </pre>
        <p>
          Name mismatch is the most common failure — it errors, it does not warn.
        </p>
      </>
    ),
  },
  {
    id: 'retain',
    title: '4 · Retention & cleanup',
    summary: 'Default 90 days — lower it to save storage',
    body: (
      <>
        <p>
          GitHub keeps artifacts for the retention window then prunes them. Set{' '}
          <code>retention-days</code> on the upload step to shrink storage cost.
        </p>
        <p>Artifacts also count against repo/org storage quotas.</p>
      </>
    ),
  },
]

const LINKS = [
  {
    label: 'Artifacts docs',
    href: 'https://docs.github.com/actions/using-workflows/storing-workflow-data-as-artifacts',
  },
  { label: 'upload-artifact', href: 'https://github.com/actions/upload-artifact' },
  {
    label: 'download-artifact',
    href: 'https://github.com/actions/download-artifact',
  },
]

function App() {
  const [open, setOpen] = useState('what')

  const toggle = (id) => setOpen((cur) => (cur === id ? null : id))

  return (
    <>
      <section id="center">
        <div className="artifact-mark" role="presentation" aria-hidden="true">
          <span className="box" />
          <span className="arrow up" />
          <span className="arrow down" />
        </div>
        <div>
          <h1>Understanding Artifacts</h1>
          <p className="lede">
            A short lesson on how GitHub Actions jobs hand build output to each
            other with <code>upload-artifact</code> and{' '}
            <code>download-artifact</code>.
          </p>
        </div>
      </section>

      <div className="ticks"></div>

      <section id="lesson">
        <h2>The lesson</h2>
        <p className="hint">Click a section to expand it</p>
        <div className="accordion">
          {MODULES.map((m) => {
            const isOpen = open === m.id
            return (
              <div
                key={m.id}
                className={`acc-item${isOpen ? ' open' : ''}`}
              >
                <button
                  type="button"
                  className="acc-head"
                  aria-expanded={isOpen}
                  onClick={() => toggle(m.id)}
                >
                  <span>
                    <strong>{m.title}</strong>
                    <span className="acc-sum">{m.summary}</span>
                  </span>
                  <span className="chevron" aria-hidden="true" />
                </button>
                {isOpen && <div className="acc-body">{m.body}</div>}
              </div>
            )
          })}
        </div>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <h2>Reference</h2>
          <p>The actions and docs you actually need</p>
          <ul>
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} target="_blank" rel="noreferrer">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}

export default App
