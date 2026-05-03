import * as cp from 'child_process';
import * as util from 'util';

const exec = util.promisify(cp.exec);

export class GitService {

    /**
     * Checks if a local git repo is behind the remote.
     * Returns true if update is available.
     */
    public async checkUpdateAvailable(repoPath: string): Promise<boolean> {
        try {
            // git fetch --dry-run returns status code 0 if success
            // We need to compare HEAD vs @{u}
            const { stdout } = await exec('git fetch origin && git status -uno', { cwd: repoPath });
            return stdout.includes('Your branch is behind');
        } catch (error) {
            console.error(`Git check failed for ${repoPath}:`, error);
            return false;
        }
    }

    /**
     * Clones a repo to a target directory.
     */
    public async cloneRepo(url: string, targetPath: string): Promise<void> {
        await exec(`git clone "${url}" "${targetPath}"`);
    }

    /**
     * Pulls latest changes.
     */
    public async pullRepo(repoPath: string): Promise<void> {
        await exec('git pull', { cwd: repoPath });
    }
}
