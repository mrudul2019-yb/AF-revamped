import simpleGit, {SimpleGit, SimpleGitOptions} from 'simple-git';
import * as vscode from 'vscode';

/**
 * Class handling all git activites.
 */
export class GitHandler {

    /** git object created using simpleGit package.*/
    private git: SimpleGit;

    /**
     * 
     * @param basePath Path relative to which git commands are to be run.
     */
    constructor(basePath: string){
        let options: Partial<SimpleGitOptions> = {
            baseDir: basePath,
            binary: 'git',
            maxConcurrentProcesses: 6,
         };
        this.git = simpleGit(options);

    }

    /**
     * Pushes the commit to 'origin'
     */
    async submitProgress(): Promise<any>;
    /**
     * Constructs the link using username, token and repository name so as to push without prompting the user.
     * 
     * Deprecated after moving to github classroom.
     * @param username github username
     * @param token Access Token for pushing to repository
     */
    async submitProgress(username:string, token: string): Promise<any>;

    async submitProgress(username?:string, token?: string){
        try{
            if(token && username){
                let authRemote: string;
                let repoName: string|undefined = await this.getRepoName();            

                if(repoName !== undefined){
                    authRemote = `https://${username}:${token}@github.com/${username}/${repoName}`;
                    return await this.git.push([authRemote, '-u']);
                }
                else vscode.window.showErrorMessage('Failed to get reponame');
            }
            else{
                return await this.git.push(['origin'])
            }
        }
        catch(err){
            throw(err);
        }
    }

    /**
     * Commits everything present in the folder.
     */
    async saveProgress(){
        try{
            await this.git.add('*').commit('Saving Progress');
            // vscode.window.showInformationMessage('progress saved');
        }
        catch(err){
            throw(err);
        }
    }

    /**
     * 
     * @ignore
     * Deprecated after moving to github classroom.
     */
    async getRepoName(){
        try{
            let reponame: string|undefined;
            let remotelink = await this.git.getConfig('remote.origin.url');

            if(remotelink.value !== null){
                reponame = remotelink.value.split('/').pop();
                console.log(reponame);
                if(reponame !== undefined && reponame.substr(-4) === '.git')reponame = reponame.substr(0, reponame.length - 4);
                console.log(reponame);
                
                return reponame;
            }
        }
        catch(err){
            throw{err};
        }

    }
}