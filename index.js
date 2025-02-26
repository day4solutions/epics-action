import * as core from '@actions/core';
import * as github from '@actions/github';

async function getReferencedEpics({ octokit }) {
  const epicLabelName = core.getInput('epic-label-name', { required: true });

  if (github.context.payload.action !== 'deleted') {
    const events = await octokit.issues.listEventsForTimeline({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: github.context.payload.issue.number,
    });

    return events.data
      .filter((item) => item.event === 'cross-referenced' && item.source)
      .filter(
        (item) => item.source.issue.labels.filter(
          (label) => label.name.toLowerCase() === epicLabelName.toLowerCase(),
        ).length > 0,
      );
  }

  return [];
}

async function updateEpic({ octokit, epic }) {
  const issueNumber = github.context.payload.issue.number;
  const epicNumber = epic.source.issue.number;
  const epicBody = epic.source.issue.body;

  const pattern = new RegExp(`- \\[[ x]\\] .*#${issueNumber}.*`, 'gm');
  const matches = Array.from(epicBody.matchAll(pattern));

  const patternAll = new RegExp('- \\[[ x]\\] .*#.*', 'gm');
  const patternAllDone = new RegExp('- \\[[x]\\] .*#.*', 'gm');
  const matchesAll = Array.from(epicBody.matchAll(patternAll));
  const matchesAllDone = Array.from(epicBody.matchAll(patternAllDone));

  const epicState = (() => {
    if (
      matches.length
      && matchesAll.length
      && matchesAllDone.length
      && matchesAllDone.length === matchesAll.length
    ) {
      return 'closed';
    }
    return 'open';
  })();

  const result = await octokit.issues.update({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: epicNumber,
    body: epicBody,
    state: epicState,
  });

  return result;
}

async function updateEpics({ octokit, epics }) {
  return Promise.all(epics.map((epic) => updateEpic({ octokit, epic })));
}

async function run() {
  try {
    const token = core.getInput('github-token', { required: true });

    const octokit = new github.GitHub(token, {
      previews: ['mockingbird-preview'],
    });

    const epics = await getReferencedEpics({ octokit });
    await updateEpics({ octokit, epics });
  } catch (error) {
    core.error(error);
    core.setFailed(error.message);
  }
}

run();
