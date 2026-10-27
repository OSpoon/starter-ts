import { access, mkdir, mkdtemp, readdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'
import { cancel, group, intro, log, outro, tasks, text } from '@clack/prompts'
import pc from 'picocolors'

interface PackageAuthor {
  name: string
  url?: string
}

interface PackageJson {
  name: string
  description: string
  author?: PackageAuthor | string
  repository?: { type: string, url: string }
  homepage?: string
  bugs?: { url: string }
  funding?: string
}

function parseGitHubUrl(value: string) {
  try {
    const url = new URL(value)
    const parts = url.pathname.replace(/\.git$/, '').split('/').filter(Boolean)
    if (url.protocol === 'https:' && url.hostname === 'github.com' && !url.username && !url.password && !url.port && !url.search && !url.hash && parts.length === 2 && /^[\w-]+$/.test(parts[0]) && !parts[0].includes('_') && /^[\w.-]+$/.test(parts[1]))
      return { owner: parts[0], name: parts[1] }
  }
  catch {
    return undefined
  }
}

function getGitHubUsername(value?: string) {
  return value?.match(/^https:\/\/github\.com\/([\w-]+)\/?$/)?.[1]
}

const root = process.cwd()
const packagePath = join(root, 'package.json')
const pkg = JSON.parse(await readFile(packagePath, 'utf8')) as PackageJson
const readmePath = join(root, 'README.md')
const currentReadme = await readFile(readmePath, 'utf8')
const previousName = pkg.name
const previousDescription = pkg.description
const previousRepo = pkg.repository?.url?.replace(/^git\+/, '').replace(/\.git$/, '') ?? 'https://github.com/OSpoon/pkg-placeholder'
const previousRepoInfo = parseGitHubUrl(previousRepo)
const previousRepoPath = previousRepoInfo ? `${previousRepoInfo.owner}/${previousRepoInfo.name}` : 'OSpoon/pkg-placeholder'
const currentAuthor = typeof pkg.author === 'object' ? pkg.author : undefined
const defaultGithubUsername = getGitHubUsername(currentAuthor?.url) ?? 'OSpoon'
const defaultWebsite = currentReadme.match(/\[Website\]\((https?:\/\/[^)]+)\)/)?.[1] ?? (currentReadme.includes('## Maintainer') ? '' : 'https://ospoon.cn')
const suggestedName = basename(root).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[._-]+/, '') || 'my-package'
const initialName = pkg.name === 'pkg-placeholder' ? suggestedName : pkg.name
const initialDescription = pkg.description === '_description_' ? '' : pkg.description
const initialRepository = pkg.name === 'pkg-placeholder' ? undefined : previousRepo

const RESET = '\x1B[0m'
const LOGO_LINES = [
  '███████╗████████╗ █████╗ ██████╗ ████████╗███████╗██████╗',
  '██╔════╝╚══██╔══╝██╔══██╗██╔══██╗╚══██╔══╝██╔════╝██╔══██╗',
  '███████╗   ██║   ███████║██████╔╝   ██║   █████╗  ██████╔╝',
  '╚════██║   ██║   ██╔══██║██╔══██╗   ██║   ██╔══╝  ██╔══██╗',
  '███████║   ██║   ██║  ██║██║  ██║   ██║   ███████╗██║  ██║',
  '╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝',
]
const GRAYS = ['\x1B[38;5;250m', '\x1B[38;5;248m', '\x1B[38;5;245m', '\x1B[38;5;243m', '\x1B[38;5;240m', '\x1B[38;5;238m']

function showLogo() {
  console.log()
  LOGO_LINES.forEach((line, i) => {
    console.log(pc.isColorSupported ? `${GRAYS[i]}${line}${RESET}` : line)
  })
}

if (process.stdout.isTTY && !process.env.CI)
  showLogo()

intro(pc.bgCyan(pc.black(' starter-ts ')))
log.info(`${pc.dim('Default maintainer:')} ${currentAuthor?.name ?? '小鑫同学'} (@${defaultGithubUsername})${defaultWebsite ? ` · ${defaultWebsite}` : ''}`)

const answers = await group({
  name: () => text({
    message: 'Package name',
    initialValue: initialName,
    validate: value => !value || value.length > 214 || !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value) || value.endsWith('.')
      ? 'Enter a valid npm package name.'
      : undefined,
  }),
  description: () => text({
    message: 'Package description',
    initialValue: initialDescription,
    placeholder: 'A short description',
    validate: value => value?.trim() ? undefined : 'Description is required.',
  }),
  author: () => text({
    message: 'Author name',
    initialValue: currentAuthor?.name ?? '小鑫同学',
    validate: value => value?.trim() && !value.includes('[') && !value.includes(']') && !value.includes('\\') ? undefined : 'Enter an author name without brackets or backslashes.',
  }),
  githubUsername: () => text({
    message: 'GitHub username',
    initialValue: defaultGithubUsername,
    validate: value => value && value.length <= 39 && /^\w+(?:-\w+)*$/.test(value) && !value.includes('_') ? undefined : 'Enter a valid GitHub username.',
  }),
  website: () => text({
    message: 'Personal website (optional)',
    initialValue: defaultWebsite,
    validate(value) {
      if (!value?.trim())
        return
      try {
        const url = new URL(value)
        if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password)
          return
      }
      catch {
        return 'Enter a valid http or https URL, or leave it blank.'
      }
      return 'Enter a valid http or https URL, or leave it blank.'
    },
  }),
  repository: () => text({
    message: 'GitHub repository URL',
    initialValue: initialRepository ?? `https://github.com/${defaultGithubUsername}/${initialName.split('/').at(-1)}`,
    placeholder: 'https://github.com/owner/repo',
    validate: value => value && parseGitHubUrl(value) ? undefined : 'Enter a GitHub repository URL in https://github.com/owner/repo format.',
  }),
}, {
  onCancel() {
    cancel('Initialization cancelled; no files were changed.')
    process.exit(0)
  },
})

