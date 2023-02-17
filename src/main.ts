import { getInput, info, setFailed, setOutput } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { COMMIT_MSG } from "./constants";
import { MergeStatus } from "./interfaces";

async function run(): Promise<void> {
  const mergeStatus: MergeStatus = {
    merged: [],
    alreadyMerged: [],
    failed: [],
  };
  try {
    // Get inputs: token, source, target_glob
    const token: string = getInput("token");
    const source: string = getInput("source");
    const targets: string[] = JSON.parse(getInput("targets"));

    // Init stuff
    const client = getOctokit(token);
    const repository = context.repo;

    for (const target of targets) {
      info(`Attempting to merge '${source}' into '${target}'`);

      // Build merge commit message
      const message = COMMIT_MSG.replace("{source}", source).replace(
        "{target}",
        target
      );

      // Merge source branch to target branch
      try {
        const merge: { status: number } = await client.request(
          "POST /repos/{owner}/{repo}/merges",
          {
            owner: repository.owner,
            repo: repository.repo,
            base: target,
            head: source,
            commit_message: message,
          }
        );

        switch (merge.status) {
          case 201: {
            mergeStatus.merged.push(target);
            break;
          }
          case 204: {
            mergeStatus.alreadyMerged.push(target);
            break;
          }
          default:
            break;
        }
      } catch (error: any) {
        const { data = {} } = error.response || {};
        const { message = `Unknown error occurred: ${error}` } = data;
        info(`Unable to sync branch '${target}': ${message}`);
        mergeStatus.failed.push(target);
      }
    }

    const output = generateOutput(mergeStatus);
    if (mergeStatus.failed.length > 0) setFailed(output);
  } catch (e) {
    const output = generateOutput(mergeStatus);
    setFailed(`
    Unable to sync branches due to an unexpected error:
    ${e}
    -
    ${output}
    `);
  }
}

function generateOutput(status: MergeStatus): string {
  const output = JSON.stringify(status, null, 2);
  info(output);
  setOutput("MERGE_STATUS", output);
  return output;
}

run();
