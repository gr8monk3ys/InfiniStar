/* global process */

import { existsSync } from "node:fs"
import { spawnSync } from "node:child_process"

if (!existsSync(".git")) {
  process.exit(0)
}

const huskyBin =
  process.platform === "win32" ? ".\\node_modules\\.bin\\husky.cmd" : "./node_modules/.bin/husky"

const result = spawnSync(huskyBin, { stdio: "inherit" })

if (result.error) {
  throw result.error
}

process.exit(result.status ?? 0)