const name = answers.name!
const description = answers.description!
const author = answers.author!
const githubUsername = answers.githubUsername!
const website = answers.website!
const repositoryInput = answers.repository!
const repository = parseGitHubUrl(repositoryInput)!
const repositoryUrl = `https://github.com/${repository.owner}/${repository.name}`
const repositoryPath = `${repository.owner}/${repository.name}`
const githubProfile = `https://github.com/${githubUsername}`
const authorNameMarkdown = author.trim().replaceAll('[', '\\[').replaceAll(']', '\\]')
const websiteUrl = website.trim().replaceAll('(', '%28').replaceAll(')', '%29')
const snapshotsRoot = join(root, 'test/__snapshots__/tsnapi')
const oldSnapshots = join(snapshotsRoot, previousName)
const newSnapshots = join(snapshotsRoot, name)
const snapshotFiles = ['index.snapshot.js', 'index.snapshot.d.ts']
let reuseExistingSnapshots = false
let removeEmptySnapshotTarget = false

if (oldSnapshots !== newSnapshots) {
  let existingFiles: string[] | undefined
  try {
    existingFiles = await readdir(newSnapshots)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw error
  }
  if (existingFiles) {
    if (existingFiles.length === 0) {
      removeEmptySnapshotTarget = true
    }
    else if (snapshotFiles.every(file => existingFiles.includes(file))) {
      reuseExistingSnapshots = true
    }
    else {
      log.error(`Snapshot directory is incomplete; kept it unchanged: ${newSnapshots}`)
      process.exit(1)
    }
  }
}
if (!reuseExistingSnapshots) {
  try {
    await access(oldSnapshots)
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      log.error(`API snapshots not found: ${oldSnapshots}`)
      process.exit(1)
    }
    throw error
  }
}

const snapshotSource = reuseExistingSnapshots ? newSnapshots : oldSnapshots
const snapshotContents = await Promise.all(snapshotFiles.map(async (file) => {
  const content = await readFile(join(snapshotSource, file), 'utf8')
  return { file, content: content.replaceAll(previousName, name) }
}))

pkg.name = name
pkg.description = description.trim()
pkg.author = { name: author.trim(), url: githubProfile }
pkg.funding = `https://github.com/sponsors/${githubUsername}`
pkg.repository = { type: 'git', url: `git+${repositoryUrl}.git` }
pkg.homepage = `${repositoryUrl}#readme`
pkg.bugs = { url: `${repositoryUrl}/issues` }

const maintainer = `## Maintainer\n\n[${authorNameMarkdown} (${githubUsername})](${githubProfile})${websiteUrl ? ` · [Website](${websiteUrl})` : ''}`
const sponsors = `## Sponsors\n\n<p align="center">\n  <a href="https://github.com/sponsors/${githubUsername}">\n    <img src="https://img.shields.io/github/sponsors/${githubUsername}?style=flat" alt="GitHub Sponsors"/>\n  </a>\n</p>\n\n`
let readme = currentReadme
  .replaceAll(previousRepo, repositoryUrl)
  .replaceAll(previousRepoPath, repositoryPath)
  .replaceAll(previousName, name)
  .replace(/^# .+$/m, `# ${name}`)
  .replace(previousDescription === '_description_' ? '_description_' : previousDescription, () => description.trim())
  .replace(/## Sponsors\n[\s\S]*?(?=## License)/, sponsors)
  .replace(/^\[MIT\]\(\.\/LICENSE(?:\.md)?\) License © .+$/m, `[MIT](./LICENSE.md) License © [Anthony Fu](https://github.com/antfu) and [${authorNameMarkdown}](https://github.com/${githubUsername})`)
if (/## Maintainer\n[\s\S]*?(?=## Initialize)/.test(readme))
  readme = readme.replace(/## Maintainer\n[\s\S]*?(?=## Initialize)/, `${maintainer}\n\n`)
else
  readme = readme.replace('## Initialize', `${maintainer}\n\n## Initialize`)
readme = readme.replace('[MIT](./LICENSE)', '[MIT](./LICENSE.md)')

const licensePath = join(root, 'LICENSE.md')
const licenseLines = (await readFile(licensePath, 'utf8')).split('\n')
const upstreamCopyright = licenseLines.findIndex(line => line.startsWith('Copyright (c) 2025-PRESENT Anthony Fu'))
const authorCopyright = licenseLines.findIndex((line, index) => index > upstreamCopyright && line.startsWith('Copyright (c)'))
const newCopyright = `Copyright (c) ${new Date().getFullYear()} ${author.trim()} <${githubProfile}>`
if (authorCopyright >= 0)
  licenseLines[authorCopyright] = newCopyright
else
  licenseLines.splice(upstreamCopyright + 1, 0, '', newCopyright)

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'starter-ts-init-'))
const fileContents: Array<[string, string]> = [
  [packagePath, `${JSON.stringify(pkg, null, 2)}\n`],
  [readmePath, readme],
  [join(root, '.github/FUNDING.yml'), `github: [${githubUsername}]\n`],
  [licensePath, licenseLines.join('\n')],
  ...snapshotContents.map(({ file, content }): [string, string] => [join(newSnapshots, file), content]),
]
const fileUpdates = fileContents.map(([path, content], index) => ({
  path,
  content,
  stagePath: join(temporaryDirectory, `${index}.new`),
  backupPath: join(temporaryDirectory, `${index}.bak`),
}))
const [packageUpdate, readmeUpdate, fundingUpdate, licenseUpdate, ...snapshotUpdates] = fileUpdates
const fileBackups: Array<{ path: string, backup?: string }> = []
let snapshotsMoved = false
let emptySnapshotBackup: string | undefined

// shortcut: abrupt process termination can interrupt this transaction; add a persistent journal if crash recovery is required.
try {
  const temporaryDevice = (await stat(temporaryDirectory)).dev
  for (const directory of [root, join(root, '.github'), snapshotsRoot]) {
    if ((await stat(directory)).dev !== temporaryDevice)
      throw new Error('System temporary directory and project files must share a filesystem for safe initialization.')
  }
  for (const update of fileUpdates) {
    await writeFile(update.stagePath, update.content, { flag: 'wx' })
    if (await readFile(update.stagePath, 'utf8') !== update.content)
      throw new Error(`Temporary file verification failed: ${update.stagePath}`)
  }
}
catch (error) {
  try {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
  catch (cleanupError) {
    throw new AggregateError([error, cleanupError], 'File staging failed and temporary files could not be fully removed.')
  }
  throw error
}

async function updateFile(update: typeof fileUpdates[number]) {
  const { path, stagePath, backupPath: backupFilePath } = update
  let backup: string | undefined
  try {
    await rename(path, backupFilePath)
    backup = backupFilePath
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw error
  }
  fileBackups.push({ path, backup })
  await rename(stagePath, path)
}

log.info(`${pc.dim('Project:')} ${name} · ${repositoryPath}`)

try {
  await tasks([
    {
      title: 'Package metadata',
      task: async () => {
        await updateFile(packageUpdate)
        return 'Updated package.json'
      },
    },
    {
      title: 'Project documentation',
      task: async () => {
        await updateFile(readmeUpdate)
        await updateFile(fundingUpdate)
        await updateFile(licenseUpdate)
        return 'Updated README, funding, and license details'
      },
    },
    {
      title: 'API snapshots',
      task: async () => {
        if (oldSnapshots !== newSnapshots && !reuseExistingSnapshots) {
          if (removeEmptySnapshotTarget) {
            emptySnapshotBackup = join(temporaryDirectory, 'empty-snapshots')
            await rename(newSnapshots, emptySnapshotBackup)
          }
          await mkdir(dirname(newSnapshots), { recursive: true })
          await rename(oldSnapshots, newSnapshots)
          snapshotsMoved = true
        }
        for (const update of snapshotUpdates)
          await updateFile(update)
        return reuseExistingSnapshots ? `Reused snapshots for ${name}` : `Updated snapshots for ${name}`
      },
    },
  ])
}
catch (error) {
  const rollbackErrors: unknown[] = []
  for (const { path, backup } of fileBackups.reverse()) {
    try {
      await unlink(path)
    }
    catch (rollbackError) {
      if ((rollbackError as NodeJS.ErrnoException).code !== 'ENOENT')
        rollbackErrors.push(rollbackError)
    }
    if (backup) {
      try {
        await rename(backup, path)
      }
      catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
    }
  }
  if (snapshotsMoved) {
    try {
      await rename(newSnapshots, oldSnapshots)
    }
    catch (rollbackError) {
      rollbackErrors.push(rollbackError)
    }
  }
  if (emptySnapshotBackup) {
    try {
      await rename(emptySnapshotBackup, newSnapshots)
    }
    catch (rollbackError) {
      rollbackErrors.push(rollbackError)
    }
  }
  if (rollbackErrors.length)
    throw new AggregateError([error, ...rollbackErrors], `Initialization rollback was incomplete; recovery files remain in ${temporaryDirectory}.`)
  try {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
  catch (cleanupError) {
    throw new AggregateError([error, cleanupError], `Initialization rolled back, but temporary files remain in ${temporaryDirectory}.`)
  }
  throw error
}

try {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
catch {
  log.warn(`Project is ready, but temporary recovery files remain in ${temporaryDirectory}.`)
}

outro(`${name} is ready`)
